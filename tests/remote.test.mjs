// 远程配置、匿名统计：手机端逻辑
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeConfig, verifyEnvelope, signBody, generateKeys, cmpVersion } from '../shared/remote-config.js';
import { featureOf, parseHit, FEATURES } from '../shared/stats.js';
import { effectiveOffsets, effectiveHijri, activeNotices, updateLink, flagOn } from '../src/core/remote.js';
import { CITY_DATA } from '../src/content/cities-data.js';
import { getCity } from '../src/core/cities.js';

const IDS = CITY_DATA.map((c) => c.id);
const base = { v: 1, issued: '2026-11-24T00:00:00Z' };

test('配置清洗：格式不对整体丢弃', () => {
  assert.equal(sanitizeConfig(null, IDS), null);
  assert.equal(sanitizeConfig({ v: 2, issued: base.issued }, IDS), null);
  assert.equal(sanitizeConfig({ v: 1, issued: 'yesterday' }, IDS), null);
  assert.ok(sanitizeConfig(base, IDS));
});

test('配置清洗：公告只留纯文字，去掉控制字符和双向文字控制符，只看前 3 条', () => {
  const c = sanitizeConfig(
    {
      ...base,
      notices: [
        { id: 'a', text: { zh: '你好‮<script>', ru: '' } },
        { id: 'bad id!', text: { zh: 'x' } },
        { id: 'd', text: { tg: 'Салом' }, level: 'warn', from: '2026-11-01', until: 'never' },
        { id: 'c', text: {} }, // 第 4 条起不看
        { id: 'e', text: { zh: '4' } },
        { id: 'f', text: { zh: '5' } },
      ],
    },
    IDS,
  );
  assert.deepEqual(
    c.notices.map((n) => n.id),
    ['a', 'd'],
  );
  assert.equal(c.notices[0].text.zh, '你好<script>'); // 尖括号留着，显示时会转成纯文字
  assert.equal(c.notices[0].text.ru, undefined);
  assert.equal(c.notices[1].level, 'warn');
  assert.equal(c.notices[1].until, null);
});

test('配置清洗：官方时间校正必须写来源、不超过 ±30 分钟、只认列表里的城市', () => {
  const c = sanitizeConfig(
    {
      ...base,
      cityOffsets: {
        dushanbe: { dhuhr: 10, src: { zh: '乌莱玛委员会日历' } },
        khujand: { dhuhr: 10 }, // 没写来源
        kazan: { dhuhr: 45, src: { zh: 'x' } }, // 超范围
        kulob: { dhuhr: 2.5, src: { zh: 'x' } }, // 不是整数
        paris: { dhuhr: 1, src: { zh: 'x' } },
      },
    },
    IDS,
  );
  assert.deepEqual(Object.keys(c.cityOffsets), ['dushanbe']);
  assert.deepEqual(c.cityOffsets.dushanbe, { fajr: 0, dhuhr: 10, asr: 0, maghrib: 0, isha: 0, src: { zh: '乌莱玛委员会日历' } });
});

test('配置清洗：商店链接只允许官方商店；版本号格式', () => {
  const c = sanitizeConfig(
    { ...base, minVersion: '1.2', store: { android: 'https://play.google.com/store/apps/details?id=a', ios: 'http://apps.apple.com/x' }, flags: { masjid: false, evil: false, weather: 'no' } },
    IDS,
  );
  assert.equal(c.minVersion, '1.2');
  assert.ok(c.store.android);
  assert.equal(c.store.ios, undefined); // 不是 https
  assert.deepEqual(c.flags, { masjid: false });
  assert.equal(sanitizeConfig({ ...base, minVersion: '1.2.3.4' }, IDS).minVersion, null);
  assert.equal(sanitizeConfig({ ...base, store: { ios: 'https://user:pw@apps.apple.com/x' } }, IDS).store.ios, undefined);
});

test('签名：对的公钥验得过；改一个字、换一把钥匙都验不过', async () => {
  const k = await generateKeys();
  const k2 = await generateKeys();
  const env = await signBody(JSON.stringify(base), k.privateJwk);
  assert.deepEqual(await verifyEnvelope(env, k.publicJwk), base);
  assert.equal(await verifyEnvelope({ ...env, body: env.body.replace('24', '25') }, k.publicJwk), null);
  assert.equal(await verifyEnvelope(env, k2.publicJwk), null);
  assert.equal(await verifyEnvelope({ body: 'x', sig: '!!!' }, k.publicJwk), null);
  assert.equal(await verifyEnvelope(env, { kty: 'RSA' }), null);
  assert.equal(k.publicJwk.d, undefined, '公钥里不能带私钥部分');
});

