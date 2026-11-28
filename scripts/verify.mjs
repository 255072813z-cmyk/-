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
import { gzipSync } from 'node:zlib';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startPresenceServer } from '../server/dev-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = fileURLToPath(new URL('../dist/', import.meta.url));
const shots = fileURLToPath(new URL('../shots/', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json' };
// 和真实的网站托管（GitHub Pages、Cloudflare 等）一样：文字类文件压缩后再发（首屏速度按真实情况测）
const zipped = new Map();
const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^([/\\])+/, '');
  try {
    const body = await readFile(join(root, p || 'index.html'));
    const type = TYPES[extname(p)] || 'text/html; charset=utf-8';
    if (/gzip/.test(req.headers['accept-encoding'] || '') && !/font/.test(type)) {
      const key = p || 'index.html';
      if (!zipped.has(key)) zipped.set(key, gzipSync(body));
      res.writeHead(200, { 'content-type': type, 'content-encoding': 'gzip', vary: 'accept-encoding' });
      return res.end(zipped.get(key));
    }
    res.writeHead(200, { 'content-type': type });
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
// 新用户第一次打开先走三步引导。大多数检查要的是"已经用过的人"：每个浏览器环境开第一页时，
// 在别的预设之后把"引导走完了"补进设置（只补这一项，不动其他设置）。专门检查第一次打开的环境传 fresh: true。
{
  const raw = browser.newContext.bind(browser);
  browser.newContext = async (opts = {}) => {
    const { fresh, ...rest } = opts;
    const ctx = await raw(rest);
    if (fresh) return ctx;
    const rawPage = ctx.newPage.bind(ctx);
    let added = false;
    ctx.newPage = async () => {
      if (!added) {
        added = true;
        await ctx.addInitScript(() => {
          try {
            const st = JSON.parse(localStorage.getItem('masjid:settings') || '{}');
            if (st.onboarded === undefined) localStorage.setItem('masjid:settings', JSON.stringify({ ...st, onboarded: true }));
          } catch (e) {}
        });
      }
      return rawPage();
    };
    return ctx;
  };
}
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
  await page.screenshot({ path: join(shots, 'verify-reminder.png'), animations: 'disabled' });
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
  await page.screenshot({ path: join(shots, 'verify-compass.png'), animations: 'disabled' });
  await ctx.close();
}

// 3b. 罗盘指针（全面）：安卓、苹果两种传感器；磁偏角向东、向西的城市；横屏；跨过正北；读不到传感器、没有权限
{
  const { qiblaBearing } = await import('../src/core/qibla.js');
  const { CITY_DATA } = await import('../src/content/cities-data.js');
  const norm = (a) => ((a % 360) + 360) % 360;
  const diff = (a, b) => {
    const d = norm(a - b);
    return d > 180 ? d - 360 : d;
  };
  // 打开某城市的朝向页。ios：模拟苹果（没有 absolute 事件，读 webkitCompassHeading，要先请求权限）；angle：屏幕旋转角
  async function openCompass({ city = 'dushanbe', ios = false, perm = 'granted', angle = 0 } = {}) {
    const ctx = await browser.newContext(phone);
    await ctx.addInitScript(
      ([city, ios, perm, angle]) => {
        localStorage.setItem('masjid:settings', JSON.stringify({ city, cityConfirmed: true, lang: 'zh' }));
        if (ios) {
          delete Window.prototype.ondeviceorientationabsolute;
          delete window.ondeviceorientationabsolute;
          // perm 为 hang：模拟有的苹果手机请求权限时既不答应也不拒绝
          window.DeviceOrientationEvent.requestPermission = () => (perm === 'hang' ? new Promise(() => {}) : Promise.resolve(perm));
        }
        if (angle) Object.defineProperty(screen, 'orientation', { configurable: true, get: () => ({ angle, type: 'landscape-primary', addEventListener() {}, removeEventListener() {} }) });
      },
      [city, ios, perm, angle],
    );
    const page = await ctx.newPage();
    await page.goto(base + '?weather=clear#/qibla');
    await page.waitForSelector('[data-start]');
    await page.click('[data-start]');
    const c = CITY_DATA.find((x) => x.id === city);
    const b = qiblaBearing(c.lat, c.lon);
    // 让屏幕上方指向"真北方位 H"：换算成磁北，再换算成手机顶边的方向（横屏时差 angle）
    const toward = async (H, n = 50) => {
      const dev = norm(norm(H - c.declination) - angle);
      for (let i = 0; i < n; i++)
        await page.evaluate(
          ([ios, dev]) => {
            const ev = new Event(ios ? 'deviceorientation' : 'deviceorientationabsolute');
            // 苹果的 alpha 是任意参考系，故意给个乱的值，确认用的是 webkitCompassHeading
            Object.assign(ev, ios ? { alpha: 77, beta: 0, gamma: 0, absolute: false, webkitCompassHeading: dev } : { alpha: (360 - dev) % 360, beta: 0, gamma: 0, absolute: true });
            window.dispatchEvent(ev);
          },
          [ios, dev],
        );
      const rose = parseFloat((await page.getAttribute('[data-rose]', 'transform')).match(/-?[\d.]+/)[0]);
      return { turn: (await page.textContent('[data-turn]')).trim(), rose, aligned: (await page.locator('.compass-card.is-aligned').count()) === 1 };
    };
    return { ctx, page, b, c, toward };
  }

  // 安卓，杜尚别（磁偏角 +4.7° 向东）
  {
    const { ctx, page, b, toward } = await openCompass();
    const needle = parseFloat((await page.getAttribute('[data-rose] > g', 'transform')).match(/-?[\d.]+/)[0]);
    const num = (await page.textContent('.bearing-num')).trim();
    check('罗盘：表盘上的朝向指针转到朝向角（杜尚别 243.8°）', Math.abs(needle - b) < 0.05 && num === b.toFixed(1) + '°', `指针 ${needle.toFixed(1)}°，显示 ${num}`);
    let r = await toward(b + 30);
    const ok1 = r.turn === '向左转 30°' && Math.abs(diff(-r.rose, b + 30)) < 0.5 && !r.aligned;
    r = await toward(b - 50);
    const ok2 = r.turn === '向右转 50°' && Math.abs(diff(-r.rose, b - 50)) < 0.5;
    const t2 = r.turn;
    r = await toward(b + 4);
    const ok3 = r.turn === '已对准朝向' && r.aligned;
    const hint = await page.locator('[data-portrait]:visible').count();
    check('罗盘（安卓）：偏右 30° 提示向左转 30°，偏左 50° 提示向右转 50°，差 4° 算对准；表盘跟着转', ok1 && ok2 && ok3 && hint === 0, `${t2}；${r.turn}，表盘 ${r.rose}`);
    // 跨过正北：从 350° 转到 10°，指针应走最短的 20°，不能绕一大圈
    await toward(350, 60);
    const path = [];
    const c = CITY_DATA.find((x) => x.id === 'dushanbe');
    for (let i = 0; i < 25; i++) {
      await page.evaluate((a) => {
        const ev = new Event('deviceorientationabsolute');
        Object.assign(ev, { alpha: a, beta: 0, gamma: 0, absolute: true });
        window.dispatchEvent(ev);
      }, norm(360 - norm(10 - c.declination)));
      path.push(-parseFloat((await page.getAttribute('[data-rose]', 'transform')).match(/-?[\d.]+/)[0]));
    }
    const worst = Math.max(...path.map((a) => Math.abs(diff(a, 0))));
    check('罗盘：从 350° 转到 10° 时走最短路（经过正北），不乱转一圈', worst <= 10.5 && Math.abs(diff(path[path.length - 1], 10)) < 1, `途中离正北最远 ${worst.toFixed(1)}°`);
    await ctx.close();
  }
  // 安卓，符拉迪沃斯托克（磁偏角 -10.9° 向西）、莫斯科（+12.2°）
  for (const city of ['vladivostok', 'moscow']) {
    const { ctx, b, c, toward } = await openCompass({ city });
    const r1 = await toward(b);
    const r2 = await toward(b + 20);
    // 如果磁偏角的正负弄反了，会差 2×|磁偏角|（20° 以上），这里就会失败
    check(
      `罗盘：${city === 'moscow' ? '莫斯科（磁偏角向东 12.2°）' : '符拉迪沃斯托克（磁偏角向西 10.9°）'}，朝向 ${b.toFixed(1)}° 时对准，偏 20° 提示向左转`,
      r1.aligned && r1.turn === '已对准朝向' && r2.turn === '向左转 20°',
      `磁偏角 ${c.declination}°：${r1.turn}；${r2.turn}`,
    );
    await ctx.close();
  }
  // 苹果：先请求权限，读 webkitCompassHeading
  {
    const { ctx, b, toward } = await openCompass({ ios: true });
    const r1 = await toward(b - 40);
    const r2 = await toward(b);
    check('罗盘（苹果）：用 webkitCompassHeading，偏左 40° 提示向右转 40°，转过来后对准', r1.turn === '向右转 40°' && r2.aligned, `${r1.turn}；${r2.turn}`);
    await ctx.close();
  }
  // 横屏：屏幕转了 90°，按屏幕上方算方向，并提醒竖着拿
  {
    const { ctx, page, b, toward } = await openCompass({ angle: 90 });
    const r = await toward(b);
    const hint = await page.locator('[data-portrait]:visible').count();
    check('罗盘（横屏）：修正屏幕旋转后仍然对准，并提示竖着拿更准', r.aligned && hint === 1, r.turn);
    await ctx.close();
  }
  // 读不到传感器 / 苹果拒绝权限：3.5 秒后说明原因，按钮回来可以再试
  {
    const a = await openCompass();
    const b2 = await openCompass({ ios: true, perm: 'denied' });
    await a.page.waitForTimeout(3800);
    const t1 = (await a.page.textContent('[data-turn]')).trim();
    const t2 = (await b2.page.textContent('[data-turn]')).trim();
    const again = await a.page.locator('[data-start]:visible').count();
    check('罗盘：读不到传感器时提示用角度对照；苹果没给权限时说明去设置里允许', /读不到罗盘/.test(t1) && /没有得到罗盘权限/.test(t2) && again === 1, `${t1.slice(0, 12)}…；${t2.slice(0, 12)}…`);
    // 再点一次"打开罗盘"，这回有数据：照常工作
    await a.page.click('[data-start]');
    const r = await a.toward(a.b);
    check('罗盘：出错后再点一次能正常用', r.aligned, r.turn);
    await a.ctx.close();
    await b2.ctx.close();
  }
  // 苹果请求权限一直没有回音：不能一直停在"正在读取"——3 秒先提示怎么拿手机，8 秒说明办法、按钮变"再试一次"
  {
    const h = await openCompass({ ios: true, perm: 'hang' });
    await h.page.waitForTimeout(3400);
    const slow = (await h.page.textContent('[data-turn]')).trim();
    await h.page.waitForTimeout(5000);
    const out = (await h.page.textContent('[data-turn]')).trim();
    const retry = ((await h.page.locator('[data-start]:visible').textContent().catch(() => '')) || '').trim();
    check('罗盘：权限请求一直没回音时，3 秒提示"慢慢转一圈"，8 秒说明办法（画"8"字、允许"运动与方向"、按角度和地图找）并可以再试', /慢慢转一圈/.test(slow) && /一直没有反应/.test(out) && /8/.test(out) && /运动与方向/.test(out) && retry === '再试一次', `${slow.slice(0, 14)}… → ${out.slice(0, 14)}…；按钮"${retry}"`);
    await h.ctx.close();
  }
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
  await page.waitForSelector('.day.is-today'); // 斋月页是按需下载的：等它出来再数
  const yes = await page.locator('.day.is-today.is-yes').count();
  check('刷新后封斋记录还在（斋月第 13 天）', yes === 1);
  await ctx.close();
}

// 4b. 每日封斋：斋月里打开能用——倒计时、封斋饭截止和开斋时间、今天打卡、改过去某天、到点自动切换
{
  const { fastTimes } = await import('../src/core/ramadan.js');
  const { getCity } = await import('../src/core/cities.js');
  const ft = fastTimes(getCity('dushanbe'), { y: 2027, m: 2, d: 20 });
  const hm = (d) => new Date(d.getTime() + 5 * 3600e3).toISOString().slice(11, 16);
  const ctx = await browser.newContext(phone);
  await ctx.addInitScript(() => localStorage.setItem('masjid:settings', JSON.stringify({ city: 'dushanbe', cityConfirmed: true, lang: 'zh' })));
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  // 用假时钟：开斋前 10 秒
  await page.clock.install({ time: new Date(ft.iftar.getTime() - 10e3) });
  await page.goto(base + '?weather=clear#/ramadan');
  await page.waitForSelector('[data-fast-count]');
  const title = (await page.textContent('.ph h1')).trim();
  const head = (await page.textContent('.fast-phase')).trim();
  const times = (await page.locator('.ft-time').allTextContents()).map((x) => x.trim());
  check('斋月页（第 13 天）：显示"封斋中"、开斋倒计时、封斋饭截止和开斋时间', /第 13 天/.test(title) && head === '封斋中' && times[0] === hm(ft.sahurEnd) && times[1] === hm(ft.iftar), `${title}；${head}；${times.join(' / ')}`);
  const days = await page.locator('.day').count();
  const future = await page.locator('.day[disabled]').count();
  check('斋月页：30 个日子格，今天以后的不能点', days >= 29 && future === days - 13, `${days} 格，${future} 格不能点`);
  // 今天打卡 → 解锁"第一天斋"徽章 → 刷新还在
  await page.click('[data-today]');
  await page.waitForSelector('.celebrate', { timeout: 3000 }).catch(() => {});
  const badge = (await page.textContent('.celebrate h2').catch(() => '')) || '';
  if (badge) await page.click('[data-cele-ok]');
  const btn = (await page.textContent('[data-today]')).trim();
  check('今天封了斋，点一下记下，并解锁"第一天斋"徽章', /已记下/.test(btn) && (await page.locator('.day.is-today.is-yes').count()) === 1 && badge === '第一天斋', `${btn}；${badge}`);
  // 改过去某天：封了 → 没封 → 清空
  const cell = '[data-day="5"]';
  const seen = [];
  for (let i = 0; i < 3; i++) {
    await page.click(cell);
    seen.push((await page.getAttribute(cell, 'class')).includes('is-yes') ? 'yes' : (await page.getAttribute(cell, 'class')).includes('is-no') ? 'no' : '-');
  }
  check('斋月第 5 天：点一下"封了"，再点"没封"，再点清空', seen.join(',') === 'yes,no,-', seen.join(' → '));
  // 到点开斋：时钟走过开斋时间，页面自己切到"已开斋"，倒计时改成到明天封斋饭截止
  await page.clock.runFor(15e3);
  await page.waitForTimeout(300);
  const head2 = (await page.textContent('.fast-phase')).trim();
  const count2 = (await page.textContent('.hero-count')).trim();
  check('到开斋时间页面自动切换为"已开斋"，倒计时改为明天停止吃喝', /已开斋/.test(head2) && /明天停止吃喝/.test(count2), `${head2}；${count2.replace(/\s+/g, ' ')}`);
  await page.reload();
  await page.waitForSelector('[data-today]');
  check('刷新后今天的封斋记录还在', (await page.locator('.day.is-today.is-yes').count()) === 1);
  // 首页：斋月里有斋月卡片
  await page.goto(base + '?weather=clear#/');
  await page.waitForSelector('[data-hero]');
  const home = await page.textContent('#app');
  check('斋月里首页有封斋卡片（开斋/封斋饭时间）', /封斋饭|开斋/.test(home));
  // 斋月前：这一页变成全年可用的"封斋"页——没有点不动的斋月格子，有斋月倒计时和第一天的时间
  await page.clock.setSystemTime(new Date('2027-01-20T08:00:00Z'));
  await page.goto(base + '?weather=clear#/ramadan');
  await page.waitForSelector('.ph h1');
  const pre = (await page.textContent('[data-vf-ramadan]')).replace(/\s+/g, ' ');
  check('斋月前：显示"斋月还有 N 天"和第一天的时间，没有点不动的斋月格子', /斋月还有 \d+ 天/.test(pre) && (await page.locator('.day').count()) === 0 && (await page.locator('[data-vf-fast]').count()) === 1, pre.slice(0, 40));
  check('斋月页以上操作没有页面错误', errs.length === 0, errs.join('; '));
  await ctx.close();
}

// 4c. 平时封斋（斋月以外）：圣行斋日、今天我在封斋、副功斋/补斋、补斋天数、明天的提醒、不能封斋的日子
{
  const ctx = await browser.newContext(phone);
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('masjid:settings')) localStorage.setItem('masjid:settings', JSON.stringify({ city: 'dushanbe', cityConfirmed: true, lang: 'zh' }));
    if (!localStorage.getItem('masjid:fast:1447')) localStorage.setItem('masjid:fast:1447', JSON.stringify({ 3: 'no', 4: 'no', 10: 'yes' }));
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  // 2026-12-24 星期四，伊斯兰历赖哲卜月 15 日（白日）
  const q = '?weather=clear&now=2026-12-24T11:20';
  await page.goto(base + q + '#/ramadan');
  await page.waitForSelector('[data-vf-today]');
  const tab = (await page.textContent('.tabbar .tab.is-active')).trim();
  const sunnah = (await page.textContent('.vf-sunnah')).trim();
  const ups = await page.locator('.vf-day').count();
  const special = (await page.locator('.vf-special').allTextContents()).join(' ');
  check('平时的"封斋"页：标签叫"封斋"；今天是白日和星期四；列出近期圣行斋日和下一个阿拉法日、阿舒拉日', tab === '封斋' && /白日/.test(sunnah) && /星期四/.test(sunnah) && ups >= 5 && /阿拉法日：2027年5月15日/.test(special) && /阿舒拉日/.test(special), `${sunnah}；${ups} 天；${special.slice(0, 30)}`);
  // 上个斋月记了 2 天没封 → 加到补斋
  await page.click('[data-vf-import]');
  const owe1 = (await page.textContent('[data-vf-owe-n]')).trim();
  // 今天我在封斋：有要补的就先记成补斋，出现开斋倒计时，解锁"补上一天"
  await page.click('[data-vf-fast]');
  await page.waitForSelector('.celebrate', { timeout: 3000 }).catch(() => {});
  const badge = (await page.textContent('.celebrate h2').catch(() => '')) || '';
  if (badge) await page.click('[data-cele-ok]');
  const count = (await page.textContent('[data-vf-count]').catch(() => '')) || '';
  const owe2 = (await page.textContent('[data-vf-owe-n]')).trim();
  const kindQ = await page.getAttribute('[data-vf-kind="qada"]', 'aria-pressed');
  check('今天我在封斋：记成补斋，还要补 2 天 → 1 天，出现开斋倒计时，解锁"补上一天"', owe1 === '还要补 2 天' && owe2 === '还要补 1 天' && kindQ === 'true' && /\d/.test(count) && badge === '补上一天', `${owe1} → ${owe2}，倒计时 ${count.replace(/\s+/g, '')}，${badge}`);
  // 改成副功斋：补斋恢复 2 天
  await page.click('[data-vf-kind="nafl"]');
  await page.waitForTimeout(200);
  if (await page.locator('.celebrate').count()) await page.click('[data-cele-ok]');
  const owe3 = (await page.textContent('[data-vf-owe-n]')).trim();
  // 明天也封斋：提醒
  await page.click('[data-vf-today] [data-vf-plan]');
  const planned = await page.getAttribute('[data-vf-today] [data-vf-plan]', 'aria-pressed');
  await page.reload();
  await page.waitForSelector('[data-vf-today]');
  const still = (await page.locator('[data-vf-kind="nafl"][aria-pressed="true"]').count()) === 1 && (await page.getAttribute('[data-vf-today] [data-vf-plan]', 'aria-pressed')) === 'true';
  check('改成副功斋后补斋回到 2 天；"明天也封斋"可以设提醒；刷新后都还在', owe3 === '还要补 2 天' && planned === 'true' && still, `${owe3}，明天提醒 ${planned}`);
  await page.goto(base + '?weather=clear&now=2026-12-24T11:25#/');
  await page.waitForSelector('[data-hero]');
  const home = (await page.textContent('.home-ramadan').catch(() => '')) || '';
  check('今天在封斋时，首页显示开斋时间和还有多久', /今天在封斋/.test(home) && /开斋/.test(home), home.replace(/\s+/g, ' ').trim());
  // 古尔邦节：不封斋，没有"今天我在封斋"按钮
  await page.goto(base + '?weather=clear&now=2027-05-16T10:00#/ramadan');
  await page.waitForSelector('[data-vf-today]');
  const eid = (await page.textContent('[data-vf-today]')).replace(/\s+/g, ' ');
  check('古尔邦节当天：写明这天不封斋（布哈里 1990），不能记封斋', /今天是古尔邦节/.test(eid) && /1990/.test(eid) && (await page.locator('[data-vf-fast]').count()) === 0, eid.slice(0, 30));
  check('平时封斋页以上操作没有页面错误', errs.length === 0, errs.join('; '));
  await ctx.close();
}

