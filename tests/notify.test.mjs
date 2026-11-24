// 提醒排程测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule, notifId, DEFAULT_NOTIFY, SAHUR_WARN_MIN } from '../src/core/notify.js';
import { getCity } from '../src/core/cities.js';
import { timesFor } from '../src/core/prayer-times.js';
import { fastTimes } from '../src/core/ramadan.js';

const city = getCity('dushanbe');
const base = { remind: true, notify: DEFAULT_NOTIFY, offsets: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, hijriAdjust: 0 };
const at = (y, m, d, hh, mm) => new Date(Date.UTC(y, m - 1, d, hh - 5, mm)); // 杜尚别当地时间

test('7 天 × 5 番拜 = 35 条；已过去的不排', () => {
  const early = buildSchedule(city, at(2026, 12, 1, 3, 0), base);
  assert.equal(early.length, 35);
  const noon = buildSchedule(city, at(2026, 12, 1, 13, 0), base);
  assert.equal(noon.length, 33); // 当天晨礼、晌礼已过
  assert.ok(noon.every((x) => x.at > at(2026, 12, 1, 13, 0)));
  assert.equal(new Set(early.map((x) => x.id)).size, early.length);
});

test('时间与礼拜时间一致；提前 10 分钟', () => {
  const list = buildSchedule(city, at(2026, 12, 1, 3, 0), base);
  const t = timesFor(city, { y: 2026, m: 12, d: 1 });
  assert.equal(list[0].prayer, 'fajr');
  assert.equal(list[0].at.getTime(), t.fajr.getTime());
  const adv = buildSchedule(city, at(2026, 12, 1, 3, 0), { ...base, notify: { ...DEFAULT_NOTIFY, advance: 10 } });
  assert.equal(adv[0].at.getTime(), t.fajr.getTime() - 10 * 60000);
  assert.match(adv[0].title, /10/);
});

test('关掉的番拜不提醒；总开关关掉一条都不排', () => {
  const s = { ...base, notify: { ...DEFAULT_NOTIFY, prayers: { ...DEFAULT_NOTIFY.prayers, fajr: false, isha: false } } };
  const list = buildSchedule(city, at(2026, 12, 1, 3, 0), s);
  assert.equal(list.length, 21);
  assert.ok(!list.some((x) => x.prayer === 'fajr' || x.prayer === 'isha'));
  assert.equal(buildSchedule(city, at(2026, 12, 1, 3, 0), { ...base, remind: false }).length, 0);
});

test('星期五的晌礼写作主麻日', () => {
  const list = buildSchedule(city, at(2026, 12, 4, 3, 0), base); // 2026-12-04 是星期五
  const fri = list.find((x) => x.prayer === 'dhuhr');
  assert.match(fri.title, /主麻/);
});

test('斋月：每天多两条（停止吃喝前 30 分钟、开斋），总数不超过 60', () => {
  const now = at(2027, 2, 10, 2, 0);
  const list = buildSchedule(city, now, base);
  const sahur = list.filter((x) => x.kind === 'sahur');
  const iftar = list.filter((x) => x.kind === 'iftar');
  assert.equal(sahur.length, 7);
  assert.equal(iftar.length, 7);
  assert.ok(list.length <= 60);
  const f = fastTimes(city, { y: 2027, m: 2, d: 10 });
  assert.equal(sahur[0].at.getTime(), f.sahurEnd.getTime() - SAHUR_WARN_MIN * 60000);
  assert.equal(iftar[0].at.getTime(), f.iftar.getTime());
  assert.equal(buildSchedule(city, now, { ...base, notify: { ...DEFAULT_NOTIFY, ramadan: false } }).filter((x) => x.kind !== 'prayer').length, 0);
});

test('提醒编号：同一天同一番拜，重排时编号不变', () => {
  assert.equal(notifId({ y: 2026, m: 12, d: 1 }, 2), 202612012);
  assert.ok(notifId({ y: 2099, m: 12, d: 31 }, 7) < 2 ** 31); // 安卓要求 32 位整数
});
