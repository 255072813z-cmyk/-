// 记下今天用到了哪些功能、跟着做完几次礼拜（只存在本机；下一个使用日随匿名统计一起排队，见 stats.js）
import { load, save } from './storage.js';
import { featureOf } from '../../shared/stats.js';

function useOf(todayKey) {
  const u = load('use', null);
  return u && u.day === todayKey && Array.isArray(u.f) ? u : { day: todayKey, f: [], gd: 0 };
}

/** 打开某个页面时记一下 */
export function markUse(path, todayKey) {
  const f = featureOf(path);
  if (f) markFeature(f, todayKey);
}

export function markFeature(f, todayKey) {
  const cur = useOf(todayKey);
  if (!cur.f.includes(f)) {
    cur.f.push(f);
    save('use', cur);
  }
}

/** 跟着做完一次礼拜 */
export function markGuideDone(todayKey) {
  const cur = useOf(todayKey);
  cur.gd = Math.min(50, (Number(cur.gd) || 0) + 1);
  save('use', cur);
}
