// "用我的位置"：只在手机上用来算礼拜时间和朝向，不上传到任何地方。
// - 只要粗略位置（城市级别即可），保存时四舍五入到 0.01°（约 1 公里）
// - 查天气用最近城市的坐标，不把用户位置发给天气服务
// 这是本应用唯一读取位置的地方（测试会检查）。
export function locate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: Math.round(p.coords.latitude * 100) / 100,
          lon: Math.round(p.coords.longitude * 100) / 100,
          // 用手机当前的时区（不在塔吉克斯坦、俄罗斯时也能对；在中国就是北京时间）
          utcOffset: -new Date().getTimezoneOffset() / 60,
        }),
      (e) => reject(e),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

/** 手机现在的时区（相对 UTC 的小时数，如北京 8、杜尚别 5） */
export const deviceOffset = () => -new Date().getTimezoneOffset() / 60;

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
  if (loc.utcOffset !== deviceOffset()) {
    loc = { ...loc, utcOffset: deviceOffset() };
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