// 4d. 启动画面：打开时显示图标、名称和一句话，按手机语言显示，几秒后自己淡出，内容安全策略不拦
{
  const res = [];
  for (const locale of ['tg-TJ', 'ru-RU']) {
    const ctx = await browser.newContext({ ...phone, locale });
    await ctx.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }));
    const page = await ctx.newPage();
    const csp = [];
    page.on('console', (m) => /Content Security Policy/.test(m.text()) && csp.push(m.text()));
    const t0 = Date.now();
    await page.goto(base + '?weather=clear');
    await page.waitForTimeout(500);
    const name = (await page.textContent('.splash-name').catch(() => '')) || '';
    const tag = (await page.textContent('.splash-tag').catch(() => '')) || '';
    const visible = await page.locator('#splash.is-on').isVisible().catch(() => false);
    await page.waitForSelector('#splash', { state: 'detached', timeout: 8000 }).catch(() => {});
    const ms = Date.now() - t0;
    res.push({ locale, name, tag, visible, ms, csp: csp.length });
    if (locale === 'tg-TJ') {
      await page.reload();
      const t1 = Date.now();
      await page.waitForSelector('#splash', { state: 'detached', timeout: 8000 }).catch(() => {});
      res.push({ again: Date.now() - t1 });
    }
    await ctx.close();
  }
  const [tg, again, ru] = res;
  check(
    '启动画面：塔吉克语手机显示"Ҷойнамоз"、俄语手机显示"Джойнамоз"；第一次约 3.8 秒、以后约 2.4 秒后淡出（不超过 6.5 秒）；不被安全策略拦',
    tg.visible && tg.name === 'Ҷойнамоз' && /Намоз дар хона/.test(tg.tag) && ru.name === 'Джойнамоз' && tg.ms >= 3800 && tg.ms < 6500 && again.again >= 2400 && again.again < tg.ms && tg.csp + ru.csp === 0,
    `${tg.name} ${tg.ms} ms → 再次 ${again.again} ms；${ru.name} ${ru.ms} ms`,
  );
}

