// 生成城市数据：坐标与时区（Open-Meteo 地名库，数据来自 GeoNames）、磁偏角（WMM-2025）。
// 只在开发时运行：npm run cities   生成 src/content/cities-data.js
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const geomagnetism = require('geomagnetism');

// method：karachi = 晨礼、宵礼 18°（塔吉克斯坦；乌兹别克斯坦、吉尔吉斯斯坦也先用它——哈乃斐地区通行、宵礼偏稳妥，
//           两国宗教局公布的算法没能核实，上线前请对照当地清真寺时间表，有差别就在管理后台发"官方时间校正"）；
//         dumrf = 晨礼 16°、宵礼 15°（俄罗斯穆斯林宗教管理局常用）
const LIST = [
  ['dushanbe', 'Dushanbe', 'TJ', 'karachi'],
  ['khujand', 'Khujand', 'TJ', 'karachi'],
  ['kulob', 'Kulob', 'TJ', 'karachi'],
  ['bokhtar', 'Kurgan-Tyube', 'TJ', 'karachi'],
  ['istaravshan', 'Istaravshan', 'TJ', 'karachi'],
  ['vahdat', 'Vahdat', 'TJ', 'karachi'],
  ['tursunzoda', 'Tursunzoda', 'TJ', 'karachi'],
  ['hisor', 'Hisor', 'TJ', 'karachi'],
  ['isfara', 'Isfara', 'TJ', 'karachi'],
  ['konibodom', 'Konibodom', 'TJ', 'karachi'],
  ['panjakent', 'Panjakent', 'TJ', 'karachi'],
  ['khorog', 'Khorugh', 'TJ', 'karachi'],
  ['tashkent', 'Tashkent', 'UZ', 'karachi'],
  ['samarkand', 'Samarkand', 'UZ', 'karachi'],
  ['bukhara', 'Bukhara', 'UZ', 'karachi'],
  ['namangan', 'Namangan', 'UZ', 'karachi'],
  ['andijan', 'Andijan', 'UZ', 'karachi'],
  ['fergana', 'Fergana', 'UZ', 'karachi'],
  ['kokand', 'Kokand', 'UZ', 'karachi'],
  ['qarshi', 'Qarshi', 'UZ', 'karachi'],
  ['termez', 'Termez', 'UZ', 'karachi'],
  ['jizzakh', 'Jizzakh', 'UZ', 'karachi'],
  ['navoiy', 'Navoiy', 'UZ', 'karachi'],
  ['urgench', 'Urgench', 'UZ', 'karachi'],
  ['nukus', 'Nukus', 'UZ', 'karachi'],
  ['bishkek', 'Bishkek', 'KG', 'karachi'],
  ['osh', 'Osh', 'KG', 'karachi'],
  ['jalalabad', 'Dzhalal-Abad', 'KG', 'karachi'], // 地名库里英文名记成 Manas（州首府，坐标就是贾拉拉巴德市）
  ['karakol', 'Karakol', 'KG', 'karachi'],
  ['tokmok', 'Tokmok', 'KG', 'karachi'],
  ['karabalta', 'Kara-Balta', 'KG', 'karachi'],
  ['uzgen', 'Uzgen', 'KG', 'karachi'],
  ['naryn', 'Naryn', 'KG', 'karachi'],
  ['talas', 'Talas', 'KG', 'karachi'],
  ['batken', 'Batken', 'KG', 'karachi'],
  ['moscow', 'Moscow', 'RU', 'dumrf'],
  ['spb', 'Saint Petersburg', 'RU', 'dumrf'],
  ['kazan', 'Kazan', 'RU', 'dumrf'],
  ['nnovgorod', 'Nizhniy Novgorod', 'RU', 'dumrf'],
  ['krasnodar', 'Krasnodar', 'RU', 'dumrf'],
  ['rostov', 'Rostov-on-Don', 'RU', 'dumrf'],
  ['samara', 'Samara', 'RU', 'dumrf'],
  ['yekaterinburg', 'Yekaterinburg', 'RU', 'dumrf'],
  ['chelyabinsk', 'Chelyabinsk', 'RU', 'dumrf'],
  ['ufa', 'Ufa', 'RU', 'dumrf'],
  ['tyumen', 'Tyumen', 'RU', 'dumrf'],
  ['surgut', 'Surgut', 'RU', 'dumrf'],
  ['novosibirsk', 'Novosibirsk', 'RU', 'dumrf'],
  ['krasnoyarsk', 'Krasnoyarsk', 'RU', 'dumrf'],
  ['irkutsk', 'Irkutsk', 'RU', 'dumrf'],
  ['vladivostok', 'Vladivostok', 'RU', 'dumrf'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function geocode(name, cc) {
  for (let i = 0; i < 5; i++) {
    try {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=en&format=json&countryCode=${cc}`);
      if (r.ok) {
        const j = await r.json();
        // 取人口最多的居民点（避开机场、同名小村）
        const best = (j.results || []).filter((x) => x.population).sort((a, b) => b.population - a.population)[0];
        if (best) return best;
      }
    } catch (e) {
      /* 重试 */
    }
    await sleep(1000 * (i + 1));
  }
  throw new Error('查不到：' + name);
}

/** 某时区在某天的 UTC 偏移（小时） */
function offsetHours(tz, date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(date);
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const asUTC = Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour, +v.minute);
  return Math.round((asUTC - date.getTime()) / 36e5 * 4) / 4;
}

const model = geomagnetism.model(new Date('2026-12-01'));
const out = [];
for (const [id, name, cc, method] of LIST) {
  const g = await geocode(name, cc);
  const winter = offsetHours(g.timezone, new Date('2027-01-15T12:00:00Z'));
  const summer = offsetHours(g.timezone, new Date('2027-07-15T12:00:00Z'));
  if (winter !== summer) throw new Error(`${name} 有夏令时，需要单独处理`);
  out.push({
    id,
    cc,
    lat: +g.latitude.toFixed(5),
    lon: +g.longitude.toFixed(5),
    tz: g.timezone,
    utcOffset: winter,
    declination: +model.point([g.latitude, g.longitude]).decl.toFixed(1),
    method,
    geonameId: g.id,
  });
  console.log(id, g.name, g.latitude, g.longitude, g.timezone, 'UTC+' + winter, 'decl', out.at(-1).declination);
  await sleep(250);
}
writeFileSync(
  new URL('../src/content/cities-data.js', import.meta.url),
  `// 自动生成：npm run cities（scripts/build-cities.mjs）。请勿手改。
// 坐标与时区：Open-Meteo 地名库（数据来自 GeoNames，geonameId 可查）；磁偏角：WMM-2025（2026 年 12 月）。
// 塔吉克斯坦、乌兹别克斯坦、吉尔吉斯斯坦、俄罗斯都不实行夏令时，UTC 偏移全年固定（生成时已核对冬、夏两个日期）。
export const CITY_DATA = ${JSON.stringify(out, null, 1)};
`,
);
console.log('共', out.length, '个城市');
