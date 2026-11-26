// 后台服务地址。构建时设置 VITE_API_URL（例如 https://masjid-api.xxx.workers.dev）才会联系后台；
// 没设置时：不取远程配置、不发统计、不显示在线人数——应用照常离线工作。
// 本地测试可在地址后加 ?api=http://127.0.0.1:8787（只接受本机地址）。
import { devParam } from './dev.js';
export function apiBase() {
  try {
    const q = devParam('api'); // 只在本机测试时生效
    if (q) {
      const u = new URL(q);
      if ((u.protocol === 'http:' || u.protocol === 'https:') && ['127.0.0.1', 'localhost'].includes(u.hostname)) return u.origin;
    }
  } catch (e) {
    /* 非浏览器环境 */
  }
  const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_URL : '';
  try {
    const u = env ? new URL(String(env)) : null;
    return u && u.protocol === 'https:' ? u.origin : '';
  } catch (e) {
    return '';
  }
}

/** 应用版本（构建时写入） */
// eslint-disable-next-line no-undef
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';

/** 平台：web / android / ios */
export function platform() {
  try {
    const cap = typeof window !== 'undefined' && window.Capacitor;
    const p = cap && cap.getPlatform ? cap.getPlatform() : 'web';
    return p === 'android' || p === 'ios' ? p : 'web';
  } catch (e) {
    return 'web';
  }
}

/** 给后台发请求的公共选项：不带 Cookie、不带来源网址 */
export const QUIET = { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' };

/** 是不是在手机应用里（Capacitor）。提醒等原生功能只在应用里才下载相关代码 */
export function isNativeApp() {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  } catch (e) {
    return false;
  }
}
