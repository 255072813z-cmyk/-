// 备份与恢复：不用账号。把这台手机上的个人记录导出成一个文件，换手机、重装时再导入。
// 只导出用户自己的记录和偏好；不导出匿名统计的排队数据、缓存，也不导出亲友圈的密钥（换手机后用邀请码重新加入）。
import { load, save } from './storage.js';

export const BACKUP_APP = 'joynamoz';
export const BACKUP_VERSION = 1;
const MAX_BYTES = 2 * 1024 * 1024;

// 要备份的记录（见各模块）：设置、已礼、连续天数、徽章、补礼、补斋、副功斋、封斋计划、古兰经阅读、赞念
export const BACKUP_KEYS = ['settings', 'prayed', 'streak', 'badges', 'qada', 'qadaFast', 'vfast', 'fastPlan', 'qread', 'qhist', 'qprog', 'qdays', 'qtoday', 'qmarks', 'qprefs', 'tasbih'];
// 按年份存的：斋月打卡 fast:<年>、30 天通读 quran:<年>
const PREFIXES = ['fast:', 'quran:'];
const okKey = (k) => BACKUP_KEYS.includes(k) || PREFIXES.some((p) => k.startsWith(p) && /^\d{4}$/.test(k.slice(p.length)));

function storedKeys() {
  const out = [];
  try {
    const ls = window.localStorage;
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k && k.startsWith('masjid:') && okKey(k.slice(7))) out.push(k.slice(7));
    }
  } catch (e) {
    /* 读不了就只备份已知的键 */
  }
  return [...new Set([...BACKUP_KEYS, ...out])];
}

/** 现在这台手机上的记录，做成备份对象 */
export function makeBackup(now = new Date()) {
  const data = {};
  for (const k of storedKeys()) {
    const v = load(k, undefined);
    if (v !== undefined) data[k] = v;
  }
  return { app: BACKUP_APP, v: BACKUP_VERSION, created: now.toISOString(), data };
}

/** 备份里有什么（给用户确认用）：记了几天礼拜、补礼还剩几番、古兰经读了几节、几个书签、几枚徽章 */
export function summarize(data) {
  const prayed = data.prayed && typeof data.prayed === 'object' ? Object.keys(data.prayed).length : 0;
  const qada = data.qada && typeof data.qada === 'object' ? Object.values(data.qada).reduce((a, n) => a + (Number.isInteger(n) && n > 0 ? n : 0), 0) : 0;
  const prog = data.qprog && typeof data.qprog === 'object' ? data.qprog : {};
  const verses = Object.values(prog).reduce((a, n) => a + (Number.isInteger(n) && n > 0 ? n : 0), 0);
  const marks = Array.isArray(data.qmarks) ? data.qmarks.length : 0;
  const badges = data.badges && typeof data.badges === 'object' ? Object.keys(data.badges).length : 0;
  return { prayed, qada, verses, marks, badges };
}

/** 读备份文件的文字；不对就返回 { error } */
export function parseBackup(text) {
  if (typeof text !== 'string' || !text.trim()) return { error: 'empty' };
  if (text.length > MAX_BYTES) return { error: 'big' };
  let o;
  try {
    o = JSON.parse(text);
  } catch (e) {
    return { error: 'format' };
  }
  if (!o || o.app !== BACKUP_APP || typeof o.data !== 'object' || !o.data) return { error: 'format' };
  if (!Number.isInteger(o.v) || o.v > BACKUP_VERSION) return { error: 'newer' };
  const data = {};
  for (const [k, v] of Object.entries(o.data)) if (okKey(k) && v !== undefined) data[k] = v;
  if (!Object.keys(data).length) return { error: 'format' };
  return { data, created: typeof o.created === 'string' ? o.created.slice(0, 10) : '', summary: summarize(data) };
}

/** 用备份替换这台手机上的记录（各模块读的时候还会再检查一遍格式） */
export function applyBackup(data) {
  let n = 0;
  for (const k of storedKeys()) {
    try {
      window.localStorage.removeItem('masjid:' + k);
    } catch (e) {
      /* 忽略 */
    }
  }
  for (const [k, v] of Object.entries(data)) if (okKey(k) && save(k, v)) n++;
  return n;
}
