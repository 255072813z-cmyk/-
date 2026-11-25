// 五番拜时间计算（完全在手机上离线计算，不联网）
//
// 计算方法（页面上会写明）：
// - 晨礼、宵礼：太阳在地平线下 18°（卡拉奇伊斯兰科学大学法，哈乃斐地区常用）
// - 晡礼：哈乃斐学派，物体影长达到本身长度的 2 倍（再加正午影长）时开始
// - 晌礼：太阳过中天之后；昏礼：日落
// 计算库：adhan-js（MIT 许可），已与 aladhan.com 同参数结果逐分钟比对（见 scripts/check-times.mjs）。
//
// 塔吉克斯坦乌莱玛委员会另有官方日历，部分时间与天文计算相差几分钟甚至更多，
// 因此页面一律提示"以当地清真寺公布为准"，并允许用户按自己清真寺的时间微调（offsets）。
import { Coordinates, CalculationMethod, PrayerTimes, Madhab, Rounding, HighLatitudeRule } from 'adhan';
import { localParts, addDays } from './clock.js';

export const PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];


// 算法：karachi（塔吉克斯坦、乌兹别克斯坦、吉尔吉斯斯坦）晨礼、宵礼 18°；dumrf（俄罗斯）晨礼 16°、宵礼 15°。
// 用户也可以在设置里自己选（mwl 穆斯林世界联盟 18°/17°、isna 15°/15°），选和自己清真寺最接近的。
// 纬度 48° 以上的夏天，太阳整夜到不了这个角度，按"夜晚七分之一"规则估算（adhan 推荐做法），页面会提示以当地清真寺为准。
export const METHODS = { karachi: { fajr: 18, isha: 18 }, mwl: { fajr: 18, isha: 17 }, dumrf: { fajr: 16, isha: 15 }, isna: { fajr: 15, isha: 15 } };

/** 太阳赤纬（度，近似公式，误差约 0.5°，只用来判断"太阳整夜到不到规定角度"） */
function solarDeclination(ymd) {
  const n = Math.round((Date.UTC(ymd.y, ymd.m - 1, ymd.d) - Date.UTC(ymd.y, 0, 0)) / 864e5);
  return 23.44 * Math.sin(((2 * Math.PI) / 365) * (284 + n));
}

/**
 * 这一天晨礼或宵礼的规定角度太阳整夜都到不了（高纬度夏天），需要按规则估算。
 * 太阳夜里最低时的高度 = 纬度 + 赤纬 − 90°（北半球）。
 */
export function highLatitudeDay(city, ymd) {
  const m = METHODS[city.method] || METHODS.karachi;
  const lowest = Math.abs(city.lat) + solarDeclination(ymd) * Math.sign(city.lat || 1) - 90;
  // 留 1.5° 余地：刚好够得着的那几天，到达时刻在半夜附近、对误差极敏感，也按规则估算
  return lowest > -(Math.max(m.fajr, m.isha) + 1.5);
}

function params(city, ymd) {
  const m = METHODS[city.method] || METHODS.karachi;
  const p = city.method === 'karachi' || !METHODS[city.method] ? CalculationMethod.Karachi() : CalculationMethod.Other();
  p.fajrAngle = m.fajr;
  p.ishaAngle = m.isha;
  p.methodAdjustments = { ...p.methodAdjustments, dhuhr: 1 }; // 晌礼在太阳过中天后 +1 分钟
  p.madhab = Madhab.Hanafi;
  // 平常按角度算；只有太阳到不了规定角度的日子，才按"夜晚七分之一"估算
  p.highLatitudeRule = ymd && highLatitudeDay(city, ymd) ? HighLatitudeRule.SeventhOfTheNight : HighLatitudeRule.MiddleOfTheNight;
  p.rounding = Rounding.None; // 取整由下面按谨慎原则自己做
  return p;
}

