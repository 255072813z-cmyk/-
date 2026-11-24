// 应用入口：路由、底部导航、每秒走时、到点提醒
import '@fontsource/amiri/arabic-400.css';
import '@fontsource/amiri/arabic-700.css';
// 塔吉克语、俄语用的西里尔字母字体（含 ӣ ӯ ҳ қ ҷ ғ）。只有页面上出现西里尔字母时才会下载。
import '@fontsource/noto-sans/cyrillic-400.css';
import '@fontsource/noto-sans/cyrillic-ext-400.css';
import '@fontsource/noto-sans/cyrillic-700.css';
import '@fontsource/noto-sans/cyrillic-ext-700.css';
import '@fontsource/noto-serif/cyrillic-700.css';
import '@fontsource/noto-serif/cyrillic-ext-700.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/home.css';
import './styles/pray.css';
import './styles/spaces.css';

import { getSettings, onSettings } from './core/settings.js';
import { getCity } from './core/cities.js';
import { now, setDisplayOffset, ymdKey } from './core/clock.js';
import { schedule } from './core/prayer-times.js';
import { getWeather, classify } from './core/weather.js';
import { checkReminder } from './core/reminder.js';
import { isNativeApp, syncNotifications, listenNotificationTaps } from './core/notify.js';
import { cachedRemote, refreshRemote, effectiveOffsets, effectiveHijri, flagOn } from './core/remote.js';
import { setStatsGate, markUse, sendDaily, reportError } from './core/stats.js';
import { setPresenceGate } from './core/presence.js';
import { t, setLang, getLang, loadLang } from './i18n/index.js';
import { ICONS, star8 } from './ui/art.js';
import { resolveRoute, prefetchPages } from './router.js';

const app = document.getElementById('app');
const tabbar = document.querySelector('.tabbar');
const topnav = document.querySelector('.topnav');

const TABS = [
  { href: '#/', key: 'nav.home', icon: 'home', match: (p) => p === '' },
  { href: '#/pray', key: 'nav.pray', icon: 'pray', match: (p) => (p.startsWith('pray') && !p.startsWith('pray/guide/tarawih')) || p.startsWith('qibla') },
  { href: '#/masjid', key: 'nav.masjid', icon: 'masjid', match: (p) => p.startsWith('masjid') },
  { href: '#/ramadan', key: 'nav.ramadan', icon: 'ramadan', match: (p) => p.startsWith('ramadan') || p.startsWith('pray/guide/tarawih') },
  { href: '#/tasbih', key: 'nav.tasbih', icon: 'tasbih', match: (p) => p.startsWith('tasbih') },
];

// 全局状态：页面从这里读城市、时间表、天气
export const ctx = {
  notifyState: null, // 手机应用里提醒的状态（权限、排了几条）
  resync: () => resync(),
  settings: getSettings(),
  city: getCity(getSettings().city, getSettings().loc),
  now: now(),
  sched: null,
  weather: undefined, // undefined 还在查；null 查不到；对象为天气
  weatherKind: null,
  remote: cachedRemote(), // 后台发布的配置（已验证签名）；没有时为默认
  offsets: {}, // 官方校正 + 用户微调
  official: null, // 官方校正的来源
  hijriAdjust: 0,
  hijriOfficial: null,
  rerender: () => render(),
};

// 由设置和远程配置算出实际使用的时间校正、伊斯兰历调整
function derive() {
  const o = effectiveOffsets(ctx.settings.offsets, ctx.remote, ctx.city);
  ctx.offsets = o.offsets;
  ctx.official = o.official;
  const h = effectiveHijri(ctx.settings, ctx.remote, ctx.city);
  ctx.hijriAdjust = h.adjust;
  ctx.hijriOfficial = h.official;
}
derive();
setStatsGate(() => ctx.settings.stats !== false && flagOn(ctx.remote, 'stats'));
setPresenceGate(() => flagOn(ctx.remote, 'presence'));
const todayKey = () => (ctx.sched ? ymdKey(ctx.sched.today) : '');

function refreshSchedule() {
  setDisplayOffset(ctx.city.utcOffset);
  ctx.now = now();
  ctx.sched = schedule(ctx.city, ctx.now, ctx.offsets);
}

function applyPrefs() {
  const s = ctx.settings;
  document.documentElement.dataset.fs = String(s.fontScale || 0);
  setLang(s.lang);
  if (getLang() !== s.lang) {
    // 词典还没下载：下载好再切换（期间先显示原来的语言）
    loadLang(s.lang).then((ok) => {
      if (ok && ctx.settings.lang === s.lang) {
        setLang(s.lang);
        updateShell();
        render();
        resync(); // 提醒的文字也换成新语言
      }
    });
  }
  updateShell();
}

