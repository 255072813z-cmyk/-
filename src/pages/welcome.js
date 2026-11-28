// 第一次打开的引导：三步，带着走一遍，然后进首页。
//   1) 欢迎：选语言，"你是年轻人，还是年纪大的人？"
//   2) 城市：按手机时区猜的城市——自动定位 / 对，我在这里 / 选别的城市
//   3) 提醒：手机应用里开启通知；网页上说明"页面开着时到点轻声提示"
// 是一整页（不是弹窗）；底部导航先藏起来，让人只做眼前这一步。任何时候都能在设置里改。
import { t, LANGS } from '../i18n/index.js';
import { cityName } from '../i18n/format.js';
import { setSettings } from '../core/settings.js';
import { isNativeApp } from '../core/api.js';
import { markFeature } from '../core/usage.js';
import { ymdKey } from '../core/clock.js';
import { star8 } from '../ui/art.js';

const STEPS = 3;
// 现在在第几步、刚才往哪个方向走（换语言、选城市回来时页面会重画，步骤不能丢）
let step = 1;
let dir = 'next';

function dots() {
  return `<div class="ob-dots" role="progressbar" aria-valuemin="1" aria-valuemax="${STEPS}" aria-valuenow="${step}" aria-label="${t('ob.step', { n: step, all: STEPS })}">
    ${Array.from({ length: STEPS }, (_, i) => `<span class="ob-dot ${i + 1 === step ? 'is-on' : i + 1 < step ? 'is-done' : ''}"><i></i></span>`).join('')}
  </div>`;
}

function stepHello(ctx) {
  const s = ctx.settings;
  return `<div class="ob-mark" aria-hidden="true">${star8(64)}</div>
    <p class="ob-salam" lang="ar" dir="rtl">السَّلَامُ عَلَيْكُمْ</p>
    <h1 class="ob-title">${t('ob.title', { app: t('app.name') })}</h1>
    <p class="ob-sub">${t('ob.sub')}</p>
    <div class="segmented lang-grid ob-langs" role="group" aria-label="${t('settings.langTitle')}">
      ${Object.entries(LANGS)
        .map(([code, l]) => `<button type="button" class="seg ${s.lang === code ? 'is-on' : ''}" data-ob-lang="${code}" lang="${l.locale}" aria-pressed="${s.lang === code}">${l.name}</button>`)
        .join('')}
    </div>
    <p class="ob-q">${t('mode.ask')}</p>
    <div class="mode-pick">
      <button type="button" class="mode-opt ${s.modeAsked && s.mode === 'young' ? 'is-on' : ''}" data-ob-mode="young"><b>${t('mode.young')}</b><small>${t('mode.youngSub')}</small></button>
      <button type="button" class="mode-opt is-elder ${s.modeAsked && s.mode === 'elder' ? 'is-on' : ''}" data-ob-mode="elder"><b>${t('mode.elder')}</b><small>${t('mode.elderSub')}</small></button>
    </div>
    <p class="note ob-later">${t('mode.askNote')}</p>`;
}

function stepCity(ctx) {
  return `<div class="ob-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"/><circle cx="12" cy="10" r="2.6"/></svg></div>
    <h1 class="ob-title">${t('ob.cityTitle')}</h1>
    <p class="ob-sub">${t('home.welcomeText', { city: `<b>${cityName(ctx.city)}</b>` })}</p>
    <div class="ob-actions">
      <button type="button" class="btn btn-primary btn-wide" data-ob-auto>${t('home.welcomeAuto')}</button>
      <button type="button" class="btn btn-ghost btn-wide" data-ob-city-ok>${t('home.welcomeOk', { city: cityName(ctx.city) })}</button>
      <a class="btn btn-ghost btn-wide" href="#/city">${t('home.welcomeChoose')}</a>
    </div>
    <p class="note" data-ob-msg aria-live="polite">${t('home.welcomeAutoNote')}</p>`;
}

