// 用高精度天文库 astronomy-engine 独立计算"真实时刻"，全年逐日核对本站显示的时间：
// 各番拜开始时间必须不早于真实时刻，且晚得不超过 2 分钟（晌礼按卡拉奇法另加 1 分钟，放宽到 2.5 分钟）；
// 日出必须不晚于真实时刻。
// 晡礼同时按"几何高度"和"计入大气折射"两种定义核对，取更晚者为真实时刻。
// 用法：npm run check:astro   （离线即可运行）
import * as A from 'astronomy-engine';
import { timesFor } from '../src/core/prayer-times.js';
import { CITIES } from '../src/core/cities.js';

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
for (const c of Object.values(CITIES)) {
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
      fajr: cross(obs, tr - 11.5 * 3600e3, tr, -18, true, null),
      sunrise: A.SearchRiseSet(A.Body.Sun, obs, +1, A.MakeTime(new Date(tr - 11 * 3600e3)), 1).date.getTime(),
      dhuhr: tr,
      asr: Math.max(asrOf(null), asrOf('normal')),
      maghrib: A.SearchRiseSet(A.Body.Sun, obs, -1, A.MakeTime(new Date(tr)), 1).date.getTime(),
      isha: cross(obs, tr, tr + 11.5 * 3600e3, -18, false, null),
    };
    for (const k of Object.keys(truth)) {
      n++;
      const diff = (ours[k].getTime() - truth[k]) / 1000;
      const max = k === 'dhuhr' ? 150 : 120;
      const ok = k === 'sunrise' ? diff <= 0 && diff > -120 : diff >= 0 && diff < max;
      if (k !== 'sunrise') latest = Math.max(latest, diff);
      if (!ok) {
        bad++;
        console.log(`不符合 ${c.id} ${ymd.y}-${ymd.m}-${ymd.d} ${k}: 差 ${diff.toFixed(0)} 秒`);
      }
    }
  }
}
console.log(`核对 ${n} 个时间点；不符合 ${bad} 个；开始时间最多比真实时刻晚 ${(latest / 60).toFixed(1)} 分钟`);
process.exit(bad ? 1 : 0);
