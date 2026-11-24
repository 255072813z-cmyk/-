// 应用入口：路由、底部导航、每秒走时、到点提醒
import '@fontsource/amiri/arabic-400.css';
import '@fontsource/amiri/arabic-700.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/home.css';
import './styles/pray.css';

import { getSettings, onSettings } from './core/settings.js';
import { getCity } from './core/cities.js';
import { now } from './core/clock.js';
import { schedule } from './core/prayer-times.js';
import { getWeather, classify } from './core/weather.js';
import { checkReminder } from './core/reminder.js';
import { t, setLang } from './i18n/index.js';
import { ICONS, star8 } from './ui/art.js';
import { resolveRoute } from './router.js';

const app = document.getElementById('app');
const tabbar = document.querySelector('.tabbar');
const topnav = document.querySelector('.topnav');

const TABS = [
  { href: '#/', key: 'nav.home', icon: 'home', match: (p) => p === '' },
  { href: '#/pray', key: 'nav.pray', icon: 'pray', match: (p) => p.startsWith('pray') && !p.startsWith('pray/guide/tarawih') },
  { href: '#/ramadan', key: 'nav.ramadan', icon: 'ramadan', match: (p) => p.startsWith('ramadan') || p.startsWith('pray/guide/tarawih') },
  { href: '#/qibla', key: 'nav.qibla', icon: 'qibla', match: (p) => p.startsWith('qibla') },
  { href: '#/tasbih', key: 'nav.tasbih', icon: 'tasbih', match: (p) => p.startsWith('tasbih') },
];

// 全局状态：页面从这里读城市、时间表、天气
export const ctx = {
  settings: getSettings(),
  city: getCity(getSettings().city),
  now: now(),
  sched: null,
  weather: undefined, // undefined 还在查；null 查不到；对象为天气
  weatherKind: null,
  rerender: () => render(),
};

function refreshSchedule() {
  ctx.now = now();
  ctx.sched = schedule(ctx.city, ctx.now, ctx.settings.offsets);
}

function applyPrefs() {
  const s = ctx.settings;
  document.documentElement.dataset.fs = String(s.fontScale || 0);
  setLang(s.lang);
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
  if (page && page.unmount) page.unmount();
  refreshSchedule();
  page = resolveRoute(path, ctx);
  app.innerHTML = page.html;
  if (page.mount) page.mount(app);
  renderNav(path);
  if (changed) {
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
  const w = await getWeather(city);
  if (city !== ctx.city) return;
  ctx.weather = w;
  ctx.weatherKind = classify(w);
  if (page && page.onWeather) page.onWeather(ctx);
}

onSettings((s) => {
  const cityChanged = s.city !== ctx.city.id;
  ctx.settings = s;
  ctx.city = getCity(s.city);
  applyPrefs();
  render();
  if (cityChanged) loadWeather();
});

document.documentElement.lang = 'zh-CN';
document.querySelector('.brand-mark').innerHTML = star8(26);
document.querySelector('.topbar-settings').innerHTML = ICONS.settings;
applyPrefs();
window.addEventListener('hashchange', render);
render();
loadWeather();
// 与整秒对齐地走时，倒计时更稳
setTimeout(() => {
  tick();
  setInterval(tick, 1000);
}, 1000 - (Date.now() % 1000));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) tick();
});

// 离线缓存（微信 iOS 等不支持的环境会静默跳过）
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
