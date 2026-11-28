// "用我的位置"：只在手机上用来算礼拜时间和朝向，不上传到任何地方。
// - 只要粗略位置（城市级别即可），保存时四舍五入到 0.01°（约 1 公里）
// - 查天气用最近城市的坐标，不把用户位置发给天气服务
// 这是本应用唯一读取位置的地方（测试会检查）。
import { deviceTz, deviceOffsetNow } from './clock.js';

const once = (opts) =>
  new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, opts));

/**
 * 取大概位置。没有网络时也尽量取到：
 *   1) 先快速要一个（允许用 30 分钟内的位置，靠网络定位最快）；
 *   2) 没取到（没有网络、在室内），改用卫星定位再等最多 30 秒——卫星定位不需要网络；
 *   3) 还不行，就用手机上记着的最后一个位置（不管多久以前的）。
 * 用户拒绝了位置权限就直接告诉页面，不再重试。
 * 时区一律跟着手机（偏移和时区名都记下），这样显示的时间和手机上的钟对得上。
 */
export async function locate() {
  if (!navigator.geolocation) throw new Error('unsupported');
  const tries = [
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 30 * 60 * 1000 },
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
    { enableHighAccuracy: false, timeout: 3000, maximumAge: Infinity },
  ];
  let last = null;
  for (const opts of tries) {
    try {
      const p = await once(opts);
      return {
        lat: Math.round(p.coords.latitude * 100) / 100,
        lon: Math.round(p.coords.longitude * 100) / 100,
        utcOffset: deviceOffsetNow(),
        tz: deviceTz() || undefined,
      };
    } catch (e) {
      last = e;
      if (e && e.code === 1) throw e; // 没给权限：不再试
    }
  }
  throw last || new Error('failed');
}

/** 手机现在的时区（相对 UTC 的小时数，如北京 8、杜尚别 5） */
export const deviceOffset = deviceOffsetNow;

/** 已经允许过定位吗（不会弹出询问）。不支持查询的环境返回 false，宁可不自动定位 */
export async function locationGranted() {
  try {
    if (!navigator.permissions || !navigator.permissions.query) return false;
    const st = await navigator.permissions.query({ name: 'geolocation' });
    return st.state === 'granted';
  } catch (e) {
    return false;
  }
}

/** 两个位置相距多少公里（够用的近似） */
export function kmBetween(a, b) {
  const r = Math.PI / 180;
  const x = (b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

/**
 * 打开应用时（"我的位置"模式）：
 * - 手机时区变了（出差、换了时区设置）就跟着变，不需要定位权限；
 * - 开了"自动定位"并且已经允许过定位，就悄悄更新位置（移动超过 3 公里才更新），不弹窗。
 * 返回新的 loc，没变化返回 null。
 */
export async function refreshHere(settings) {
  if (settings.city !== 'here' || !settings.loc) return null;
  let loc = settings.loc;
  let changed = false;
  const tz = deviceTz() || undefined;
  if (loc.utcOffset !== deviceOffset() || loc.tz !== tz) {
    loc = { ...loc, utcOffset: deviceOffset(), tz };
    changed = true;
  }
  if (settings.autoLoc && (await locationGranted())) {
    try {
      const now = await locate();
      if (kmBetween(loc, now) > 3) {
        loc = now;
        changed = true;
      }
    } catch (e) {
      /* 这次没定位到：用上次的 */
    }
  }
  return changed ? loc : null;
}
