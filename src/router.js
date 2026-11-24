// 路由（地址 # 后面的部分）。每个页面是一个模块，返回 { html, mount, tick, unmount }。
//   #/                       首页：今天的礼拜
//   #/pray                   在家礼拜
//   #/pray/wudu              小净
//   #/pray/guide[/拜/部分]   跟着做礼拜
//   #/qibla                  朝向
//   #/tasbih                 赞念
//   #/settings               设置
// 以后的斋月（ramadan）、三个空间（spaces）在这里加路由。
import { homePage } from './pages/home.js';
import { hubPage } from './pages/pray/hub.js';
import { wuduPage } from './pages/pray/wudu.js';
import { guidePage } from './pages/pray/guide.js';
import { qiblaPage } from './pages/pray/qibla.js';
import { tasbihPage } from './pages/pray/tasbih.js';
import { settingsPage } from './pages/settings.js';

export function resolveRoute(path, ctx) {
  const parts = path.split('/').filter(Boolean);
  switch (parts[0]) {
    case undefined:
      return homePage(ctx);
    case 'pray':
      if (parts[1] === 'wudu') return wuduPage(ctx);
      if (parts[1] === 'guide') return guidePage(ctx, parts[2], parts[3]);
      return hubPage(ctx);
    case 'qibla':
      return qiblaPage(ctx);
    case 'tasbih':
      return tasbihPage(ctx);
    case 'settings':
      return settingsPage(ctx);
    default:
      return homePage(ctx);
  }
}
