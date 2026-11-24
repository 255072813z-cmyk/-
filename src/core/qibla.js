// 朝向（基布拉）：从所在城市到天房的大圆初始方位角，以及手机罗盘。
// 天房坐标与 adhan-js 一致：北纬 21.4225241°，东经 39.8261818°。
export const KAABA = { lat: 21.4225241, lon: 39.8261818 };

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/** 与正北的顺时针夹角（真北） */
export function qiblaBearing(lat, lon) {
  const φ1 = rad(lat);
  const φ2 = rad(KAABA.lat);
  const Δλ = rad(KAABA.lon - lon);
  const y = Math.sin(Δλ);
  const x = Math.cos(φ1) * Math.tan(φ2) - Math.sin(φ1) * Math.cos(Δλ);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** 两点大圆距离（公里） */
export function distanceKm(lat, lon, lat2 = KAABA.lat, lon2 = KAABA.lon) {
  const R = 6371;
  const dφ = rad(lat2 - lat);
  const dλ = rad(lon2 - lon);
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(lat2)) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 大圆路径上的点（用于地图画线） */
export function greatCirclePoints(lat1, lon1, lat2 = KAABA.lat, lon2 = KAABA.lon, n = 48) {
  const φ1 = rad(lat1), λ1 = rad(lon1), φ2 = rad(lat2), λ2 = rad(lon2);
  const d = 2 * Math.asin(Math.sqrt(Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    pts.push([deg(Math.atan2(y, x)), deg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  return pts; // [lon, lat]
}

export function compassWord(b) {
  const words = ['北', '东北偏北', '东北', '东北偏东', '东', '东南偏东', '东南', '东南偏南', '南', '西南偏南', '西南', '西南偏西', '西', '西北偏西', '西北', '西北偏北'];
  return words[Math.round(b / 22.5) % 16];
}

/**
 * 启动手机罗盘。回调得到"磁北方位角"（0～360，顺时针）。
 * - iOS：需要用户点按后调用 DeviceOrientationEvent.requestPermission()，读 webkitCompassHeading
 * - Android Chrome：deviceorientationabsolute 事件，heading = 360 - alpha
 * 返回 stop() 函数。
 */
export function startCompass({ onHeading, onError }) {
  let got = false;
  let evName = 'deviceorientation';
  const handler = (e) => {
    let h = null;
    if (typeof e.webkitCompassHeading === 'number' && !isNaN(e.webkitCompassHeading)) {
      h = e.webkitCompassHeading;
    } else if ((e.absolute || evName === 'deviceorientationabsolute') && typeof e.alpha === 'number') {
      h = (360 - e.alpha) % 360;
    }
    if (h == null) return;
    // 横屏时修正屏幕旋转角
    let screenAngle = 0;
    try {
      screenAngle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    } catch (err) {
      screenAngle = 0;
    }
    got = true;
    onHeading((h + screenAngle + 360) % 360);
  };
  const attach = (failReason = 'nodata') => {
    evName = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
    window.addEventListener(evName, handler, true);
    setTimeout(() => {
      if (!got) onError && onError(failReason);
    }, 3500);
  };
  const DOE = window.DeviceOrientationEvent;
  if (!DOE) {
    onError && onError('unsupported');
    return () => {};
  }
  if (typeof DOE.requestPermission === 'function') {
    // iOS 必须在点按后请求权限。有的浏览器也带这个接口但直接返回"拒绝"，
    // 所以无论结果如何都先监听，3.5 秒内收到方向数据就照常工作，收不到才提示没有权限。
    DOE.requestPermission()
      .then((s) => attach(s === 'granted' ? 'nodata' : 'denied'))
      .catch(() => attach('denied'));
  } else {
    attach();
  }
  return () => window.removeEventListener(evName, handler, true);
}
