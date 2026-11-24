// 第 8 节验收清单的自动检查（需先 npm run build）：
//  - 慢速 3G 下首屏时间
//  - 到点提醒只弹一次
//  - 罗盘：模拟手机方向传感器，指针转动、提示"向左/右转"、对准
//  - 刷新后个人记录还在（本地存储）
//  - 除天气接口（只带城市坐标）外，不向任何第三方发请求
//  - 夜间（深色）模式截图
// 用法：npm run verify
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startPresenceServer } from '../server/dev-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const shots = fileURLToPath(new URL('../shots/', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([/\\])+/, '');
  try {
    const body = await readFile(join(root, p || 'index.html'));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'text/html; charset=utf-8' });
    res.end(body);
  } catch (e) {
    res.writeHead(404);
    res.end();
  }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/index.html`;
await mkdir(shots, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '通过' : '失败'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const browser = await chromium.launch();
const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'zh-CN' };

// 1. 慢速 3G 首屏
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const t0 = Date.now();
  await page.goto(base + '?weather=clear', { waitUntil: 'commit' });
  await page.waitForSelector('[data-hero] .hero-time');
  const ready = Date.now() - t0;
  const fcp = await page.evaluate(() => (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0);
  check('首屏（3G 网速、CPU 降速 4 倍）2 秒内显示礼拜时间', ready < 2000, `首次绘制 ${Math.round(fcp)} ms，礼拜时间出现 ${ready} ms`);
  await ctx.close();
}

// 2. 到点提醒：晡礼 15:27，把时钟拨到 15:27
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await page.goto(base + '?weather=clear&now=2026-12-18T15:27');
  await page.waitForSelector('.toast', { timeout: 4000 }).catch(() => {});
  const text = await page.locator('.toast').textContent().catch(() => '');
  check('到时间轻声提醒（页面提示）', /晡礼时间到了/.test(text || ''), (text || '').replace(/\s+/g, ' ').slice(0, 40));
  await page.screenshot({ path: join(shots, 'verify-reminder.png') });
  await page.reload();
  await page.waitForTimeout(2500);
  const again = await page.locator('.toast').count();
  check('同一番拜只提醒一次（刷新后不再弹）', again === 0);
  const soundDefault = await page.evaluate(() => JSON.parse(localStorage.getItem('masjid:settings') || '{}').sound);
  check('提醒声默认关闭', soundDefault !== true);
  await ctx.close();
}

// 3. 罗盘
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await page.goto(base + '?weather=clear#/qibla');
  await page.click('[data-start]');
  const send = (alpha) =>
    page.evaluate((a) => {
      const ev = new Event('deviceorientationabsolute');
      Object.assign(ev, { alpha: a, beta: 0, gamma: 0, absolute: true });
      window.dispatchEvent(ev);
    }, alpha);
  // 手机朝向磁北 0°（真北 4.7°）：朝向 243.8°，应提示向左转约 121°
  for (let i = 0; i < 40; i++) await send(0);
  const t1 = await page.textContent('[data-turn]');
  // 手机朝向磁北 239°（真北约 243.7°）：应提示已对准。alpha = 360 - 239
  for (let i = 0; i < 60; i++) await send(360 - 239);
  const t2 = await page.textContent('[data-turn]');
  const rot = await page.getAttribute('[data-rose]', 'transform');
  check('罗盘：没对准时提示转向', /向左转 1[12]\d°/.test(t1), t1);
  check('罗盘：对准后提示"已对准朝向"', t2.includes('已对准'), `${t2}，表盘 ${rot}`);
  await page.screenshot({ path: join(shots, 'verify-compass.png') });
  await ctx.close();
}

// 4. 本地记录：赞念计数刷新后还在
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await page.goto(base + '?weather=clear#/tasbih');
  for (let i = 0; i < 5; i++) await page.click('[data-tap]');
  await page.reload();
  const n = await page.textContent('[data-num]');
  check('刷新页面后个人记录还在（赞念计数）', n === '5', `计数 ${n}`);
  await page.goto(base + '?weather=clear#/settings');
  await page.click('[data-fs="2"]');
  await page.reload();
  const fs = await page.evaluate(() => document.documentElement.dataset.fs);
  check('刷新后设置还在（字号）', fs === '2');
  await page.goto(base + '?weather=clear&now=2027-02-20T12:00#/ramadan');
  await page.click('[data-today]');
  await page.reload();
  const yes = await page.locator('.day.is-today.is-yes').count();
  check('刷新后封斋记录还在（斋月第 13 天）', yes === 1);
  await ctx.close();
}

// 5. 网络请求：只允许本站资源 + 天气接口（只带城市坐标）
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const external = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.hostname !== '127.0.0.1') external.push(u.hostname + u.pathname + u.search);
  });
  // 天气请求在这里拦下返回假数据，只检查请求里带了什么
  await page.route('https://api.open-meteo.com/**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ current: { weather_code: 0, temperature_2m: 10, snowfall: 0 }, daily: { weather_code: [0], temperature_2m_min: [3], snowfall_sum: [0] } }) }),
  );
  for (const h of ['', '#/pray', '#/pray/wudu', '#/pray/guide/fajr/fard', '#/qibla', '#/tasbih', '#/settings']) {
    await page.goto(base + h);
    await page.waitForLoadState('networkidle');
  }
  const bad = external.filter((u) => !u.startsWith('api.open-meteo.com/v1/forecast'));
  const weatherOk = external.every((u) => !u.startsWith('api.open-meteo.com') || /latitude=38\.53575&longitude=68\.77905/.test(u));
  check('不向第三方发送请求（天气除外）', bad.length === 0, bad.join(', ') || `天气请求 ${external.length} 次`);
  check('天气请求只含城市坐标，不含用户位置', weatherOk);
  const cookies = await ctx.cookies();
  check('不设置 Cookie', cookies.length === 0);
  await ctx.close();
}

// 6. 夜间模式
{
  const ctx = await browser.newContext({ ...phone, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.goto(base + '?weather=snow&now=2026-12-20T20:10');
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(shots, 'verify-dark-home.png'), fullPage: true });
  await page.goto(base + '?weather=snow&now=2026-12-20T20:10#/pray/guide/isha/witr');
  let title = '';
  let count = '';
  for (let i = 0; i < 40 && !title.includes('古努特'); i++) {
    await page.click('[data-next]');
    title = await page.textContent('.step-title');
    count = await page.textContent('.step-count');
  }
  await page.screenshot({ path: join(shots, 'verify-dark-witr.png'), fullPage: true });
  check('威特尔第 3 拜有"举手，念古努特"一步', title.includes('古努特') && count.startsWith('第 3 拜'), `${count.trim()}：${title}`);
  await ctx.close();
}

// 7. 礼拜大殿：真实的多人连接（本地在线人数服务，垫子设为 2 张）
{
  const ps = startPresenceServer({ port: 0, hallCapacity: 2 });
  await new Promise((r) => setTimeout(r, 200));
  const q = `?weather=clear&now=2026-12-18T14:10&presence=ws://127.0.0.1:${ps.port}#/masjid/hall`;
  const users = [];
  for (let k = 0; k < 3; k++) {
    const ctx = await browser.newContext(phone);
    const page = await ctx.newPage();
    await page.goto(base + q);
    users.push({ ctx, page });
  }
  await users[2].page.waitForFunction(() => /此刻在大殿 3 人/.test(document.querySelector('[data-count]').textContent), null, { timeout: 5000 }).catch(() => {});
  check('大殿显示真实在线人数', /此刻在大殿 3 人/.test(await users[2].page.textContent('[data-count]')), await users[2].page.textContent('[data-count]'));
  await users[0].page.click('[data-mat="0"]');
  await users[1].page.waitForSelector('[data-mat="1"].is-free');
  await users[1].page.click('[data-mat="1"]');
  await users[2].page.waitForSelector('[data-queue]', { timeout: 5000 }).catch(() => {});
  check('垫子坐满后提示排队', (await users[2].page.locator('[data-queue]').count()) === 1);
  await users[2].page.click('[data-queue]');
  await users[2].page.waitForFunction(() => /你排在第 1 位/.test(document.querySelector('[data-panel]').textContent), null, { timeout: 5000 }).catch(() => {});
  check('排队位置', /你排在第 1 位/.test(await users[2].page.textContent('[data-panel]')));
  await users[0].page.click('[data-stand]');
  await users[2].page.waitForFunction(() => /你坐在第 1 排第 1 张/.test(document.querySelector('[data-panel]').textContent), null, { timeout: 5000 }).catch(() => {});
  const toastText = (await users[2].page.locator('.toast').textContent().catch(() => '')) || '';
  check('有人起身，垫子自动给排队的人', /你坐在第 1 排第 1 张/.test(await users[2].page.textContent('[data-panel]')) && /轮到你了/.test(toastText), toastText.trim());
  await users[2].page.screenshot({ path: join(shots, 'verify-hall-queue.png') });
  await users[1].ctx.close();
  await users[0].page.waitForFunction(() => /此刻在大殿 2 人/.test(document.querySelector('[data-count]').textContent), null, { timeout: 5000 }).catch(() => {});
  check('有人离开，人数实时减少', /此刻在大殿 2 人/.test(await users[0].page.textContent('[data-count]')));
  await users[0].page.goto(base + q.replace('#/masjid/hall', '#/masjid'));
  await users[0].page.waitForFunction(() => /此刻/.test(document.querySelector('[data-count="hall"]').textContent), null, { timeout: 5000 }).catch(() => {});
  check('入口页只读人数（看人数不算人头）', /此刻 1 人 · 垫子 1\/2/.test(await users[0].page.textContent('[data-count="hall"]')), await users[0].page.textContent('[data-count="hall"]'));
  for (const u of users) await u.ctx.close().catch(() => {});
  await ps.close();
}

