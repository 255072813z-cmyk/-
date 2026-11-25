// 安卓桌面小组件：把未来 7 天的礼拜时间交给它（只在手机里，不联网）。
// 小组件本身是原生代码（android/app/src/main/java/.../PrayerWidget.java），只负责显示，到下一番的时刻自己刷新。
// 每次打开应用、改城市或设置时更新一次；7 天不打开，小组件提示"打开一次应用"。
import { timesFor, PRAYERS } from './prayer-times.js';
import { addDays, ymdKey } from './clock.js';
import { platform } from './api.js';
import { t } from '../i18n/index.js';
import { cityName } from '../i18n/format.js';

export const WIDGET_DAYS = 7;

/** 交给小组件的数据（时间是毫秒时间戳；off = 城市的 UTC 偏移分钟数，小组件按城市当地时间显示） */
export function widgetData(ctx) {
  const days = [];
  for (let i = 0; i < WIDGET_DAYS; i++) {
    const ymd = addDays(ctx.sched.today, i);
    const T = timesFor(ctx.city, ymd, ctx.offsets);
    days.push({ d: ymdKey(ymd), fri: ymd.wd === 5, t: Object.fromEntries(PRAYERS.map((p) => [p, T[p].getTime()])) });
  }
  const labels = {
    ...Object.fromEntries(PRAYERS.map((p) => [p, t('prayer.' + p)])),
    jumuah: t('home.jumuah'),
    next: t('home.next'),
    // 安卓的格式写法：%1$d 小时、%2$d 分钟
    leftHM: t('card.left', { dur: t('dur.textHM', { h: '%1$d', m: '%2$d' }) }),
    leftM: t('card.left', { dur: t('dur.textM', { m: '%1$d' }) }),
  };
  return { v: 1, city: cityName(ctx.city), off: Math.round(ctx.city.utcOffset * 60), labels, days };
}

let plugin = null;
export async function updateWidget(ctx) {
  if (platform() !== 'android') return;
  try {
    if (!plugin) plugin = (await import('@capacitor/core')).registerPlugin('Widget');
    await plugin.update({ data: JSON.stringify(widgetData(ctx)) });
  } catch (e) {
    /* 旧版本应用没有这个插件：不影响别的 */
  }
}
