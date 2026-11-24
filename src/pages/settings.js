// 设置：字号、提醒、按清真寺微调时间、伊斯兰历调整、语言。全部只存在本机。
import { getSettings, setSettings } from '../core/settings.js';
import { unlockAudio, playChime } from '../core/chime.js';
import { timesFor, PRAYERS } from '../core/prayer-times.js';
import { fmtHM } from '../core/clock.js';
import { toHijri } from '../core/hijri.js';
import { ICONS, star8 } from '../ui/art.js';
import { t, LANGS } from '../i18n/index.js';
import { hijriLine, cityName, remoteText } from '../i18n/format.js';
import { effectiveOffsets } from '../core/remote.js';
import { isNativeApp, notifyStatus, askNotifyPermission, openExactSetting, testNotification } from '../core/notify.js';

const signed = (v) => (v > 0 ? '+' : '') + v;

export function settingsPage(ctx) {
  const s = getSettings();
  // "计算"一栏：天文计算 + 官方校正（如果后台发布了）；用户的微调叠加在上面
  const base = timesFor(ctx.city, ctx.sched.today, effectiveOffsets({}, ctx.remote, ctx.city).offsets);
  const h = toHijri(ctx.sched.today, ctx.hijriAdjust);
  const officialHijri = ctx.remote.hijri && ctx.remote.hijri[ctx.city.cc];
  const fs = ['settings.fs0', 'settings.fs1', 'settings.fs2'];
  const app = isNativeApp();
  const html = `
  <div class="page settings">
    <div class="page-head"><a class="back" href="#/" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('nav.settings')}</h1></div>

    <a class="card card-link city-set" href="#/city">
      <span class="athome-t">${t('settings.cityIs', { name: cityName(ctx.city) })}</span>
      <span class="athome-s">${t('settings.cityChange')} →</span>
    </a>

    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('settings.fontTitle')}</h2>
      <div class="segmented big" role="group" aria-label="${t('settings.fontTitle')}">
        ${fs.map((k, i) => `<button type="button" class="seg ${s.fontScale === i ? 'is-on' : ''}" data-fs="${i}" aria-pressed="${s.fontScale === i}" style="font-size:${1 + i * 0.12}em">${t(k)}</button>`).join('')}
      </div>
    </section>

    <section class="card" data-remind-card>
      <h2 class="card-title">${star8(18)} ${t('settings.remindTitle')}</h2>
      ${app ? `<p class="notify-status" data-notify-status aria-live="polite">${t('common.loading')}</p>` : ''}
      <label class="switch-row"><span><b>${t(app ? 'settings.remindApp' : 'settings.remind')}</b><small>${t(app ? 'settings.remindAppSub' : 'settings.remindSub')}</small></span>
        <input type="checkbox" data-remind ${s.remind ? 'checked' : ''}></label>
      <div class="notify-prayers" role="group" aria-label="${t('settings.whichPrayers')}">
        ${PRAYERS.map((p) => `<label class="chip"><input type="checkbox" data-np="${p}" ${s.notify.prayers[p] ? 'checked' : ''}> ${t('prayer.' + p)}</label>`).join('')}
      </div>
      <p class="sub-title">${t('settings.advance')}</p>
      <div class="segmented" role="group" aria-label="${t('settings.advance')}">
        ${[0, 5, 10, 15].map((m) => `<button type="button" class="seg ${Number(s.notify.advance) === m ? 'is-on' : ''}" data-adv="${m}" aria-pressed="${Number(s.notify.advance) === m}">${m ? t('settings.advanceN', { n: m }) : t('settings.onTime')}</button>`).join('')}
      </div>
      <label class="switch-row"><span><b>${t('settings.ramadanRemind')}</b><small>${t('settings.ramadanRemindSub')}</small></span>
        <input type="checkbox" data-nr ${s.notify.ramadan ? 'checked' : ''}></label>
      ${
        app
          ? `<div class="step-btns"><button type="button" class="btn btn-ghost btn-sm" data-test>${t('settings.test')}</button></div>
             <p class="note">${t('settings.weekly')}</p>`
          : `<label class="switch-row"><span><b>${t('settings.sound')}</b><small>${t('settings.soundSub')}</small></span>
               <input type="checkbox" data-sound ${s.sound ? 'checked' : ''}></label>
             <p class="note">${t('settings.webOnly')}</p>`
      }
    </section>

    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('home.adjust')}</h2>
      <p class="note">${t('settings.adjustNote', { city: cityName(ctx.city) })}</p>
      ${ctx.official ? `<p class="note">${t('settings.officialNote', { src: remoteText(ctx.official) })}</p>` : ''}
      <ul class="adj-list">
        ${PRAYERS.map((p) => {
          const v = Number(s.offsets[p]) || 0;
          const name = t('prayer.' + p);
          return `<li class="adj">
            <span class="adj-name">${name}</span>
            <span class="adj-base">${t(ctx.official ? 'settings.official' : 'settings.calc', { time: fmtHM(base[p]) })}</span>
            <span class="adj-ctrl">
              <button type="button" class="btn-round" data-adj="${p}" data-d="-1" aria-label="${t('settings.earlier', { name })}">−</button>
              <output class="adj-val">${t('settings.minutes', { n: signed(v) })}</output>
              <button type="button" class="btn-round" data-adj="${p}" data-d="1" aria-label="${t('settings.later', { name })}">+</button>
            </span>
            <span class="adj-res">${t('settings.shown', { time: `<b>${fmtHM(new Date(base[p].getTime() + v * 60000))}</b>` })}</span>
          </li>`;
        }).join('')}
      </ul>
      <button type="button" class="btn btn-ghost btn-sm" data-adj-reset>${t('settings.adjustReset')}</button>
    </section>

    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('settings.hijriTitle')}</h2>
      <p>${t('settings.today')} ${hijriLine(h)}</p>
      <p class="note">${t('settings.hijriNote', { method: t(h.source === 'umalqura' ? 'settings.umalqura' : 'settings.tabular') })}</p>
      <div class="segmented" role="group" aria-label="${t('settings.hijriTitle')}">
        <button type="button" class="seg ${!s.hijriManual ? 'is-on' : ''}" data-hj-auto aria-pressed="${!s.hijriManual}">${t('settings.hijriAuto')}</button>
        ${[-2, -1, 0, 1, 2].map((d) => {
          const on = s.hijriManual && s.hijriAdjust === d;
          return `<button type="button" class="seg ${on ? 'is-on' : ''}" data-hj="${d}" aria-pressed="${on}">${t('settings.days', { n: signed(d) })}</button>`;
        }).join('')}
      </div>
      <p class="note">${
        s.hijriManual
          ? t('settings.hijriManualNote')
          : officialHijri
            ? t('settings.hijriAutoOfficial', { src: remoteText(officialHijri.src), n: signed(officialHijri.adjust) })
            : t('settings.hijriAutoNote')
      }</p>
    </section>

    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('settings.statsTitle')}</h2>
      <label class="switch-row"><span><b>${t('settings.stats')}</b><small>${t('settings.statsSub')}</small></span>
        <input type="checkbox" data-stats ${s.stats !== false ? 'checked' : ''}></label>
    </section>

    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('settings.langTitle')}</h2>
      <div class="segmented big" role="group" aria-label="${t('settings.langTitle')}">
        ${Object.entries(LANGS)
          .map(
            ([code, l]) =>
              `<button type="button" class="seg ${s.lang === code ? 'is-on' : ''}" data-lang="${code}" aria-pressed="${s.lang === code}" ${l.ready ? '' : 'disabled'}>${l.name}${l.ready ? '' : `<small class="seg-sub">${t('settings.langSoon')}</small>`}</button>`,
          )
          .join('')}
      </div>
    </section>

    <p class="privacy">${t('privacy')}</p>
  </div>`;

  return {
    html,
    onNotify(r) {
      const el = document.getElementById('app');
      if (el) drawStatus(el, r);
    },
    mount(el) {
      el.querySelectorAll('[data-fs]').forEach((b) => b.addEventListener('click', () => setSettings({ fontScale: +b.dataset.fs })));
      el.querySelector('[data-remind]').addEventListener('change', async (e) => {
        // 手机应用里第一次打开提醒时，向系统要通知权限（必须在点按后要）
        if (e.target.checked && app) await askNotifyPermission();
        setSettings({ remind: e.target.checked });
      });
      const sound = el.querySelector('[data-sound]');
      if (sound)
        sound.addEventListener('change', (e) => {
          if (e.target.checked) {
            unlockAudio();
            playChime();
          }
          setSettings({ sound: e.target.checked });
        });
      const notify = () => getSettings().notify;
      el.querySelectorAll('[data-np]').forEach((cb) =>
        cb.addEventListener('change', () => setSettings({ notify: { ...notify(), prayers: { ...notify().prayers, [cb.dataset.np]: cb.checked } } })),
      );
      el.querySelectorAll('[data-adv]').forEach((b) => b.addEventListener('click', () => setSettings({ notify: { ...notify(), advance: +b.dataset.adv } })));
      el.querySelector('[data-nr]').addEventListener('change', (e) => setSettings({ notify: { ...notify(), ramadan: e.target.checked } }));
      const test = el.querySelector('[data-test]');
      if (test)
        test.addEventListener('click', async () => {
          if ((await notifyStatus()).display !== 'granted') await askNotifyPermission();
          if (await testNotification()) test.textContent = t('settings.testSent');
        });
      if (app) drawStatus(el, ctx.notifyState);
      el.querySelectorAll('[data-adj]').forEach((b) =>
        b.addEventListener('click', () => {
          const cur = getSettings().offsets;
          const p = b.dataset.adj;
          const v = Math.max(-30, Math.min(30, (Number(cur[p]) || 0) + Number(b.dataset.d)));
          setSettings({ offsets: { ...cur, [p]: v } });
          const again = document.querySelector(`[data-adj="${p}"][data-d="${b.dataset.d}"]`);
          if (again) again.focus();
        }),
      );
      el.querySelector('[data-adj-reset]').addEventListener('click', () =>
        setSettings({ offsets: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 } }),
      );
      el.querySelectorAll('[data-hj]').forEach((b) => b.addEventListener('click', () => setSettings({ hijriAdjust: +b.dataset.hj, hijriManual: true })));
      el.querySelector('[data-hj-auto]').addEventListener('click', () => setSettings({ hijriAdjust: 0, hijriManual: false }));
      el.querySelector('[data-stats]').addEventListener('change', (e) => setSettings({ stats: e.target.checked }));
      el.querySelectorAll('[data-lang]:not([disabled])').forEach((b) => b.addEventListener('click', () => setSettings({ lang: b.dataset.lang })));
    },
  };
}

