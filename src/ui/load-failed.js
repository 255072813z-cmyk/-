// 按需下载的页面、古兰经经文没下载下来时怎么办。
// 以前一律说"没有网络"，但很多时候手机是有网的：
//   1) 网站刚更新过，手机上开着的还是旧页面，它要的旧文件已经换了名字 → 自动刷新一次就好
//   2) 网络不稳，这一次没下载完 → 给一个"再试一次"
// 只有手机真的断网（navigator.onLine 为 false）时才说"没有网络"。
import { t } from '../i18n/index.js';
import { guessCity, getCity } from '../core/cities.js';
import { cityName } from '../i18n/format.js';

const guessedCityName = () => cityName(getCity(guessCity()));

const KEY = 'masjid:reloaded';

/** 30 秒内只自动刷新一次，免得来回刷新 */
function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch (e) {
    return false;
  }
  location.reload();
  return true;
}

export const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** 把 el 的内容换成说明 + "再试一次"按钮（有网时先自动刷新一次） */
export function loadFailed(el) {
  if (!el) return;
  const offline = isOffline();
  if (!offline && reloadOnce()) return;
  el.innerHTML = `<p class="note load-failed">${t(offline ? 'common.offlineMissing' : 'common.loadFailed')}</p>
    <div class="step-btns"><button type="button" class="btn btn-ghost btn-sm" data-retry>${t('common.retry')}</button></div>`;
  el.querySelector('[data-retry]').addEventListener('click', () => location.reload());
}

/** 自动定位没成功时说什么：没给权限 / 设备不支持 / 没有网络（给出按手机时区猜的城市）/ 一般的取不到 */
export function locateError(e) {
  if (e && e.code === 1) return t('city.denied');
  if (e && e.message === 'unsupported') return t('city.unsupported');
  if (isOffline()) return t('city.failedOffline', { city: guessedCityName() });
  return t('city.failed');
}