// 8. 没有在线人数服务时：不显示任何人数
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await page.goto(base + '?weather=clear#/masjid/hall');
  const t = await page.textContent('[data-count]');
  check('未连接计数服务时不显示人数（不编造）', !/\d+ 人/.test(t), t);
  await ctx.close();
}

// 9. 离线：打开一次后断网，礼拜时间和各页面照样能看
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  await page.goto(base + '?weather=clear');
  await page.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready);
  await page.reload(); // 让离线缓存接管页面
  await page.waitForTimeout(5000); // 等空闲时预下载其他页面
  await ctx.setOffline(true);
  await page.reload();
  const time = await page.textContent('[data-hero] .hero-time').catch(() => '');
  check('断网后礼拜时间照样显示', /\d\d:\d\d/.test(time || ''), time);
  const okPages = [];
  for (const h of ['#/ramadan', '#/masjid/hall', '#/pray/guide/fajr/fard', '#/qibla']) {
    await page.goto(base + '?weather=clear' + h);
    await page.waitForTimeout(600);
    const txt = await page.textContent('#app');
    const stuck = await page.locator('#app > .page > .loading').count();
    if (txt && !stuck && txt.length > 50) okPages.push(h);
  }
  check('断网后斋月、大殿、跟做、朝向页都能打开', okPages.length === 4, okPages.join(' '));
  await ctx.close();
}

