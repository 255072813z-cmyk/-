// 到时间轻声提醒一次：页面上出现一条安静的提示；用户打开"提醒声"时再响一声。
// 每番拜只提醒一次（记在本机），时间过去 10 分钟后才打开页面就不再提醒。
import { load, save } from './storage.js';
import { ymdKey } from './clock.js';
import { PRAYERS } from './prayer-times.js';
import { playChime } from './chime.js';
import { isNativeApp } from './api.js';
import { t } from '../i18n/index.js';

const WINDOW = 10 * 60 * 1000;
const SOON = 10 * 60 * 1000; // 到点前 10 分钟轻声说一句

/** 到点前 10 分钟：一句温和的话（网页开着时；手机应用里由系统通知说） */
function checkSoon(ctx, on) {
  if (isNativeApp() || (ctx.settings.notify && ctx.settings.notify.soon === false)) return;
  const n = ctx.now.getTime();
  for (const p of PRAYERS) {
    if (on[p] === false) continue;
    const left = ctx.sched.times[p].getTime() - n;
    if (left > 0 && left <= SOON) {
      const key = ymdKey(ctx.sched.today) + ':' + p + ':' + ctx.city.id;
      if (load('soonReminded', '') === key) return;
      save('soonReminded', key);
      const isFriday = ctx.sched.today.wd === 5;
      const name = t(p === 'dhuhr' && isFriday ? 'prayer.jumuah' : 'prayer.' + p);
      // 首页的主卡片上已经写着这句话，就不再弹提示
      if (document.querySelector('[data-soon]')) return;
      softToast(t('home.soon', { name, n: Math.ceil(left / 60000) }), 12000);
      return;
    }
  }
}

export function checkReminder(ctx) {
  const s = ctx.settings;
  if (!s.remind || !ctx.sched) return;
  const times = ctx.sched.times;
  const n = ctx.now.getTime();
  const on = (s.notify && s.notify.prayers) || {};
  checkSoon(ctx, on);
  for (const p of PRAYERS) {
    if (on[p] === false) continue;
    const at = times[p].getTime();
    if (n >= at && n - at < WINDOW) {
      const key = ymdKey(ctx.sched.today) + ':' + p + ':' + ctx.city.id;
      if (load('reminded', '') === key) return;
      save('reminded', key);
      showToast(p, ctx);
      // 手机应用里系统通知会响，这里不再重复出声
      if (s.sound && !isNativeApp()) playChime();
      return;
    }
  }
}

export function showToast(prayer, ctx) {
  const layer = document.querySelector('.toast-layer');
  if (!layer) return;
  const isFriday = ctx && ctx.sched && ctx.sched.today.wd === 5;
  const name = t(prayer === 'dhuhr' && isFriday ? 'prayer.jumuah' : 'prayer.' + prayer);
  layer.innerHTML = `<div class="toast" role="status">
      <div class="toast-text"><strong>${t('remind.title', { name })}</strong><span>${t('remind.body')}</span></div>
      <div class="toast-actions">
        <a class="btn btn-primary btn-sm" href="#/pray/guide/${prayer}">${t('remind.go')}</a>
        <button class="btn btn-ghost btn-sm" type="button" data-close>${t('remind.close')}</button>
      </div></div>`;
  const close = () => {
    layer.innerHTML = '';
  };
  layer.querySelector('[data-close]').addEventListener('click', close);
  layer.querySelector('a').addEventListener('click', close);
}

/** 一句轻声的提示（几秒后自己消失） */
export function softToast(text, ms = 5000) {
  const layer = document.querySelector('.toast-layer');
  if (!layer) return;
  layer.innerHTML = `<div class="toast" role="status"><div class="toast-text"><span></span></div></div>`;
  layer.querySelector('span').textContent = text;
  setTimeout(() => {
    if (layer.querySelector('span') && layer.querySelector('span').textContent === text) layer.innerHTML = '';
  }, ms);
}
