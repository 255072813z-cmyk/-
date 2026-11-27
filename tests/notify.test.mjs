// 提醒排程测试
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSchedule, notifId, soonId, DEFAULT_NOTIFY, SAHUR_WARN_MIN, SOON_MIN, SOON_DAYS } from '../src/core/notify.js';
import { getCity } from '../src/core/cities.js';
import { timesFor } from '../src/core/prayer-times.js';
import { fastTimes } from '../src/core/ramadan.js';
// 界面文字按需下载：测试里先把中文词典准备好
{
  const i18n = await import('../src/i18n/index.js');
  await i18n.loadLang('zh');
  i18n.setLang('zh');
}

const city = getCity('dushanbe');
const base = { remind: true, notify: DEFAULT_NOTIFY, offsets: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 }, hijriAdjust: 0 };
const at = (y, m, d, hh, mm) => new Date(Date.UTC(y, m - 1, d, hh - 5, mm)); // 杜尚别当地时间

test('7 天 × 5 番拜 = 35 条；已过去的不排', () => {
  const early = buildSchedule(city, at(2026, 12, 1, 3, 0), base);
  assert.equal(early.filter((x) => x.kind === 'prayer').length, 35);
  const noon = buildSchedule(city, at(2026, 12, 1, 13, 0), base);
  assert.equal(noon.filter((x) => x.kind === 'prayer').length, 33); // 当天晨礼、晌礼已过
  assert.ok(noon.every((x) => x.at > at(2026, 12, 1, 13, 0)));
  assert.equal(new Set(early.map((x) => x.id)).size, early.length);
});

test('时间与礼拜时间一致；提前 10 分钟', () => {
  const list = buildSchedule(city, at(2026, 12, 1, 3, 0), base).filter((x) => x.kind === 'prayer');
  const t = timesFor(city, { y: 2026, m: 12, d: 1 });
  assert.equal(list[0].prayer, 'fajr');
  assert.equal(list[0].at.getTime(), t.fajr.getTime());
  const adv = buildSchedule(city, at(2026, 12, 1, 3, 0), { ...base, notify: { ...DEFAULT_NOTIFY, advance: 10 } });
  assert.equal(adv[0].at.getTime(), t.fajr.getTime() - 10 * 60000);
  assert.match(adv[0].title, /10/);
  // 自己设了提前 10 分钟：不再另外排"还有 10 分钟"那一条
  assert.equal(adv.filter((x) => x.kind === 'soon').length, 0);
});

test('到点前 10 分钟轻声说一句：只排最近 3 天，可以关掉', () => {
  const now = at(2026, 12, 1, 3, 0);
  const list = buildSchedule(city, now, base);
  const soon = list.filter((x) => x.kind === 'soon');
  assert.equal(soon.length, 5 * SOON_DAYS);
  const t = timesFor(city, { y: 2026, m: 12, d: 1 });
  assert.equal(soon[0].prayer, 'fajr');
  assert.equal(soon[0].at.getTime(), t.fajr.getTime() - SOON_MIN * 60000);
  assert.match(soon[0].title, /10 分钟/);
  assert.match(soon[0].body, /收个尾/);
  assert.equal(soon[0].id, soonId({ y: 2026, m: 12, d: 1 }, 0));
  assert.equal(new Set(list.map((x) => x.id)).size, list.length);
  assert.ok(soonId({ y: 2099, m: 12, d: 31 }, 4) < 2 ** 31);
  assert.equal(buildSchedule(city, now, { ...base, notify: { ...DEFAULT_NOTIFY, soon: false } }).filter((x) => x.kind === 'soon').length, 0);
});

test('关掉的番拜不提醒；总开关关掉一条都不排', () => {
  const s = { ...base, notify: { ...DEFAULT_NOTIFY, prayers: { ...DEFAULT_NOTIFY.prayers, fajr: false, isha: false } } };
  const list = buildSchedule(city, at(2026, 12, 1, 3, 0), s);
  assert.equal(list.filter((x) => x.kind === 'prayer').length, 21);
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
  assert.equal(buildSchedule(city, now, { ...base, notify: { ...DEFAULT_NOTIFY, ramadan: false } }).filter((x) => x.kind === 'sahur' || x.kind === 'iftar').length, 0);
});

test('提醒编号：同一天同一番拜，重排时编号不变', () => {
  assert.equal(notifId({ y: 2026, m: 12, d: 1 }, 2), 202612012);
  assert.ok(notifId({ y: 2099, m: 12, d: 31 }, 7) < 2 ** 31); // 安卓要求 32 位整数
});

