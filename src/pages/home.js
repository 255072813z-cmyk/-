// 首页：今天的礼拜
// 用户一打开就要看到三件事：下一番拜是什么、还有多久、今天在家礼拜行不行。
import { t } from '../i18n/index.js';
import { fmtHM, splitDuration, addDays } from '../core/clock.js';
import { PRAYERS, skyPhase } from '../core/prayer-times.js';
import { toHijri, HIJRI_MONTHS } from '../core/hijri.js';
import { setSettings } from '../core/settings.js';
import { CITIES } from '../core/cities.js';
import { PRAYER_INFO } from '../content/prayers.js';
import { mosqueScene, star8 } from '../ui/art.js';
import { homeRamadanCard } from './ramadan/index.js';
import { ramadanStatus } from '../core/ramadan.js';

const WEEK = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

function prayerName(p, sched) {
  if (p === 'dhuhr' && sched.today.wd === 5) return t('prayer.jumuah');
  return t('prayer.' + p);
}

function countdownText(ms) {
  const { h, m, s } = splitDuration(ms);
  if (h > 0) return `<b>${h}</b><small>小时</small><b>${m}</b><small>分</small>`;
  if (m >= 10) return `<b>${m}</b><small>分钟</small>`;
  return `<b>${m}</b><small>分</small><b>${String(s).padStart(2, '0')}</b><small>秒</small>`;
}

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
  const msg = {
    heavy: '今天大雪，路上不好走，在家礼拜同样可以。',
    snow: '今天下雪，路上滑，在家礼拜同样可以。',
    cold: `今天很冷（${Math.round(w.temp)}°C），出门不方便，在家礼拜同样可以。`,
  }[k];
  return `<section class="card winter-card" aria-label="在家礼拜提示">
    <p class="winter-msg">${msg}</p>
    <p class="winter-why">按哈乃斐学派，雨雪、泥泞路滑、严寒，都是可以不去清真寺参加集体礼拜的正当理由（见教法书《Nur al-Idah》）。在家按时礼拜，同样完成了主命。</p>
    <div class="winter-actions">
      <a class="btn btn-primary" href="#/pray">进入在家礼拜</a>
      <a class="btn btn-ghost" href="#/pray/wudu">先做小净</a>
    </div>
    ${w && w.demo ? '<p class="note">（演示天气）</p>' : ''}
  </section>`;
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
      ${s.current === p ? '<span class="prow-badge">现在</span>' : s.next === p && !s.nextTomorrow ? '<span class="prow-badge soft">下一番</span>' : ''}
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
  return `<span class="date-g">${d.y}年${d.m}月${d.d}日 ${WEEK[d.wd]}${d.wd === 5 ? '<span class="jumuah">主麻日</span>' : ''}</span>
    <span class="date-h">伊斯兰历 ${h.y} 年 ${HIJRI_MONTHS[h.m - 1].zh} ${h.d} 日<span class="date-ar" lang="ar" dir="rtl">${HIJRI_MONTHS[h.m - 1].ar}</span></span>
    ${hn ? `<span class="date-eve">日落后，伊斯兰历已进入 ${hn.d} 日</span>` : ''}`;
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
        <summary>时间是怎么算的？</summary>
        <p>${t('home.method')}</p>
        <p>${t('home.methodLocal')}</p>
        <p>时间在你的手机上离线计算，没有网络也能看。</p>
      </details>
      <a class="link-row" href="#/settings">${adjusted ? t('home.adjusted') : t('home.adjust')} →</a>
    </section>
    </div>
    <div class="col col-b">
    <div class="date" data-date>${dateHTML(ctx)}</div>
    <div class="city-row">
      <div class="segmented" role="group" aria-label="${t('city.switch')}">${cityBtns}</div>
      <span class="city-note">当地时间 ${fmtHM(ctx.now)}</span>
    </div>
    <div class="ramadan-slot ${ramadanStatus(ctx.sched.today, ctx.settings.hijriAdjust).active ? 'is-active' : ''}" data-ramadan>${homeRamadanCard(ctx)}</div>
    <section class="card hero" data-hero>${heroHTML(ctx)}</section>
    <div data-winter>${winterCard(ctx)}</div>
    <a class="card card-link athome" href="#/pray">
      <span class="athome-t">${t('home.atHome')}</span>
      <span class="athome-s">小净 · 朝向 · 跟着做 · 礼拜后赞念</span>
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
        el.querySelector('[data-sr-count]').textContent = `距离下一番还有 ${h} 小时 ${mm} 分`;
        const note = document.querySelector('.city-note');
        if (note) note.textContent = '当地时间 ' + fmtHM(c.now);
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
