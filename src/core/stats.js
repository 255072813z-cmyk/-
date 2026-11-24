// 匿名使用统计（设置里可关；隐私说明里写明）。格式见 shared/stats.js。
//
// 离线优先：每个使用日在手机上记一条，先放进本机的待发队列；有网时（打开应用、回到前台、网络恢复）自动补传。
// 一条里只有当天用没用、版本、语言、城市、哪周第一次打开等，没有编号、具体时间和位置；后台只加总数。
// 出错时匿名报告错误信息（每天最多 3 条），同样先排队。
import { load, save } from './storage.js';
import { apiBase, QUIET, APP_VERSION, platform } from './api.js';
import { weekOf } from '../../shared/stats.js';
import { prayedCount } from './prayed.js';

const QUEUE_MAX = 60; // 最多攒 60 条（约两个月没联网）
import { statsOn as enabled } from './gates.js';
export { setStatsGate } from './gates.js';

export { markUse, markFeature, markGuideDone } from './usage.js';

/** 第一次打开的日期和来源（只用来算"第几周的新用户还在用"，不是编号） */
function install(todayKey) {
  let i = load('install', null);
  // 手机日期曾经错乱（第一次打开记成了"未来"）时，以今天为准
  if (i && typeof i.day === 'string' && i.day > todayKey) {
    i = { day: todayKey, src: i.src };
    save('install', i);
  }
  if (!i || typeof i.day !== 'string') {
    let src = platform() === 'web' ? 'direct' : 'app';
    // 从别人分享的链接打开（链接里带 ref=share）
    if (/[?&]ref=share\b/.test(typeof location !== 'undefined' ? location.search || '' : '')) src = 'share';
    i = { day: todayKey, src, fresh: true };
    save('install', { day: i.day, src: i.src });
  }
  return i;
}

/** 最近使用的日子（只存在本机，用来算"最近 7 天用了几天"） */
function activeDays(todayKey) {
  const list = load('act', []);
  const arr = Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  if (!arr.includes(todayKey)) arr.push(todayKey);
  const keep = arr.sort().slice(-14);
  save('act', keep);
  const from = new Date(Date.parse(todayKey + 'T00:00:00Z') - 6 * 864e5).toISOString().slice(0, 10);
  return keep.filter((d) => d >= from && d <= todayKey).length;
}

const queue = (k) => (Array.isArray(load(k, [])) ? load(k, []) : []);

/**
 * 每个使用日第一次打开时调用：把今天这一条放进待发队列（没网也记），然后试着发送。
 * @param ctx  { city, lang, todayKey, fontScale, notifyOn }
 */
export function recordDay({ city, lang, todayKey, fontScale, notifyOn }) {
  if (!enabled()) {
    save('statq', []); // 关掉统计时，没发出去的也一并丢掉
    return;
  }
  if (!todayKey || load('statDay', '') === todayKey) return;
  const ins = install(todayKey);
  const prev = load('use', null);
  const body = {
    d: todayKey,
    v: APP_VERSION,
    p: platform(),
    l: lang,
    c: city.id === 'here' ? city.near : city.id,
    iw: weekOf(ins.day),
    ad: activeDays(todayKey),
    fs: Number(fontScale) || 0,
  };
  if (notifyOn != null) body.ntf = notifyOn ? 1 : 0;
  if (ins.fresh) Object.assign(body, { nw: 1, src: ins.src });
  if (prev && typeof prev.day === 'string' && prev.day < todayKey) {
    Object.assign(body, { fd: prev.day, f: Array.isArray(prev.f) ? prev.f : [], pk: prayedCount(prev.day), gd: Number(prev.gd) || 0 });
    save('use', { day: todayKey, f: [], gd: 0 });
  }
  save('statq', [...queue('statq'), body].slice(-QUEUE_MAX));
  save('statDay', todayKey);
  flushStats();
}

let inflight = null;
/** 把攒着的发出去（没网、后台没设置、被关掉时什么也不做）；正在发送时返回同一个任务 */
export function flushStats() {
  if (inflight) return inflight;
  if (!apiBase() || !enabled()) return Promise.resolve();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve();
  inflight = (async () => {
    for (const [key, path] of [
      ['statq', '/hit'],
      ['errq', '/err'],
    ]) {
      let q = queue(key);
      while (q.length) {
        const r = await post(path, q[0]);
        // 发成功或被后台拒收（格式不对、太旧）都从队列去掉；网络错误、限流、服务器出错时留着下次再发
        if (!r || r.status === 429 || r.status >= 500) break;
        q = q.slice(1);
        save(key, q);
      }
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

function post(path, body) {
  return fetch(apiBase() + path, { ...QUIET, method: 'POST', keepalive: true, headers: { 'content-type': 'text/plain' }, body: JSON.stringify(body) }).catch(() => null);
}

/** 匿名错误报告：只有错误信息和出错的文件、行号；先排队，有网时发送 */
export function reportError(message, where, todayKey) {
  if (!enabled()) return;
  const e = load('errSent', null);
  const cur = e && e.day === todayKey ? e : { day: todayKey, list: [] };
  const m = String(message || '').slice(0, 160);
  if (!m || cur.list.length >= 3 || cur.list.includes(m)) return;
  cur.list.push(m);
  save('errSent', cur);
  const s = String(where || '').split('/').pop().slice(0, 80);
  save('errq', [...queue('errq'), { v: APP_VERSION, p: platform(), m, s }].slice(-10));
  flushStats();
}
