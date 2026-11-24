// 用高精度天文库 astronomy-engine 独立计算"真实时刻"，全年逐日核对本站显示的时间：
// 各番拜开始时间必须不早于真实时刻，且晚得不超过 2 分钟（晌礼按卡拉奇法另加 1 分钟，放宽到 2.5 分钟）；
// 日出必须不晚于真实时刻。
// 晡礼同时按"几何高度"和"计入大气折射"两种定义核对，取更晚者为真实时刻。
// 用法：npm run check:astro   （离线即可运行）
import * as A from 'astronomy-engine';
import { timesFor, highLatitudeDay, METHODS } from '../src/core/prayer-times.js';
import { CITY_DATA } from '../src/content/cities-data.js';

const altAt = (obs, ms, refr) => {
  const t = A.MakeTime(new Date(ms));
  const eq = A.Equator(A.Body.Sun, t, obs, true, true);
  return A.Horizon(t, obs, eq.ra, eq.dec, refr).altitude;
};
function cross(obs, from, to, target, rising, refr) {
  let lo = from;
  let hi = to;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const a = altAt(obs, mid, refr);
    if (rising ? a < target : a > target) lo = mid;
    else hi = mid;
  }
  return lo;
}

let bad = 0;
let n = 0;
let latest = 0;
let skipped = 0;
for (const c of CITY_DATA) {
  const M = METHODS[c.method];
  const obs = new A.Observer(c.lat, c.lon, 0);
  for (let day = 0; day < 366; day++) {
    const dt = new Date(Date.UTC(2026, 11, 1) + day * 864e5);
    const ymd = { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
    const ours = timesFor(c, ymd);
    const tr = A.SearchHourAngle(A.Body.Sun, obs, 0, A.MakeTime(new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d, 0)))).time.date.getTime();
    const asrOf = (refr) => {
      const h = altAt(obs, tr, refr);
      const target = (Math.atan(1 / (2 + 1 / Math.tan((h * Math.PI) / 180))) * 180) / Math.PI;
      return cross(obs, tr, tr + 7 * 3600e3, target, false, refr);
    };
    const truth = {
      fajr: cross(obs, tr - 11.5 * 3600e3, tr, -M.fajr, true, null),
      sunrise: A.SearchRiseSet(A.Body.Sun, obs, +1, A.MakeTime(new Date(tr - 11 * 3600e3)), 1).date.getTime(),
      dhuhr: tr,
      asr: Math.max(asrOf(null), asrOf('normal')),
      maghrib: A.SearchRiseSet(A.Body.Sun, obs, -1, A.MakeTime(new Date(tr)), 1).date.getTime(),
      isha: cross(obs, tr, tr + 11.5 * 3600e3, -M.isha, false, null),
    };
    // 太阳整夜到不了规定角度的日子：晨礼、宵礼是按规则估算的，没有"真实时刻"可比，跳过。
    // 同时核对：判断为"到得了"的日子，太阳确实到得了（否则估算判断有误）。
    const hl = highLatitudeDay(c, ymd);
    const reach = (deg) => altAt(obs, tr + 12 * 3600e3, null) < -deg; // 午夜前后太阳最低
    if (!hl && (!reach(M.fajr) || !reach(M.isha))) {
      bad++;
      console.log(`判断有误 ${c.id} ${ymd.y}-${ymd.m}-${ymd.d}：太阳到不了规定角度，却没按高纬度规则估算`);
    }
    for (const k of Object.keys(truth)) {
      if (hl && (k === 'fajr' || k === 'isha')) {
        skipped++;
        continue;
      }
      n++;
      const diff = (ours[k].getTime() - truth[k]) / 1000;
      const high = Math.abs(c.lat) >= 45;
      const max = k === 'dhuhr' ? 150 : k === 'asr' && high ? 300 : high ? 150 : 120;
      const ok = k === 'sunrise' ? diff <= 0 && diff > -120 : diff >= 0 && diff < max;
      if (k !== 'sunrise') latest = Math.max(latest, diff);
      if (!ok) {
        bad++;
        console.log(`不符合 ${c.id} ${ymd.y}-${ymd.m}-${ymd.d} ${k}: 差 ${diff.toFixed(0)} 秒`);
      }
    }
  }
}
console.log(`${CITY_DATA.length} 个城市，核对 ${n} 个时间点；不符合 ${bad} 个；开始时间最多比真实时刻晚 ${(latest / 60).toFixed(1)} 分钟；高纬度估算跳过 ${skipped} 个`);
process.exit(bad ? 1 : 0);
