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
          window.DeviceOrientationEvent.requestPermission = () => Promise.resolve(perm);
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
  const title = (await page.textContent('.r-status h1')).trim();
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
  await page.waitForSelector('.r-status h1');
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
  await users[2].page.screenshot({ path: join(shots, 'verify-hall-queue.png'), animations: 'disabled' });
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
  // 首页只放今天要用的：不再有"在家礼拜""进清真寺""分享应用"大卡片和隐私长文（移到"礼拜""我的"）
  const homeClean = (await page.locator('.athome, .to-masjid, [data-share-app], .page.home .privacy').count()) === 0;
  const order = await page.evaluate(() => {
    const y = (sel) => { const e = document.querySelector(sel); return e ? e.getBoundingClientRect().top + window.scrollY : -1; };
    return [y('[data-hero]'), y('.list-card'), y('[data-streak]'), y('.hadith-card')];
  });
  check('首页精简：下一番 → 五番拜打勾 → 打卡 → 今日圣训（可分享），没有多余的大卡片', homeClean && order.every((v, i) => v > 0 && (i === 0 || v > order[i - 1])) && (await page.locator('[data-share-hadith]').count()) === 1, order.map(Math.round).join(' < '));
  await page.goto(base + '?weather=snow&now=2026-12-18T15:20#/me');
  await page.waitForSelector('.me-hero');
  const me = (await page.textContent('#app')).replace(/\s+/g, ' ');
  const tabs = (await page.locator('.tabbar .tab').allTextContents()).map((x) => x.trim());
  check('底部五个标签：今天 · 礼拜 · 古兰经 · 封斋 · 我的；"我的"里有坚持、亲友圈、时间表、城市、设置、分享', tabs.join('·') === '今天·礼拜·古兰经·封斋·我的' && /亲友圈/.test(me) && /本月时间表/.test(me) && /提醒和设置/.test(me) && (await page.locator('[data-share-app]').count()) === 1, tabs.join(' · '));
  await page.goto(base + '?weather=snow&now=2026-12-18T15:20#/pray');
  await page.waitForSelector('.tools');
  const tools = await page.locator('.tools .tool').count();
  check('"礼拜"标签：跟着做 + 工具格（小净、朝向、赞念、补礼、一起礼拜），依据折叠起来', tools === 5 && (await page.locator('.hub-main').count()) === 1 && (await page.locator('details.excuse-card:not([open])').count()) === 1, `${tools} 个工具`);
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

await browser.close();
server.close();
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} 项未通过` : `\n全部 ${results.length} 项通过`);
process.exit(failed ? 1 : 0);
