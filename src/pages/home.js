// 首页：今天的礼拜
// 一个穆斯林打开首页，3 秒内要知道：今天该做什么、下一番拜几点。所以首页只放三层：
//   顶部：日期（公历 + 伊斯兰历）和城市
//   中间："下一番拜"大卡片：拜名、时间、倒计时
//   下面：今天要做的事——礼拜时间表、封斋状态、今日圣训和记念
// 其他入口都在底部导航里。
// 两种显示方式（第一次打开时问一句，设置里随时改）：
//   年轻人：精致简洁；年纪大的人：大字极简，首页只有时间和下一番。
import { t, L, getLang } from '../i18n/index.js';
import { dateLine, hijriLine, durHTML, cityName, remoteText, esc } from '../i18n/format.js';
import { fmtHM, splitDuration, addDays, ymdKey } from '../core/clock.js';
import { PRAYERS, skyPhase, highLatitudeDay, METHODS } from '../core/prayer-times.js';
import { toHijri } from '../core/hijri.js';
import { setSettings, getSettings } from '../core/settings.js';
import { PRAYER_INFO } from '../content/prayers.js';
import { mosqueScene, star8, ICONS } from '../ui/art.js';
import { isHeavyRain } from '../core/weather.js';
import { homeRamadanCard } from './ramadan/card.js';
import { ramadanStatus } from '../core/ramadan.js';
import { sunnahReasons } from '../core/fasting.js';
import { festivalOf } from '../core/festival.js';
import { isNativeApp, platform } from '../core/api.js';
import { activeNotices, dismissNotice, updateLink } from '../core/remote.js';
import { prayedOn, togglePrayed, prayedDays } from '../core/prayed.js';
import { adhkarCard } from '../ui/adhkar-card.js';
import { markFeature } from '../core/usage.js';
import { softToast } from '../core/reminder.js';
import { setCount } from '../ui/motion.js';
// 分享按需下载（点了才用到）
const share = () => import('../core/share.js');

function prayerName(p, sched) {
  if (p === 'dhuhr' && sched.today.wd === 5) return t('prayer.jumuah');
  return t('prayer.' + p);
}

const countdownText = (ms) => durHTML(ms, true);
const SOON_MS = 10 * 60 * 1000; // 到点前 10 分钟，主卡片上说一句温和的话

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

// 这些天气下，引用先知让大家"在住处礼拜"的圣训（布哈里 666、901），让人安心在家礼拜
const HOME_PRAYER_KINDS = ['heavy', 'snow', 'rain', 'storm', 'cold'];

/**
 * 今天的天气提示：一句关心的话 + 一句教法上站得住的说明。
 * 雨、雪、泥泞、严寒是哈乃斐学派认可的可以不去清真寺参加集体礼拜的理由；
 * 大风只在夜里算；酷热时晌礼可以等凉快些再礼（圣训）；年老体弱、身体不适的人也属于可以不去的情况。
 * 不为没有依据的情况编造"可以不去"的说法。
 * 首页只在天气不好时出现（晴天不占地方）。
 */
function weatherCard(ctx) {
  const k = ctx.weatherKind;
  if (!k || k === 'clear') return '';
  const w = ctx.weather || {};
  const r = (v) => (v == null ? '' : Math.round(v));
  const msgKey = k === 'rain' && isHeavyRain(w) ? 'wx.rainHeavy' : 'wx.' + k;
  const vars = { temp: r(w.temp), max: r(w.maxTemp), gust: r(w.gust || w.wind), uv: r(w.uv) };
  const [cls, icon] = WX_STYLE[k] || WX_STYLE.clear;
  return `<section class="card weather-card ${cls}" aria-label="${t('winter.label')}">
    <div class="wx-head"><svg class="wx-icon" viewBox="0 0 24 24" aria-hidden="true">${WX_ICON[icon]}</svg>
      <p class="winter-msg">${t(msgKey, vars)}</p></div>
    <p class="winter-why">${t('wx.' + k + 'Why', vars)}</p>
    ${HOME_PRAYER_KINDS.includes(k) ? `<details class="wx-more"><summary>${t('wx.proof')}</summary><div data-wx-hadith="${ctx.sched.today.wd === 5 ? 'b901' : 'b666'}">${HAD ? hadithQuote(HAD.HADITH[ctx.sched.today.wd === 5 ? 'b901' : 'b666'], 'wx-hadith') : ''}</div></details>` : ''}
    <div class="winter-actions">
      <a class="btn btn-primary btn-sm" href="#/pray">${t('winter.go')}</a>
      <a class="btn btn-ghost btn-sm" href="#/pray/wudu">${t('winter.wudu')}</a>
    </div>
    ${w.demo ? `<p class="note">${t('winter.demo')}</p>` : ''}
  </section>`;
}

