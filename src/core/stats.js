// 匿名使用统计（可在设置里关闭）。格式见 shared/stats.js：
// 每天最多发一次"今天用了"，附带前一天用到了哪些功能；没有编号、时间、位置，后台只加总数。
// 出错时匿名报告错误信息（每天最多 3 条），帮助我们发现问题。
import { load, save } from './storage.js';
import { apiBase, QUIET, APP_VERSION, platform } from './api.js';
import { featureOf } from '../../shared/stats.js';

let enabled = () => false;
/** main.js 设置：是否允许统计（用户设置 + 远程开关） */
export function setStatsGate(fn) {
  enabled = fn;
}

/** 记下今天用到了某个功能（只存在本机，第二天随统计一起发送） */
export function markUse(path, todayKey) {
  const f = featureOf(path);
  if (!f) return;
  markFeature(f, todayKey);
}
export function markFeature(f, todayKey) {
  const u = load('use', null);
  const cur = u && u.day === todayKey ? u : { day: todayKey, f: [] };
  if (!cur.f.includes(f)) {
    cur.f.push(f);
    save('use', cur);
  }
}

function post(path, body) {
  return fetch(apiBase() + path, { ...QUIET, method: 'POST', keepalive: true, headers: { 'content-type': 'text/plain' }, body: JSON.stringify(body) });
}

/**
 * 今天第一次打开时发一次。
 * @param city     当前城市（"我的位置"只报最近的城市编号）
 * @param lang     界面语言
 * @param todayKey 当地日期 YYYY-MM-DD
 */
export async function sendDaily(city, lang, todayKey) {
  if (!apiBase() || !enabled()) return false;
  if (load('statSent', '') === todayKey) return false;
  const u = load('use', null);
  const prev = u && u.day < todayKey ? u : null;
  const body = { v: APP_VERSION, p: platform(), l: lang, c: city.id === 'here' ? city.near : city.id };
  if (prev && prev.f.length) Object.assign(body, { f: prev.f, fd: prev.day });
  save('statSent', todayKey); // 先记下，避免网络慢时重复发送
  try {
    const r = await post('/hit', body);
    if (prev) save('use', { day: todayKey, f: [] });
    return r.ok;
  } catch (e) {
    return false;
  }
}

/** 匿名错误报告：只有错误信息和出错的文件、行号 */
export function reportError(message, where, todayKey) {
  if (!apiBase() || !enabled()) return;
  const e = load('errSent', null);
  const cur = e && e.day === todayKey ? e : { day: todayKey, list: [] };
  const m = String(message || '').slice(0, 160);
  if (!m || cur.list.length >= 3 || cur.list.includes(m)) return;
  cur.list.push(m);
  save('errSent', cur);
  const s = String(where || '').split('/').pop().slice(0, 80);
  post('/err', { v: APP_VERSION, p: platform(), m, s }).catch(() => {});
}
