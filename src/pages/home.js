// 首页：今天的礼拜
// 用户一打开就要看到三件事：下一番拜是什么、还有多久、今天在家礼拜行不行。
import { t } from '../i18n/index.js';
import { dateLine, hijriLine, durHTML, cityName, remoteText, esc } from '../i18n/format.js';
import { fmtHM, splitDuration, addDays } from '../core/clock.js';
import { PRAYERS, skyPhase, highLatitudeDay } from '../core/prayer-times.js';
import { toHijri } from '../core/hijri.js';
import { setSettings } from '../core/settings.js';
import { PRAYER_INFO } from '../content/prayers.js';
import { mosqueScene, star8 } from '../ui/art.js';
import { isHeavyRain } from '../core/weather.js';
import { homeRamadanCard } from './ramadan/card.js';
import { ramadanStatus } from '../core/ramadan.js';
import { isNativeApp, askNotifyPermission } from '../core/notify.js';
import { getSettings } from '../core/settings.js';
import { activeNotices, dismissNotice, updateLink } from '../core/remote.js';
import { platform } from '../core/api.js';
import { ymdKey } from '../core/clock.js';

function prayerName(p, sched) {
  if (p === 'dhuhr' && sched.today.wd === 5) return t('prayer.jumuah');
  return t('prayer.' + p);
}

const countdownText = (ms) => durHTML(ms, true);

/** 冬季画面（雪景）：下雪、严寒，或者查不到天气时的 12～2 月 */
export function isWinter(ctx) {
  if (['heavy', 'snow', 'cold'].includes(ctx.weatherKind)) return true;
  if (ctx.weather === null) return [12, 1, 2].includes(ctx.sched.today.m);
  return false;
}

// 每种天气的小图标
const WX_ICON = {
  snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 4l3 2 3-2M9 20l3-2 3 2" fill="none" stroke-width="1.6" stroke-linecap="round"/>',
  rain: '<path d="M6 14a4 4 0 0 1 .5-8 6 6 0 0 1 11 2.5A3.5 3.5 0 0 1 17 14Z" /><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" fill="none" stroke-width="1.6" stroke-linecap="round"/>',
  storm: '<path d="M6 13a4 4 0 0 1 .5-8 6 6 0 0 1 11 2.5A3.5 3.5 0 0 1 17 13Z"/><path d="M12 13l-2 4h3l-2 5" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8" fill="none" stroke-width="1.8" stroke-linecap="round"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1" fill="none" stroke-width="1.6" stroke-linecap="round"/>',
  fog: '<path d="M3 8h18M5 12h14M3 16h18M7 20h10" fill="none" stroke-width="1.8" stroke-linecap="round"/>',
  cold: '<path d="M12 2v20M4 6l16 12M4 18L20 6" fill="none" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12" r="2.5"/>',
};
const WX_STYLE = {
  heavy: ['wx-snow', 'snow'], snow: ['wx-snow', 'snow'], cold: ['wx-snow', 'cold'],
  rain: ['wx-rain', 'rain'], storm: ['wx-rain', 'storm'], wind: ['wx-wind', 'wind'],
  heat: ['wx-heat', 'sun'], uv: ['wx-heat', 'sun'], fog: ['wx-fog', 'fog'], clear: ['wx-clear', 'sun'],
};

/**
 * 今天的天气提示：一句关心的话 + 一句教法上站得住的说明。
 * 雨、雪、泥泞、严寒是哈乃斐学派认可的可以不去清真寺参加集体礼拜的理由；
 * 大风只在夜里算；酷热时晌礼可以等凉快些再礼（圣训）；年老体弱、身体不适的人也属于可以不去的情况。
 * 不为没有依据的情况编造"可以不去"的说法。
 */
function weatherCard(ctx) {
  const k = ctx.weatherKind;
  if (!k) return '';
  const w = ctx.weather || {};
  const r = (v) => (v == null ? '' : Math.round(v));
  const msgKey = k === 'rain' && isHeavyRain(w) ? 'wx.rainHeavy' : 'wx.' + k;
  const vars = { temp: r(w.temp), max: r(w.maxTemp), gust: r(w.gust || w.wind), uv: r(w.uv) };
  const [cls, icon] = WX_STYLE[k] || WX_STYLE.clear;
  const showActions = k !== 'clear';
  return `<section class="card weather-card ${cls}" aria-label="${t('winter.label')}">
    <div class="wx-head"><svg class="wx-icon" viewBox="0 0 24 24" aria-hidden="true">${WX_ICON[icon]}</svg>
      <p class="winter-msg">${t(msgKey, vars)}</p></div>
    <p class="winter-why">${t('wx.' + k + 'Why', vars)}</p>
    ${showActions ? `<div class="winter-actions">
      <a class="btn btn-primary" href="#/pray">${t('winter.go')}</a>
      <a class="btn btn-ghost" href="#/pray/wudu">${t('winter.wudu')}</a>
    </div>` : ''}
    ${w.demo ? `<p class="note">${t('winter.demo')}</p>` : ''}
  </section>`;
}
const winterCard = weatherCard;

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

