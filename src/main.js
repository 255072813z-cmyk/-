// 应用入口：路由、底部导航、每秒走时、到点提醒
import '@fontsource/amiri/arabic-400.css';
import '@fontsource/amiri/arabic-700.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/home.css';
import './styles/pray.css';
import './styles/spaces.css';
import './styles/motion.css';

import { getSettings, onSettings } from './core/settings.js';
import { getCity, withMethod } from './core/cities.js';
import { now, setDisplayOffset, ymdKey } from './core/clock.js';
import { schedule } from './core/prayer-times.js';
import { toHijri } from './core/hijri.js';
import { enterPage } from './ui/motion.js';
import { getWeather, classify } from './core/weather.js';
import { checkReminder } from './core/reminder.js';
import { isNativeApp, syncNotifications, listenNotificationTaps } from './core/notify.js';
import { cachedRemote, refreshRemote, effectiveOffsets, effectiveHijri, flagOn } from './core/remote.js';
import { setStatsGate, setPresenceGate } from './core/gates.js';
import { markUse } from './core/usage.js';
// 匿名统计的发送部分按需加载（不拖慢首屏）
const stats = () => import('./core/stats.js');
import { t, setLang, getLang, loadLang } from './i18n/index.js';
import { ICONS, star8 } from './ui/art.js';
import { resolveRoute, prefetchPages } from './router.js';

const app = document.getElementById('app');
const tabbar = document.querySelector('.tabbar');
const topnav = document.querySelector('.topnav');

// 底部六个标签：今天 · 礼拜 · 清真寺 · 古兰经 · 封斋 · 我的（赞念在"礼拜"里；时间表、亲友圈、设置在"我的"里）
const TABS = [
  { href: '#/', key: 'nav.home', icon: 'home', match: (p) => p === '' },
  { href: '#/pray', key: 'nav.pray', icon: 'pray', match: (p) => (p.startsWith('pray') && !p.startsWith('pray/guide/tarawih')) || p.startsWith('qibla') || p.startsWith('tasbih') },
  { href: '#/masjid', key: 'nav.masjid', icon: 'masjid', match: (p) => p.startsWith('masjid') },
  { href: '#/quran', key: 'nav.quran', icon: 'quran', match: (p) => p.startsWith('quran') },
  // 斋月里叫"斋月"，平时叫"封斋"（全年都能用：副功斋、补斋）
  { href: '#/ramadan', key: () => (ctx.sched && toHijri(ctx.sched.today, ctx.hijriAdjust).m === 9 ? 'nav.ramadan' : 'nav.fast'), icon: 'ramadan', match: (p) => p.startsWith('ramadan') || p.startsWith('pray/guide/tarawih') },
  { href: '#/me', key: 'nav.me', icon: 'me', match: (p) => ['me', 'streak', 'circle', 'times', 'city', 'settings'].includes(p.split('/')[0]) },
];

