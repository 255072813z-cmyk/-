// 提醒：排出未来几天要发的提醒（纯计算，便于测试），以及在手机应用里交给系统按时发出。
//
// 网页版只能在页面开着时提醒（见 reminder.js）。装成手机应用后，用系统的"本地通知"：
// 提前排好未来 7 天，每次打开应用、改了设置、回到前台时重新排一遍，所以关着应用、锁屏也会准时响。
// 不联网、不用推送服务器，什么信息都不上传。
import { timesFor, PRAYERS } from './prayer-times.js';
import { fastTimes } from './ramadan.js';
import { toHijri } from './hijri.js';
import { addDays, localParts, fmtHM, ymdKey } from './clock.js';
import { t } from '../i18n/index.js';

export const NOTIFY_DAYS = 7;
export const SAHUR_WARN_MIN = 30; // 斋月：停止吃喝前 30 分钟提醒一次
export const DEFAULT_NOTIFY = {
  prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
  advance: 0, // 提前几分钟（0 = 准时）
  ramadan: true, // 斋月里、和用户标了要封斋的日子，提醒封斋饭和开斋
  jumuah: true, // 星期五晌礼前 1 小时提醒主麻
  streak: true, // 晚上还没打卡时提醒一次
};
export const STREAK_HOUR = 21; // 当地晚上 9 点（宵礼还没到时，改到宵礼后 30 分钟）
export const JUMUAH_WARN_MIN = 60;

/** 每条提醒的编号：日期 × 10 + 序号（0–4 五番拜，6 封斋饭，7 开斋，8 主麻，9 打卡），同一条提醒重排时编号不变 */
export function notifId(ymd, idx) {
  return (ymd.y * 10000 + ymd.m * 100 + ymd.d) * 10 + idx;
}

/**
 * 从 now 起未来 NOTIFY_DAYS 天的提醒（已经过去的不排）。
 * 返回 [{ id, at, title, body, kind: 'prayer'|'sahur'|'iftar', prayer?, route }]
 */
export function buildSchedule(city, now, settings) {
  const out = [];
  if (!settings.remind) return out;
  const n = { ...DEFAULT_NOTIFY, ...(settings.notify || {}) };
  n.prayers = { ...DEFAULT_NOTIFY.prayers, ...(n.prayers || {}) };
  const today = localParts(now, city.utcOffset);
  for (let i = 0; i < NOTIFY_DAYS; i++) {
    const ymd = addDays(today, i);
    const times = timesFor(city, ymd, settings.offsets);
    PRAYERS.forEach((p, idx) => {
      if (!n.prayers[p]) return;
      const at = new Date(times[p].getTime() - (Number(n.advance) || 0) * 60000);
      if (at <= now) return;
      const name = t(ymd.wd === 5 && p === 'dhuhr' ? 'prayer.jumuah' : 'prayer.' + p);
      out.push({
        id: notifId(ymd, idx),
        at,
        title: n.advance ? t('notify.soonTitle', { name, n: n.advance }) : t('remind.title', { name }),
        body: t('notify.body', { time: fmtHM(times[p], city.utcOffset) }),
        kind: 'prayer',
        prayer: p,
        route: '#/pray/guide/' + p,
      });
    });
    // 晚上还没打卡：提醒一次。今天已经打卡就不排（打卡时会重新排一遍）
    if (n.streak && !(i === 0 && settings.checkedToday)) {
      const nine = Date.UTC(ymd.y, ymd.m - 1, ymd.d, STREAK_HOUR) - city.utcOffset * 3600e3;
      const at = new Date(Math.max(nine, times.isha.getTime() + 30 * 60000));
      const sameDay = localParts(at, city.utcOffset).d === ymd.d;
      if (at > now && sameDay)
        out.push({ id: notifId(ymd, 9), at, title: t('notify.streakTitle'), body: t('notify.streakBody'), kind: 'streak', route: '#/' });
    }
    if (n.jumuah && ymd.wd === 5) {
      const at = new Date(times.dhuhr.getTime() - JUMUAH_WARN_MIN * 60000);
      if (at > now) out.push({ id: notifId(ymd, 8), at, title: t('notify.jumuahTitle'), body: t('notify.jumuahBody', { time: fmtHM(times.dhuhr, city.utcOffset) }), kind: 'jumuah', route: '#/pray' });
    }
    const planned = Array.isArray(settings.fastDays) && settings.fastDays.includes(ymdKey(ymd));
    if (n.ramadan && (planned || toHijri(ymd, settings.hijriAdjust).m === 9)) {
      const f = fastTimes(city, ymd, settings.offsets);
      const warn = new Date(f.sahurEnd.getTime() - SAHUR_WARN_MIN * 60000);
      if (warn > now)
        out.push({ id: notifId(ymd, 6), at: warn, title: t('notify.sahurTitle'), body: t('notify.sahurBody', { time: fmtHM(f.sahurEnd, city.utcOffset), n: SAHUR_WARN_MIN }), kind: 'sahur', route: '#/ramadan' });
      if (f.iftar > now) out.push({ id: notifId(ymd, 7), at: f.iftar, title: t('notify.iftarTitle'), body: t('notify.iftarBody'), kind: 'iftar', route: '#/ramadan' });
    }
  }
  // 苹果手机最多同时排 64 条
  return out.sort((a, b) => a.at - b.at).slice(0, 60);
}

