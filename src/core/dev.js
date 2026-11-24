// 演示/测试用的地址参数（?now= 拨时钟、?weather= 演示天气）。
// 只在本机（localhost / 127.0.0.1）或预览版里生效：正式网站上别人发来的链接改不了你看到的时间和天气。
export function devParam(name) {
  try {
    const preview = typeof import.meta !== 'undefined' && !!import.meta.env && import.meta.env.VITE_PREVIEW === '1';
    const local = ['localhost', '127.0.0.1'].includes(location.hostname);
    if (!preview && !local) return null;
    return new URLSearchParams(location.search).get(name);
  } catch (e) {
    return null; // 非浏览器环境（测试）
  }
}
