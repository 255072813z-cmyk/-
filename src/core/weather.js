// 天气：只按"城市坐标"查询 Open-Meteo（免费、无需密钥），不读取用户位置，不发送任何个人信息。
// 结果在本机缓存 1 小时；断网或查询失败时返回 null，页面不会凭空说"下雪"。
import { load, save } from './storage.js';

const TTL = 60 * 60 * 1000;
// WMO 天气代码：45/48 雾；51–57 毛毛雨；61–67 雨（66/67 冻雨）；71–77 雪；80–82 阵雨；85/86 阵雪；95–99 雷雨
const SNOW = [71, 73, 75, 77, 85, 86];
const HEAVY_SNOW = [75, 86];
const RAIN = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82];
const HEAVY_RAIN = [65, 67, 82];
const STORM = [95, 96, 99];
const FOG = [45, 48];

// 门槛（可按当地情况调整）
export const LIMITS = { gustKmh: 55, windKmh: 40, heatC: 37, uv: 8, coldC: 0, coldMinC: -5 };

/**
 * 把天气归成一类（按对出门影响从大到小）：
 * heavy 大雪 / snow 下雪 / storm 雷雨 / rain 下雨 / wind 大风 / cold 严寒 / heat 酷热 / uv 紫外线强 / fog 雾 / clear 好天气
 */
export function classify(w) {
  if (!w) return null;
  const codes = [w.code, w.dayCode];
  const any = (list) => codes.some((c) => list.includes(c));
  if (any(HEAVY_SNOW) || w.snowCm >= 5) return 'heavy';
  if (any(SNOW) || w.snowCm > 0) return 'snow';
  if (any(STORM)) return 'storm';
  if (any(RAIN)) return 'rain';
  if ((w.gust || 0) >= LIMITS.gustKmh || (w.wind || 0) >= LIMITS.windKmh) return 'wind';
  if (w.temp <= LIMITS.coldC || w.minTemp <= LIMITS.coldMinC) return 'cold';
  if ((w.maxTemp != null ? w.maxTemp : w.temp) >= LIMITS.heatC) return 'heat';
  if ((w.uv || 0) >= LIMITS.uv) return 'uv';
  if (any(FOG)) return 'fog';
  return 'clear';
}

export const isHeavyRain = (w) => !!w && [w.code, w.dayCode].some((c) => HEAVY_RAIN.includes(c));

/** 演示/测试：地址里加 ?weather=heavy|snow|storm|rain|wind|cold|heat|uv|fog|clear */
const DEMO = {
  heavy: { code: 75, dayCode: 75, temp: -4, minTemp: -9, maxTemp: -1, snowCm: 12 },
  snow: { code: 71, dayCode: 71, temp: -1, minTemp: -4, maxTemp: 1, snowCm: 2 },
  storm: { code: 95, dayCode: 95, temp: 18, minTemp: 12, maxTemp: 22, snowCm: 0 },
  rain: { code: 63, dayCode: 63, temp: 9, minTemp: 5, maxTemp: 11, snowCm: 0 },
  wind: { code: 3, dayCode: 3, temp: 8, minTemp: 3, maxTemp: 12, snowCm: 0, wind: 42, gust: 68 },
  cold: { code: 3, dayCode: 3, temp: -7, minTemp: -12, maxTemp: -3, snowCm: 0 },
  heat: { code: 0, dayCode: 0, temp: 39, minTemp: 26, maxTemp: 42, snowCm: 0, uv: 10 },
  uv: { code: 1, dayCode: 1, temp: 31, minTemp: 19, maxTemp: 33, snowCm: 0, uv: 9 },
  fog: { code: 45, dayCode: 45, temp: 4, minTemp: 1, maxTemp: 7, snowCm: 0 },
  clear: { code: 0, dayCode: 0, temp: 12, minTemp: 4, maxTemp: 15, snowCm: 0, uv: 3 },
};
function override() {
  try {
    const v = new URLSearchParams(location.search).get('weather');
    if (DEMO[v]) return { ...DEMO[v], demo: true };
  } catch (e) {
    /* ignore */
  }
  return null;
}

// 预览版（VITE_PREVIEW=1 构建，用于在不能联网查天气的预览环境里展示冬季模式）固定显示演示大雪
const PREVIEW = typeof import.meta !== 'undefined' && !!import.meta.env && import.meta.env.VITE_PREVIEW === '1';

export async function getWeather(city) {
  const o = override() || (PREVIEW ? { ...DEMO.heavy, demo: true } : null);
  if (o) return o;
  const key = 'weather2:' + (city.near || city.id); // 按查询的城市缓存（"我的位置"用最近城市）
  const cached = load(key, null);
  if (cached && Date.now() - cached.at < TTL) return cached.data;
  try {
    const url =
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${city.weatherLat ?? city.lat}&longitude=${city.weatherLon ?? city.lon}` + // "我的位置"时用最近城市，不发出用户位置
      '&current=temperature_2m,weather_code,snowfall,wind_speed_10m,wind_gusts_10m' +
      '&daily=weather_code,temperature_2m_min,temperature_2m_max,snowfall_sum,uv_index_max,wind_gusts_10m_max' +
      '&timezone=auto&forecast_days=1'; // 按城市当地的日期统计当天最高温、最大阵风
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 6000) : null;
    const res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (timer) clearTimeout(timer);
    if (!res.ok) throw new Error('http ' + res.status);
    const j = await res.json();
    const data = {
      code: j.current.weather_code,
      temp: j.current.temperature_2m,
      snowCm: Math.max(j.current.snowfall || 0, (j.daily.snowfall_sum && j.daily.snowfall_sum[0]) || 0),
      dayCode: j.daily.weather_code && j.daily.weather_code[0],
      minTemp: j.daily.temperature_2m_min && j.daily.temperature_2m_min[0],
      maxTemp: j.daily.temperature_2m_max && j.daily.temperature_2m_max[0],
      wind: j.current.wind_speed_10m,
      gust: Math.max(j.current.wind_gusts_10m || 0, (j.daily.wind_gusts_10m_max && j.daily.wind_gusts_10m_max[0]) || 0),
      uv: j.daily.uv_index_max && j.daily.uv_index_max[0],
    };
    save(key, { at: Date.now(), data });
    return data;
  } catch (e) {
    return cached ? cached.data : null;
  }
}
