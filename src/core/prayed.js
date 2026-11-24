// "已礼"记录：每番拜礼完，在首页点一下。只存在这台手机上：不计分、不排名。记下任何一番，当天就算打卡（见 streak.js）。
import { load, save } from './storage.js';
import { PRAYERS } from './prayer-times.js';
import { checkIn } from './streak.js';

const KEEP = 60; // 只留最近 60 天

function all() {
  const raw = load('prayed', {});
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

/** 某天记了哪几番：{ fajr: true, ... } */
export function prayedOn(dayKey) {
  const d = all()[dayKey];
  const out = {};
  if (Array.isArray(d)) for (const p of d) if (PRAYERS.includes(p)) out[p] = true;
  return out;
}

export function prayedCount(dayKey) {
  return Object.keys(prayedOn(dayKey)).length;
}

/** 有记录的日子（用来画打卡格子） */
export function prayedDays() {
  return new Set(Object.entries(all()).filter(([, v]) => Array.isArray(v) && v.length).map(([k]) => k));
}

/** 点一下：记下或取消。记下时顺便打卡，返回打卡结果（连续天数、新称号等） */
export function togglePrayed(dayKey, prayer, on) {
  if (!PRAYERS.includes(prayer)) return null;
  const a = all();
  const set = new Set(Array.isArray(a[dayKey]) ? a[dayKey].filter((p) => PRAYERS.includes(p)) : []);
  if (on == null ? !set.has(prayer) : on) set.add(prayer);
  else set.delete(prayer);
  a[dayKey] = PRAYERS.filter((p) => set.has(p));
  const keys = Object.keys(a).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) delete a[k];
  save('prayed', a);
  return set.has(prayer) ? checkIn(dayKey) : null;
}
