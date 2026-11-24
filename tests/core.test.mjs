// 核心计算测试：node --test tests/
// 关键要求：不管手机时区设成什么，杜尚别的礼拜时间都一样。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));

function runIn(tz, code) {
  return execFileSync(process.execPath, ['--input-type=module', '-e', code], {
    env: { ...process.env, TZ: tz },
    cwd: here + '..',
  }).toString();
}

const SNIPPET = `
import { timesFor, schedule } from './src/core/prayer-times.js';
import { getCity } from './src/core/cities.js';
import { fmtHM } from './src/core/clock.js';
const out = [];
for (const id of ['dushanbe','khujand']) for (const [y,m,d] of [[2026,11,24],[2026,12,21],[2027,2,8],[2027,6,21],[2027,3,10]]) {
  const t = timesFor(getCity(id), {y,m,d});
  out.push(id+' '+y+'-'+m+'-'+d+' '+['fajr','sunrise','dhuhr','asr','maghrib','isha'].map(k=>fmtHM(t[k])).join(' '));
}
const s = schedule(getCity('dushanbe'), new Date(Date.UTC(2026,10,24,1,0))); // 杜尚别 06:00
out.push('at06 current='+s.current+' next='+s.next);
const s2 = schedule(getCity('dushanbe'), new Date(Date.UTC(2026,10,24,16,0))); // 杜尚别 21:00
out.push('at21 current='+s2.current+' next='+s2.next+' tomorrow='+s2.nextTomorrow);
console.log(out.join('\\n'));
`;

test('礼拜时间与手机时区无关', () => {
  const zones = ['UTC', 'Asia/Dushanbe', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Europe/Moscow'];
  const results = zones.map((z) => runIn(z, SNIPPET));
  for (const r of results) assert.equal(r, results[0]);
  // 杜尚别 2026-11-24：aladhan.com（method=1 卡拉奇, school=1 哈乃斐）为 05:43 07:16 12:12 15:27 17:07 18:40；
  // 本站按谨慎原则取整，开始时间只会晚、日出只会早，不超过 1 分钟
  assert.match(results[0], /dushanbe 2026-11-24 05:4[34] 07:1[56] 12:1[234] 15:2[78] 17:0[78] 18:4[01]/);
  assert.match(results[0], /at06 current=fajr next=dhuhr/);
  assert.match(results[0], /at21 current=isha next=fajr tomorrow=true/);
});

test('伊斯兰历：乌姆古拉历与算术历相差不超过 2 天', async () => {
  const { toHijri, tabularHijri } = await import('../src/core/hijri.js');
  const h = toHijri({ y: 2026, m: 11, d: 24 });
  assert.deepEqual([h.y, h.m, h.d], [1448, 6, 14]);
  for (const [y, m, d] of [[2026, 11, 24], [2027, 2, 8], [2027, 3, 10], [2025, 3, 1]]) {
    const a = toHijri({ y, m, d });
    const b = tabularHijri(new Date(Date.UTC(y, m - 1, d, 12)));
    const da = a.y * 354 + a.m * 29.5 + a.d;
    const db = b.y * 354 + b.m * 29.5 + b.d;
    assert.ok(Math.abs(da - db) <= 2, `${y}-${m}-${d}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  }
});

test('朝向：杜尚别约 244°（西南偏西），距离约 3350 公里', async () => {
  const { qiblaBearing, distanceKm, compassPoint } = await import('../src/core/qibla.js');
  const b = qiblaBearing(38.53575, 68.77905);
  assert.ok(b > 243 && b < 245, String(b));
  assert.equal(compassPoint(b), 11); // 西南偏西
  const km = distanceKm(38.53575, 68.77905);
  assert.ok(km > 3300 && km < 3400, String(km));
});

test('天气归类', async () => {
  const { classify } = await import('../src/core/weather.js');
  assert.equal(classify({ code: 75, temp: -3, minTemp: -6, snowCm: 8 }), 'heavy');
  assert.equal(classify({ code: 71, temp: -1, minTemp: -3, snowCm: 1 }), 'snow');
  assert.equal(classify({ code: 3, temp: -6, minTemp: -10, snowCm: 0 }), 'cold');
  assert.equal(classify({ code: 0, temp: 13.7, minTemp: 5, snowCm: 0 }), 'clear');
  assert.equal(classify({ code: 63, temp: 9, minTemp: 5, snowCm: 0 }), 'rain');
  assert.equal(classify({ code: 95, temp: 18, minTemp: 12, snowCm: 0 }), 'storm');
  assert.equal(classify({ code: 3, temp: 8, minTemp: 3, snowCm: 0, gust: 68 }), 'wind');
  assert.equal(classify({ code: 0, temp: 36, minTemp: 25, maxTemp: 41, snowCm: 0 }), 'heat');
  assert.equal(classify({ code: 1, temp: 30, minTemp: 18, maxTemp: 32, snowCm: 0, uv: 9 }), 'uv');
  assert.equal(classify({ code: 45, temp: 4, minTemp: 1, snowCm: 0 }), 'fog');
  // 先看影响最大的：下雪又刮风，按下雪提示
  assert.equal(classify({ code: 71, temp: -2, minTemp: -6, snowCm: 1, gust: 70 }), 'snow');
  assert.equal(classify(null), null);
});

test('设置：存储里的数据坏了也能正常打开（数据异常检查）', async () => {
  const { normalizeSettings } = await import('../src/core/settings.js');
  const bad = normalizeSettings({ city: 'atlantis', fontScale: 'huge', offsets: { fajr: 999, dhuhr: '5', asr: 2 }, notify: { advance: 7, prayers: { fajr: 'yes' } }, hijriAdjust: 9, lang: 'xx', loc: { lat: 'a' }, stats: 'no' });
  assert.equal(bad.city, 'dushanbe');
  assert.equal(bad.fontScale, 0);
  assert.deepEqual(bad.offsets, { fajr: 0, dhuhr: 5, asr: 2, maghrib: 0, isha: 0 });
  assert.equal(bad.notify.advance, 0);
  assert.equal(bad.notify.prayers.fajr, true);
  assert.equal(bad.hijriAdjust, 0);
  assert.equal(bad.lang, 'zh');
  assert.equal(bad.loc, null);
  assert.equal(bad.stats, true);
  assert.equal(normalizeSettings(null).city, 'dushanbe');
  assert.equal(normalizeSettings([]).city, 'dushanbe');
  // "我的位置"没有坐标时回到默认城市
  assert.equal(normalizeSettings({ city: 'here' }).city, 'dushanbe');
  assert.equal(normalizeSettings({ city: 'here', loc: { lat: 55.7, lon: 37.6, utcOffset: 3 } }).city, 'here');
  // 老版本调过伊斯兰历的，视为手动
  assert.equal(normalizeSettings({ hijriAdjust: 1 }).hijriManual, true);
  assert.equal(normalizeSettings({ hijriAdjust: 0 }).hijriManual, false);
});