// 全局状态：页面从这里读城市、时间表、天气
export const ctx = {
  notifyState: null, // 手机应用里提醒的状态（权限、排了几条）
  resync: () => resync(),
  settings: getSettings(),
  city: withMethod(getCity(getSettings().city, getSettings().loc), getSettings().method),
  now: now(),
  sched: null,
  weather: undefined, // undefined 还在查；null 查不到；对象为天气
  weatherKind: null,
  remote: cachedRemote(), // 后台发布的配置（已验证签名）；没有时为默认
  offsets: {}, // 官方校正 + 用户微调
  official: null, // 官方校正的来源
  hijriAdjust: 0,
  hijriOfficial: null,
  rerender: (opts) => render(opts),
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
  // 塔吉克语、俄语：加载西里尔字母字体（中文界面不下载，首屏更快）
  // 西里尔字体：按字符范围下载，页面上真有西里尔字母才下载（乌兹别克语界面是拉丁字母，但诗歌夜的塔吉克文要用）
  if (s.lang !== 'zh') import('./styles/cyrillic.js').catch(() => {});
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

// 已经在某个标签的首页时再点一次这个标签：平滑回到顶部（和常见应用一样）
function onTabTap(e) {
  const a = e.target.closest('a.tab');
  if (!a || a.getAttribute('href') !== (location.hash || '#/')) return;
  e.preventDefault();
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
}
tabbar.addEventListener('click', onTabTap);
topnav.addEventListener('click', onTabTap);

function renderNav(path, fresh = false) {
  const html = TABS.map(
    (tab) =>
      `<a href="${tab.href}" class="tab ${tab.match(path) ? 'is-active' : ''} ${fresh && tab.match(path) ? 'is-new' : ''}" ${tab.match(path) ? 'aria-current="page"' : ''}>
        <span class="tab-icon">${ICONS[tab.icon]}</span><span class="tab-label">${t(typeof tab.key === 'function' ? tab.key() : tab.key)}</span></a>`,
  ).join('');
  tabbar.innerHTML = html;
  topnav.innerHTML = html;
}

let page = null;
let lastPath = null;

// 返回时回到原来的位置：每一步浏览记录（history.state.i）记住离开时滚到哪里；
// 按返回（浏览器、手机的返回键）回到它时恢复，点链接进的新页面从顶上开始。
const scrollMemo = new Map();
let navCount = 0;
let curEntry = 0;
let pendingY = 0; // 按需下载的页面要等真内容出来再恢复
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
function entryOf() {
  const st = history.state;
  if (st && Number.isInteger(st.i)) {
    navCount = Math.max(navCount, st.i);
    return { i: st.i, back: true };
  }
  navCount++;
  try {
    history.replaceState({ i: navCount }, '');
  } catch (e) {
    /* 极少数环境不允许 */
  }
  return { i: navCount, back: false };
}

let lastDir = 'up';
function render(opts) {
  const path = (location.hash || '#/').replace(/^#\/?/, '');
  const changed = path !== lastPath;
  let entry = null;
  if (changed) {
    ctx.prevPath = lastPath;
    if (lastPath != null) scrollMemo.set(curEntry, window.scrollY);
    entry = entryOf();
    curEntry = entry.i;
    // 新打开的页面先回到顶上，页面自己要滚到某处（如时间表的今天）时不会被盖掉
    if (!entry.back) window.scrollTo(0, 0);
  }
  if (page && page.unmount) page.unmount();
  refreshSchedule();
  page = resolveRoute(path, ctx);
  app.innerHTML = page.html;
  if (page.mount) page.mount(app);
  const prevTab = lastPath == null ? -1 : TABS.findIndex((tab) => tab.match(lastPath));
  const tab = TABS.findIndex((x) => x.match(path));
  renderNav(path, changed && prevTab !== tab && lastPath != null);
  if (changed) {
    markUse(path, todayKey());
    const from = lastPath;
    lastPath = path;
    // 返回到看过的页面：回到离开时的位置（按需下载的页面等真内容出来再滚）
    pendingY = entry.back ? scrollMemo.get(entry.i) || 0 : 0;
    if (entry.back) window.scrollTo(0, pendingY);
    if (pendingY && Math.abs(window.scrollY - pendingY) < 2) pendingY = 0;
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    // 换页动效：换标签按标签的方向；同一个标签里往里走从右边、返回从左边
    const depth = (p) => (p ? p.split('/').filter(Boolean).length : 0);
    const dir = from == null ? 'up' : prevTab !== tab ? (tab > prevTab ? 'right' : 'left') : depth(path) > depth(from) ? 'right' : depth(path) < depth(from) ? 'left' : 'up';
    lastDir = dir;
  }
  // 按需下载的页面：真内容出来后再回到原来的位置
  if (!changed && pendingY && opts && opts.enter) {
    window.scrollTo(0, pendingY);
    pendingY = 0;
  }
  if (changed || (opts && opts.enter)) {
    const sp = document.getElementById('splash');
    if (!sp || sp.classList.contains('is-out')) enterPage(app, lastDir); // 启动画面还在时，等它退开再浮现
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
  const next = withMethod(getCity(s.city, s.loc), s.method);
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
  // 安卓桌面小组件：交给它未来 7 天的时间（见 core/widget.js）
  import('./core/widget.js').then((m) => m.updateWidget(ctx)).catch(() => {});
}

document.querySelector('.brand-mark').innerHTML = star8(26);
document.querySelector('.topbar-settings').innerHTML = ICONS.settings;

/** 启动画面（index.html 里）：第一页画好、并且至少停了规定的时间后淡出；点一下可以提前跳过 */
function hideSplash() {
  const el = document.getElementById('splash');
  if (!el || !window.__splash) return;
  const out = () => {
    if (el.classList.contains('is-out')) return;
    el.classList.add('is-out');
    enterPage(app, 'up'); // 启动画面退开时，首页内容依次浮现
    setTimeout(() => el.remove(), 650);
  };
  el.addEventListener('click', out, { once: true });
  setTimeout(out, Math.max(0, window.__splash.min - (Date.now() - window.__splash.t0)));
}

// 启动：先把所选语言的词典准备好再显示，避免先闪一下别的语言
function start() {
  applyPrefs();
  window.addEventListener('hashchange', render);
  render();
  hideSplash();
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
  const st = ctx.notifyState;
  stats().then(({ recordDay }) => recordDay({
    city: ctx.city,
    lang: getLang(),
    todayKey: todayKey(),
    fontScale: ctx.settings.fontScale,
    // 提醒开着没有：手机应用看系统权限，网页看设置
    notifyOn: isNativeApp() ? (st && st.native ? st.display === 'granted' && ctx.settings.remind : null) : ctx.settings.remind,
  }));
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

// 网络恢复时，把离线时攒下的匿名统计补传
window.addEventListener('online', () => stats().then((m) => m.flushStats()));

// 匿名错误报告（只有错误信息和位置）
window.addEventListener('error', (e) => stats().then((m) => m.reportError(e.message, `${e.filename || ''}:${e.lineno || 0}`, todayKey())).catch(() => {}));
window.addEventListener('unhandledrejection', (e) => stats().then((m) => m.reportError(String((e.reason && e.reason.message) || e.reason), 'promise', todayKey())).catch(() => {}));
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
