// 路由（地址 # 后面的部分）。每个页面是一个模块，返回 { html, mount, tick, unmount }。
//   #/                       首页：今天的礼拜
//   #/pray                   在家礼拜
//   #/pray/wudu              小净
//   #/pray/guide[/拜/部分]   跟着做礼拜
//   #/qibla                  朝向
//   #/tasbih                 赞念
//   #/adhkar[/morning|evening] 早晚记念（不写就按现在的时间：晡礼后是傍晚）
//   #/settings               设置
//   #/city                   选择城市
//   #/times[/月份偏移]       本月时间表（可分享、打印）
//   #/pray/qada              补礼记录
//   #/streak                 我的坚持（连续天数、称号）
//   #/circle                 亲友圈
//   #/ramadan                斋月：封斋/开斋、打卡、节日
//   #/ramadan/tarawih        间歇拜
//   #/ramadan/quran          古兰经 30 天读完（也可从 #/quran/plan 进）
//   #/quran                  古兰经：继续读、常念章节、114 章目录
//   #/quran/章[/节]          读一章（原文 + 当前语言译文）
//   #/me                     我的：坚持与徽章、亲友圈、时间表、城市、设置、分享
//   #/masjid                 清真寺：三个空间的入口
//   #/masjid/hall            礼拜大殿
//   #/masjid/courtyard       庭院
//   #/masjid/poetry          诗歌夜
// 只有首页随首屏一起加载；其余页面第一次打开时才下载，空闲时也会预先下载好（首屏更快，之后断网也能开）。
import { homePage } from "./pages/home.js";
import { t, getLang } from "./i18n/index.js";
import { flagOn } from "./core/remote.js";
import { ICONS } from "./ui/art.js";

const LAZY = {
  hub: () => import("./pages/pray/hub.js").then((m) => m.hubPage),
  wudu: () => import("./pages/pray/wudu.js").then((m) => m.wuduPage),
  guide: () => import("./pages/pray/guide.js").then((m) => m.guidePage),
  qibla: () => import("./pages/pray/qibla.js").then((m) => m.qiblaPage),
  tasbih: () => import("./pages/pray/tasbih.js").then((m) => m.tasbihPage),
  adhkar: () => import("./pages/pray/adhkar.js").then((m) => m.adhkarPage),
  settings: () => import("./pages/settings.js").then((m) => m.settingsPage),
  city: () => import("./pages/city.js").then((m) => m.cityPage),
  times: () => import("./pages/times.js").then((m) => m.timesPage),
  qada: () => import("./pages/pray/qada.js").then((m) => m.qadaPage),
  streak: () => import("./pages/streak.js").then((m) => m.streakPage),
  circle: () => import("./pages/circle.js").then((m) => m.circlePage),
  ramadan: () => import("./pages/ramadan/index.js").then((m) => m.ramadanPage),
  tarawih: () =>
    import("./pages/ramadan/tarawih.js").then((m) => m.tarawihPage),
  quran: () => import("./pages/ramadan/quran.js").then((m) => m.quranPage),
  qhome: () => import("./pages/quran/index.js").then((m) => m.quranHome),
  qread: () => import("./pages/quran/read.js").then((m) => m.quranRead),
  me: () => import("./pages/me.js").then((m) => m.mePage),
  spaces: () => import("./pages/spaces/index.js").then((m) => m.spacesPage),
  hall: () => import("./pages/spaces/hall.js").then((m) => m.hallPage),
  courtyard: () =>
    import("./pages/spaces/courtyard.js").then((m) => m.courtyardPage),
  poetry: () => import("./pages/spaces/poetry.js").then((m) => m.poetryPage),
};
const loaded = {};

