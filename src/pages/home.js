// 首页：今天的礼拜
// 用户一打开就要看到三件事：下一番拜是什么、还有多久、今天在家礼拜行不行。
import { t } from '../i18n/index.js';
import { dateLine, hijriLine, durHTML } from '../i18n/format.js';
import { fmtHM, splitDuration, addDays } from '../core/clock.js';
import { PRAYERS, skyPhase } from '../core/prayer-times.js';
import { toHijri } from '../core/hijri.js';
import { setSettings } from '../core/settings.js';
import { CITIES } from '../core/cities.js';
import { PRAYER_INFO } from '../content/prayers.js';
import { mosqueScene, star8 } from '../ui/art.js';
import { homeRamadanCard } from './ramadan/card.js';
import { ramadanStatus } from '../core/ramadan.js';
import { isNativeApp, askNotifyPermission } from '../core/notify.js';
import { getSettings } from '../core/settings.js';

function prayerName(p, sched) {
  if (p === 'dhuhr' && sched.today.wd === 5) return t('prayer.jumuah');
  return t('prayer.' + p);
}

const countdownText = (ms) => durHTML(ms, true);

/** 冬季：天气说下雪/严寒，或者查不到天气时的 12～2 月 */
export function isWinter(ctx) {
  if (ctx.weatherKind && ctx.weatherKind !== 'clear') return true;
  if (ctx.weather === null) return [12, 1, 2].includes(ctx.sched.today.m);
  return false;
}

function winterCard(ctx) {
  const k = ctx.weatherKind;
  if (!k || k === 'clear') return '';
  const w = ctx.weather;
  const msg = t('winter.' + k, { temp: w ? Math.round(w.temp) : '' });
  return `<section class="card winter-card" aria-label="${t('winter.label')}">
    <p class="winter-msg">${msg}</p>
    <p class="winter-why">${t('winter.why')}</p>
    <div class="winter-actions">
      <a class="btn btn-primary" href="#/pray">${t('winter.go')}</a>
      <a class="btn btn-ghost" href="#/pray/wudu">${t('winter.wudu')}</a>
    </div>
    ${w && w.demo ? `<p class="note">${t('winter.demo')}</p>` : ''}
  </section>`;
}

/** 手机应用里还没允许通知时，在首页直接请用户开启（很多老人不会去翻设置） */
function notifyCard(r) {
  if (!isNativeApp() || !r || !r.native || r.display === 'granted' || !getSettings().remind) return '';
  return `<section class="card notify-card">
    <p class="notify-card-t">${t('home.notifyTitle')}</p>
    <p>${t('home.notifyText')}</p>
    <button type="button" class="btn btn-primary btn-wide" data-notify-on>${t('home.notifyOn')}</button>
  </section>`;
}

function bindNotifyCard(root) {
  const b = root.querySelector('[data-notify-on]');
  if (b)
    b.addEventListener('click', async () => {
      await askNotifyPermission();
      setSettings({}); // 重新排提醒并刷新页面
    });
}

function heroHTML(ctx) {
  const s = ctx.sched;
  const name = prayerName(s.next, s);
  const info = PRAYER_INFO[s.next];
  const nowLine = s.current
    ? `${t('home.nowIn', { name: t('prayer.' + s.current) })}<span class="until">${t('home.until', { time: fmtHM(s.currentEnd) })}</span>`
    : t('home.noPrayerNow');
  const fajrWarn = s.current === 'fajr' ? `<p class="hero-warn">${t('home.fajrEnd', { time: fmtHM(s.times.sunrise) })}</p>` : '';
  const followTarget = s.current || s.next;
  return `<div class="hero-now">${nowLine}</div>
    ${fajrWarn}
    <div class="hero-next">
      <span class="hero-label">${t('home.next')}</span>
      <span class="hero-name">${name}</span>
      <span class="hero-ar" lang="ar" dir="rtl">${info.ar}</span>
      <span class="hero-time">${s.nextTomorrow ? t('home.tomorrow') + ' ' : ''}${fmtHM(s.nextTime)}</span>
    </div>
    <div class="hero-count" aria-hidden="true">${t('home.left')} <span class="count">${countdownText(s.nextTime - ctx.now)}</span></div>
    <span class="sr-only" data-sr-count></span>
    <a class="btn btn-primary btn-wide" href="#/pray/guide/${followTarget}">${t('home.follow', { name: t('prayer.' + followTarget) })}</a>`;
}

function listHTML(ctx) {
  const s = ctx.sched;
  const T = s.times;
  const n = ctx.now.getTime();
  const rows = [];
  for (const p of PRAYERS) {
    const passed = n >= (p === 'isha' ? T.isha : T[p]).getTime() && s.current !== p;
    const cls = [s.current === p ? 'is-current' : '', s.next === p && !s.nextTomorrow ? 'is-next' : '', passed ? 'is-passed' : ''].join(' ');
    rows.push(`<li class="prow ${cls}">
      <span class="prow-name">${prayerName(p, s)}</span>
      <span class="prow-ar" lang="ar" dir="rtl">${PRAYER_INFO[p].ar}</span>
      <span class="prow-time">${fmtHM(T[p])}</span>
      ${s.current === p ? `<span class="prow-badge">${t('home.badgeNow')}</span>` : s.next === p && !s.nextTomorrow ? `<span class="prow-badge soft">${t('home.next')}</span>` : ''}
    </li>`);
    if (p === 'fajr') {
      rows.push(`<li class="prow prow-sun"><span class="prow-name">${t('prayer.sunrise')}</span><span class="prow-ar"></span><span class="prow-time">${fmtHM(T.sunrise)}</span></li>`);
    }
  }
  return rows.join('');
}

