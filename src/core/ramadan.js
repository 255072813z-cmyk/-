// 斋月：日期推算、封斋/开斋时间、节日
//
// 日期：按乌姆古拉历法推算（可在设置里 ±2 天），页面一律写明"日期为天文推算，实际以当地清真寺公布为准"。
//
// 封斋（停止吃喝）：按谨慎原则，比天文黎明（晨礼开始，18°）再提前 10 分钟。
//   依据：2027 年斋月第三方转载的塔吉克乌莱玛委员会时间表，封斋时间比 18° 黎明早 6～7 分钟；
//   提前 10 分钟可以覆盖这个差别（宁早勿晚）。
// 开斋：日落（昏礼开始）。当地清真寺习惯在日落后再等几分钟才宣礼开斋（上述时间表晚 6～10 分钟），
//   页面写明"以当地宣礼为准"。
// 用户按清真寺微调过时间时：封斋取"计算值与微调值中更早的"，开斋取"更晚的"，只会更谨慎。
import { timesFor } from './prayer-times.js';
import { addDays, localParts } from './clock.js';
import { toHijri } from './hijri.js';

export const SAHUR_MARGIN_MIN = 10;

/** 从 from 开始（含当天），找伊斯兰历 hm 月 hd 日对应的公历日期 */
export function findHijri(from, hm, hd, adjust = 0, maxDays = 400) {
  for (let i = 0; i <= maxDays; i++) {
    const d = addDays(from, i);
    const h = toHijri(d, adjust);
    if (h.m === hm && h.d === hd) return { ...d, hy: h.y, inDays: i };
  }
  return null;
}

/** 斋月状态：正在斋月中（第几天），或下一个斋月还有几天 */
export function ramadanStatus(today, adjust = 0) {
  const h = toHijri(today, adjust);
  if (h.m === 9) {
    const start = addDays(today, -(h.d - 1));
    const eid = findHijri(today, 10, 1, adjust);
    return { active: true, day: h.d, year: h.y, start, eid, length: eid ? h.d - 1 + eid.inDays : 30 };
  }
  const start = findHijri(today, 9, 1, adjust);
  const eid = start ? findHijri(start, 10, 1, adjust) : null;
  return { active: false, year: start && start.hy, start, eid, length: eid ? eid.inDays : 30 };
}

export function holidays(today, adjust = 0) {
  return {
    fitr: findHijri(today, 10, 1, adjust), // 开斋节：闪瓦鲁月 1 日
    adha: findHijri(today, 12, 10, adjust), // 古尔邦节：都尔黑哲月 10 日
  };
}

/** 某天的封斋、开斋时间 */
export function fastTimes(city, ymd, offsets = {}) {
  const raw = timesFor(city, ymd);
  const adj = timesFor(city, ymd, offsets);
  const dawn = new Date(Math.min(raw.fajr.getTime(), adj.fajr.getTime()));
  return {
    dawn,
    sahurEnd: new Date(dawn.getTime() - SAHUR_MARGIN_MIN * 60000),
    iftar: new Date(Math.max(raw.maghrib.getTime(), adj.maghrib.getTime())),
  };
}

/**
 * 此刻在斋戒日的哪个阶段：
 *  before   黎明前（还可以吃封斋饭）→ 倒计时到停止吃喝
 *  fasting  白天封斋中 → 倒计时到开斋
 *  after    已开斋 → 倒计时到明天停止吃喝
 */
export function fastPhase(city, at, offsets = {}) {
  const today = localParts(at, city.utcOffset);
  const t = fastTimes(city, today, offsets);
  const n = at.getTime();
  if (n < t.sahurEnd.getTime()) return { phase: 'before', today, times: t, target: t.sahurEnd };
  if (n < t.iftar.getTime()) return { phase: 'fasting', today, times: t, target: t.iftar };
  const tm = fastTimes(city, addDays(today, 1), offsets);
  return { phase: 'after', today, times: t, tomorrow: tm, target: tm.sahurEnd };
}