// 10. 基本操作：新功能都能用、能保存
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(base + '?weather=snow&now=2026-12-18T15:20');
  await page.waitForTimeout(800);
  // 第一次打开：首页请用户确认城市；确认后不再出现
  const welcome = await page.locator('[data-city-ok]').count();
  await page.click('[data-city-ok]');
  await page.waitForTimeout(200);
  await page.reload();
  await page.waitForTimeout(500);
  check('第一次打开请确认城市，确认后不再出现', welcome === 1 && (await page.locator('[data-city-ok]').count()) === 0);
  // 已礼打勾：只有已到时间的拜能点；刷新后还在
  const checks = await page.locator('[data-prayed]').count();
  await page.click('[data-prayed="dhuhr"]');
  await page.reload();
  await page.waitForTimeout(400);
  const pressed = await page.getAttribute('[data-prayed="dhuhr"]', 'aria-pressed');
  check('"已礼"打勾：到时间的拜才能点（15:20 时晨礼、晌礼），刷新后还在', checks === 2 && pressed === 'true', `可点 ${checks} 番，晌礼 ${pressed}`);
  // 雪天：天气卡片里有"在住处礼拜"的圣训；星期五用伊本·阿拔斯主麻日那一条
  await page.waitForSelector('[data-wx-hadith] .hq-src', { timeout: 3000 }).catch(() => {});
  const wx = (await page.textContent('[data-wx-hadith]').catch(() => '')) || '';
  check('雪天卡片引用"在家里礼拜"的圣训（星期五：布哈里 901）', /901/.test(wx) && /[\u0600-\u06FF]/.test(wx), wx.replace(/\s+/g, ' ').slice(0, 50));
  // 今日圣训 + 分享
  await page.waitForSelector('[data-daily-hadith] .hq-src', { timeout: 3000 }).catch(() => {});
  const hd = (await page.textContent('[data-daily-hadith]').catch(() => '')) || '';
  check('今日圣训有原文、意思和出处', /[\u0600-\u06FF]/.test(hd) && /出处：(布哈里|提尔密济)/.test(hd), hd.replace(/\s+/g, ' ').slice(-30));
  check('首页有"分享给亲友"', (await page.locator('[data-share-app]').count()) === 1 && (await page.locator('[data-share-hadith]').count()) === 1);
  // 补礼记录
  await page.goto(base + '?weather=clear&now=2026-12-18T15:20#/pray/qada');
  await page.waitForTimeout(500);
  await page.click('[data-bulk]');
  await page.click('[data-q="fajr"][data-d="1"]');
  await page.click('[data-q="isha"][data-d="-1"]');
  await page.reload();
  await page.waitForTimeout(400);
  const qf = await page.textContent('[data-qv="fajr"]');
  const qi = await page.textContent('[data-qv="isha"]');
  check('补礼记录加减正确、刷新后还在', qf === '2' && qi === '0', `晨礼 ${qf}，宵礼 ${qi}`);
  // 本月时间表
  await page.goto(base + '?weather=clear&now=2026-12-18T15:20#/times');
  await page.waitForTimeout(500);
  const rows = await page.locator('.times-table tbody tr').count();
  check('本月时间表 31 天都在，今天高亮', rows === 31 && (await page.locator('.times-table tr.is-today').count()) === 1, `${rows} 行`);
  // 换城市：时间跟着变，首页显示新城市
  await page.goto(base + '?weather=clear&now=2026-12-18T15:20#/city');
  await page.waitForTimeout(400);
  await page.fill('[data-search]', 'kazan');
  const visible = await page.locator('[data-pick]:visible').count();
  await page.click('[data-pick="kazan"]');
  await page.waitForTimeout(500);
  const back = await page.evaluate(() => location.hash); // 回到进来之前的页面
  await page.goto(base + '?weather=clear&now=2026-12-18T15:20#/');
  await page.waitForTimeout(400);
  const cityBtn = await page.textContent('.city-btn');
  check('搜索城市、选中后回到原来的页面，首页换成新城市', visible === 1 && back === '#/times' && /喀山/.test(cityBtn), `${visible} 个结果，回到 ${back}，${cityBtn.trim()}`);
  // 切换语言
  await page.goto(base + '?weather=clear&now=2026-12-18T15:20#/settings');
  await page.waitForTimeout(400);
  await page.click('[data-lang="tg"]');
  await page.waitForTimeout(800);
  const tg = await page.textContent('.tabbar');
  check('设置里切换成塔吉克语，界面立即变', /Имрӯз/.test(tg), tg.replace(/\s+/g, ' ').trim());
  // 坚持打卡：已连续 6 天（昨天打过），今天点一番"已礼" → 连续 7 天，解锁"一周"并庆祝
  await page.goto(base + '?weather=clear&now=2026-12-18T15:20');
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('masjid:settings') || '{}');
    localStorage.setItem('masjid:settings', JSON.stringify({ ...st, lang: 'zh' }));
    localStorage.setItem('masjid:streak', JSON.stringify({ cur: 6, best: 6, last: '2026-12-17', grace: [], titles: [3], prev: 0 }));
    localStorage.removeItem('masjid:prayed');
  });
  await page.reload();
  await page.waitForTimeout(500);
  const before = (await page.textContent('[data-streak] .streak-n')) || '';
  await page.click('[data-prayed="fajr"]');
  await page.waitForTimeout(400);
  const cele = await page.locator('.celebrate').count();
  const celeText = cele ? await page.textContent('.celebrate h2') : '';
  if (cele) await page.click('[data-cele-ok]');
  const after = (await page.textContent('[data-streak] .streak-n')) || '';
  check('打卡：连续 6 天 → 点"已礼"变 7 天，解锁"一周"并庆祝', /6/.test(before) && /7/.test(after) && cele === 1 && /一周/.test(celeText), `${before.trim()} → ${after.trim()}，${celeText}`);
  await page.goto(base + '?weather=clear&now=2026-12-18T15:20#/streak');
  await page.waitForTimeout(500);
  const got = await page.locator('.title-item.is-got').count();
  check('"我的坚持"页：已解锁 2 个称号（起步、一周）', got === 2, `${got} 个`);
  await page.goto(base + '?weather=clear&now=2026-12-18T15:20#/circle');
  await page.waitForTimeout(400);
  check('没有后台时，亲友圈说明"上线后可用"，不报错', /上线后可用/.test(await page.textContent('#app')));
  check('以上操作没有页面错误', errs.length === 0, errs.join('; '));
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} 项未通过` : `\n全部 ${results.length} 项通过`);
process.exit(failed ? 1 : 0);