function lazy(name, ctx, args) {
  if (loaded[name]) return loaded[name](ctx, ...args);
  return {
    html: `<div class="page"><div class="loading skel" role="status" aria-label="${t("common.loading")}"><i class="tall"></i><i></i><i></i><i></i></div></div>`,
    mount() {
      LAZY[name]()
        .then((fn) => {
          loaded[name] = fn;
          ctx.rerender({ enter: true }); // 真正的页面出来时再放一次"依次浮现"
        })
        .catch((e) => {
          const el = document.querySelector(".loading");
          if (el) el.textContent = t("common.offlineMissing");
          // 不是断网而是页面自己出错时，要让错误报告看得到（不能悄悄吞掉）
          if (e && !/fetch|import|load/i.test(String(e.message)))
            setTimeout(() => {
              throw e;
            });
        });
    },
  };
}

export function resolveRoute(path, ctx) {
  const parts = path.split("/").filter(Boolean);
  switch (parts[0]) {
    case undefined:
      return homePage(ctx);
    case "pray":
      if (parts[1] === "wudu") return lazy("wudu", ctx, []);
      if (parts[1] === "qada") return lazy("qada", ctx, []);
      if (parts[1] === "guide") return lazy("guide", ctx, [parts[2], parts[3]]);
      return lazy("hub", ctx, []);
    case "qibla":
      return lazy("qibla", ctx, []);
    case "tasbih":
      return lazy("tasbih", ctx, []);
    case "adhkar":
      return lazy("adhkar", ctx, [parts[1]]);
    case "settings":
      return lazy("settings", ctx, []);
    case "city":
      return lazy("city", ctx, []);
    case "streak":
      return lazy("streak", ctx, []);
    case "circle":
      return lazy("circle", ctx, []);
    case "times":
      return lazy("times", ctx, [parts[1]]);
    case "quran":
      if (parts[1] === "plan") return lazy("quran", ctx, []);
      if (parts[1]) return lazy("qread", ctx, [parts[1], parts[2]]);
      return lazy("qhome", ctx, []);
    case "me":
      return lazy("me", ctx, []);
    case "masjid":
      if (!flagOn(ctx.remote, "masjid")) return closedPage();
      if (parts[1] === "hall") return lazy("hall", ctx, []);
      if (parts[1] === "courtyard") return lazy("courtyard", ctx, []);
      if (parts[1] === "poetry") return lazy("poetry", ctx, []);
      return lazy("spaces", ctx, []);
    case "ramadan":
      if (parts[1] === "tarawih") return lazy("tarawih", ctx, []);
      if (parts[1] === "quran") return lazy("quran", ctx, []);
      return lazy("ramadan", ctx, []);
    default:
      return homePage(ctx);
  }
}

/** 后台临时关闭了清真寺空间时显示 */
function closedPage() {
  return {
    html: `<div class="page"><div class="page-head"><a class="back" href="#/" aria-label="${t("common.back")}">${ICONS.back}</a><h1>${t("nav.masjid")}</h1></div>
      <section class="card"><p>${t("spaces.closed")}</p><a class="btn btn-primary btn-wide" href="#/pray">${t("home.atHome")}</a></section></div>`,
  };
}

/** 空闲时预先下载常用页面，之后断网也能打开 */
export function prefetchPages() {
  // 空闲时把各页面先下载好；下好的直接记下，以后点进去不再先闪一下"加载中"。
  // 一次只下两个，不和用户正在看的页面抢网速（慢网上尤其明显）
  const jobs = [
    ...Object.entries(LAZY).map(
      ([k, f]) =>
        () =>
          f().then((fn) => (loaded[k] = loaded[k] || fn)),
    ),
    () => import("./content/hadith.js"), // 今日圣训、在家礼拜的依据
    () => import("./content/region-map.js"), // 朝向页的地图
    () => import("./content/wide-map.js"),
    // 古兰经"继续读"的那一章：先下载好，断网也能接着读（只这一块，不整本下载，省流量）
    () =>
      import("./core/quran.js").then((q) => {
        const r = q.lastRead();
        return r ? q.loadSurah(r.s, getLang()) : null;
      }),
  ];
  const next = () => {
    const job = jobs.shift();
    if (job)
      job()
        .catch(() => {})
        .then(next);
  };
  const go = () => {
    next();
    next();
  };
  if ("requestIdleCallback" in window)
    requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1500);
}