/** 后台发布的公告（纯文字）和"请更新应用"提示 */
function noticesHTML(ctx) {
  const list = activeNotices(ctx.remote, ymdKey(ctx.sched.today));
  const upd = updateLink(ctx.remote, platform());
  return (
    (upd
      ? `<section class="card notice-card is-warn"><p>${t('home.updateText')}</p>
        <a class="btn btn-primary btn-wide" href="${esc(upd)}" target="_blank" rel="noopener noreferrer">${t('home.updateBtn')}</a></section>`
      : '') +
    list
      .map(
        (n) => `<section class="card notice-card ${n.level === 'warn' ? 'is-warn' : ''}" role="${n.level === 'warn' ? 'alert' : 'status'}">
        <p class="notice-text">${remoteText(n.text)}</p>
        <button type="button" class="btn btn-ghost btn-sm" data-notice-ok="${n.id}">${t('home.noticeOk')}</button></section>`,
      )
      .join('')
  );
}

function bindNotices(root) {
  root.querySelectorAll('[data-notice-ok]').forEach((b) =>
    b.addEventListener('click', () => {
      dismissNotice(b.dataset.noticeOk);
      b.closest('.notice-card').remove();
    }),
  );
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
  const h = toHijri(d, ctx.hijriAdjust);
  const afterSunset = ctx.now >= ctx.sched.times.sunset;
  const hn = afterSunset ? toHijri(addDays(d, 1), ctx.hijriAdjust) : null;
  return `<span class="date-g">${dateLine(d)}${d.wd === 5 ? `<span class="jumuah">${t('home.jumuah')}</span>` : ''}</span>
    <span class="date-h">${hijriLine(h)}</span>
    ${hn ? `<span class="date-eve">${t('home.hijriEve', { d: hn.d })}</span>` : ''}`;
}

export function homePage(ctx) {
  const s = ctx.sched;
  const phase = skyPhase(s.times, ctx.now);
  const ru = ctx.city.method === 'dumrf';
  const highLat = highLatitudeDay(ctx.city, s.today);
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
      ${highLat ? `<p class="hero-warn high-lat">${t('home.highLat')}</p>` : ''}
      <p class="local-note">${
        ctx.official
          ? t(adjusted ? 'home.localNoteOfficialAdjusted' : 'home.localNoteOfficial', { src: remoteText(ctx.official) })
          : adjusted
            ? t('home.localNoteAdjusted')
            : t('home.localNote')
      }</p>
      <details class="method">
        <summary>${t('home.howCalc')}</summary>
        <p>${t(ru ? 'home.methodRu' : 'home.method')}</p>
        <p>${t(ru ? 'home.methodLocalRu' : 'home.methodLocal')}</p>
        ${Math.abs(ctx.city.lat) >= 45 ? `<p>${t('home.methodHighLat')}</p>` : ''}
        <p>${t('home.offline')}</p>
      </details>
      <a class="link-row" href="#/settings">${adjusted ? t('home.adjusted') : t('home.adjust')} →</a>
    </section>
    </div>
    <div class="col col-b">
    <div class="date" data-date>${dateHTML(ctx)}</div>
    <div class="city-row">
      <a class="city-btn" href="#/city" aria-label="${t('city.choose', { name: cityName(ctx.city) })}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"/><circle cx="12" cy="10" r="2.6"/></svg>
        <span>${cityName(ctx.city)}</span><span class="city-caret" aria-hidden="true">▾</span></a>
      <span class="city-note">${t('home.localTime', { time: fmtHM(ctx.now) })}</span>
    </div>
    <div class="notice-slot">${noticesHTML(ctx)}</div>
    <div class="ramadan-slot ${ramadanStatus(ctx.sched.today, ctx.hijriAdjust).active ? 'is-active' : ''}" data-ramadan>${homeRamadanCard(ctx)}</div>
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
      bindNotifyCard(el);
      bindNotices(el);
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
