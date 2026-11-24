// 路由（地址 # 后面的部分）。每个页面是一个模块，返回 { html, mount, tick, unmount }。
//   #/                       首页：今天的礼拜
//   #/pray                   在家礼拜
//   #/pray/wudu              小净
//   #/pray/guide[/拜/部分]   跟着做礼拜
//   #/qibla                  朝向
//   #/tasbih                 赞念
//   #/settings               设置
//   #/city                   选择城市
//   #/times[/月份偏移]       本月时间表（可分享、打印）
//   #/pray/qada              补礼记录
//   #/ramadan                斋月：封斋/开斋、打卡、节日
//   #/ramadan/tarawih        间歇拜
//   #/ramadan/quran          古兰经 30 天读完
//   #/masjid                 清真寺：三个空间的入口
//   #/masjid/hall            礼拜大殿
//   #/masjid/courtyard       庭院
//   #/masjid/poetry          诗歌夜
// 首页和"在家礼拜"随首屏一起加载；其余页面第一次打开时才下载（首屏更快）。
import { homePage } from './pages/home.js';
import { hubPage } from './pages/pray/hub.js';
import { t } from './i18n/index.js';
import { flagOn } from './core/remote.js';
import { ICONS } from './ui/art.js';

const LAZY = {
  wudu: () => import('./pages/pray/wudu.js').then((m) => m.wuduPage),
  guide: () => import('./pages/pray/guide.js').then((m) => m.guidePage),
  qibla: () => import('./pages/pray/qibla.js').then((m) => m.qiblaPage),
  tasbih: () => import('./pages/pray/tasbih.js').then((m) => m.tasbihPage),
  settings: () => import('./pages/settings.js').then((m) => m.settingsPage),
  city: () => import('./pages/city.js').then((m) => m.cityPage),
  times: () => import('./pages/times.js').then((m) => m.timesPage),
  qada: () => import('./pages/pray/qada.js').then((m) => m.qadaPage),
  ramadan: () => import('./pages/ramadan/index.js').then((m) => m.ramadanPage),
  tarawih: () => import('./pages/ramadan/tarawih.js').then((m) => m.tarawihPage),
  quran: () => import('./pages/ramadan/quran.js').then((m) => m.quranPage),
  spaces: () => import('./pages/spaces/index.js').then((m) => m.spacesPage),
  hall: () => import('./pages/spaces/hall.js').then((m) => m.hallPage),
  courtyard: () => import('./pages/spaces/courtyard.js').then((m) => m.courtyardPage),
  poetry: () => import('./pages/spaces/poetry.js').then((m) => m.poetryPage),
};
const loaded = {};

function lazy(name, ctx, args) {
  if (loaded[name]) return loaded[name](ctx, ...args);
  return {
    html: `<div class="page"><p class="loading">${t('common.loading')}</p></div>`,
    mount() {
      LAZY[name]()
        .then((fn) => {
          loaded[name] = fn;
          ctx.rerender();
        })
        .catch(() => {
          const el = document.querySelector('.loading');
          if (el) el.textContent = t('common.offlineMissing');
        });
    },
  };
}

export function resolveRoute(path, ctx) {
  const parts = path.split('/').filter(Boolean);
  switch (parts[0]) {
    case undefined:
      return homePage(ctx);
    case 'pray':
      if (parts[1] === 'wudu') return lazy('wudu', ctx, []);
      if (parts[1] === 'qada') return lazy('qada', ctx, []);
      if (parts[1] === 'guide') return lazy('guide', ctx, [parts[2], parts[3]]);
      return hubPage(ctx);
    case 'qibla':
      return lazy('qibla', ctx, []);
    case 'tasbih':
      return lazy('tasbih', ctx, []);
    case 'settings':
      return lazy('settings', ctx, []);
    case 'city':
      return lazy('city', ctx, []);
    case 'times':
      return lazy('times', ctx, [parts[1]]);
    case 'masjid':
      if (!flagOn(ctx.remote, 'masjid')) return closedPage();
      if (parts[1] === 'hall') return lazy('hall', ctx, []);
      if (parts[1] === 'courtyard') return lazy('courtyard', ctx, []);
      if (parts[1] === 'poetry') return lazy('poetry', ctx, []);
      return lazy('spaces', ctx, []);
    case 'ramadan':
      if (parts[1] === 'tarawih') return lazy('tarawih', ctx, []);
      if (parts[1] === 'quran') return lazy('quran', ctx, []);
      return lazy('ramadan', ctx, []);
    default:
      return homePage(ctx);
  }
}

/** 后台临时关闭了清真寺空间时显示 */
function closedPage() {
  return {
    html: `<div class="page"><div class="page-head"><a class="back" href="#/" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('nav.masjid')}</h1></div>
      <section class="card"><p>${t('spaces.closed')}</p><a class="btn btn-primary btn-wide" href="#/pray">${t('home.atHome')}</a></section></div>`,
  };
}

/** 空闲时预先下载常用页面，之后断网也能打开 */
export function prefetchPages() {
  const go = () => {
    Object.values(LAZY).forEach((f) => f().catch(() => {}));
    import('./content/region-map.js').catch(() => {}); // 朝向页的地图
    import('./content/wide-map.js').catch(() => {});
  };
  if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 4000 });
  else setTimeout(go, 2500);
}
