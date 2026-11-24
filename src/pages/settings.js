// 设置：字号、提醒、按清真寺微调时间、伊斯兰历调整、语言。全部只存在本机。
import { getSettings, setSettings } from '../core/settings.js';
import { unlockAudio, playChime } from '../core/chime.js';
import { timesFor, PRAYERS } from '../core/prayer-times.js';
import { fmtHM } from '../core/clock.js';
import { toHijri } from '../core/hijri.js';
import { ICONS, star8 } from '../ui/art.js';
import { t, LANGS } from '../i18n/index.js';
import { hijriLine } from '../i18n/format.js';

const signed = (v) => (v > 0 ? '+' : '') + v;

export function settingsPage(ctx) {
  const s = getSettings();
  const base = timesFor(ctx.city, ctx.sched.today);
  const h = toHijri(ctx.sched.today, s.hijriAdjust);
  const fs = ['settings.fs0', 'settings.fs1', 'settings.fs2'];
  const html = `
  <div class="page settings">
    <div class="page-head"><a class="back" href="#/" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('nav.settings')}</h1></div>

    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('settings.fontTitle')}</h2>
      <div class="segmented big" role="group" aria-label="${t('settings.fontTitle')}">
        ${fs.map((k, i) => `<button type="button" class="seg ${s.fontScale === i ? 'is-on' : ''}" data-fs="${i}" aria-pressed="${s.fontScale === i}" style="font-size:${1 + i * 0.12}em">${t(k)}</button>`).join('')}
      </div>
    </section>

    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('settings.remindTitle')}</h2>
      <label class="switch-row"><span><b>${t('settings.remind')}</b><small>${t('settings.remindSub')}</small></span>
        <input type="checkbox" data-remind ${s.remind ? 'checked' : ''}></label>
      <label class="switch-row"><span><b>${t('settings.sound')}</b><small>${t('settings.soundSub')}</small></span>
        <input type="checkbox" data-sound ${s.sound ? 'checked' : ''}></label>
    </section>

    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('home.adjust')}</h2>
      <p class="note">${t('settings.adjustNote', { city: t('city.' + ctx.city.id) })}</p>
      <ul class="adj-list">
        ${PRAYERS.map((p) => {
          const v = Number(s.offsets[p]) || 0;
          const name = t('prayer.' + p);
          return `<li class="adj">
            <span class="adj-name">${name}</span>
            <span class="adj-base">${t('settings.calc', { time: fmtHM(base[p]) })}</span>
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
        ${[-2, -1, 0, 1, 2].map((d) => `<button type="button" class="seg ${s.hijriAdjust === d ? 'is-on' : ''}" data-hj="${d}" aria-pressed="${s.hijriAdjust === d}">${t('settings.days', { n: signed(d) })}</button>`).join('')}
      </div>
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
    mount(el) {
      el.querySelectorAll('[data-fs]').forEach((b) => b.addEventListener('click', () => setSettings({ fontScale: +b.dataset.fs })));
      el.querySelector('[data-remind]').addEventListener('change', (e) => setSettings({ remind: e.target.checked }));
      el.querySelector('[data-sound]').addEventListener('change', (e) => {
        if (e.target.checked) {
          unlockAudio();
          playChime();
        }
        setSettings({ sound: e.target.checked });
      });
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
      el.querySelectorAll('[data-hj]').forEach((b) => b.addEventListener('click', () => setSettings({ hijriAdjust: +b.dataset.hj })));
      el.querySelectorAll('[data-lang]:not([disabled])').forEach((b) => b.addEventListener('click', () => setSettings({ lang: b.dataset.lang })));
    },
  };
}
