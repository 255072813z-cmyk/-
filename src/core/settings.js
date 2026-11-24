// 用户设置（存在本机）。改动后通知订阅者重新渲染。
import { load, save } from './storage.js';
import { DEFAULT_CITY, CITIES } from './cities.js';
import { DEFAULT_NOTIFY } from './notify.js';

const DEFAULTS = {
  city: DEFAULT_CITY,
  loc: null, // "我的位置"：{ lat, lon, utcOffset }，只存本机
  fontScale: 0, // 0 标准 / 1 大 / 2 特大
  remind: true, // 按时提醒（网页：页面开着时提示；手机应用：系统通知）
  notify: DEFAULT_NOTIFY, // 提醒哪几番、提前几分钟、斋月提醒
  sound: false, // 提示时是否响一声（默认静音）
  offsets: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, // 按自己清真寺的时间微调（分钟）
  hijriAdjust: 0, // 伊斯兰历按当地宣布调整（天）——只在 hijriManual 为 true 时使用
  hijriManual: false, // false：跟随当地宣布（后台发布的调整）；true：用户自己调
  stats: true, // 匿名使用统计（可关闭）
  lang: 'zh', // 预留：tg 塔吉克语、ru 俄语
};

const listeners = new Set();

const int = (v, lo, hi, d) => (Number.isInteger(v) && v >= lo && v <= hi ? v : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);

/**
 * 检查、修正设置（本机存储被清理一半、老版本格式、手动改坏等情况都不让应用出错）
 * @param saved 存储里读出来的
 */
export function normalizeSettings(saved) {
  const s = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  const out = { ...DEFAULTS };
  out.city = typeof s.city === 'string' ? s.city : DEFAULTS.city;
  const loc = s.loc;
  out.loc =
    loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lon) && Math.abs(loc.lat) <= 90 && Math.abs(loc.lon) <= 180
      ? { lat: loc.lat, lon: loc.lon, utcOffset: Number.isFinite(loc.utcOffset) && Math.abs(loc.utcOffset) <= 14 ? loc.utcOffset : undefined }
      : null;
  if (!CITIES[out.city] && !(out.city === 'here' && out.loc)) out.city = DEFAULT_CITY;
  out.fontScale = int(s.fontScale, 0, 2, 0);
  out.remind = bool(s.remind, true);
  out.sound = bool(s.sound, false);
  out.stats = bool(s.stats, true);
  const o = s.offsets || {};
  out.offsets = {};
  for (const p of Object.keys(DEFAULTS.offsets)) out.offsets[p] = int(Number(o[p]), -30, 30, 0);
  const n = s.notify || {};
  out.notify = {
    prayers: Object.fromEntries(Object.keys(DEFAULT_NOTIFY.prayers).map((p) => [p, bool((n.prayers || {})[p], true)])),
    advance: [0, 5, 10, 15].includes(Number(n.advance)) ? Number(n.advance) : 0,
    ramadan: bool(n.ramadan, true),
  };
  out.hijriAdjust = int(Number(s.hijriAdjust), -2, 2, 0);
  // 老版本里调过伊斯兰历的用户，视为手动调整
  out.hijriManual = typeof s.hijriManual === 'boolean' ? s.hijriManual : out.hijriAdjust !== 0;
  out.lang = ['zh', 'tg', 'ru'].includes(s.lang) ? s.lang : DEFAULTS.lang;
  return out;
}

let state = normalizeSettings(load('settings', {}));

export function getSettings() {
  return state;
}

export function setSettings(patch) {
  state = normalizeSettings({ ...state, ...patch });
  save('settings', state);
  listeners.forEach((fn) => fn(state));
}

export function onSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