/** 手机应用里：提醒排好了没有，缺什么权限，一键去开 */
async function drawStatus(el, r) {
  const box = el.querySelector('[data-notify-status]');
  if (!box) return;
  const st = r && r.native ? r : await notifyStatus();
  const s = getSettings();
  let html;
  if (!s.remind) html = t('settings.stOff');
  else if (st.display !== 'granted')
    html = `${t('settings.stNoPerm')} <button type="button" class="btn btn-primary btn-sm" data-perm>${t('settings.allow')}</button>`;
  else {
    const next = r && r.next ? fmtHM(new Date(r.next)) : '';
    html = r && r.count != null ? t('settings.stOk', { n: r.count, next }) : t('settings.stOkShort');
    if (st.exact && st.exact !== 'granted')
      html += `<br>${t('settings.stInexact')} <button type="button" class="btn btn-ghost btn-sm" data-exact>${t('settings.allowExact')}</button>`;
  }
  box.innerHTML = html;
  const perm = box.querySelector('[data-perm]');
  if (perm)
    perm.addEventListener('click', async () => {
      await askNotifyPermission();
      setSettings({});
    });
  const exact = box.querySelector('[data-exact]');
  if (exact)
    exact.addEventListener('click', async () => {
      await openExactSetting();
      setSettings({});
    });
}