test('官方校正叠加用户微调；"我的位置"不套用城市的官方时间', () => {
  const remote = sanitizeConfig({ ...base, cityOffsets: { dushanbe: { dhuhr: 10, src: { zh: 's' } } } }, IDS);
  const a = effectiveOffsets({ dhuhr: 3, fajr: -2 }, remote, getCity('dushanbe'));
  assert.equal(a.offsets.dhuhr, 13);
  assert.equal(a.offsets.fajr, -2);
  assert.deepEqual(a.official, { zh: 's' });
  const b = effectiveOffsets({ dhuhr: 3 }, remote, getCity('here', { lat: 38.56, lon: 68.78, utcOffset: 5 }));
  assert.equal(b.offsets.dhuhr, 3);
  assert.equal(b.official, null);
  assert.equal(effectiveOffsets({}, sanitizeConfig(base, IDS), getCity('moscow')).offsets.dhuhr, 0);
});

test('伊斯兰历：自动时跟随当地宣布；用户手动调过以用户为准', () => {
  const remote = sanitizeConfig({ ...base, hijri: { TJ: { adjust: 1, src: { zh: 's' } } } }, IDS);
  assert.equal(effectiveHijri({ hijriManual: false, hijriAdjust: 0 }, remote, getCity('dushanbe')).adjust, 1);
  assert.equal(effectiveHijri({ hijriManual: false, hijriAdjust: 0 }, remote, getCity('moscow')).adjust, 0);
  assert.equal(effectiveHijri({ hijriManual: true, hijriAdjust: -1 }, remote, getCity('dushanbe')).adjust, -1);
});

test('公告按日期显示；提示更新只对旧版本的手机应用', () => {
  const remote = sanitizeConfig(
    {
      ...base,
      notices: [
        { id: 'a', text: { zh: 'a' }, from: '2026-11-20', until: '2026-11-30' },
        { id: 'b', text: { zh: 'b' }, until: '2026-11-01' },
      ],
      minVersion: '99.0.0',
      store: { android: 'https://play.google.com/store/apps/details?id=a' },
    },
    IDS,
  );
  assert.deepEqual(
    activeNotices(remote, '2026-11-24').map((n) => n.id),
    ['a'],
  );
  assert.deepEqual(activeNotices(remote, '2026-12-01'), []);
  assert.ok(updateLink(remote, 'android'));
  assert.equal(updateLink(remote, 'web'), null);
  assert.equal(updateLink(remote, 'ios'), null); // 没给苹果链接就不提示
  assert.equal(cmpVersion('1.10.0', '1.9'), 1);
  assert.equal(cmpVersion('1.0', '1.0.0'), 0);
  assert.equal(flagOn(remote, 'masjid'), true);
  assert.equal(flagOn(sanitizeConfig({ ...base, flags: { masjid: false } }, IDS), 'masjid'), false);
});

test('统计：地址对应功能名', () => {
  assert.equal(featureOf(''), 'home');
  assert.equal(featureOf('pray/guide/fajr/fard'), 'guide');
  assert.equal(featureOf('pray/guide/tarawih'), 'tarawih');
  assert.equal(featureOf('ramadan/quran'), 'qplan');
  assert.equal(featureOf('quran/plan'), 'qplan');
  assert.equal(featureOf('quran/36/12'), 'quran');
  assert.equal(featureOf('pray/qada'), 'qada');
  assert.equal(featureOf('masjid/hall'), 'hall');
  assert.equal(featureOf('qibla'), 'qibla');
  assert.equal(featureOf('nonsense'), null);
  for (const f of ['home', 'pray', 'guide', 'qibla', 'hall']) assert.ok(FEATURES.includes(f));
});

test('统计：没网时先存在手机里，有网时按顺序补传；内容只有约定的几项，没有位置', async () => {
  const mem = new Map();
  globalThis.window = { localStorage: { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) } };
  globalThis.location = { hostname: '127.0.0.1', search: '?api=http://127.0.0.1:8787&ref=share' };
  const sent = [];
  let online = false;
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (!online) throw new Error('offline');
    sent.push({ url, init, body: JSON.parse(init.body) });
    return { ok: true, status: 204 };
  };
  try {
    const { recordDay, flushStats, setStatsGate, markFeature, markGuideDone } = await import('../src/core/stats.js');
    const { togglePrayed } = await import('../src/core/prayed.js');
    const here = getCity('here', { lat: 55.81, lon: 37.62, utcOffset: 3 });
    setStatsGate(() => false);
    recordDay({ city: here, lang: 'ru', todayKey: '2026-11-24', fontScale: 2, notifyOn: true });
    assert.equal(mem.has('masjid:statq') ? JSON.parse(mem.get('masjid:statq')).length : 0, 0, '关掉统计后不记');
    setStatsGate(() => true);
    // 第一天：没网
    recordDay({ city: here, lang: 'ru', todayKey: '2026-11-24', fontScale: 2, notifyOn: true });
    markFeature('qibla', '2026-11-24');
    markGuideDone('2026-11-24');
    togglePrayed('2026-11-24', 'fajr', true);
    togglePrayed('2026-11-24', 'isha', true);
    await flushStats();
    assert.equal(sent.length, 0);
    assert.equal(JSON.parse(mem.get('masjid:statq')).length, 1, '没网时留在队列里');
    // 第二天：有网了，两天的一起补传
    online = true;
    recordDay({ city: here, lang: 'ru', todayKey: '2026-11-25', fontScale: 2, notifyOn: false });
    await flushStats();
    assert.equal(sent.length, 2);
    assert.equal(JSON.parse(mem.get('masjid:statq')).length, 0);
    const [d1, d2] = sent.map((x) => x.body);
    const ALLOWED = ['d', 'v', 'p', 'l', 'c', 'iw', 'ad', 'fs', 'ntf', 'nw', 'src', 'fd', 'f', 'pk', 'gd'];
    for (const b of [d1, d2]) assert.ok(Object.keys(b).every((k) => ALLOWED.includes(k)), JSON.stringify(b));
    assert.equal(d1.d, '2026-11-24');
    assert.equal(d1.nw, 1);
    assert.equal(d1.src, 'share');
    assert.equal(d1.iw, '2026-11-23'); // 那一周的周一
    assert.equal(d1.c, 'moscow');
    assert.equal(d2.d, '2026-11-25');
    assert.equal(d2.nw, undefined, '只有第一天算新用户');
    assert.equal(d2.fd, '2026-11-24');
    assert.deepEqual(d2.f, ['qibla']);
    assert.equal(d2.pk, 2);
    assert.equal(d2.gd, 1);
    assert.equal(d2.ad, 2);
    assert.equal(d2.ntf, 0);
    const raw = sent.map((x) => x.init.body).join('');
    assert.ok(!/55\.81|37\.62/.test(raw), '统计里出现了位置');
    assert.equal(sent[0].init.credentials, 'omit');
    for (const b of [d1, d2]) assert.ok(parseHit(b, IDS, '2026-11-25'));
    // 同一天再打开不重复记
    recordDay({ city: here, lang: 'ru', todayKey: '2026-11-25', fontScale: 2, notifyOn: false });
    await flushStats();
    assert.equal(sent.length, 2);
  } finally {
    globalThis.fetch = origFetch;
    delete globalThis.location;
    delete globalThis.window;
  }
});

