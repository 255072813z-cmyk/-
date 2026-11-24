// 与 aladhan.com 比对礼拜时间（相同参数：卡拉奇 18°/18° + 哈乃斐晡礼）。
// 用法：npm run check:times   （需要联网）
import { timesFor } from '../src/core/prayer-times.js';
import { getCity } from '../src/core/cities.js';
import { fmtHM } from '../src/core/clock.js';

const KEYS = { Fajr: 'fajr', Sunrise: 'sunrise', Dhuhr: 'dhuhr', Asr: 'asr', Maghrib: 'maghrib', Isha: 'isha' };
const toMin = (s) => +s.slice(0, 2) * 60 + +s.slice(3, 5);
let worst = 0;
let n = 0;
let bad = 0;
for (const id of ['dushanbe', 'khujand']) {
  const c = getCity(id);
  for (const month of [1, 3, 6, 9, 11, 12]) {
    const y = month >= 11 ? 2026 : 2027;
    const url = `https://api.aladhan.com/v1/calendar/${y}/${month}?latitude=${c.lat}&longitude=${c.lon}&method=1&school=1&timezonestring=Asia/Dushanbe`;
    const j = await (await fetch(url)).json();
    for (const day of j.data) {
      const [d, m, yy] = day.date.gregorian.date.split('-').map(Number);
      const ours = timesFor(c, { y: yy, m, d });
      for (const [k, key] of Object.entries(KEYS)) {
        // 粗核对：与 aladhan 相差不超过 3 分钟即视为同一算法。
        // 本站开始时间宁晚勿早（会比 aladhan 晚 0～2 分钟）；aladhan 自身的晡礼有时比真实时刻早 1 分多钟。
        // 精确核对（不早于真实时刻）见 scripts/check-astronomy.mjs。
        const diff = toMin(fmtHM(ours[key])) - toMin(day.timings[k]);
        const ok = Math.abs(diff) <= 3;
        worst = Math.max(worst, Math.abs(diff));
        n++;
        if (!ok) { bad++; console.log(`差异 ${id} ${yy}-${m}-${d} ${k}: aladhan ${day.timings[k]} / 本站 ${fmtHM(ours[key])}`); }
      }
    }
  }
}
console.log(`比对 ${n} 个时间点，最大相差 ${worst} 分钟，超过 3 分钟的 ${bad} 个`);
process.exit(bad ? 1 : 0);