function stepRemind() {
  const app = isNativeApp();
  return `<div class="ob-icon ob-bell" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15Z"/><path d="M10 21h4"/></svg></div>
    <h1 class="ob-title">${t('ob.remindTitle')}</h1>
    <p class="ob-sub">${app ? t('home.notifyText') : t('ob.remindWeb')}</p>
    <div class="ob-actions">
      ${
        app
          ? `<button type="button" class="btn btn-primary btn-wide" data-ob-notify>${t('home.notifyOn')}</button>
             <button type="button" class="btn btn-ghost btn-wide" data-ob-finish>${t('ob.later')}</button>`
          : `<button type="button" class="btn btn-primary btn-wide" data-ob-finish>${t('ob.start')}</button>`
      }
    </div>
    <p class="note">${t('ob.private')}</p>`;
}

export function welcomePage(ctx) {
  const body = step === 1 ? stepHello(ctx) : step === 2 ? stepCity(ctx) : stepRemind();
  const html = `
  <div class="page welcome">
    <div class="ob-top">
      ${step > 1 ? `<button type="button" class="ob-back" data-ob-back aria-label="${t('ob.back')}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>` : '<span class="ob-back-gap"></span>'}
      ${dots()}
      <span class="ob-back-gap"></span>
    </div>
    <section class="ob-step ob-${dir}" data-ob-step="${step}">${body}</section>
  </div>`;

  const go = (n) => {
    dir = n > step ? 'next' : 'prev';
    step = Math.max(1, Math.min(STEPS, n));
    ctx.rerender();
  };
  const finish = () => {
    step = 1;
    dir = 'next';
    setSettings({ onboarded: true, modeAsked: true, cityConfirmed: true });
  };

  return {
    html,
    mount(el) {
      document.body.classList.add('is-onboarding');
      if (navigator.vibrate && step > 1) navigator.vibrate(8);
      const back = el.querySelector('[data-ob-back]');
      if (back) back.addEventListener('click', () => go(step - 1));
      el.querySelectorAll('[data-ob-lang]').forEach((b) => b.addEventListener('click', () => setSettings({ lang: b.dataset.obLang })));
      el.querySelectorAll('[data-ob-mode]').forEach((b) =>
        b.addEventListener('click', () => {
          // 先让按下去的那张亮一下，再走到下一步
          el.querySelectorAll('[data-ob-mode]').forEach((x) => x.classList.toggle('is-on', x === b));
          setTimeout(() => {
            dir = 'next';
            step = 2;
            setSettings({ mode: b.dataset.obMode, modeAsked: true });
          }, 180);
        }),
      );
      const ok = el.querySelector('[data-ob-city-ok]');
      if (ok)
        ok.addEventListener('click', () => {
          dir = 'next';
          step = 3;
          setSettings({ cityConfirmed: true });
        });
      // 自动定位：位置只在手机上算礼拜时间和朝向，不上传；时区用手机的
      const auto = el.querySelector('[data-ob-auto]');
      if (auto)
        auto.addEventListener('click', async () => {
          const msg = el.querySelector('[data-ob-msg]');
          auto.disabled = true;
          msg.textContent = t('city.locating');
          try {
            const { locate } = await import('../core/location.js');
            const loc = await locate();
            markFeature('here', ymdKey(ctx.sched.today));
            dir = 'next';
            step = 3;
            setSettings({ city: 'here', loc, cityConfirmed: true, autoLoc: true });
          } catch (e) {
            auto.disabled = false;
            msg.textContent = t(e && e.code === 1 ? 'city.denied' : e && e.message === 'unsupported' ? 'city.unsupported' : 'city.failed');
          }
        });
      const notify = el.querySelector('[data-ob-notify]');
      if (notify)
        notify.addEventListener('click', async () => {
          notify.disabled = true;
          try {
            await (await import('../core/notify.js')).askNotifyPermission();
          } catch (e) {
            /* 没给权限也照样进首页；首页会再请一次 */
          }
          finish();
        });
      const fin = el.querySelector('[data-ob-finish]');
      if (fin) fin.addEventListener('click', finish);
    },
    unmount() {
      document.body.classList.remove('is-onboarding');
    },
  };
}
