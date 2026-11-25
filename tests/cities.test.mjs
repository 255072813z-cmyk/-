// 全部城市 × 全年：数据有没有异常
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITY_DATA } from '../src/content/cities-data.js';
import { getCity, nearestCity } from '../src/core/cities.js';
import { timesFor, highLatitudeDay } from '../src/core/prayer-times.js';
import { fastTimes } from '../src/core/ramadan.js';
import { qiblaBearing } from '../src/core/qibla.js';
import { addDays, fmtHM, setDisplayOffset } from '../src/core/clock.js';

const ORDER = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];

test('51 个城市：塔吉克斯坦 12 个、乌兹别克斯坦 13 个、吉尔吉斯斯坦 10 个、俄罗斯 16 个，编号不重复', () => {
  assert.equal(CITY_DATA.length, 51);
  assert.equal(new Set(CITY_DATA.map((c) => c.id)).size, 51);
  const n = (cc) => CITY_DATA.filter((c) => c.cc === cc).length;
  assert.deepEqual([n('TJ'), n('UZ'), n('KG'), n('RU')], [12, 13, 10, 16]);
  for (const c of CITY_DATA) {
    assert.ok(Number.isFinite(c.lat) && Number.isFinite(c.lon) && Number.isFinite(c.utcOffset) && Number.isFinite(c.declination), c.id);
    // 塔吉克斯坦、乌兹别克斯坦 UTC+5，吉尔吉斯斯坦 UTC+6（都没有夏令时）
    if (c.cc === 'TJ' || c.cc === 'UZ') assert.equal(c.utcOffset, 5, c.id);
    if (c.cc === 'KG') assert.equal(c.utcOffset, 6, c.id);
  }
});

test('全部城市全年每一天：时间有值、先后顺序正确、间隔合理', () => {
  const problems = [];
  let highLat = 0;
  for (const c of CITY_DATA) {
    let d = { y: 2026, m: 12, d: 1 };
    for (let i = 0; i < 366; i++, d = addDays(d, 1)) {
      const t = timesFor(c, d);
      const v = ORDER.map((k) => t[k].getTime());
      if (v.some((x) => !Number.isFinite(x))) problems.push(`${c.id} ${d.y}-${d.m}-${d.d} 有空值`);
      for (let k = 1; k < v.length; k++) if (!(v[k] > v[k - 1])) problems.push(`${c.id} ${d.y}-${d.m}-${d.d} ${ORDER[k - 1]}≥${ORDER[k]}`);
      // 晌礼在当地 10:30–14:30 之间（时区与经度匹配）
      const noon = +fmtHM(new Date(t.dhuhr.getTime() + c.utcOffset * 36e5 - 0)).slice(0, 2);
      const dh = new Date(t.dhuhr.getTime() + c.utcOffset * 36e5);
      const hh = dh.getUTCHours() + dh.getUTCMinutes() / 60;
      if (hh < 10.5 || hh > 14.5) problems.push(`${c.id} 晌礼 ${hh.toFixed(2)} 不在中午附近 ${noon}`);
      // 每两番之间至少 20 分钟
      for (let k = 1; k < v.length; k++) if (v[k] - v[k - 1] < 20 * 60000) problems.push(`${c.id} ${d.y}-${d.m}-${d.d} ${ORDER[k - 1]}→${ORDER[k]} 不到 20 分钟`);
      const f = fastTimes(c, d);
      if (!(f.sahurEnd < f.dawn && f.iftar >= t.sunset)) problems.push(`${c.id} ${d.y}-${d.m}-${d.d} 封斋/开斋时间异常`);
      if (highLatitudeDay(c, d)) highLat++;
    }
  }
  assert.deepEqual(problems.slice(0, 10), []);
  assert.ok(highLat > 0, '俄罗斯北部夏天应出现高纬度估算日');
});

test('高纬度估算只出现在北部城市的夏天', () => {
  const tj = CITY_DATA.filter((c) => c.cc === 'TJ');
  for (const c of tj) for (const m of [1, 6, 12]) assert.equal(highLatitudeDay(c, { y: 2027, m, d: 21 }), false, c.id);
  assert.equal(highLatitudeDay(getCity('spb'), { y: 2027, m: 6, d: 21 }), true);
  assert.equal(highLatitudeDay(getCity('spb'), { y: 2027, m: 12, d: 21 }), false);
  assert.equal(highLatitudeDay(getCity('spb'), { y: 2027, m: 3, d: 21 }), false);
  assert.equal(highLatitudeDay(getCity('moscow'), { y: 2027, m: 6, d: 21 }), true);
  assert.equal(highLatitudeDay(getCity('krasnodar'), { y: 2027, m: 6, d: 21 }), false);
});

test('朝向：塔吉克斯坦约西南偏西；俄罗斯西部朝南、东部偏西', () => {
  for (const c of CITY_DATA) {
    const b = qiblaBearing(c.lat, c.lon);
    if (c.cc === 'TJ') assert.ok(b > 235 && b < 255, `${c.id} ${b}`);
    else assert.ok(b > 160 && b < 290, `${c.id} ${b}`);
  }
});

test('我的位置：用最近城市的算法；天气用最近城市坐标（不发出用户位置）', () => {
  const here = getCity('here', { lat: 38.6, lon: 68.85, utcOffset: 5 });
  assert.equal(here.near, 'dushanbe');
  assert.equal(here.method, 'karachi');
  assert.equal(here.weatherLat, getCity('dushanbe').lat);
  assert.equal(nearestCity(55.7, 37.5).c.id, 'moscow');
  assert.equal(getCity('here', null).id, 'dushanbe'); // 位置无效时回到默认城市
});

test('显示时间跟着所选城市的时区（莫斯科 UTC+3、符拉迪沃斯托克 UTC+10）', () => {
  const ymd = { y: 2027, m: 3, d: 21 };
  // 晌礼必在当地正午前后 1 个半小时内：说明时区用对了
  for (const c of CITY_DATA) {
    setDisplayOffset(c.utcOffset);
    const [hh] = fmtHM(timesFor(c, ymd).dhuhr).split(':').map(Number);
    assert.ok(hh >= 11 && hh <= 13, `${c.id} 晌礼 ${hh} 点`);
  }
  setDisplayOffset(5);
});

test('天气：正常查询能返回数据；"我的位置"只发最近城市的坐标', async () => {
  const { getWeather, classify } = await import('../src/core/weather.js');
  const urls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return {
      ok: true,
      json: async () => ({
        current: { weather_code: 0, temperature_2m: 20, snowfall: 0, wind_speed_10m: 5, wind_gusts_10m: 10 },
        daily: { weather_code: [0], temperature_2m_min: [10], temperature_2m_max: [25], snowfall_sum: [0], uv_index_max: [4], wind_gusts_10m_max: [12] },
      }),
    };
  };
  try {
    const w = await getWeather(getCity('dushanbe'));
    assert.equal(classify(w), 'clear');
    await getWeather(getCity('here', { lat: 38.61, lon: 68.9, utcOffset: 5 }));
    assert.ok(!urls.some((u) => u.includes('38.61') || u.includes('68.9')), '天气查询里出现了用户位置');
  } finally {
    globalThis.fetch = orig;
  }
});
