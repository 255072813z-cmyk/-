// 斋月以外的封斋：副功斋（圣行的斋日）、补斋（补斋月没封的日子）、"明天我要封斋"的计划。
// 只存在这台手机上。日期按伊斯兰历推算（设置里可 ±2 天），页面写明"以当地宣布为准"。
//
// 圣行斋日（来源已逐条核对原文）：
//   星期一、星期四 —— 提尔密济 747（"功课在星期一、星期四呈上，我喜欢呈上时我在封斋"）
//   每个伊斯兰月的 13、14、15 日（"白日"）—— 提尔密济 761
//   闪瓦鲁月封六天 —— 提尔密济 759（开斋节当天除外，可以分开封）
//   阿拉法日（都尔黑哲月 9 日，没去朝觐的人）—— 提尔密济 749
//   阿舒拉日（穆哈兰姆月 10 日）—— 提尔密济 752、布哈里 2004；哈乃斐学派主张连着 9 日或 11 日一起封
// 不封斋的五天：开斋节、古尔邦节 —— 布哈里 1990；古尔邦节后三天（晒肉日）—— 布哈里 1998
import { load, save } from './storage.js';
import { addDays } from './clock.js';
import { toHijri } from './hijri.js';

const key = (d) => `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
const isKey = (k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);

/** 这天不能封斋吗：'fitr' 开斋节 / 'adha' 古尔邦节 / 'tashriq' 古尔邦节后三天 / null */
export function forbiddenDay(ymd, adjust = 0) {
  const h = toHijri(ymd, adjust);
  if (h.m === 10 && h.d === 1) return 'fitr';
  if (h.m === 12 && h.d === 10) return 'adha';
  if (h.m === 12 && h.d >= 11 && h.d <= 13) return 'tashriq';
  return null;
}

/** 这天为什么是圣行斋日：['arafah', 'ashura', 'tasua', 'white', 'shawwal', 'mon', 'thu']（斋月里、禁止的日子返回 []） */
export function sunnahReasons(ymd, adjust = 0) {
  const h = toHijri(ymd, adjust);
  if (h.m === 9 || forbiddenDay(ymd, adjust)) return [];
  const r = [];
  if (h.m === 12 && h.d === 9) r.push('arafah');
  if (h.m === 1 && h.d === 10) r.push('ashura');
  if (h.m === 1 && (h.d === 9 || h.d === 11)) r.push('tasua');
  if (h.d >= 13 && h.d <= 15) r.push('white');
  if (h.m === 10) r.push('shawwal');
  const wd = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d)).getUTCDay();
  if (wd === 1) r.push('mon');
  if (wd === 4) r.push('thu');
  return r;
}

/** 从今天起 days 天内的圣行斋日；另外找出下一个阿拉法日、阿舒拉日（可能在几个月后） */
export function upcomingSunnah(today, adjust = 0, days = 21) {
  const list = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(today, i);
    const r = sunnahReasons(d, adjust);
    if (r.length) list.push({ ...d, key: key(d), inDays: i, reasons: r });
  }
  const special = [];
  for (const [id, m, dd] of [['arafah', 12, 9], ['ashura', 1, 10]]) {
    for (let i = 0; i <= 400; i++) {
      const d = addDays(today, i);
      const h = toHijri(d, adjust);
      if (h.m === m && h.d === dd) {
        special.push({ ...d, key: key(d), inDays: i, id });
        break;
      }
    }
  }
  return { list, special: special.sort((a, b) => a.inDays - b.inDays) };
}

// ---- 记录：哪天封了斋（副功斋 nafl / 补斋 qada） ----
export function fastLog() {
  const raw = load('vfast', {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([k, v]) => isKey(k) && (v === 'nafl' || v === 'qada')));
}

/** 记下或取消某天的斋。kind：'nafl' | 'qada' | null（取消）。还要补几天按记录自动算（见 oweDays） */
export function setFast(dayKey, kind) {
  const log = fastLog();
  if (kind) log[dayKey] = kind;
  else delete log[dayKey];
  const keys = Object.keys(log).sort();
  const drop = keys.slice(0, Math.max(0, keys.length - 400));
  // 太旧的记录删掉时，里面的补斋从"要补的总数"里扣掉，剩下要补的天数不变
  const oldQada = drop.filter((k) => log[k] === 'qada').length;
  if (oldQada) {
    const s = readOwe();
    s.base = Math.max(0, s.base - oldQada);
    save('qadaFast', s);
  }
  for (const k of drop) delete log[k];
  save('vfast', log);
  return log;
}

/** 某一年（公历）封了几天副功斋、补了几天 */
export function yearCount(year) {
  const out = { nafl: 0, qada: 0 };
  for (const [k, v] of Object.entries(fastLog())) if (k.startsWith(year + '-')) out[v]++;
  return out;
}

// ---- 补斋：还要补几天 = 总共要补的（base）− 已经记下的补斋 ----
const MAX_OWE = 9999;
function readOwe() {
  const raw = load('qadaFast', null);
  const base = raw && Number.isInteger(raw.base) && raw.base >= 0 ? Math.min(MAX_OWE, raw.base) : 0;
  const imported = raw && Array.isArray(raw.imported) ? raw.imported.filter(Number.isInteger).slice(-20) : [];
  return { base, imported };
}
const qadaDone = () => Object.values(fastLog()).filter((v) => v === 'qada').length;
export const oweDays = () => Math.max(0, readOwe().base - qadaDone());
/** 手动加减一天（只改"还要补"的天数） */
export function addOwe(n) {
  const s = readOwe();
  const done = qadaDone();
  const next = Math.max(0, Math.min(MAX_OWE, Math.max(0, s.base - done) + n));
  s.base = done + next;
  save('qadaFast', s);
  return next;
}

/** 上一个斋月记了"没封"的天数（还没加进补斋时才返回） */
export function ramadanMissed(ramadanYear) {
  if (!ramadanYear || readOwe().imported.includes(ramadanYear)) return 0;
  const log = load('fast:' + ramadanYear, {});
  return log && typeof log === 'object' ? Object.values(log).filter((v) => v === 'no').length : 0;
}
export function importMissed(ramadanYear) {
  const n = ramadanMissed(ramadanYear);
  const s = readOwe();
  s.base = Math.min(MAX_OWE, Math.max(s.base, qadaDone()) + n);
  s.imported = [...s.imported, ramadanYear].slice(-20);
  save('qadaFast', s);
  return oweDays();
}

// ---- 计划：哪些天打算封斋（用来排封斋饭、开斋提醒） ----
export function fastPlan(todayKey) {
  const raw = load('fastPlan', []);
  return Array.isArray(raw) ? raw.filter((k) => isKey(k) && (!todayKey || k >= todayKey)).sort().slice(0, 60) : [];
}
export function togglePlan(dayKey, on, todayKey) {
  const set = new Set(fastPlan(todayKey));
  if (on) set.add(dayKey);
  else set.delete(dayKey);
  save('fastPlan', [...set].sort());
  return [...set];
}

export { key as dayKey };