/** 年纪大的人：天气不好时，只在主卡片里说一句（不另起卡片） */
function weatherLine(ctx) {
  const k = ctx.weatherKind;
  if (!HOME_PRAYER_KINDS.includes(k)) return '';
  const w = ctx.weather || {};
  const msgKey = k === 'rain' && isHeavyRain(w) ? 'wx.rainHeavy' : 'wx.' + k;
  return t(msgKey, { temp: w.temp == null ? '' : Math.round(w.temp) });
}

// 圣训内容按需加载（不拖慢首屏）；加载过一次后同步可用
let HAD = null;
export function loadHadith() {
  return HAD ? Promise.resolve(HAD) : import('../content/hadith.js').then((m) => (HAD = m));
}

function hadithQuote(h, cls = '') {
  return `<blockquote class="hadith-quote ${cls}">
    <p class="hq-ar" lang="ar" dir="rtl">${h.ar}</p>
    <p class="hq-text">${L(h)}</p>
    <p class="hq-src">${t('common.source', { src: L(h.src) })}</p></blockquote>`;
}

// ---------- 每日一节古兰经（数据按需下载：摘自古兰经页同一个出版译本） ----------
let AYAHS = null;
const loadAyahs = () => (AYAHS ? Promise.resolve(AYAHS) : import('../content/daily-ayah.js').then((m) => (AYAHS = m.DAILY_AYAHS)));
/** 今天是哪一节：按日期轮流（同一天打开几次都是同一节） */
export function ayahOfDay(list, ymd) {
  const n = Math.floor(Date.UTC(ymd.y, ymd.m - 1, ymd.d) / 864e5);
  return list[((n % list.length) + list.length) % list.length];
}
const arNum = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
function ayahBody(x) {
  return `<p class="ar ayah-ar" lang="ar" dir="rtl">${esc(x.ar)} <span class="ayah-no">﴿${arNum(x.a)}﴾</span></p>
    <p class="ayah-tr">${esc(x.t[getLang()] || x.t.ru)}</p>
    <p class="src">${t('ayah.src', { surah: x.n[getLang()] || x.n.ru, s: x.s, a: x.a, who: t('qr.translator') })}</p>`;
}
function ayahCard(ctx) {
  const x = AYAHS ? ayahOfDay(AYAHS, ctx.sched.today) : null;
  return `<section class="card ayah-card" data-daily-ayah>
    <h2 class="card-title">${star8(16)} ${t('ayah.title')}</h2>
    <div data-ayah-body>${x ? ayahBody(x) : '<div class="skel" aria-hidden="true"><i></i><i></i></div>'}</div>
    <div class="card-foot">
      <a class="text-btn" data-ayah-read href="${x ? `#/quran/${x.s}/${x.a}` : '#/quran'}">${ICONS.quran}${t('ayah.read')}</a>
      <button type="button" class="text-btn" data-share-ayah>${ICONS.share}${t('ayah.share')}</button>
      <span class="note" data-share-msg aria-live="polite"></span>
    </div>
  </section>`;
}
function fillAyah(root, ctx) {
  loadAyahs()
    .then((list) => {
      const box = root.querySelector('[data-ayah-body]');
      if (!box) return;
      const x = ayahOfDay(list, ctx.sched.today);
      if (box.querySelector('.skel')) {
        box.innerHTML = ayahBody(x);
        box.classList.add('is-in'); // 内容到了轻轻浮现
      }
      const read = root.querySelector('[data-ayah-read]');
      if (read) read.setAttribute('href', `#/quran/${x.s}/${x.a}`);
    })
    .catch(() => {
      const card = root.querySelector('[data-daily-ayah]');
      if (card) card.remove(); // 没下载下来就先不显示这张卡片（不影响首页其他内容）
    });
}

