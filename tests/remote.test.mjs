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
  assert.equal(featureOf('ramadan/quran'), 'quran');
  assert.equal(featureOf('masjid/hall'), 'hall');
  assert.equal(featureOf('qibla'), 'qibla');
  assert.equal(featureOf('nonsense'), null);
  for (const f of ['home', 'pray', 'guide', 'qibla', 'hall']) assert.ok(FEATURES.includes(f));
});

test('统计：手机发出的内容只有约定的几项，"我的位置"只报最近的城市', async () => {
  const sent = [];
  globalThis.location = { hostname: '127.0.0.1', search: '?api=http://127.0.0.1:8787' };
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent.push({ url, init });
    return { ok: true };
  };
  try {
    const { sendDaily, setStatsGate } = await import('../src/core/stats.js');
    setStatsGate(() => false);
    assert.equal(await sendDaily(getCity('dushanbe'), 'zh', '2026-11-24'), false, '关掉统计后不发');
    assert.equal(sent.length, 0);
    setStatsGate(() => true);
    await sendDaily(getCity('here', { lat: 55.81, lon: 37.62, utcOffset: 3 }), 'ru', '2026-11-24');
    assert.equal(sent.length, 1);
    const body = JSON.parse(sent[0].init.body);
    assert.deepEqual(Object.keys(body).sort(), ['c', 'l', 'p', 'v']);
    assert.equal(body.c, 'moscow');
    assert.ok(!/55\.81|37\.62/.test(sent[0].init.body), '统计里出现了位置');
    assert.equal(sent[0].init.credentials, 'omit');
    assert.ok(parseHit(body, IDS, '2026-11-24'));
  } finally {
    globalThis.fetch = origFetch;
    delete globalThis.location;
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
  assert.ok(!/<script(?![^>]*\ssrc=)[^>]*>/.test(html), '页面里不能有行内脚本');
  assert.match(html, /name="referrer" content="no-referrer"/);
});

test('安全：发布时间统一格式，旧配置判断可靠', () => {
  const a = sanitizeConfig({ v: 1, issued: '2026-11-24' }, IDS);
  assert.equal(a.issued, '2026-11-24T00:00:00.000Z');
});