test('管理后台打包文件是最新的（改了后台页面要运行 npm run admin）', async () => {
  const { readFileSync } = await import('node:fs');
  const { OUTPUT } = await import('../scripts/build-admin.mjs');
  assert.equal(readFileSync(new URL('../server/admin-assets.js', import.meta.url), 'utf8'), OUTPUT);
});

test('安全：演示参数（拨时钟、演示天气、本机后台）在正式网站上不生效', async () => {
  const { devParam } = await import('../src/core/dev.js');
  globalThis.location = { hostname: 'example.github.io', search: '?now=2026-01-01T00:00&weather=heavy&api=http://127.0.0.1:1' };
  try {
    assert.equal(devParam('now'), null);
    assert.equal(devParam('weather'), null);
    globalThis.location = { hostname: '127.0.0.1', search: '?now=2026-01-01T00:00' };
    assert.equal(devParam('now'), '2026-01-01T00:00');
  } finally {
    delete globalThis.location;
  }
});

test('安全：网页有内容安全策略，只运行自己的脚本，不连陌生网站', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const f = new URL('../dist/index.html', import.meta.url);
  if (!existsSync(f)) return; // 还没构建
  const html = readFileSync(f, 'utf8');
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /connect-src 'self' https:\/\/api\.open-meteo\.com/);
  assert.ok(!/connect-src[^;]*\s(https:|wss:|\*)(\s|;|$)/.test(csp), '不能允许连接任意网站');
  // 行内脚本只允许老浏览器兼容层那几段，而且必须按内容摘要写进安全策略
  const { createHash } = await import('node:crypto');
  for (const m of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
    const h = createHash('sha256').update(m[1]).digest('base64');
    assert.ok(csp.includes(`'sha256-${h}'`), '有行内脚本没有列在安全策略里：' + m[1].slice(0, 60));
  }
  assert.match(html, /name="referrer" content="no-referrer"/);
});

test('安全：发布时间统一格式，旧配置判断可靠', () => {
  const a = sanitizeConfig({ v: 1, issued: '2026-11-24' }, IDS);
  assert.equal(a.issued, '2026-11-24T00:00:00.000Z');
});

test('每个页面都有统计用的功能名，管理后台都有中文名', async () => {
  const { readFileSync } = await import('node:fs');
  // 路由表里的每一种地址（src/router.js 开头的注释列出了全部页面）
  const router = readFileSync(new URL('../src/router.js', import.meta.url), 'utf8');
  const paths = [...router.matchAll(/^\/\/\s+#\/(\S*)/gm)].map((m) => m[1].replace(/\[.*$/, '').replace(/\/章.*$/, '/1'));
  assert.ok(paths.length >= 20, '路由注释 ' + paths.length);
  const missing = paths.filter((p) => !featureOf(p));
  assert.deepEqual(missing, [], '这些页面没有功能名');
  const admin = readFileSync(new URL('../server/admin/app.js', import.meta.url), 'utf8');
  const block = admin.slice(admin.indexOf('  f: {'), admin.indexOf('},', admin.indexOf('  f: {')));
  const noLabel = FEATURES.filter((f) => !new RegExp('\\b' + f + ':').test(block));
  assert.deepEqual(noLabel, [], '管理后台缺中文名');
});
