// 本地存储：所有个人记录只存在用户自己的设备上，不上传任何服务器。
// 隐私模式、清理过数据或被浏览器禁用时，读写会失败，这里一律吞掉错误，页面照常工作。
const NS = 'masjid:';

export function load(key, fallback) {
  try {
    const raw = window.localStorage.getItem(NS + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

export function save(key, value) {
  try {
    window.localStorage.setItem(NS + key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}