/** 今日圣训（每天一句，可以分享给亲友） */
function hadithCard(ctx) {
  return `<section class="card hadith-card">
    <h2 class="card-title">${star8(16)} ${t('hadith.title')}</h2>
    <div data-daily-hadith>${HAD ? hadithQuote(HAD.dailyHadith(ctx.sched.today)) : ''}</div>
    <div class="card-foot"><button type="button" class="text-btn" data-share-hadith>${ICONS.share}${t('hadith.share')}</button>
    <span class="note" data-share-msg aria-live="polite"></span></div>
  </section>`;
}

/** 圣训加载好后填进页面（首页今日圣训、天气卡片里的依据） */
function fillHadith(root, ctx) {
  loadHadith().then((m) => {
    const box = root.querySelector('[data-daily-hadith]');
    if (box && !box.innerHTML.trim()) box.innerHTML = hadithQuote(m.dailyHadith(ctx.sched.today));
    const wx = root.querySelector('[data-wx-hadith]');
    if (wx && !wx.innerHTML.trim()) wx.innerHTML = hadithQuote(m.HADITH[wx.dataset.wxHadith], 'wx-hadith');
  });
}

function bindShare(root, ctx) {
  const say = (btn, r) => {
    const m = btn.parentElement.querySelector('[data-share-msg]');
    if (m) m.textContent = r === 'copied' ? t('times.copied') : r === 'saved' ? t('times.saved') : r === 'failed' ? t('times.shareFailed') : '';
  };
  const day = ymdKey(ctx.sched.today);
  // 今天的礼拜时间做成图片分享（群里最常转发的就是这个）
  const img = root.querySelector('[data-share-img]');
  if (img)
    img.addEventListener('click', async () => {
      img.disabled = true;
      try {
        const [{ drawTimesCard }, { shareImage, shareLink }] = await Promise.all([import('../ui/share-card.js'), share()]);
        const cv = await drawTimesCard(ctx);
        const link = shareLink(ctx.remote);
        say(img, await shareImage(cv, `namaz-${day}.png`, `${t('app.name')}${link ? ' ' + link : ''}`, day));
      } catch (e) {
        say(img, 'failed');
      }
      img.disabled = false;
    });
  const ay = root.querySelector('[data-share-ayah]');
  if (ay)
    ay.addEventListener('click', async () => {
      ay.disabled = true;
      try {
        const list = await loadAyahs();
        const x = ayahOfDay(list, ctx.sched.today);
        const tr = x.t[getLang()] || x.t.ru;
        const ref = t('ayah.src', { surah: x.n[getLang()] || x.n.ru, s: x.s, a: x.a, who: t('qr.translator') });
        const [{ drawAyahCard }, { shareImage, shareLink }] = await Promise.all([import('../ui/share-card.js'), share()]);
        const cv = await drawAyahCard({ ar: x.ar, tr, ref });
        const link = shareLink(ctx.remote);
        say(ay, await shareImage(cv, `ayah-${x.s}-${x.a}.png`, `${tr}\n(${ref})\n\n${t('share.from', { app: t('app.name') })}${link ? ' ' + link : ''}`, day));
      } catch (e) {
        say(ay, 'failed');
      }
      ay.disabled = false;
    });
  const h = root.querySelector('[data-share-hadith]');
  if (h)
    h.addEventListener('click', async () => {
      const [{ dailyHadith }, { shareText, shareLink }] = await Promise.all([loadHadith(), share()]);
      const d = dailyHadith(ctx.sched.today);
      const link = shareLink(ctx.remote);
      const text = `${L(d)}\n(${L(d.src)})\n\n${t('share.from', { app: t('app.name') })}${link ? ' ' + link : ''}`;
      say(h, await shareText(text, day));
    });
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
      await (await import('../core/notify.js')).askNotifyPermission();
      setSettings({}); // 重新排提醒并刷新页面
    });
}

/** 第一次打开：先问一句"你是年轻人还是年纪大的人？"（页面里的卡片，不弹窗；设置里随时可改） */
function modeHTML(ctx) {
  if (ctx.settings.modeAsked) return '';
  return `<section class="card welcome-card mode-card">
    <p class="notify-card-t">${t('mode.ask')}</p>
    <p class="note">${t('mode.askNote')}</p>
    <div class="mode-pick">
      <button type="button" class="mode-opt" data-set-mode="young"><b>${t('mode.young')}</b><small>${t('mode.youngSub')}</small></button>
      <button type="button" class="mode-opt is-elder" data-set-mode="elder"><b>${t('mode.elder')}</b><small>${t('mode.elderSub')}</small></button>
    </div>
  </section>`;
}

