// 斋月计算测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ramadanStatus, fastTimes, fastPhase, holidays, SAHUR_MARGIN_MIN } from '../src/core/ramadan.js';
import { timesFor } from '../src/core/prayer-times.js';
import { getCity } from '../src/core/cities.js';
import { fmtHM } from '../src/core/clock.js';
import { buildSteps } from '../src/content/prayers.js';
import { JUZ } from '../src/content/juz.js';

const dushanbe = getCity('dushanbe');

test('1448 年斋月：推算 2027-02-08 开始，29 天，开斋节 03-09，古尔邦节 05-16', () => {
  const before = ramadanStatus({ y: 2026, m: 11, d: 24 });
  assert.equal(before.active, false);
  assert.deepEqual([before.start.y, before.start.m, before.start.d], [2027, 2, 8]);
  assert.equal(before.start.inDays, 76);
  const mid = ramadanStatus({ y: 2027, m: 2, d: 20 });
  assert.equal(mid.active, true);
  assert.equal(mid.day, 13);
  assert.equal(mid.length, 29);
  assert.deepEqual([mid.eid.m, mid.eid.d], [3, 9]);
  const h = holidays({ y: 2027, m: 1, d: 1 });
  assert.deepEqual([h.fitr.m, h.fitr.d, h.adha.m, h.adha.d], [3, 9, 5, 16]);
});

test('伊斯兰历调整 −1 天时，斋月推迟一天开始', () => {
  const st = ramadanStatus({ y: 2026, m: 11, d: 24 }, -1);
  assert.deepEqual([st.start.m, st.start.d], [2, 9]);
});

test('封斋（停止吃喝）比黎明早 10 分钟；开斋不早于日落', () => {
  for (const d of [8, 15, 22]) {
    const ymd = { y: 2027, m: 2, d };
    const f = fastTimes(dushanbe, ymd);
    const t = timesFor(dushanbe, ymd);
    assert.equal(t.fajr - f.sahurEnd, SAHUR_MARGIN_MIN * 60000);
    assert.ok(f.iftar >= t.sunset);
  }
});

test('按清真寺微调时，封斋只会更早、开斋只会更晚', () => {
  const ymd = { y: 2027, m: 2, d: 20 };
  const base = fastTimes(dushanbe, ymd);
  const later = fastTimes(dushanbe, ymd, { fajr: 8, maghrib: -8 });
  assert.ok(later.sahurEnd <= base.sahurEnd);
  assert.ok(later.iftar >= base.iftar);
  const earlier = fastTimes(dushanbe, ymd, { fajr: -6, maghrib: 6 });
  assert.ok(earlier.sahurEnd < base.sahurEnd);
  assert.ok(earlier.iftar > base.iftar);
});

test('与第三方转载的 2027 斋月时间表对照：本站停止吃喝时间不晚于它', () => {
  // time-namaz.com（称照搬塔吉克乌莱玛委员会日历），2026-11 抓取
  const published = { 8: '05:49', 15: '05:42', 22: '05:33' };
  const mar = { 1: '05:24', 8: '05:13' };
  const toMin = (s) => +s.slice(0, 2) * 60 + +s.slice(3, 5);
  for (const [d, s] of Object.entries(published)) assert.ok(toMin(fmtHM(fastTimes(dushanbe, { y: 2027, m: 2, d: +d }).sahurEnd)) <= toMin(s), `2/${d}`);
  for (const [d, s] of Object.entries(mar)) assert.ok(toMin(fmtHM(fastTimes(dushanbe, { y: 2027, m: 3, d: +d }).sahurEnd)) <= toMin(s), `3/${d}`);
});

test('一天中的斋戒阶段', () => {
  const at = (hh, mm) => new Date(Date.UTC(2027, 1, 20, hh - 5, mm));
  assert.equal(fastPhase(dushanbe, at(4, 0)).phase, 'before');
  assert.equal(fastPhase(dushanbe, at(12, 0)).phase, 'fasting');
  assert.equal(fastPhase(dushanbe, at(20, 0)).phase, 'after');
});

test('间歇拜每组 2 拜，每拜都念经文，可出声念', () => {
  const { steps, unit } = buildSteps('tarawih', 'set');
  assert.equal(unit.rakats, 2);
  assert.equal(steps.filter((s) => s.title === '再念一段经文').length, 2);
  assert.match(steps.find((s) => s.title === '开端章').how, /可以出声念/);
  assert.match(steps[0].how, /间歇拜/);
});

test('古兰经 30 卷连续、覆盖 1–604 页', () => {
  assert.equal(JUZ.length, 30);
  assert.equal(JUZ[0].pages[0], 1);
  assert.equal(JUZ[29].pages[1], 604);
  assert.deepEqual(JUZ[29].from, { surah: 78, ayah: 1 });
  for (let i = 1; i < 30; i++) assert.ok(JUZ[i].pages[0] - JUZ[i - 1].pages[1] <= 1);
});
