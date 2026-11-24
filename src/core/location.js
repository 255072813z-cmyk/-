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
          // 用手机当前的时区（不在塔吉克斯坦、俄罗斯时也能对）
          utcOffset: -new Date().getTimezoneOffset() / 60,
        }),
      (e) => reject(e),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 },
    );
  });
}