/** 是否运行在手机应用里（Capacitor 会在页面加载前注入） */
export function isNativeApp() {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch (e) {
    return false;
  }
}

// 注意：Capacitor 的插件对象不能直接作为 async 函数的返回值（会被当成 Promise 去调用 .then），所以包一层返回
let LN = null;
async function plugin() {
  if (!LN) LN = (await import('@capacitor/local-notifications')).LocalNotifications;
  return { ln: LN };
}

/** 通知权限 + 安卓"准时提醒"（精确闹钟）权限 */
export async function notifyStatus() {
  if (!isNativeApp()) return { native: false };
  const { ln } = await plugin();
  const perm = await ln.checkPermissions();
  let exact = 'granted';
  try {
    exact = (await ln.checkExactNotificationSetting()).exact_alarm;
  } catch (e) {
    exact = 'granted'; // 苹果、旧版安卓没有这项
  }
  return { native: true, display: perm.display, exact };
}

/** 请求通知权限（应在用户点按后调用） */
export async function askNotifyPermission() {
  if (!isNativeApp()) return 'unsupported';
  const { ln } = await plugin();
  return (await ln.requestPermissions()).display;
}

/** 打开系统"闹钟和提醒"设置，让提醒准时（安卓 12+） */
export async function openExactSetting() {
  if (!isNativeApp()) return;
  const { ln } = await plugin();
  try {
    await ln.changeExactNotificationSetting();
  } catch (e) {
    /* 不支持 */
  }
}

let syncing = null;
/**
 * 把提醒交给系统：先清掉之前排的，再排新的。
 * 不会弹出任何权限请求或设置页（那些只在用户点按时做）。
 */
export function syncNotifications(ctx) {
  if (!isNativeApp()) return Promise.resolve({ native: false });
  // 合并短时间内的多次调用
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      const { ln } = await plugin();
      const st = await notifyStatus();
      const pending = await ln.getPending();
      if (pending.notifications.length) await ln.cancel({ notifications: pending.notifications.map((x) => ({ id: x.id })) });
      if (st.display !== 'granted') return { ...st, count: 0 };
      try {
        await ln.createChannel({ id: 'prayer', name: t('notify.channel'), importance: 5, visibility: 1, vibration: true });
      } catch (e) {
        /* 苹果没有频道 */
      }
      const { streakStatus } = await import('./streak.js');
      const { fastPlan } = await import('./fasting.js');
      const todayKey = ymdKey(localParts(ctx.now, ctx.city.utcOffset));
      const checkedToday = streakStatus(todayKey).today;
      const fastDays = fastPlan(todayKey); // 用户标了要封斋的日子（斋月以外）
      const list = buildSchedule(ctx.city, ctx.now, { ...ctx.settings, offsets: ctx.offsets, hijriAdjust: ctx.hijriAdjust, checkedToday, fastDays });
      if (list.length)
        await ln.schedule({
          notifications: list.map((x) => ({
            id: x.id,
            title: x.title,
            body: x.body,
            schedule: { at: x.at, allowWhileIdle: true },
            channelId: 'prayer',
            // 没有"准时"权限时按普通方式排，不自动跳到设置页
            isExactNotification: st.exact === 'granted',
            extra: { route: x.route },
          })),
        });
      return { ...st, count: list.length, next: list[0] && list[0].at };
    } catch (e) {
      return { native: true, error: String(e && e.message) };
    } finally {
      setTimeout(() => (syncing = null), 300);
    }
  })();
  return syncing;
}

/** 发一条测试提醒（5 秒后），让用户确认手机真的会响 */
export async function testNotification() {
  if (!isNativeApp()) return false;
  const { ln } = await plugin();
  await ln.schedule({
    notifications: [
      {
        id: 99999,
        title: t('notify.testTitle'),
        body: t('notify.testBody'),
        schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true },
        channelId: 'prayer',
        isExactNotification: false,
      },
    ],
  });
  return true;
}

/** 点了通知：打开对应页面（跟做那番拜 / 斋月） */
export async function listenNotificationTaps() {
  if (!isNativeApp()) return;
  const { ln } = await plugin();
  ln.addListener('localNotificationActionPerformed', (e) => {
    const r = e && e.notification && e.notification.extra && e.notification.extra.route;
    if (typeof r === 'string' && /^#\/[a-z0-9/]*$/.test(r)) location.hash = r; // 只接受本应用自己的页面地址
  });
}