function dateHTML(ctx) {
  const d = ctx.sched.today;
  const h = toHijri(d, ctx.settings.hijriAdjust);
  const afterSunset = ctx.now >= ctx.sched.times.sunset;
  const hn = afterSunset ? toHijri(addDays(d, 1), ctx.settings.hijriAdjust) : null;
  return `<span class="date-g">${dateLine(d)}${d.wd === 5 ? `<span class="jumuah">${t('home.jumuah')}</span>` : ''}</span>
    <span class="date-h">${hijriLine(h)}</span>
    ${hn ? `<span class="date-eve">${t('home.hijriEve', { d: hn.d })}</span>` : ''}`;
}

export function homePage(ctx) {
  const s = ctx.sched;
  const phase = skyPhase(s.times, ctx.now);
  const cityBtns = Object.keys(CITIES)
    .map(
      (id) =>
        `<button type="button" class="seg ${ctx.city.id === id ? 'is-on' : ''}" data-city="${id}" aria-pressed="${ctx.city.id === id}">${t('city.' + id)}</button>`,
    )
    .join('');
  const adjusted = Object.values(ctx.settings.offsets).some((v) => Number(v));
  const html = `
  <div class="page home">
    <div class="col col-a">
    <section class="scene-wrap" data-scene>
      ${mosqueScene({ phase, winter: isWinter(ctx) })}
      <div class="scene-top">
        <p class="bismillah" lang="ar" dir="rtl">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</p>
      </div>
    </section>
    <section class="card list-card">
      <h2 class="card-title">${star8(18)} ${t('home.today')}</h2>
      <ul class="plist" data-list>${listHTML(ctx)}</ul>
      <p class="sunline">${t('prayer.sunrise')} ${fmtHM(s.times.sunrise)} · ${t('prayer.sunset')} ${fmtHM(s.times.sunset)}</p>
      <p class="local-note">${adjusted ? t('home.localNoteAdjusted') : t('home.localNote')}</p>
      <details class="method">
        <summary>${t('home.howCalc')}</summary>
        <p>${t('home.method')}</p>
        <p>${t('home.methodLocal')}</p>
        <p>${t('home.offline')}</p>
      </details>
      <a class="link-row" href="#/settings">${adjusted ? t('home.adjusted') : t('home.adjust')} →</a>
    </section>
    </div>
    <div class="col col-b">
    <div class="date" data-date>${dateHTML(ctx)}</div>
    <div class="city-row">
      <div class="segmented" role="group" aria-label="${t('city.switch')}">${cityBtns}</div>
      <span class="city-note">${t('home.localTime', { time: fmtHM(ctx.now) })}</span>
    </div>
    <div class="ramadan-slot ${ramadanStatus(ctx.sched.today, ctx.settings.hijriAdjust).active ? 'is-active' : ''}" data-ramadan>${homeRamadanCard(ctx)}</div>
    <section class="card hero" data-hero>${heroHTML(ctx)}</section>
    <div class="notify-slot" data-notify-card>${notifyCard(ctx.notifyState)}</div>
    <div data-winter>${winterCard(ctx)}</div>
    <a class="card card-link athome" href="#/pray">
      <span class="athome-t">${t('home.atHome')}</span>
      <span class="athome-s">${t('home.atHomeSub')}</span>
    </a>
    <a class="card card-link to-masjid" href="#/masjid">
      <span class="athome-t">${t('home.toMasjid')}</span>
      <span class="athome-s">${t('home.toMasjidSub')}</span>
    </a>
    </div>
    <p class="privacy">${t('privacy')}</p>
  </div>`;

  let lastMinute = -1;
  let lastKey = '';
  return {
    html,
    mount(el) {
      el.querySelectorAll('[data-city]').forEach((b) =>
        b.addEventListener('click', () => setSettings({ city: b.dataset.city })),
      );
      bindNotifyCard(el);
    },
    onNotify(r) {
      const box = document.querySelector('[data-notify-card]');
      if (!box) return;
      box.innerHTML = notifyCard(r);
      bindNotifyCard(box);
    },
    tick(c) {
      const el = document.querySelector('[data-hero]');
      if (!el) return;
      const key = c.sched.current + '|' + c.sched.next + '|' + c.sched.today.d;
      if (key !== lastKey && lastKey) {
        // 换了时段：整页重绘（天色、列表、日期都要变）
        c.rerender();
        return;
      }
      lastKey = key;
      el.querySelector('.count').innerHTML = countdownText(c.sched.nextTime - c.now);
      const m = c.now.getUTCMinutes();
      if (m !== lastMinute) {
        lastMinute = m;
        const { h, m: mm } = splitDuration(c.sched.nextTime - c.now);
        el.querySelector('[data-sr-count]').textContent = t('home.srCount', { h, m: mm });
        const note = document.querySelector('.city-note');
        if (note) note.textContent = t('home.localTime', { time: fmtHM(c.now) });
        const d = document.querySelector('[data-date]');
        if (d) d.innerHTML = dateHTML(c);
        const r = document.querySelector('[data-ramadan]');
        if (r) r.innerHTML = homeRamadanCard(c);
      }
    },
    onWeather(c) {
      const box = document.querySelector('[data-winter]');
      if (box) box.innerHTML = winterCard(c);
      const scene = document.querySelector('[data-scene] svg');
      if (scene) scene.outerHTML = mosqueScene({ phase: skyPhase(c.sched.times, c.now), winter: isWinter(c) });
    },
  };
}
