// 城市数据（见 content/cities-data.js：坐标、时区、磁偏角、算法，脚本生成）
// - 时区：塔吉克斯坦、俄罗斯都不实行夏令时，按固定 UTC 偏移计算，不读取手机时区。
// - "我的位置"：坐标只在手机上计算礼拜时间，不上传；查天气时用最近的城市代替，不把位置发出去。
import { CITY_DATA } from '../content/cities-data.js';

export const CITIES = Object.fromEntries(CITY_DATA.map((c) => [c.id, c]));
export const CITY_GROUPS = [
  { cc: 'TJ', ids: CITY_DATA.filter((c) => c.cc === 'TJ').map((c) => c.id) },
  { cc: 'RU', ids: CITY_DATA.filter((c) => c.cc === 'RU').map((c) => c.id) },
];
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
