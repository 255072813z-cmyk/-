// 远程配置：管理员在后台发布、用私钥签名；手机上用内置公钥验证签名后才使用。
// 没有设置后台地址或公钥时，一切按默认（离线可用，不依赖后台）。
// 能控制的只有这些：公告文字、官方时间校正（必须写明来源）、伊斯兰历按当地宣布调整、功能开关、提示更新。
import { load, save } from './storage.js';
import { apiBase, QUIET, APP_VERSION } from './api.js';
import { sanitizeConfig, verifyEnvelope, cmpVersion, PRAYERS } from '../../shared/remote-config.js';
import { CITY_DATA } from '../content/cities-data.js';

const CITY_IDS = CITY_DATA.map((c) => c.id);
const REFRESH_MS = 6 * 3600e3; // 最多每 6 小时问一次后台
const EMPTY = { v: 1, issued: '', notices: [], cityOffsets: {}, hijri: {}, flags: {}, minVersion: null, store: {} };

function publicKey() {
  const raw = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_CONFIG_PUBKEY : '';
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function remoteEnabled() {
  return !!apiBase() && !!publicKey() && typeof crypto !== 'undefined' && !!crypto.subtle;
}

/** 本机保存的、已验证过的配置 */
export function cachedRemote() {
  const c = load('remote', null);
  const cfg = c && c.cfg ? sanitizeConfig(c.cfg, CITY_IDS) : null;
  return cfg || EMPTY;
}

/**
 * 向后台要最新配置。验证签名、检查格式，并且只接受比本机更新的版本（防止被换成旧配置）。
 * 有更新时返回新配置，否则返回 null。
 */
export async function refreshRemote(force = false) {
  if (!remoteEnabled()) return null;
  const c = load('remote', null);
  if (!force && c && Date.now() - (c.at || 0) < REFRESH_MS) return null;
  try {
    const r = await fetch(apiBase() + '/config', QUIET);
    if (!r.ok) return null;
    const raw = r.status === 204 ? null : await verifyEnvelope(await r.json(), publicKey());
    const cfg = raw && sanitizeConfig(raw, CITY_IDS);
    const cur = c && c.cfg ? c.cfg.issued : '';
    if (!cfg || (cur && !(cfg.issued > cur))) {
      // 没有配置、签名不对或不比本机新：保留本机的，只记下问过的时间
      save('remote', { ...(c || {}), at: Date.now() });
      return null;
    }
    save('remote', { cfg, at: Date.now() });
    return cfg;
  } catch (e) {
    return null;
  }
}

/** 某功能是否开着（配置里没写就是开着） */
export const flagOn = (remote, name) => !(remote && remote.flags && remote.flags[name] === false);

/** 官方时间校正 + 用户自己的微调。只用于列表里的城市（"我的位置"不套用某个城市的官方时间） */
export function effectiveOffsets(userOffsets, remote, city) {
  const off = (remote && remote.cityOffsets && remote.cityOffsets[city.id]) || null;
  const out = {};
  for (const p of PRAYERS) out[p] = (Number(userOffsets && userOffsets[p]) || 0) + (off ? off[p] || 0 : 0);
  return { offsets: out, official: off ? off.src : null };
}

/** 伊斯兰历调整：用户手动调过的以用户为准；否则跟随当地宣布（配置）；都没有就是 0 */
export function effectiveHijri(settings, remote, city) {
  if (settings.hijriManual) return { adjust: Number(settings.hijriAdjust) || 0, official: null };
  const h = remote && remote.hijri && remote.hijri[city.cc];
  return h ? { adjust: h.adjust, official: h.src } : { adjust: 0, official: null };
}

/** 今天该显示的公告（按日期范围；用户点过"知道了"的不再显示） */
export function activeNotices(remote, todayKey) {
  const dismissed = load('noticeSeen', []);
  return ((remote && remote.notices) || []).filter((n) => (!n.from || n.from <= todayKey) && (!n.until || n.until >= todayKey) && !dismissed.includes(n.id));
}
export function dismissNotice(id) {
  const list = load('noticeSeen', []).filter((x) => x !== id);
  list.push(id);
  save('noticeSeen', list.slice(-20));
}

/** 需要更新应用吗：返回商店链接（网页版不提示） */
export function updateLink(remote, plat) {
  if (!remote || !remote.minVersion || plat === 'web') return null;
  if (cmpVersion(APP_VERSION, remote.minVersion) >= 0) return null;
  return remote.store[plat] || null;
}
