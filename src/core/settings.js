// 用户设置（存在本机）。改动后通知订阅者重新渲染。
import { load, save } from './storage.js';
import { DEFAULT_CITY, CITIES } from './cities.js';

const DEFAULTS = {
  city: DEFAULT_CITY,
  fontScale: 0, // 0 标准 / 1 大 / 2 特大
  remind: true, // 到时间在页面上轻轻提示一次
  sound: false, // 提示时是否响一声（默认静音）
  offsets: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, // 按自己清真寺的时间微调（分钟）
  hijriAdjust: 0, // 伊斯兰历按当地宣布调整（天）
  lang: 'zh', // 预留：tg 塔吉克语、ru 俄语
};

const listeners = new Set();
let state = { ...DEFAULTS, ...load('settings', {}) };
state.offsets = { ...DEFAULTS.offsets, ...(state.offsets || {}) };
if (!CITIES[state.city]) state.city = DEFAULT_CITY;

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
