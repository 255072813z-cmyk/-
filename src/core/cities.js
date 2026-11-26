// 城市数据（见 content/cities-data.js：坐标、时区、磁偏角、算法，脚本生成）
// - 时区：塔吉克斯坦、乌兹别克斯坦、吉尔吉斯斯坦、俄罗斯、中国（北京时间）都不实行夏令时，按固定 UTC 偏移计算，不读取手机时区。
// - "我的位置"：坐标只在手机上计算礼拜时间，不上传；查天气时用最近的城市代替，不把位置发出去。
import { CITY_DATA } from '../content/cities-data.js';

export const CITIES = Object.fromEntries(CITY_DATA.map((c) => [c.id, c]));
export const CITY_GROUPS = ['TJ', 'UZ', 'KG', 'RU', 'CN'].map((cc) => ({ cc, ids: CITY_DATA.filter((c) => c.cc === cc).map((c) => c.id) }));
export const DEFAULT_CITY = 'dushanbe';

/** 两点距离（公里） */
export function km(a, b) {
  const r = (d) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function nearestCity(lat, lon) {
  let best = null;
  for (const c of CITY_DATA) {
    const d = km({ lat, lon }, c);
    if (!best || d < best.d) best = { c, d };
  }
  return best;
}

/**
 * 取城市。id 为 'here' 时用"我的位置"（loc = { lat, lon, utcOffset }）：
 * 算法、磁偏角跟最近的城市一样；天气用最近城市的坐标。
 */
export function getCity(id, loc) {
  if (id === 'here' && loc && isFinite(loc.lat) && isFinite(loc.lon)) {
    const { c: near, d } = nearestCity(loc.lat, loc.lon);
    return {
      ...near,
      id: 'here',
      near: near.id,
      nearKm: Math.round(d),
      lat: loc.lat,
      lon: loc.lon,
      utcOffset: isFinite(loc.utcOffset) ? loc.utcOffset : near.utcOffset,
      weatherLat: near.lat,
      weatherLon: near.lon,
    };
  }
  return CITIES[id] || CITIES[DEFAULT_CITY];
}

/** 用户在设置里自己选了算法（不是"自动"）时，用选的算法代替城市默认的 */
export function withMethod(city, method) {
  return method && method !== 'auto' && method !== city.method ? { ...city, method } : city;
}

// 第一次打开时按手机的时区猜城市（不读位置）：在莫斯科打工的人一打开就是莫斯科的时间。
const TZ_CITY = {
  'Asia/Dushanbe': 'dushanbe',
  'Asia/Tashkent': 'tashkent',
  'Asia/Samarkand': 'samarkand',
  'Asia/Bishkek': 'bishkek',
  // 中国：手机设北京时间的猜北京；设新疆时间的猜乌鲁木齐；不准时首页请用户确认或自动定位
  'Asia/Shanghai': 'beijing',
  'Asia/Chongqing': 'chongqing',
  'Asia/Chungking': 'chongqing',
  'Asia/Harbin': 'beijing',
  'PRC': 'beijing',
  'Asia/Urumqi': 'urumqi',
  'Asia/Kashgar': 'kashgar',
  'Europe/Moscow': 'moscow',
  'Europe/Volgograd': 'rostov',
  'Europe/Kirov': 'kazan',
  'Europe/Samara': 'samara',
  'Europe/Ulyanovsk': 'samara',
  'Europe/Saratov': 'samara',
  'Europe/Astrakhan': 'samara',
  'Asia/Yekaterinburg': 'yekaterinburg',
  'Asia/Novosibirsk': 'novosibirsk',
  'Asia/Barnaul': 'novosibirsk',
  'Asia/Tomsk': 'novosibirsk',
  'Asia/Novokuznetsk': 'novosibirsk',
  'Asia/Krasnoyarsk': 'krasnoyarsk',
  'Asia/Irkutsk': 'irkutsk',
  'Asia/Vladivostok': 'vladivostok',
};
export function guessCity() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TZ_CITY[tz] || DEFAULT_CITY;
  } catch (e) {
    return DEFAULT_CITY;
  }
}
