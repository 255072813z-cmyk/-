// 天气：只按"城市坐标"查询 Open-Meteo（免费、无需密钥），不读取用户位置，不发送任何个人信息。
// 结果在本机缓存 1 小时；断网或查询失败时返回 null，页面不会凭空说"下雪"。
import { load, save } from './storage.js';

const TTL = 60 * 60 * 1000;
// WMO 天气代码：71/73/75 降雪（小/中/大），77 雪粒，85/86 阵雪（小/大）
const SNOW = [71, 73, 75, 77, 85, 86];
const HEAVY = [75, 86];

/** 把天气数据归类：heavy 大雪 / snow 下雪 / cold 严寒 / clear 其他 */
export function classify(w) {
  if (!w) return null;
  if (HEAVY.includes(w.code) || w.snowCm >= 5) return 'heavy';
  if (SNOW.includes(w.code) || SNOW.includes(w.dayCode) || w.snowCm > 0) return 'snow';
  if (w.temp <= 0 || w.minTemp <= -5) return 'cold';
  return 'clear';
}

/** 演示/测试：地址里加 ?weather=heavy|snow|cold|clear */
function override() {
  try {
    const v = new URLSearchParams(location.search).get('weather');
    if (v === 'heavy') return { code: 75, dayCode: 75, temp: -4, minTemp: -9, snowCm: 12, demo: true };
    if (v === 'snow') return { code: 71, dayCode: 71, temp: -1, minTemp: -4, snowCm: 2, demo: true };
    if (v === 'cold') return { code: 3, dayCode: 3, temp: -7, minTemp: -12, snowCm: 0, demo: true };
    if (v === 'clear') return { code: 0, dayCode: 0, temp: 12, minTemp: 4, snowCm: 0, demo: true };
  } catch (e) {
    /* ignore */
  }
  return null;
}

// 预览版（VITE_PREVIEW=1 构建，用于在不能联网查天气的预览环境里展示冬季模式）固定显示演示大雪
const PREVIEW = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_PREVIEW === '1';

export async function getWeather(city) {
  const o = override() || (PREVIEW ? { code: 75, dayCode: 75, temp: -4, minTemp: -9, snowCm: 12, demo: true } : null);
  if (o) return o;
  const key = 'weather:' + city.id;
  const cached = load(key, null);
  if (cached && Date.now() - cached.at < TTL) return cached.data;
  try {
    const url =
      'https://api.open-meteo.com/v1/forecast' +
      `?latitude=${city.lat}&longitude=${city.lon}` +
      '&current=temperature_2m,weather_code,snowfall' +
      '&daily=weather_code,temperature_2m_min,snowfall_sum' +
      '&timezone=Asia%2FDushanbe&forecast_days=1';
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
    };
    save(key, { at: Date.now(), data });
    return data;
  } catch (e) {
    return cached ? cached.data : null;
  }
}
