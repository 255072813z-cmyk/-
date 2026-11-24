// 城市数据
// - 坐标：GeoNames（杜尚别 1221874，胡占德 1514882）
// - 时区：塔吉克斯坦全年 UTC+5，没有夏令时，所以直接按固定偏移计算，
//   不依赖手机的时区设置（手机时区设错、人在外地时也能显示杜尚别时间）。
// - 磁偏角：WMM-2025 世界地磁模型，2026 年 12 月的值（向东为正）。手机罗盘指的是磁北，
//   需要加上磁偏角才是真北。
export const CITIES = {
  dushanbe: {
    id: 'dushanbe',
    lat: 38.53575,
    lon: 68.77905,
    utcOffset: 5,
    declination: 4.7,
  },
  khujand: {
    id: 'khujand',
    lat: 40.28256,
    lon: 69.62216,
    utcOffset: 5,
    declination: 5.3,
  },
};

export const DEFAULT_CITY = 'dushanbe';

export function getCity(id) {
  return CITIES[id] || CITIES[DEFAULT_CITY];
}
