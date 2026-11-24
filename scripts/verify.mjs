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

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} 项未通过` : `\n全部 ${results.length} 项通过`);
process.exit(failed ? 1 : 0);