// 页面外框（标题、跳转链接、导航说明）也跟着语言走
function updateShell() {
  const name = t('app.name');
  document.title = name;
  const set = (sel, attr, v) => {
    const el = document.querySelector(sel);
    if (el) el.setAttribute(attr, v);
  };
  const skip = document.querySelector('.skip');
  if (skip) skip.textContent = t('a11y.skip');
  const brand = document.querySelector('.brand-name');
  if (brand) brand.textContent = name;
  set('.brand', 'aria-label', t('a11y.homeLink', { name }));
  set('.topnav', 'aria-label', t('a11y.mainNav'));
  set('.tabbar', 'aria-label', t('a11y.mainNav'));
  set('.topbar-settings', 'aria-label', t('nav.settings'));
}

function renderNav(path) {
  const html = TABS.map(
    (tab) =>
      `<a href="${tab.href}" class="tab ${tab.match(path) ? 'is-active' : ''}" ${tab.match(path) ? 'aria-current="page"' : ''}>
        <span class="tab-icon">${ICONS[tab.icon]}</span><span class="tab-label">${t(tab.key)}</span></a>`,
  ).join('');
  tabbar.innerHTML = html;
  topnav.innerHTML = html;
}

let page = null;
let lastPath = null;

function render() {
  const path = (location.hash || '#/').replace(/^#\/?/, '');
  const changed = path !== lastPath;
  if (changed) ctx.prevPath = lastPath;
  if (page && page.unmount) page.unmount();
  refreshSchedule();
  page = resolveRoute(path, ctx);
  app.innerHTML = page.html;
  if (page.mount) page.mount(app);
  renderNav(path);
  if (changed) {
    markUse(path, todayKey());
    lastPath = path;
    window.scrollTo(0, 0);
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  }
}

function tick() {
  refreshSchedule();
  if (page && page.tick) page.tick(ctx);
  checkReminder(ctx);
}

async function loadWeather() {
  ctx.weather = undefined;
  const city = ctx.city;
  const w = flagOn(ctx.remote, 'weather') ? await getWeather(city) : null;
  if (city !== ctx.city) return;
  ctx.weather = w;
  ctx.weatherKind = classify(w);
  if (page && page.onWeather) page.onWeather(ctx);
}

onSettings((s) => {
  const next = getCity(s.city, s.loc);
  const cityChanged = next.id !== ctx.city.id || next.lat !== ctx.city.lat || next.lon !== ctx.city.lon;
  ctx.settings = s;
  ctx.city = next;
  derive();
  applyPrefs();
  render();
  if (cityChanged) loadWeather();
  resync();
});

// 手机应用：把未来 7 天的提醒交给系统（关着应用也会响）
function resync() {
  if (!isNativeApp()) return;
  refreshSchedule();
  syncNotifications(ctx).then((r) => {
    ctx.notifyState = r;
    if (page && page.onNotify) page.onNotify(r);
  });
}

document.querySelector('.brand-mark').innerHTML = star8(26);
document.querySelector('.topbar-settings').innerHTML = ICONS.settings;

// 启动：先把所选语言的词典准备好再显示，避免先闪一下别的语言
function start() {
  applyPrefs();
  window.addEventListener('hashchange', render);
  render();
  loadWeather();
  resync(); // 手机应用：排好提醒（词典已就绪，提醒文字是所选语言）
  // 与整秒对齐地走时，倒计时更稳
  setTimeout(() => {
    tick();
    setInterval(tick, 1000);
  }, 1000 - (Date.now() % 1000));
}
loadLang(ctx.settings.lang).then(start, start);
// 联系后台（设置了后台地址才会）：每天一次匿名统计；最多每 6 小时取一次远程配置
function phoneHome() {
  sendDaily(ctx.city, getLang(), todayKey());
  refreshRemote().then((cfg) => {
    if (!cfg) return;
    const weatherWas = flagOn(ctx.remote, 'weather');
    ctx.remote = cfg;
    derive();
    render();
    resync();
    if (weatherWas !== flagOn(cfg, 'weather')) loadWeather();
  });
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    tick();
    resync(); // 回到前台时续排，保证总有未来 7 天的提醒
    phoneHome();
  }
});

// 匿名错误报告（只有错误信息和位置）
window.addEventListener('error', (e) => reportError(e.message, `${e.filename || ''}:${e.lineno || 0}`, todayKey()));
window.addEventListener('unhandledrejection', (e) => reportError(String((e.reason && e.reason.message) || e.reason), 'promise', todayKey()));
if (isNativeApp()) {
  document.documentElement.classList.add('is-app');
  listenNotificationTaps();
}

// 首屏显示后，空闲时把其他页面也下载好（配合离线缓存，断网也能打开）
window.addEventListener('load', () => {
  prefetchPages();
  setTimeout(phoneHome, 1500);
});

// 离线缓存（微信 iOS 等不支持的环境会静默跳过）
// 手机应用里网页文件本来就在手机上，不需要离线缓存（也避免更新应用后还显示旧版）
if ('serviceWorker' in navigator && window.isSecureContext && !isNativeApp()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