// 4e. 古兰经：目录、搜索、读一章（原文 + 译文）、太斯米、跳到某一节、继续读、字号和译文开关、三种语言的译文
{
  const ctx = await browser.newContext(phone);
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('masjid:settings')) localStorage.setItem('masjid:settings', JSON.stringify({ city: 'dushanbe', cityConfirmed: true, lang: 'zh' }));
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const q = '?weather=clear&now=2026-12-18T15:20';
  // 每次都整页重新打开（只改 # 后面不会重新加载，读到的可能还是上一页）
  let k = 0;
  const open = (hash) => page.goto(base + q + '&r=' + ++k + hash);
  const bare = (x) => x.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '');
  await open('#/quran');
  await page.waitForSelector('.sura');
  const rows = await page.locator('.sura').count();
  await page.fill('[data-q-search]', '黄牛');
  const found = (await page.locator('.sura').allTextContents()).map((x) => x.replace(/\s+/g, ' ').trim());
  await page.fill('[data-q-search]', '');
  check('古兰经目录：114 章，按章名搜索"黄牛"找到第 2 章', rows === 114 && found.length === 1 && /^2 黄牛/.test(found[0]), found[0]);
  // 第 112 章：太斯米单独一行，4 节，原文 + 马坚译文
  await open('#/quran/112');
  await page.waitForSelector('.ayah');
  const n112 = await page.locator('.ayah').count();
  const a1 = (await page.textContent('#a1 .ayah-ar')).trim();
  const t1 = (await page.textContent('#a1 .ayah-tr')).trim();
  const bas = await page.locator('.q-basmala').count();
  check('读第 112 章：4 节，太斯米单独一行，阿拉伯原文 + 中文译文', n112 === 4 && bas === 1 && bare(a1).includes('قل هو الله أحد') && /独一/.test(t1), `${t1}`);
  await open('#/quran/9');
  await page.waitForSelector('.ayah');
  const b9 = await page.locator('.q-basmala').count();
  await open('#/quran/1');
  await page.waitForSelector('.ayah');
  const b1 = await page.locator('.q-basmala').count();
  const f1 = (await page.textContent('#a1 .ayah-ar')).trim();
  check('第 9 章没有太斯米；第 1 章的太斯米就是第 1 节', b9 === 0 && b1 === 0 && bare(f1).startsWith('بسم الله'));
  // 跳到宝座经 2:255，高亮并在屏幕里；回目录显示"继续读 第 2 章 第 255 节"
  await open('#/quran/2/255');
  await page.waitForSelector('#a255.is-target');
  await page.waitForTimeout(400);
  const box = await page.locator('#a255').boundingBox();
  const inView = box && box.y >= 0 && box.y < 844;
  await open('#/quran');
  await page.waitForSelector('.q-continue');
  const cont = (await page.textContent('.q-continue')).replace(/\s+/g, ' ');
  check('跳到 2:255（宝座经）：高亮并在屏幕里；目录页"继续读"记住第 2 章第 255 节', inView && /继续读/.test(cont) && /2\. 黄牛/.test(cont) && /255/.test(cont), cont.trim());
  // 字号、只看原文：刷新后还在
  await open('#/quran/112');
  await page.waitForSelector('.ayah');
  await page.click('[data-q-size="1"]');
  await page.click('[data-q-tr]');
  await page.reload();
  await page.waitForSelector('.ayah');
  const cls = await page.getAttribute('[data-q-page]', 'class');
  const trShown = await page.locator('.ayah-tr:visible').count();
  check('字号调大、关掉译文后刷新还在（只看阿拉伯原文）', /q-s2/.test(cls) && /no-tr/.test(cls) && trShown === 0, cls);
  await page.click('[data-q-tr]');
  // 俄语、塔吉克语：译文跟着界面语言
  const tr = {};
  for (const lang of ['ru', 'tg']) {
    await page.evaluate((l) => {
      const st = JSON.parse(localStorage.getItem('masjid:settings') || '{}');
      localStorage.setItem('masjid:settings', JSON.stringify({ ...st, lang: l }));
    }, lang);
    await open('#/quran/112');
    await page.waitForSelector('#a1 .ayah-tr');
    tr[lang] = (await page.textContent('#a1 .ayah-tr')).trim();
  }
  check('俄语界面用库利耶夫译文，塔吉克语界面用奥亚提译文', /Скажи/.test(tr.ru) && /Бигӯ/.test(tr.tg), `${tr.ru.slice(0, 30)}｜${tr.tg.slice(0, 30)}`);
  // 30 天通读：每卷有"读"，点开从这一卷开头读
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('masjid:settings') || '{}');
    localStorage.setItem('masjid:settings', JSON.stringify({ ...st, lang: 'zh' }));
  });
  await open('#/quran/plan');
  await page.waitForSelector('.juz');
  const back = await page.getAttribute('.page-head .back', 'href');
  await page.click('.juz:nth-child(3) a');
  await page.waitForSelector('.ayah.is-target');
  const target = await page.getAttribute('.ayah.is-target', 'id');
  check('30 天通读：返回到古兰经；第 3 卷点"读"从 2:253 开始', back === '#/quran' && /#\/quran\/2\/253$/.test(page.url()) && target === 'a253', `${back}，${page.url().split('#')[1]}`);
  // 读书记录：短章一屏读完 → 今天读了几节、这一章读完了；加书签；目录里打勾、书签、"接着上次"
  await open('#/quran/112');
  await page.waitForSelector('.ayah');
  await page.waitForTimeout(1600); // 像真人一样先读一会儿开头（一晃而过的不算读过）
  await page.mouse.wheel(0, 2000); // 翻到底
  await page.waitForTimeout(3200);
  const todayN = Number((await page.textContent('[data-q-today]')).trim());
  const doneShown = await page.locator('[data-q-done]:visible').count();
  await page.click('#a2 [data-mark]');
  const pressed = await page.getAttribute('#a2 [data-mark]', 'aria-pressed');
  check('读完第 112 章（4 节）：今天读了 4 节，出现"这一章读完了"；第 2 节加上书签', todayN >= 4 && doneShown === 1 && pressed === 'true', `今天 ${todayN} 节`);
  await open('#/quran/2/100');
  await page.waitForSelector('#a100.is-target');
  await page.waitForTimeout(1500);
  await open('#/quran/2');
  await page.waitForSelector('.ayah');
  const resume = ((await page.textContent('[data-q-resume]').catch(() => '')) || '').trim();
  await open('#/quran');
  await page.waitForSelector('.q-stats');
  const marks = (await page.textContent('[data-q-marklist]')).replace(/\s+/g, ' ');
  const done112 = await page.locator('.sura.is-done[href="#/quran/112"]').count();
  const big = Number((await page.textContent('.q-today-big b')).trim());
  check('目录页：今天读的节数、书签"112:2"、第 112 章打勾；再开第 2 章提示"接着上次：第 N 节"', big >= 4 && /112:2/.test(marks) && done112 === 1 && /接着上次：第 (9\d|10\d) 节/.test(resume), `${resume}；书签 ${marks.trim().slice(0, 20)}`);
  // 去掉书签：原地删掉
  await page.click('[data-unmark="112:2"]');
  const left = await page.locator('[data-q-marks]:visible').count();
  check('目录页删掉书签后，书签卡片收起', left === 0);
  // 丝滑：目录往下翻到第 60 章、点进去、按返回，回到原来的位置；再点一次"古兰经"标签，平滑回到顶部
  await open('#/quran');
  await page.waitForSelector('.sura');
  await page.locator('.sura[href="#/quran/60"]').scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, 1);
  await page.waitForTimeout(300);
  const yBefore = await page.evaluate(() => window.scrollY);
  await page.click('.sura[href="#/quran/60"]');
  await page.waitForSelector('.ayah');
  const yIn = await page.evaluate(() => window.scrollY);
  await page.goBack();
  await page.waitForSelector('.sura[href="#/quran/60"]');
  await page.waitForTimeout(400);
  const yBack = await page.evaluate(() => window.scrollY);
  await page.click('.tabbar a[href="#/quran"]');
  await page.waitForFunction(() => window.scrollY < 2, null, { timeout: 4000 }).catch(() => {});
  const yTop = await page.evaluate(() => window.scrollY);
  check('返回目录时回到原来翻到的位置；新打开的一章从顶上开始；再点当前标签回到顶部', yBefore > 1500 && yIn < 50 && Math.abs(yBack - yBefore) < 60 && yTop < 5 && page.url().endsWith('#/quran'), `离开 ${Math.round(yBefore)}，进去 ${Math.round(yIn)}，返回 ${Math.round(yBack)}，点标签 ${Math.round(yTop)}`);
  check('古兰经以上操作没有页面错误', errs.length === 0, errs.join('; '));
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
  await page.screenshot({ path: join(shots, 'verify-dark-home.png'), fullPage: true, animations: 'disabled' });
  await page.goto(base + '?weather=snow&now=2026-12-20T20:10#/pray/guide/isha/witr');
  let title = '';
  let count = '';
  for (let i = 0; i < 40 && !title.includes('古努特'); i++) {
    await page.click('[data-next]');
    title = await page.textContent('.step-title');
    count = await page.textContent('.step-count');
  }
  await page.screenshot({ path: join(shots, 'verify-dark-witr.png'), fullPage: true, animations: 'disabled' });
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
  await users[2].page.waitForFunction(() => /此刻在大殿 3 人/.test((document.querySelector('[data-count]') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
  check('大殿显示真实在线人数', /此刻在大殿 3 人/.test(await users[2].page.textContent('[data-count]')), await users[2].page.textContent('[data-count]'));
  await users[0].page.click('[data-mat="0"]');
  await users[1].page.waitForSelector('[data-mat="1"].is-free');
  await users[1].page.click('[data-mat="1"]');
  await users[2].page.waitForSelector('[data-queue]', { timeout: 5000 }).catch(() => {});
  check('垫子坐满后提示排队', (await users[2].page.locator('[data-queue]').count()) === 1);
  await users[2].page.click('[data-queue]');
  await users[2].page.waitForFunction(() => /你排在第 1 位/.test((document.querySelector('[data-panel]') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
  check('排队位置', /你排在第 1 位/.test(await users[2].page.textContent('[data-panel]')));
  await users[0].page.click('[data-stand]');
  await users[2].page.waitForFunction(() => /你坐在第 1 排第 1 张/.test((document.querySelector('[data-panel]') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
  const toastText = (await users[2].page.locator('.toast').textContent().catch(() => '')) || '';
  check('有人起身，垫子自动给排队的人', /你坐在第 1 排第 1 张/.test(await users[2].page.textContent('[data-panel]')) && /轮到你了/.test(toastText), toastText.trim());
  await users[2].page.screenshot({ path: join(shots, 'verify-hall-queue.png'), animations: 'disabled' });
  await users[1].ctx.close();
  await users[0].page.waitForFunction(() => /此刻在大殿 2 人/.test((document.querySelector('[data-count]') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => {});
  check('有人离开，人数实时减少', /此刻在大殿 2 人/.test(await users[0].page.textContent('[data-count]')));
  await users[0].page.goto(base + q.replace('#/masjid/hall', '#/masjid'));
  // 离开大殿的那条连接断开要一点时间：等人数稳定下来，只读一次
  await users[0].page.waitForFunction(() => /此刻 1 人 · 垫子 1\/2/.test((document.querySelector('[data-count="hall"]') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  const entry = await users[0].page.textContent('[data-count="hall"]');
  // 没读到时把原因打出来（直接请求一次人数、看页面地址）
  const diag = /此刻/.test(entry)
    ? ''
    : await users[0].page.evaluate(async (port) => {
        let r = '';
        try {
          const x = await fetch(`http://127.0.0.1:${port}/counts`, { cache: 'no-store' });
          r = x.status + ' ' + (await x.text()).slice(0, 80);
        } catch (e) {
          r = 'ERR ' + e.message;
        }
        return `${location.href.split('?')[1]} | ${r}`;
      }, ps.port);
  check('入口页只读人数（看人数不算人头）', /此刻 1 人 · 垫子 1\/2/.test(entry), entry + (diag ? '  ' + diag : ''));
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
  // 先看一眼隐私政策页（不能把离线缓存里的应用首页顶掉）
  await page.goto(base.replace('index.html', 'privacy.html'));
  const policy = (await page.textContent('body')).includes('Сиёсати махфият');
  await ctx.setOffline(true);
  await page.goto(base + '?weather=clear');
  const time = await page.textContent('[data-hero] .hero-time').catch(() => '');
  check('隐私政策页能打开；看过它之后断网，打开应用仍是礼拜时间', policy && /\d\d:\d\d/.test(time || ''), time);
  const okPages = [];
  for (const h of ['#/ramadan', '#/masjid/hall', '#/pray/guide/fajr/fard', '#/qibla', '#/quran', '#/me']) {
    await page.goto(base + '?weather=clear' + h);
    await page.waitForTimeout(600);
    const txt = await page.textContent('#app');
    const stuck = await page.locator('#app > .page > .loading').count();
    if (txt && !stuck && txt.length > 50) okPages.push(h);
  }
  check('断网后斋月、大殿、跟做、朝向、古兰经目录、"我的"页都能打开', okPages.length === 6, okPages.join(' '));
  await ctx.close();
}

// 10. 基本操作：新功能都能用、能保存
{
  const ctx = await browser.newContext({ ...phone, fresh: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(base + '?weather=snow&now=2026-12-18T15:20');
  await page.waitForTimeout(800);
  // 第一次打开：三步引导（一整页，不弹窗；底部导航先藏起来）——语言和显示方式 → 城市 → 提醒，走完进首页，以后不再出现
  await page.waitForSelector('.ob-step');
  const s1 = (await page.textContent('.ob-step')).replace(/\s+/g, ' ');
  const langs = await page.locator('[data-ob-lang]').count();
  const tabHidden = await page.evaluate(() => getComputedStyle(document.querySelector('.tabbar')).display === 'none');
  await page.click('[data-ob-mode="young"]');
  await page.waitForSelector('.ob-step[data-ob-step="2"]');
  const s2 = (await page.textContent('.ob-step')).replace(/\s+/g, ' ');
  await page.click('[data-ob-city-ok]');
  await page.waitForSelector('.ob-step[data-ob-step="3"]');
  await page.click('[data-ob-finish]');
  await page.waitForSelector('[data-hero]');
  const tabBack = await page.evaluate(() => getComputedStyle(document.querySelector('.tabbar')).display !== 'none');
  await page.reload();
  await page.waitForTimeout(500);
  const popups = await page.locator('[role="dialog"], dialog[open], .celebrate, .cheer-sheet').count();
  check('第一次打开走三步引导：选语言（5 种）和"年轻人还是年纪大的人" → 确认城市 → 提醒，走完进首页；之后不再出现，不弹窗', langs === 5 && /年轻人/.test(s1) && /年纪大的人/.test(s1) && /杜尚别/.test(s2) && tabHidden && tabBack && (await page.locator('.ob-step, .mode-card, [data-city-ok]').count()) === 0 && (await page.locator('[data-hero]').count()) === 1 && popups === 0, `${s1.slice(0, 20)}… → ${s2.slice(0, 16)}…`);
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
  // 首页只放今天要用的：顶部日期和城市 → 下一番大卡片 → 今天要做的事（时间表、封斋、圣训）；其他入口在底部导航
  const homeClean = (await page.locator('.athome, .to-masjid, [data-share-app], .page.home .privacy, .page.home [data-streak], .page.home .scene-wrap').count()) === 0;
  const order = await page.evaluate(() => {
    const y = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect().top + window.scrollY : -1; };
    return [y('.home-top .date-g'), y('[data-hero] .hero-time'), y('.home-sec'), y('.list-card'), y('[data-ramadan] .fast-row'), y('.hadith-card')];
  });
  check('首页：日期城市 → 下一番（拜名、时间、倒计时）→ 今天要做的事：时间表、封斋、今日圣训（可分享），没有多余的卡片', homeClean && order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])) && (await page.locator('[data-share-hadith]').count()) === 1, order.map(Math.round).join(' < '));
  await page.goto(base + '?weather=snow&now=2026-12-18T15:20#/me');
  await page.waitForSelector('.me-hero');
  const me = (await page.textContent('#app')).replace(/\s+/g, ' ');
  const tabs = (await page.locator('.tabbar .tab').allTextContents()).map((x) => x.trim());
  check('底部六个标签：今天 · 礼拜 · 清真寺 · 古兰经 · 封斋 · 我的；"我的"里有坚持、亲友圈、时间表、城市、设置、分享', tabs.join('·') === '今天·礼拜·清真寺·古兰经·封斋·我的' && /亲友圈/.test(me) && /本月时间表/.test(me) && /提醒和设置/.test(me) && (await page.locator('[data-share-app]').count()) === 1, tabs.join(' · '));
  await page.goto(base + '?weather=snow&now=2026-12-18T15:20#/pray');
  await page.waitForSelector('.tools');
  const tools = await page.locator('.tools .tool').count();
  check('"礼拜"标签：跟着做 + 工具格（小净、朝向、赞念、补礼），依据折叠起来', tools === 4 && (await page.locator('.hub-main').count()) === 1 && (await page.locator('details.excuse-card:not([open])').count()) === 1, `${tools} 个工具`);
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
  const streakN = () => page.evaluate(() => String((JSON.parse(localStorage.getItem('masjid:streak') || '{}').cur) || 0));
  const before = await streakN();
  await page.click('[data-prayed="fajr"]');
  await page.waitForTimeout(400);
  const cele = await page.locator('.celebrate').count();
  const celeText = cele ? await page.textContent('.celebrate h2') : '';
  if (cele) await page.click('[data-cele-ok]');
  const after = await streakN();
  check('打卡：连续 6 天 → 点"已礼"变 7 天，解锁"一周"并庆祝', /6/.test(before) && /7/.test(after) && cele === 1 && /一周/.test(celeText), `${before.trim()} → ${after.trim()}，${celeText}`);
  await page.goto(base + '?weather=clear&now=2026-12-18T15:20#/streak');
  await page.waitForTimeout(500);
  const got = await page.locator('.title-item.is-got').count();
  check('"我的坚持"页：已解锁 2 个称号（起步、一周）', got === 2, `${got} 个`);
  const badges = await page.locator('.badge').count();
  const gotB = (await page.locator('.badge.is-got .badge-name').allTextContents()).join('、');
  check('"我的坚持"页：18 枚成就徽章，已得"第一步"（第一次记下已礼）', badges === 18 && /第一步/.test(gotB), `${badges} 枚，已得：${gotB}`);
  // 今天第一次打卡（没有新称号）：底部弹出"又坚持了一天"，数字跳到新的天数，几秒后自己收起
  await page.goto(base + '?weather=clear&now=2026-12-18T15:20');
  await page.evaluate(() => {
    localStorage.setItem('masjid:streak', JSON.stringify({ cur: 8, best: 8, last: '2026-12-17', grace: [], titles: [3, 7], prev: 0 }));
    localStorage.removeItem('masjid:prayed');
  });
  await page.reload();
  await page.waitForTimeout(500);
  await page.click('[data-prayed="fajr"]');
  await page.waitForSelector('.cheer-sheet', { timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(1300);
  const sheetN = (await page.textContent('[data-cheer-n]').catch(() => '')) || '';
  const sheetK = (await page.textContent('.cheer-k').catch(() => '')) || '';
  await page.screenshot({ path: join(shots, 'verify-streak-sheet.png'), animations: 'disabled' });
  await page.waitForTimeout(3000);
  const gone = (await page.locator('.cheer-sheet').count()) === 0;
  check('今天第一次打卡：弹出"又坚持了一天"，数字跳到 9，几秒后自己收起', sheetN === '9' && /又坚持了一天/.test(sheetK) && gone, `${sheetN}，${sheetK}，收起 ${gone}`);
  await page.goto(base + '?weather=clear&now=2026-12-18T15:20#/circle');
  await page.waitForTimeout(400);
  check('没有后台时，亲友圈说明"上线后可用"，不报错', /上线后可用/.test(await page.textContent('#app')));
  check('以上操作没有页面错误', errs.length === 0, errs.join('; '));
  await ctx.close();
}

// 11. 系统开了"减少动态效果"：庆祝时不放彩屑，只显示静态卡片
{
  const ctx = await browser.newContext({ ...phone, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(base + '?weather=clear&now=2026-12-18T15:20');
  await page.evaluate(() => {
    localStorage.setItem('masjid:settings', JSON.stringify({ city: 'dushanbe', cityConfirmed: true, lang: 'zh' }));
    localStorage.setItem('masjid:streak', JSON.stringify({ cur: 14, best: 14, last: '2026-12-17', grace: [], titles: [3, 7], prev: 0 }));
  });
  await page.reload();
  await page.waitForTimeout(500);
  await page.click('[data-prayed="fajr"]');
  await page.waitForSelector('.celebrate', { timeout: 2000 }).catch(() => {});
  const cele = await page.locator('.celebrate').count();
  const confetti = await page.locator('.confetti').count();
  const n = (await page.textContent('[data-cele-n]').catch(() => '')) || '';
  const badges = (await page.locator('.cele-badges li').allTextContents()).join('、');
  check('减少动态效果时：解锁"半个月"仍有庆祝卡片，但没有彩屑，数字直接显示 15；同时得到的徽章列在下面', cele === 1 && confetti === 0 && n === '15' && /第一步/.test(badges), `彩屑 ${confetti}，数字 ${n}，徽章：${badges}`);
  await ctx.close();
}

// 12. 设置：选计算方法（宵礼时间跟着变）；备份导出、换"新手机"导入、恢复后记录都在
{
  const ctx = await browser.newContext({ ...phone, acceptDownloads: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const q = '?weather=clear&now=2026-12-18T09:20';
  await page.goto(base + q);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('masjid:settings', JSON.stringify({ city: 'tashkent', cityConfirmed: true, lang: 'zh' }));
    localStorage.setItem('masjid:qada', JSON.stringify({ fajr: 4, dhuhr: 0, asr: 0, maghrib: 0, isha: 1, witr: 0 }));
    localStorage.setItem('masjid:qprog', JSON.stringify({ 1: 7 }));
  });
  await page.goto(base + q + '&r=1#/');
  await page.waitForSelector('.prow');
  const isha = async () => (await page.locator('.prow').filter({ hasText: '宵礼' }).locator('.prow-time').textContent()).trim();
  const before = await isha();
  await page.goto(base + q + '&r=2#/settings');
  await page.waitForSelector('[data-method]', { state: 'attached' });
  await page.click('[data-fold="method"] > summary'); // 计算方法收在可以展开的卡片里
  await page.click('[data-method="mwl"]');
  await page.goto(base + q + '&r=3#/');
  await page.waitForSelector('.prow');
  const after = await isha();
  await page.click('details.method summary');
  const how = await page.textContent('details.method');
  check('设置里选"穆斯林世界联盟 18°/17°"：宵礼提前几分钟，"怎么算的"写明 18° 和 17°', after < before && /18°/.test(how) && /17°/.test(how), `宵礼 ${before} → ${after}`);
  // 导出备份
  await page.goto(base + q + '&r=4#/settings');
  await page.waitForSelector('[data-backup-out]', { state: 'attached' });
  await page.click('[data-fold="backup"] > summary'); // 备份收在可以展开的卡片里
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-backup-out]')]);
  const file = await dl.path();
  // "新手机"：清空后导入
  await page.evaluate(() => localStorage.clear());
  await page.goto(base + q + '&r=5#/settings');
  await page.waitForSelector('[data-backup-in]', { state: 'attached' });
  await page.click('[data-fold="backup"] > summary');
  await page.setInputFiles('[data-backup-in]', file);
  await page.waitForSelector('[data-backup-confirm]:not([hidden])');
  const sum = await page.textContent('[data-backup-sum]');
  await page.click('[data-backup-yes]');
  await page.waitForTimeout(1500);
  await page.waitForSelector('.page');
  const restored = await page.evaluate(() => [JSON.parse(localStorage.getItem('masjid:qada') || '{}').fajr, JSON.parse(localStorage.getItem('masjid:settings') || '{}').method]);
  check('备份：导出文件，清空后导入，先说明备份里有什么，确认后补礼次数和设置都恢复', /补礼还剩 5 番/.test(sum) && /读过 7 节/.test(sum) && restored[0] === 4 && restored[1] === 'mwl', `${sum.trim()}；恢复后 ${restored.join(' ')}`);
  // 不是备份的文件
  await page.goto(base + q + '&r=6#/settings');
  await page.waitForSelector('[data-backup-in]', { state: 'attached' });
  await page.setInputFiles('[data-backup-in]', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await page.waitForTimeout(300);
  const bad = await page.textContent('[data-backup-msg]');
  check('选错文件时说明"不是本应用的备份"，什么也不改', /不是本应用的备份/.test(bad), bad);
  check('设置、备份以上操作没有页面错误', errs.length === 0, errs.join('; '));
  await ctx.close();
}

// 13. 早晚记念：早晨六条、古兰经三章能读、点按计数、刷新后还在、念完整组；首页早晨出现入口、念完收起；傍晚换成傍晚那组
{
  const ctx = await browser.newContext(phone);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const q = '?weather=clear&now=2026-12-18T08:30'; // 杜尚别，晨礼之后
  await page.goto(base + q);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('masjid:settings', JSON.stringify({ city: 'dushanbe', cityConfirmed: true, lang: 'zh' }));
  });
  await page.goto(base + q + '&r=1#/');
  await page.waitForSelector('.prow');
  const homeCard = await page.locator('.dk-link').count();
  await page.click('.dk-link');
  await page.waitForSelector('[data-dk]');
  const items = await page.locator('[data-dk]').count();
  const on = (await page.textContent('.adhkar .seg.is-on')).trim();
  await page.waitForSelector('[data-dk-surah="114"] .dk-ayah');
  const nas = await page.locator('[data-dk-surah="114"] .dk-ayah').count();
  const nasTr = (await page.locator('[data-dk-surah="114"] .dk-ayah .tr').first().textContent()).trim();
  // 第一条（求饶恕词，1 遍）点一下就打勾；"奉主名"（3 遍）点两下还没完
  await page.click('[data-dk="sayyid"] [data-tap]');
  await page.click('[data-dk="bism"] [data-tap]');
  await page.click('[data-dk="bism"] [data-tap]');
  const sayyidDone = await page.locator('[data-dk="sayyid"].is-done').count();
  const prog1 = (await page.textContent('.dk-prog-t')).trim();
  await page.goto(base + q + '&r=2#/adhkar/morning');
  await page.waitForSelector('[data-dk]');
  const kept = (await page.textContent('[data-dk="bism"] [data-n]')).trim();
  check('早晚记念：早晨首页出现入口；早晨 6 条，世人章 6 节带译音；1 遍的点一下打勾，3 遍的记到 2；刷新后还在', homeCard === 1 && items === 6 && on === '早晨' && nas === 6 && /rabbin-nas/.test(nasTr) && sayyidDone === 1 && /1 \/ 6/.test(prog1) && kept === '2', `入口 ${homeCard}，${items} 条，${on}，世人章 ${nas} 节「${nasTr}」，${prog1}，刷新后 ${kept}`);
  // 念完整组（100 遍的也点满）
  for (const id of ['quls', 'bism', 'radina', 'subhan', 'tahlil']) {
    const n = await page.evaluate((x) => { const c = document.querySelector(`[data-dk="${x}"]`); const [a, b] = c.querySelector('.dk-tap-n').textContent.split('/').map((v) => Number(v.trim())); return b - a; }, id);
    for (let i = 0; i < n; i++) await page.click(`[data-dk="${id}"] [data-tap]`);
  }
  const allShown = await page.locator('[data-all]:not([hidden])').count();
  const prog2 = (await page.textContent('.dk-prog-t')).trim();
  await page.goto(base + q + '&r=3#/');
  await page.waitForSelector('.prow');
  const homeAfter = await page.locator('.dk-link').count();
  check('念完六条：显示"早晨的记念都念完了"，进度 6/6；回到首页入口收起', allShown === 1 && /6 \/ 6/.test(prog2) && homeAfter === 0, `${prog2}，首页入口 ${homeAfter}`);
  // 傍晚（晡礼之后）：自动换成傍晚那组，有"完美言辞"那条，没有"一天一百遍"那条；礼拜页一直有入口
  const q2 = '?weather=clear&now=2026-12-18T16:30';
  await page.goto(base + q2 + '&r=4#/adhkar');
  await page.waitForSelector('[data-dk]');
  const eve = (await page.textContent('.adhkar .seg.is-on')).trim();
  const ids = await page.locator('[data-dk]').evaluateAll((xs) => xs.map((x) => x.dataset.dk));
  await page.goto(base + q2 + '&r=5#/pray');
  await page.waitForSelector('.hub');
  const hubCard = (await page.textContent('.dk-link').catch(() => '')) || '';
  check('傍晚打开是傍晚那组（有"完美言辞"，没有"一天一百遍"）；礼拜页一直有早晚记念入口', eve === '傍晚' && ids.includes('kalimat') && !ids.includes('tahlil') && /傍晚的记念/.test(hubCard), `${eve}：${ids.join(' ')}`);
  check('早晚记念以上操作没有页面错误', errs.length === 0, errs.join('; '));
  await ctx.close();
}

// 14. 中国大陆：中文手机、北京时间 → 默认北京；首页一键自动定位（喀什）→ 用"我的位置"、北京时间；
//     手机换了位置（到乌鲁木齐），下次打开悄悄更新，不弹窗
{
  const ctx = await browser.newContext({ ...phone, fresh: true, locale: 'zh-CN', timezoneId: 'Asia/Shanghai', geolocation: { latitude: 39.4704, longitude: 75.9898 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const q = '?weather=clear&now=2026-12-18T09:20';
  await page.goto(base + q);
  await page.evaluate(() => localStorage.clear());
  await page.goto(base + q + '&r=1#/');
  await page.waitForSelector('.ob-step');
  await page.click('[data-ob-mode="young"]');
  await page.waitForSelector('[data-ob-auto]');
  const guessed = (await page.textContent('.ob-sub b')).trim();
  const welcome = (await page.textContent('.ob-step')).replace(/\s+/g, ' ');
  await page.click('[data-ob-auto]');
  await page.waitForFunction(() => /"city":"here"/.test(localStorage.getItem('masjid:settings') || ''), null, { timeout: 8000 });
  await page.waitForSelector('[data-ob-finish]');
  await page.click('[data-ob-finish]');
  await page.waitForSelector('[data-hero]');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('masjid:settings')));
  const cityBtn = (await page.textContent('.city-btn')).trim();
  const dhuhr = (await page.locator('.prow').nth(2).locator('.prow-time').textContent()).trim();
  check('中国：中文手机、北京时间默认选北京；首页"自动定位"后用我的位置（喀什附近）、北京时间，晌礼在下午两点多，自动定位打开', /北京/.test(guessed) && /自动定位/.test(welcome) && st.city === 'here' && st.autoLoc === true && st.loc.utcOffset === 8 && /喀什/.test(cityBtn) && /^14:/.test(dhuhr), `猜的 ${guessed}；定位后 ${cityBtn}，晌礼 ${dhuhr}，时区 +${st.loc.utcOffset}`);
  // 人到了乌鲁木齐：重新打开应用，位置悄悄更新（不弹窗）
  await ctx.setGeolocation({ latitude: 43.8, longitude: 87.6 });
  await page.goto(base + q + '&r=2#/');
  await page.waitForFunction(() => /"lat":43\.8/.test(localStorage.getItem('masjid:settings') || ''), null, { timeout: 10000 }).catch(() => {});
  const st2 = await page.evaluate(() => JSON.parse(localStorage.getItem('masjid:settings')));
  await page.waitForTimeout(300);
  const cityBtn2 = (await page.textContent('.city-btn')).trim();
  check('开了自动定位：换了地方再打开，位置自己更新到乌鲁木齐附近', st2.loc.lat === 43.8 && /乌鲁木齐/.test(cityBtn2), `${st2.loc.lat}, ${st2.loc.lon}，${cityBtn2}`);
  // 城市列表里有中国，中文界面排在前面
  await page.goto(base + q + '&r=3#/city');
  await page.waitForSelector('[data-group]');
  const firstGroup = (await page.locator('[data-group] .card-title').first().textContent()).trim();
  const cn = await page.locator('[data-pick="lanzhou"], [data-pick="linxia"], [data-pick="xining"], [data-pick="yinchuan"]').count();
  check('城市列表有中国（兰州、临夏、西宁、银川等），中文界面中国排第一组', /中国/.test(firstGroup) && cn === 4, firstGroup);
  check('中国、自动定位以上操作没有页面错误', errs.length === 0, errs.join('; '));
  await ctx.close();
}

// 15. 首页改版：两种显示方式、到点前 10 分钟的温和话、节日问候、倒计时滚动、顶栏不透明、动画只动 transform/opacity
{
  const ctx = await browser.newContext({ ...phone, timezoneId: 'Asia/Dushanbe' });
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('masjid:settings')) localStorage.setItem('masjid:settings', JSON.stringify({ city: 'dushanbe', cityConfirmed: true, modeAsked: true, lang: 'zh' }));
  });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  const noScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  // 年轻人：到点前 10 分钟，主卡片上一句温和的话；倒计时数字一位一位滚动
  await page.goto(base + '?weather=clear&now=2026-12-17T12:15');
  await page.waitForSelector('[data-hero] .hero-time');
  await page.waitForTimeout(2600);
  const soon = (await page.textContent('[data-soon]')).trim();
  const digits = await page.locator('.count .dg').count();
  const rolled = await page.evaluate(() => new Promise((res) => {
    const seen = () => !!document.querySelector('.count .dg.is-roll');
    if (seen()) return res(true);
    const mo = new MutationObserver(() => seen() && (mo.disconnect(), res(true)));
    mo.observe(document.querySelector('.count'), { childList: true, subtree: true });
    setTimeout(() => res(seen()), 2500);
  }));
  check('到点前 10 分钟：主卡片上说"晌礼还有 N 分钟，先把手头的事收个尾"', /晌礼还有 \d+ 分钟/.test(soon) && /收个尾/.test(soon), soon);
  check('倒计时数字一位一位放，变了的那一位滚过去', digits >= 2 && rolled, `${digits} 位数字，滚动 ${rolled}`);
  // 顶栏：不透明的实色
  const bar = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector('.topbar'));
    return { bg: cs.backgroundColor, bf: cs.backdropFilter || cs.webkitBackdropFilter || 'none' };
  });
  check('顶栏是不透明的实色（没有半透明、毛玻璃）', /^rgb\(/.test(bar.bg) && (bar.bf === 'none' || !bar.bf), `${bar.bg} ${bar.bf}`);
  // 动画：所有关键帧都不动会引起重排的属性；换页约 200 毫秒
  const anim = await page.evaluate(() => {
    const bad = [];
    const layout = /^(left|right|top|bottom|width|height|margin|padding|font-size|inset)/;
    for (const sh of document.styleSheets) {
      let rules = [];
      try { rules = sh.cssRules; } catch (e) { continue; }
      for (const r of rules) if (r.type === CSSRule.KEYFRAMES_RULE) for (const k of r.cssRules) for (let i = 0; i < k.style.length; i++) if (layout.test(k.style[i])) bad.push(r.name + ':' + k.style[i]);
    }
    const el = document.createElement('div');
    el.className = 'enter-i';
    document.getElementById('app').classList.add('is-enter');
    document.getElementById('app').appendChild(el);
    const d = getComputedStyle(el).animationDuration;
    el.remove();
    return { bad: [...new Set(bad)], d };
  });
  check('动画只用 transform / opacity（没有引起重排的动画），换页约 200 毫秒', anim.bad.length === 0 && parseFloat(anim.d) <= 0.25, anim.bad.join(', ') || anim.d);
  // 节日：开斋节、斋月换问候语和颜色，平常日子没有
  await page.goto(base + '?weather=clear&now=2027-03-09T10:00');
  await page.waitForSelector('[data-hero]');
  const fitr = { cls: await page.getAttribute('[data-hero]', 'class'), t: (await page.textContent('.hero-greet').catch(() => '')).trim() };
  await page.goto(base + '?weather=clear&now=2027-02-20T05:20&r=1');
  await page.waitForSelector('[data-hero]');
  const ram = { cls: await page.getAttribute('[data-hero]', 'class'), t: (await page.textContent('.hero-greet').catch(() => '')).trim() };
  await page.goto(base + '?weather=clear&now=2026-12-17T10:00&r=2');
  await page.waitForSelector('[data-hero]');
  const plain = await page.locator('.hero-greet').count();
  check('节日首页不一样：开斋节金色"开斋节吉庆"、斋月夜蓝"斋月吉庆"，平常日子没有问候', /fest-gold/.test(fitr.cls) && /开斋节/.test(fitr.t) && /fest-night/.test(ram.cls) && /斋月/.test(ram.t) && plain === 0, `${fitr.t} / ${ram.t}`);
  check('年轻人首页：手机上没有横向滚动', await noScroll());
  // 年纪大的人：大字极简，首页只有时间和下一番
  await page.click('[data-share-img]').catch(() => {});
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('masjid:settings'));
    localStorage.setItem('masjid:settings', JSON.stringify({ ...st, mode: 'elder' }));
  });
  await page.goto(base + '?weather=snow&now=2026-12-17T12:15&r=3');
  await page.waitForSelector('[data-hero] .hero-time');
  await page.waitForTimeout(400);
  const elder = await page.evaluate(() => ({
    root: parseFloat(getComputedStyle(document.documentElement).fontSize),
    mode: document.documentElement.dataset.mode,
    cards: [...document.querySelectorAll('.page.home > .card, .page.home > div > .card, .page.home > a.card')].map((c) => c.className.split(' ').filter((x) => !['card', 'card-link', 'enter-i'].includes(x)).join('.')),
    extra: document.querySelectorAll('.page.home .hadith-card, .page.home .dk-link, .page.home .fast-row, .page.home [data-prayed], .page.home .weather-card, .page.home .hero-band').length,
    time: parseFloat(getComputedStyle(document.querySelector('.hero-time')).fontSize),
    wx: (document.querySelector('.hero-wx') || {}).textContent || '',
  }));
  check('年纪大的人：大字（正文 20 像素起），首页只有下一番和时间表；天气只在主卡片里说一句', elder.mode === 'elder' && elder.root >= 20 && elder.time >= 70 && elder.extra === 0 && elder.cards.length === 2 && /雪/.test(elder.wx), `正文 ${elder.root}px，大数字 ${elder.time}px，卡片：${elder.cards.join('、')}`);
  check('年纪大的人首页：手机上没有横向滚动', await noScroll());
  // 设置里随时改回来
  await page.goto(base + '?weather=clear&now=2026-12-17T12:15#/settings');
  await page.waitForSelector('.mode-list [data-set-mode="young"]');
  await page.click('.mode-list [data-set-mode="young"]');
  await page.goto(base + '?weather=clear&now=2026-12-17T12:15&r=4#/');
  await page.waitForSelector('[data-hero] .hero-band');
  check('设置里可以改回"年轻人"', (await page.evaluate(() => document.documentElement.dataset.mode)) === 'young' && (await page.locator('.hadith-card').count()) === 1);
  check('首页改版以上操作没有页面错误', errs.length === 0, errs.join('; '));
  await ctx.close();
}

// 16. 第一批 bug：古兰经首次打开误报"没有网络"、默认语言塔吉克语
{
  // 手机语言不是五种之一（英语、法语）：默认塔吉克语，启动画面、界面都是塔吉克语
  const ctx = await browser.newContext({ ...phone, fresh: true, locale: 'en-US' });
  const page = await ctx.newPage();
  await page.goto(base + '?weather=clear&now=2026-12-17T11:40');
  await page.waitForSelector('.ob-step');
  const st = await page.evaluate(() => ({ lang: document.documentElement.lang, w: window.__lang, set: JSON.parse(localStorage.getItem('masjid:settings') || '{}').lang }));
  const tabs = (await page.textContent('.tabbar')).replace(/\s+/g, ' ');
  const ob = (await page.textContent('.ob-title')).trim();
  check('手机语言是英语时默认塔吉克语（启动画面、引导、界面、设置）', st.w === 'tg' && /^tg/.test(st.lang) && /Имрӯз/.test(tabs) && /Хуш омадед/.test(ob) && (st.set === undefined || st.set === 'tg'), `${st.lang}，${ob}`);
  await ctx.close();
}
{
  // 网站刚更新、旧页面要的文件已经没了（这里让古兰经页面的文件第一次 404）：有网就自动刷新一次，刷新后正常显示，不说"没有网络"
  const ctx = await browser.newContext(phone);
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('masjid:settings')) localStorage.setItem('masjid:settings', JSON.stringify({ city: 'dushanbe', cityConfirmed: true, modeAsked: true, lang: 'zh' }));
  });
  const page = await ctx.newPage();
  let failOnce = true;
  const PAGE_CHUNK = /\/assets\/quran-(?!files)[\w-]+\.js$/; // 古兰经页面的文件
  await page.route(PAGE_CHUNK, (route) => {
    if (failOnce) {
      failOnce = false;
      return route.fulfill({ status: 404, body: '' });
    }
    return route.continue();
  });
  await page.goto(base + '?weather=clear&now=2026-12-17T11:40#/quran/1');
  await page.waitForSelector('.ayah', { timeout: 15000 }).catch(() => {});
  const ayahs = await page.locator('.ayah').count();
  const txt = (await page.textContent('#app')).replace(/\s+/g, ' ');
  check('古兰经：文件第一次没下载下来（网站刚更新）时自动刷新一次，经文照常出来，不说"没有网络"', !failOnce && ayahs === 7 && !/没有网络/.test(txt), `第一章 ${ayahs} 节`);
  await ctx.close();
}
{
  // 一直下载不下来（网络不稳）：说"没下载下来"并给"再试一次"，不说"没有网络"（关掉离线缓存，免得缓存先把文件给了）
  const ctx = await browser.newContext({ ...phone, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    localStorage.setItem('masjid:settings', JSON.stringify({ city: 'dushanbe', cityConfirmed: true, modeAsked: true, lang: 'zh' }));
    sessionStorage.setItem('masjid:reloaded', String(Date.now())); // 刚自动刷新过：这次不再刷新，直接说明
  });
  const page = await ctx.newPage();
  await page.route(/\/assets\/(ar|zh)-\d-[\w-]+\.js$/, (route) => route.fulfill({ status: 404, body: '' })); // 经文数据一直下载不下来
  await page.goto(base + '?weather=clear&now=2026-12-17T11:40#/quran/2');
  await page.waitForSelector('.load-failed', { timeout: 15000 }).catch(() => {});
  const msg = ((await page.textContent('.load-failed').catch(() => '')) || '').trim();
  const retry = await page.locator('[data-retry]').count();
  check('古兰经：有网但一直没下载下来时说"没下载下来"、给"再试一次"，不说"没有网络"', /没下载下来/.test(msg) && !/没有网络/.test(msg) && retry === 1, msg.slice(0, 20));
  await ctx.close();
}
{
  // 真的断网：才说"没有网络"（先联网打开过一次，离线缓存里有应用本身，但没有第 114 章的经文）
  const ctx = await browser.newContext(phone);
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('masjid:settings')) localStorage.setItem('masjid:settings', JSON.stringify({ city: 'dushanbe', cityConfirmed: true, modeAsked: true, lang: 'zh' }));
  });
  const page = await ctx.newPage();
  await page.goto(base + '?weather=clear&now=2026-12-17T11:40#/quran/1');
  await page.waitForSelector('.ayah', { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 10000 }).catch(() => {});
  await page.reload();
  await page.waitForSelector('.ayah', { timeout: 15000 }).catch(() => {});
  await ctx.setOffline(true);
  await page.evaluate(() => (location.hash = '#/quran/114'));
  await page.waitForSelector('.load-failed', { timeout: 15000 }).catch(() => {});
  const off = ((await page.textContent('.load-failed').catch(() => '')) || '').trim();
  check('古兰经：真的断网时才说"没有网络"', /没有网络/.test(off), off.slice(0, 20));
  await ctx.close();
}

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} 项未通过` : `\n全部 ${results.length} 项通过`);
process.exit(failed ? 1 : 0);
