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
const saved = load('settings', {}) || {};
let state = { ...DEFAULTS, ...saved };
state.offsets = { ...DEFAULTS.offsets, ...(state.offsets || {}) };
state.notify = { ...DEFAULT_NOTIFY, ...(state.notify || {}), prayers: { ...DEFAULT_NOTIFY.prayers, ...((state.notify || {}).prayers || {}) } };
// 老版本里调过伊斯兰历的用户，视为手动调整
if (typeof saved.hijriManual !== 'boolean') state.hijriManual = Number(state.hijriAdjust) !== 0;
if (!CITIES[state.city] && !(state.city === 'here' && state.loc)) state.city = DEFAULT_CITY;

export function getSettings() {
  return state;
}

export function setSettings(patch) {
  state = { ...state, ...patch };
  save('settings', state);
  listeners.forEach((fn) => fn(state));
}

export function onSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