/** 第一次打开：请用户确认城市（按手机时区猜的，可能不对）。先问显示方式，问完再问城市，一次只一张卡片 */
function welcomeHTML(ctx) {
  if (ctx.settings.cityConfirmed || !ctx.settings.modeAsked) return '';
  return `<section class="card welcome-card">
    <p class="notify-card-t">${t('home.welcomeTitle')}</p>
    <p>${t('home.welcomeText', { city: cityName(ctx.city) })}</p>
    <div class="step-btns">
      <button type="button" class="btn btn-primary" data-city-auto>${t('home.welcomeAuto')}</button>
      <button type="button" class="btn btn-ghost" data-city-ok>${t('home.welcomeOk', { city: cityName(ctx.city) })}</button>
      <a class="btn btn-ghost" href="#/city">${t('home.welcomeChoose')}</a>
    </div>
    <p class="note" data-auto-msg aria-live="polite">${t('home.welcomeAutoNote')}</p>
  </section>`;
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

// ---------- 顶部：日期和城市 ----------

function dateHTML(ctx) {
  const d = ctx.sched.today;
  const h = toHijri(d, ctx.hijriAdjust);
  const afterSunset = ctx.now >= ctx.sched.times.sunset;
  const hn = afterSunset ? toHijri(addDays(d, 1), ctx.hijriAdjust) : null;
  return `<span class="date-g">${dateLine(d)}${d.wd === 5 ? `<span class="jumuah">${t('home.jumuah')}</span>` : ''}</span>
    <span class="date-h">${hijriLine(h)}</span>
    ${hn ? `<span class="date-eve">${t('home.hijriEve', { d: hn.d })}</span>` : ''}`;
}

/** 选的城市和手机不在同一个时区时，提一句"当地时间"（时间都按城市当地算） */
function otherZone(ctx) {
  const dev = -new Date().getTimezoneOffset() / 60;
  return Math.abs(dev - ctx.city.utcOffset) > 0.01;
}

function topHTML(ctx) {
  return `<header class="home-top">
    <div class="date" data-date>${dateHTML(ctx)}</div>
    <div class="city-row">
      <a class="city-btn" href="#/city" aria-label="${t('city.choose', { name: cityName(ctx.city) })}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12Z"/><circle cx="12" cy="10" r="2.6"/></svg>
        <span>${cityName(ctx.city)}</span><span class="city-caret" aria-hidden="true">▾</span></a>
      ${otherZone(ctx) ? `<span class="city-note">${t('home.localTime', { time: fmtHM(ctx.now) })}</span>` : ''}
    </div>
  </header>`;
}

// ---------- 中间：下一番拜 ----------

/** 节日问候：一句话 + 一个小图标（斋月新月、节日的八角星）；平常日子没有 */
function greetHTML(ctx, elder) {
  const f = festivalOf(ctx.sched.today, ctx.hijriAdjust);
  if (!f) return '';
  const icon = f.tone === 'night' ? ICONS.ramadan : star8(18);
  return `<p class="hero-greet"><span class="greet-ico" aria-hidden="true">${icon}</span><span>${t('fest.' + f.id, { y: f.y || '' })}</span></p>
    ${f.ar && !elder ? `<p class="greet-ar" lang="ar" dir="rtl">${f.ar}</p>` : ''}`;
}

/** 到点前 10 分钟：一句温和的话 */
function soonText(ctx) {
  const left = ctx.sched.nextTime - ctx.now;
  if (left <= 0 || left > SOON_MS) return '';
  return t('home.soon', { name: prayerName(ctx.sched.next, ctx.sched), n: Math.ceil(left / 60000) });
}

function heroBody(ctx, elder) {
  const s = ctx.sched;
  const name = prayerName(s.next, s);
  const info = PRAYER_INFO[s.next];
  const nowLine = s.current
    ? `<span>${t('home.nowIn', { name: t('prayer.' + s.current) })}</span><span class="until">${t('home.until', { time: fmtHM(s.currentEnd) })}</span>`
    : `<span>${t('home.noPrayerNow')}</span>`;
  const fajrWarn = s.current === 'fajr' ? `<p class="hero-warn">${t('home.fajrEnd', { time: fmtHM(s.times.sunrise) })}</p>` : '';
  const followTarget = s.current || s.next;
  const wx = elder ? weatherLine(ctx) : '';
  return `${greetHTML(ctx, elder)}
    <p class="hero-now">${nowLine}</p>
    ${fajrWarn}
    <p class="hero-label">${t('home.next')}</p>
    <p class="hero-next"><span class="hero-name">${name}</span><span class="hero-ar" lang="ar" dir="rtl">${info.ar}</span></p>
    <p class="hero-time">${s.nextTomorrow ? `<small>${t('home.tomorrow')}</small>` : ''}${fmtHM(s.nextTime)}</p>
    <p class="hero-count" aria-hidden="true">${t('home.left')} <span class="count">${countdownText(s.nextTime - ctx.now)}</span></p>
    <span class="sr-only" data-sr-count></span>
    <p class="hero-soon" data-soon aria-live="polite">${soonText(ctx)}</p>
    ${wx ? `<p class="hero-wx">${wx}</p>` : ''}
    <a class="btn btn-primary btn-wide" href="#/pray/guide/${followTarget}">${t('home.follow', { name: t('prayer.' + followTarget) })}</a>`;
}

function heroHTML(ctx, elder) {
  const f = festivalOf(ctx.sched.today, ctx.hijriAdjust);
  const tone = f ? 'fest-' + f.tone : '';
  if (elder) {
    // 年纪大的人：不放插图，节日只留一句问候
    return `<section class="card hero is-elder ${tone}" data-hero>${heroBody(ctx, true)}</section>`;
  }
  return `<section class="card hero ${tone}" data-hero>
    <div class="hero-band" data-scene>${mosqueScene({ phase: skyPhase(ctx.sched.times, ctx.now), winter: isWinter(ctx) })}</div>
    <div class="hero-body">${heroBody(ctx, false)}</div>
  </section>`;
}

// ---------- 下面：今天要做的事 ----------

function listHTML(ctx, elder) {
  const s = ctx.sched;
  const T = s.times;
  const n = ctx.now.getTime();
  const rows = [];
  const done = prayedOn(ymdKey(s.today));
  const started = (p) => n >= T[p].getTime();
  for (const p of PRAYERS) {
    const passed = n >= T[p].getTime() && s.current !== p;
    const cls = [s.current === p ? 'is-current' : '', s.next === p && !s.nextTomorrow ? 'is-next' : '', passed ? 'is-passed' : ''].join(' ');
    // 年纪大的人：只看名字和时间，不放打勾
    const check = elder
      ? ''
      : started(p)
        ? `<button type="button" class="prow-check ${done[p] ? 'is-on' : ''}" data-prayed="${p}" aria-pressed="${!!done[p]}" aria-label="${t('home.markPrayed', { name: prayerName(p, s) })}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>`
        : '<span class="prow-check-gap"></span>';
    const badge = s.current === p ? `<span class="prow-badge">${t('home.badgeNow')}</span>` : s.next === p && !s.nextTomorrow ? `<span class="prow-badge soft">${t('home.next')}</span>` : '';
    rows.push(`<li class="prow ${cls}">
      <span class="prow-name">${prayerName(p, s)}${badge}</span>
      <span class="prow-ar" lang="ar" dir="rtl">${PRAYER_INFO[p].ar}</span>
      <span class="prow-time">${fmtHM(T[p])}</span>
      ${check}
    </li>`);
    if (p === 'fajr') {
      rows.push(`<li class="prow prow-sun"><span class="prow-name">${t('prayer.sunrise')}</span><span class="prow-ar"></span><span class="prow-time">${fmtHM(T.sunrise)}</span></li>`);
    }
  }
  return rows.join('');
}

function localNote(ctx) {
  const adjusted = Object.values(ctx.settings.offsets).some((v) => Number(v));
  return ctx.official
    ? t(adjusted ? 'home.localNoteOfficialAdjusted' : 'home.localNoteOfficial', { src: remoteText(ctx.official) })
    : adjusted
      ? t('home.localNoteAdjusted')
      : t('home.localNote');
}

function timesCard(ctx, elder) {
  const s = ctx.sched;
  const ru = ctx.city.cc === 'RU';
  const mine = ctx.settings.method !== 'auto' && METHODS[ctx.settings.method]; // 用户自己选了算法
  const highLat = highLatitudeDay(ctx.city, s.today);
  const adjusted = Object.values(ctx.settings.offsets).some((v) => Number(v));
  return `<section class="card list-card">
    <h2 class="card-title">${star8(16)} ${t('home.today')}</h2>
    <ul class="plist" data-list>${listHTML(ctx, elder)}</ul>
    ${elder ? '' : `<p class="sunline">${t('prayer.sunrise')} ${fmtHM(s.times.sunrise)} · ${t('prayer.sunset')} ${fmtHM(s.times.sunset)}</p>`}
    ${highLat ? `<p class="hero-warn high-lat">${t('home.highLat')}</p>` : ''}
    ${elder || prayedDays().size ? '' : `<p class="note prayed-note">${t('home.prayedNote')}</p>`}
    <p class="local-note">${localNote(ctx)}</p>
    ${
      elder
        ? ''
        : `<details class="method">
      <summary>${t('home.howCalc')}</summary>
      <p>${mine ? t('home.methodAngles', mine) : t(ru ? 'home.methodRu' : 'home.method')}</p>
      <p>${t(ru ? 'home.methodLocalRu' : 'home.methodLocal')}</p>
      ${Math.abs(ctx.city.lat) >= 45 ? `<p>${t('home.methodHighLat')}</p>` : ''}
      <p>${t('home.offline')}</p>
      <p><a href="#/settings">${adjusted ? t('home.adjusted') : t('home.adjust')} →</a></p>
    </details>
    <div class="card-foot">
      <a class="text-btn" href="#/times">${ICONS.calendar}${t('home.monthShort')}</a>
      <button type="button" class="text-btn" data-share-img>${ICONS.share}${t('times.shareImage')}</button>
      <span class="note" data-share-msg aria-live="polite"></span>
    </div>`
    }
  </section>`;
}

/** 星期五：主麻日的一行（洗大净、早去、读山洞章） */
function jumuahRow() {
  return `<a class="card card-link fast-row jm-row" href="#/jumuah">
    <span class="tool-ico">${ICONS.masjid}</span>
    <span class="fast-row-t">${t('jm.title')}</span>
    <span class="fast-row-s">${t('jm.homeRow')}</span>
    <span class="r-link-go" aria-hidden="true">→</span>
  </a>`;
}

/** 封斋状态：斋月里、自己在封斋时是倒计时卡片；平时一行——明天是不是圣行斋日、斋月还有几天 */
function fastHTML(ctx) {
  const card = homeRamadanCard(ctx);
  if (card) return card;
  const tomorrow = addDays(ctx.sched.today, 1);
  const why = sunnahReasons(tomorrow, ctx.hijriAdjust);
  const st = ramadanStatus(ctx.sched.today, ctx.hijriAdjust);
  const line = why.length
    ? t('home.fastTomorrow', { why: why.map((r) => t('vf.r.' + r)).join(' · ') })
    : st.start
      ? t('fast.daysLeft', { n: st.start.inDays })
      : '';
  if (!line) return '';
  return `<a class="card card-link fast-row" href="#/ramadan">
    <span class="tool-ico">${ICONS.ramadan}</span>
    <span class="fast-row-t">${t('nav.fast')}</span>
    <span class="fast-row-s">${line}</span>
    <span class="r-link-go" aria-hidden="true">→</span>
  </a>`;
}

export function homePage(ctx) {
  const elder = ctx.settings.mode === 'elder';
  const s = ctx.sched;
  const ramadanOn = ramadanStatus(s.today, ctx.hijriAdjust).active;
  const html = elder
    ? `
  <div class="page home is-elder">
    ${topHTML(ctx)}
    <div class="notice-slot">${modeHTML(ctx)}${welcomeHTML(ctx)}${noticesHTML(ctx)}</div>
    ${heroHTML(ctx, true)}
    <div class="ramadan-slot" data-ramadan>${ramadanOn ? homeRamadanCard(ctx) : ''}</div>
    ${timesCard(ctx, true)}
    <div class="notify-slot" data-notify-card>${notifyCard(ctx.notifyState)}</div>
  </div>`
    : `
  <div class="page home">
    ${topHTML(ctx)}
    <div class="notice-slot">${modeHTML(ctx)}${welcomeHTML(ctx)}${noticesHTML(ctx)}</div>
    ${heroHTML(ctx, false)}
    <div data-winter>${weatherCard(ctx)}</div>
    <h2 class="sec home-sec">${t('home.todo')}</h2>
    ${timesCard(ctx, false)}
    <div class="ramadan-slot" data-ramadan>${fastHTML(ctx)}</div>
    ${s.today.wd === 5 ? jumuahRow() : ''}
    ${adhkarCard(ctx)}
    ${ayahCard(ctx)}
    ${hadithCard(ctx)}
    <div class="notify-slot" data-notify-card>${notifyCard(ctx.notifyState)}</div>
  </div>`;

  let lastMinute = -1;
  let lastKey = '';
  return {
    html,
    mount(el) {
      bindNotifyCard(el);
      bindNotices(el);
      bindShare(el, ctx);
      if (!elder) {
        fillHadith(el, ctx);
        fillAyah(el, ctx);
      }
      el.querySelectorAll('[data-set-mode]').forEach((b) =>
        b.addEventListener('click', () => {
          setSettings({ mode: b.dataset.setMode, modeAsked: true });
          markFeature('settings', ymdKey(ctx.sched.today));
        }),
      );
      el.querySelectorAll('[data-prayed]').forEach((b) =>
        b.addEventListener('click', () => {
          const on = b.getAttribute('aria-pressed') !== 'true';
          const day = ymdKey(ctx.sched.today);
          const res = togglePrayed(day, b.dataset.prayed, on);
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-pressed', String(on));
          if (on) {
            // 打勾弹一下、漾出一圈（动画在 CSS 里；减少动态效果时 CSS 不放）
            b.classList.remove('is-pop');
            void b.offsetWidth;
            b.classList.add('is-pop');
            if (navigator.vibrate) navigator.vibrate(20);
          }
          // 今天第一次打卡放"又坚持了一天"，解锁称号、徽章时庆祝；今晚的"还没打卡"提醒随之取消
          if (res) {
            // 动画和徽章按需加载，首页打开更快
            Promise.all([import('../ui/cheer.js'), import('../core/badges.js')])
              .then(([c, bd]) => c.cheer({ streak: res, badges: bd.onPrayed(day, prayedOn(day)), todayKey: day }, softToast))
              .catch(() => softToast(t('streak.doneToday')));
            ctx.resync();
            import('../core/circle.js').then((m) => m.syncCheckin(day)).catch(() => {});
          }
        }),
      );
      const ok = el.querySelector('[data-city-ok]');
      if (ok) ok.addEventListener('click', () => setSettings({ cityConfirmed: true }));
      // 自动定位：位置只在手机上算礼拜时间和朝向，不上传；时区用手机的
      const auto = el.querySelector('[data-city-auto]');
      if (auto)
        auto.addEventListener('click', async () => {
          const msg = el.querySelector('[data-auto-msg]');
          auto.disabled = true;
          msg.textContent = t('city.locating');
          try {
            const { locate } = await import('../core/location.js');
            const loc = await locate();
            markFeature('here', ymdKey(ctx.sched.today));
            setSettings({ city: 'here', loc, cityConfirmed: true, autoLoc: true });
          } catch (e) {
            auto.disabled = false;
            msg.textContent = t(e && e.code === 1 ? 'city.denied' : e && e.message === 'unsupported' ? 'city.unsupported' : 'city.failed');
          }
        });
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
      setCount(el.querySelector('.count'), countdownText(c.sched.nextTime - c.now));
      const m = c.now.getUTCMinutes();
      if (m !== lastMinute) {
        lastMinute = m;
        const { h, m: mm } = splitDuration(c.sched.nextTime - c.now);
        el.querySelector('[data-sr-count]').textContent = t('home.srCount', { h, m: mm });
        const soon = el.querySelector('[data-soon]');
        if (soon) soon.textContent = soonText(c);
        const note = document.querySelector('.city-note');
        if (note) note.textContent = t('home.localTime', { time: fmtHM(c.now) });
        const d = document.querySelector('[data-date]');
        if (d) d.innerHTML = dateHTML(c);
        const r = document.querySelector('[data-ramadan]');
        if (r) r.innerHTML = elder ? (ramadanStatus(c.sched.today, c.hijriAdjust).active ? homeRamadanCard(c) : '') : fastHTML(c);
      }
    },
    onWeather(c) {
      const box = document.querySelector('[data-winter]');
      if (box) {
        box.innerHTML = weatherCard(c);
        fillHadith(box, c);
      }
      const scene = document.querySelector('[data-scene] svg');
      if (scene) scene.outerHTML = mosqueScene({ phase: skyPhase(c.sched.times, c.now), winter: isWinter(c) });
      // 年纪大的人：天气不好时只在主卡片里说一句
      if (elder && weatherLine(c)) c.rerender();
    },
  };
}
