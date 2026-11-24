// 分享：只用手机自带的分享（发到 Telegram、WhatsApp 等），不经过我们的服务器。
import { platform } from './api.js';

/** 分享出去的下载/打开链接，带 ref=share，后台只统计"有多少新用户来自分享"（总数） */
export function shareLink(remote) {
  const site = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_SITE_URL : '';
  try {
    if (site) {
      const u = new URL(String(site));
      if (u.protocol === 'https:') {
        u.searchParams.set('ref', 'share');
        return u.href;
      }
    }
  } catch (e) {
    /* 没设置网站地址 */
  }
  const store = remote && remote.store;
  if (platform() === 'android' && store && store.android) return store.android;
  if (platform() === 'ios' && store && store.ios) return store.ios;
  if (platform() === 'web' && typeof location !== 'undefined' && /^https:/.test(location.href)) return location.origin + location.pathname + '?ref=share';
  return '';
}

/** 用手机的分享功能；不支持时复制到剪贴板。返回 'shared' | 'copied' | 'failed' | 'cancel' */
export async function shareText(text) {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancel';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (e) {
    return 'failed';
  }
}