test('主麻日提醒：星期五晌礼前 1 小时，一周一条；可以关掉', () => {
  const list = buildSchedule(city, at(2026, 12, 1, 3, 0), base); // 12 月 1 日是星期二，4 日是星期五
  const j = list.filter((x) => x.kind === 'jumuah');
  assert.equal(j.length, 1);
  const t = timesFor(city, { y: 2026, m: 12, d: 4 });
  assert.equal(j[0].at.getTime(), t.dhuhr.getTime() - 60 * 60000);
  assert.equal(j[0].id, notifId({ y: 2026, m: 12, d: 4 }, 8));
  assert.equal(new Set(list.map((x) => x.id)).size, list.length);
  const off = buildSchedule(city, at(2026, 12, 1, 3, 0), { ...base, notify: { ...DEFAULT_NOTIFY, jumuah: false } });
  assert.equal(off.filter((x) => x.kind === 'jumuah').length, 0);
});

test('打卡提醒：晚上 9 点（宵礼前就推到宵礼后）；今天已打卡就不排', () => {
  const list = buildSchedule(city, at(2026, 12, 1, 3, 0), base);
  const s = list.filter((x) => x.kind === 'streak');
  assert.equal(s.length, 7);
  assert.equal(s[0].at.getTime(), Date.UTC(2026, 11, 1, 21 - 5, 0));
  const done = buildSchedule(city, at(2026, 12, 1, 3, 0), { ...base, checkedToday: true });
  assert.equal(done.filter((x) => x.kind === 'streak').length, 6);
  assert.ok(list.length <= 64, `总数 ${list.length}`);
  const off = buildSchedule(city, at(2026, 12, 1, 3, 0), { ...base, notify: { ...DEFAULT_NOTIFY, streak: false } });
  assert.equal(off.filter((x) => x.kind === 'streak').length, 0);
});

test('平时标了"要封斋"的日子：也提醒封斋饭和开斋；没标的日子不提醒', () => {
  const now = at(2026, 12, 20, 21, 0); // 星期日晚上，标了星期一（12-21）要封斋
  const plain = buildSchedule(city, now, base);
  assert.equal(plain.filter((x) => x.kind === 'sahur' || x.kind === 'iftar').length, 0);
  const list = buildSchedule(city, now, { ...base, fastDays: ['2026-12-21'] });
  const f = fastTimes(city, { y: 2026, m: 12, d: 21 });
  const sahur = list.find((x) => x.kind === 'sahur');
  const iftar = list.find((x) => x.kind === 'iftar');
  assert.equal(sahur.at.getTime(), f.sahurEnd.getTime() - SAHUR_WARN_MIN * 60000);
  assert.equal(iftar.at.getTime(), f.iftar.getTime());
  assert.equal(list.filter((x) => x.kind === 'sahur').length, 1);
  // 封斋提醒关掉：标了也不提醒
  const off = buildSchedule(city, now, { ...base, notify: { ...DEFAULT_NOTIFY, ramadan: false }, fastDays: ['2026-12-21'] });
  assert.equal(off.filter((x) => x.kind === 'sahur').length, 0);
});

test('手机应用：排 14 天；最后加一条"打开一下就能续上"；苹果不超过 64 条', async () => {
  const { APP_DAYS, CAP } = await import('../src/core/notify.js');
  const now = at(2026, 12, 1, 3, 0);
  const android = buildSchedule(city, now, { ...base, days: APP_DAYS, cap: CAP.android, renew: true });
  const prayers = android.filter((x) => x.kind === 'prayer');
  assert.equal(prayers.length, 14 * 5, '安卓：14 天 × 5 番拜');
  const last = android[android.length - 1];
  assert.equal(last.kind, 'renew', '最后一条是续排提醒');
  assert.ok(last.at > prayers[prayers.length - 1].at);
  assert.equal(new Set(android.map((x) => x.id)).size, android.length, '编号不重复');
  const ios = buildSchedule(city, now, { ...base, days: APP_DAYS, cap: CAP.ios, renew: true });
  assert.ok(ios.length <= 64, '苹果最多 64 条');
  assert.equal(ios[ios.length - 1].kind, 'renew');
  assert.ok(ios.filter((x) => x.kind === 'prayer').length >= 45, '苹果也能排 9 天以上的礼拜提醒');
  assert.ok(ios.filter((x) => x.kind === 'soon').length >= 5, '苹果：今天的"还有 10 分钟"也排上了');
  // 不开提醒：什么都不排，也没有续排提醒
  assert.equal(buildSchedule(city, now, { ...base, remind: false, days: APP_DAYS, renew: true }).length, 0);
});
