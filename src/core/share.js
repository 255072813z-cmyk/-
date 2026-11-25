// 分享：只用手机自带的分享（发到 Telegram、WhatsApp 等），不经过我们的服务器。
// 手机应用里用 Capacitor 的 Share 插件弹出系统分享面板（安卓的网页视图里没有 navigator.share，以前只能复制）。
import { platform } from './api.js';
import { markFeature } from './usage.js';

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

/** 手机应用里的系统分享面板（Capacitor 的 Share 插件；网页上没有） */
async function nativeShare(opts) {
  const { Share } = await import('@capacitor/share');
  await Share.share(opts);
}
const isCancel = (e) => !!e && (e.name === 'AbortError' || /cancel/i.test(String(e.message || e)));

/**
 * 分享一段文字：手机应用里弹出系统分享面板（可以直接发 Telegram、WhatsApp），网页上用浏览器的分享；
 * 都不行就复制到剪贴板。返回 'shared' | 'copied' | 'failed' | 'cancel'。
 * day：传了就记一下"那天分享过"（匿名统计只记用没用，见 shared/stats.js）。
 */
export async function shareText(text, day) {
  const r = await shareTextRaw(text);
  if (day && (r === 'shared' || r === 'copied')) markFeature('share', day);
  return r;
}
async function shareTextRaw(text) {
  if (platform() !== 'web') {
    try {
      await nativeShare({ text });
      return 'shared';
    } catch (e) {
      if (isCancel(e)) return 'cancel';
    }
  }
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
  } catch (e) {
    if (isCancel(e)) return 'cancel';
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch (e) {
    return 'failed';
  }
}

/**
 * 分享一张图片（canvas）：手机应用里先存到应用的缓存目录再弹出分享面板；网页上能分享文件就分享，
 * 不能就直接下载到手机。返回 'shared' | 'saved' | 'failed' | 'cancel'。
 */
export async function shareImage(canvas, fileName, text, day) {
  const r = await shareImageRaw(canvas, fileName, text);
  if (day && (r === 'shared' || r === 'saved')) markFeature('share', day);
  return r;
}
async function shareImageRaw(canvas, fileName, text) {
  if (platform() !== 'web') {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const data = canvas.toDataURL('image/png').split(',')[1];
      const { uri } = await Filesystem.writeFile({ path: fileName, data, directory: Directory.Cache });
      await nativeShare({ files: [uri], text });
      return 'shared';
    } catch (e) {
      return isCancel(e) ? 'cancel' : 'failed';
    }
  }
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) return 'failed';
  try {
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return 'shared';
    }
  } catch (e) {
    if (isCancel(e)) return 'cancel';
  }
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return 'saved';
  } catch (e) {
    return 'failed';
  }
}

/**
 * 把一段文字存成文件交给用户（备份用）：手机应用里存到缓存目录再弹出分享面板（可以发到自己的 Telegram、存到网盘）；
 * 网页上直接下载。返回 'shared' | 'saved' | 'failed' | 'cancel'。
 */
export async function shareFile(text, fileName, mime = 'application/json') {
  if (platform() !== 'web') {
    try {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const { uri } = await Filesystem.writeFile({ path: fileName, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await nativeShare({ files: [uri], title: fileName });
      return 'shared';
    } catch (e) {
      return isCancel(e) ? 'cancel' : 'failed';
    }
  }
  try {
    const blob = new Blob([text], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return 'saved';
  } catch (e) {
    return 'failed';
  }
}