// 谨慎原则（宁晚勿早）：
// 各番拜的"开始时间" = 计算值 + 安全余量，再向后取整到整分；日出是晨礼的"结束时间"，减余量后向前取整。
// 余量依据：与高精度天文库 astronomy-engine 全年逐日比对（scripts/check-astronomy.mjs），
// adhan 的晡礼最多比真实时刻早 31 秒（塔吉克斯坦；计入大气折射时），其余各项误差在 5 秒以内；
// 俄罗斯北部冬天晡礼误差更大，余量见 asrMargin。
const MIN = 60000;
const MARGIN_S = { fajr: 5, dhuhr: 5, asr: 45, maghrib: 5, isha: 5, sunrise: 5 };
// 高纬度冬天太阳很低，晡礼对误差更敏感（核对：北纬 61° 最多早 114 秒），余量按纬度加大
const asrMargin = (lat) => (Math.abs(lat) >= 55 ? 180 : Math.abs(lat) >= 50 ? 150 : Math.abs(lat) >= 45 ? 90 : MARGIN_S.asr);
// 高纬度夏末，太阳贴着规定角度慢慢下沉，晨礼、宵礼也加一点余量（核对：最多早 8 秒）
const twilightMargin = (lat, key) => (Math.abs(lat) >= 45 ? 30 : MARGIN_S[key]);
const ceilMin = (t, s = 0) => new Date(Math.ceil((t.getTime() + s * 1000) / MIN) * MIN);
const floorMin = (t, s = 0) => new Date(Math.floor((t.getTime() - s * 1000) / MIN) * MIN);

/**
 * 某城市某一天（当地日历日期）的时间。
 * @param city   城市对象（见 cities.js）
 * @param ymd    {y, m, d} 当地日期
 * @param offsets 用户按清真寺微调的分钟数 {fajr: 0, dhuhr: 5, ...}
 */
export function timesFor(city, ymd, offsets = {}) {
  // adhan 读取的是 Date 对象的"本地年月日"，所以这里用本地构造函数放入杜尚别的日期，
  // 结果是绝对时刻，与手机时区无关。
  const date = new Date(ymd.y, ymd.m - 1, ymd.d);
  const pt = new PrayerTimes(new Coordinates(city.lat, city.lon), date, params(city, ymd));
  const margin = (key) => (key === 'asr' ? asrMargin(city.lat) : key === 'fajr' || key === 'isha' ? twilightMargin(city.lat, key) : MARGIN_S[key]);
  const adj = (key, t) => new Date(ceilMin(t, margin(key)).getTime() + (Number(offsets[key]) || 0) * MIN);
  return {
    date: ymd,
    fajr: adj('fajr', pt.fajr),
    sunrise: floorMin(pt.sunrise, MARGIN_S.sunrise),
    dhuhr: adj('dhuhr', pt.dhuhr),
    asr: adj('asr', pt.asr),
    maghrib: adj('maghrib', pt.maghrib),
    isha: adj('isha', pt.isha),
    sunset: ceilMin(pt.maghrib, MARGIN_S.maghrib),
  };
}

/**
 * 当前处在哪番拜的时间里、下一番是什么。
 * 晨礼到日出为止；日出到晌礼之间没有主命拜；宵礼一直到次日晨礼。
 */
export function schedule(city, at, offsets = {}) {
  const today = localParts(at, city.utcOffset);
  const t = timesFor(city, today, offsets);
  const tm = timesFor(city, addDays(today, 1), offsets);
  const n = at.getTime();
  let current = null;
  let currentEnd = null;
  let next;
  let nextTime;
  let nextTomorrow = false;
  if (n < t.fajr) {
    current = 'isha';
    currentEnd = t.fajr;
    next = 'fajr';
    nextTime = t.fajr;
  } else if (n < t.sunrise) {
    current = 'fajr';
    currentEnd = t.sunrise;
    next = 'dhuhr';
    nextTime = t.dhuhr;
  } else if (n < t.dhuhr) {
    next = 'dhuhr';
    nextTime = t.dhuhr;
  } else if (n < t.asr) {
    current = 'dhuhr';
    currentEnd = t.asr;
    next = 'asr';
    nextTime = t.asr;
  } else if (n < t.maghrib) {
    current = 'asr';
    currentEnd = t.maghrib;
    next = 'maghrib';
    nextTime = t.maghrib;
  } else if (n < t.isha) {
    current = 'maghrib';
    currentEnd = t.isha;
    next = 'isha';
    nextTime = t.isha;
  } else {
    current = 'isha';
    currentEnd = tm.fajr;
    next = 'fajr';
    nextTime = tm.fajr;
    nextTomorrow = true;
  }
  return { today, times: t, tomorrow: tm, current, currentEnd, next, nextTime, nextTomorrow };
}

/** 一天中的时段，用来给首页天空配色 */
export function skyPhase(times, at) {
  const n = at.getTime();
  const min = 60000;
  if (n < times.fajr.getTime() || n >= times.isha.getTime()) return 'night';
  if (n < times.sunrise.getTime() + 30 * min) return 'dawn';
  if (n < times.maghrib.getTime() - 45 * min) return 'day';
  return 'dusk';
}
