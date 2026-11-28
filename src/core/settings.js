// 用户设置（存在本机）。改动后通知订阅者重新渲染。
import { load, save } from './storage.js';
import { DEFAULT_CITY, CITIES, guessCity } from './cities.js';
import { guessLang } from '../i18n/index.js';

/** 提醒的默认设置（notify.js 也用它） */
export const DEFAULT_NOTIFY = {
  prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
  advance: 0, // 提前几分钟（0 = 准时）
  ramadan: true, // 斋月里、和用户标了要封斋的日子，提醒封斋饭和开斋
  jumuah: true, // 星期五晌礼前 1 小时提醒主麻
  streak: true, // 晚上还没打卡时提醒一次
  soon: true, // 到点前 10 分钟轻声说一句（"晌礼还有 10 分钟，先把手头的事收个尾"）
};

const DEFAULTS = {
  city: DEFAULT_CITY,
  cityConfirmed: false,
  loc: null, // "我的位置"：{ lat, lon, utcOffset }，只存本机
  fontScale: 0, // -1 小 / 0 标准（默认）/ 1 大 / 2 特大
  mode: 'young', // 显示方式：young 年轻人（精致简洁）/ elder 年纪大的人（大字极简，首页只有时间和下一番）
  modeAsked: false, // 第一次打开时在首页问一句（问过就不再问，设置里随时可改）
  onboarded: false, // 第一次打开的三步引导走完了没有（老用户视为走完）
  remind: true, // 按时提醒（网页：页面开着时提示；手机应用：系统通知）
  notify: DEFAULT_NOTIFY, // 提醒哪几番、提前几分钟、斋月提醒
  sound: false, // 提示时是否响一声（默认静音）
  offsets: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, // 按自己清真寺的时间微调（分钟）
  hijriAdjust: 0, // 伊斯兰历按当地宣布调整（天）——只在 hijriManual 为 true 时使用
  hijriManual: false, // false：跟随当地宣布（后台发布的调整）；true：用户自己调
  stats: true, // 匿名使用统计（可关闭）
  autoLoc: false, // 自动定位：用"我的位置"时，每次打开应用自动更新位置和时区（位置只在手机上用）
  lang: 'tg', // tg 塔吉克语 / ru 俄语 / uz 乌兹别克语 / ky 吉尔吉斯语 / zh 中文；第一次打开按手机语言选，都不是就用塔吉克语
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
  out.city = typeof s.city === 'string' ? s.city : guessCity(); // 第一次打开：按手机时区猜
  // 城市确认过没有（第一次打开时首页请用户确认一下）；老用户存过城市的算确认过
  out.cityConfirmed = bool(s.cityConfirmed, typeof s.city === 'string');
  // 引导：存过城市、确认过城市或回答过显示方式的老用户，不再走引导
  out.onboarded = bool(s.onboarded, out.cityConfirmed || s.modeAsked === true);
  const loc = s.loc;
  out.loc =
    loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lon) && Math.abs(loc.lat) <= 90 && Math.abs(loc.lon) <= 180
      ? { lat: loc.lat, lon: loc.lon, utcOffset: Number.isFinite(loc.utcOffset) && Math.abs(loc.utcOffset) <= 14 ? loc.utcOffset : undefined }
      : null;
  if (!CITIES[out.city] && !(out.city === 'here' && out.loc)) out.city = DEFAULT_CITY;
  out.fontScale = int(s.fontScale, -1, 2, 0);
  out.mode = s.mode === 'elder' ? 'elder' : 'young';
  out.modeAsked = bool(s.modeAsked, false);
  out.remind = bool(s.remind, true);
  out.sound = bool(s.sound, false);
  out.stats = bool(s.stats, true);
  out.autoLoc = bool(s.autoLoc, false) && out.city === 'here';
  const o = s.offsets || {};
  out.offsets = {};
  for (const p of Object.keys(DEFAULTS.offsets)) out.offsets[p] = int(Number(o[p]), -30, 30, 0);
  const n = s.notify || {};
  out.notify = {
    prayers: Object.fromEntries(Object.keys(DEFAULT_NOTIFY.prayers).map((p) => [p, bool((n.prayers || {})[p], true)])),
    advance: [0, 5, 10, 15].includes(Number(n.advance)) ? Number(n.advance) : 0,
    ramadan: bool(n.ramadan, true),
    jumuah: bool(n.jumuah, true),
    streak: bool(n.streak, true),
    soon: bool(n.soon, true),
  };
  // 计算方法：auto = 按城市所在国家；也可以自己选（见 prayer-times.js 的 METHODS）
  out.method = ['auto', 'karachi', 'mwl', 'dumrf', 'isna'].includes(s.method) ? s.method : 'auto';
  out.hijriAdjust = int(Number(s.hijriAdjust), -2, 2, 0);
  // 老版本里调过伊斯兰历的用户，视为手动调整
  out.hijriManual = typeof s.hijriManual === 'boolean' ? s.hijriManual : out.hijriAdjust !== 0;
  out.lang = ['zh', 'tg', 'ru', 'uz', 'ky'].includes(s.lang) ? s.lang : guessLang(); // 第一次打开：按手机语言
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
