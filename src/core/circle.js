// 亲友圈（自愿加入）。不要手机号、不用注册：这台手机自己生成一个随机编号和一把随机密钥，只存在本机。
// 亲友只能看到：你的昵称、今天打卡了没有、连续天数（可隐藏）。看不到你礼了哪几番。
import { load, save } from './storage.js';
import { apiBase, QUIET } from './api.js';
import { streakStatus } from './streak.js';

const hex = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((x) => x.toString(16).padStart(2, '0')).join('');

export const circleAvailable = () => !!apiBase();

/** 本机保存的身份和所在的圈 */
export function myCircle() {
  const c = load('circle', null);
  return c && typeof c.uid === 'string' && typeof c.secret === 'string' ? c : null;
}
function identity() {
  let c = load('circle', null);
  if (!c || !/^[0-9a-f]{32}$/.test(c.uid || '') || !/^[0-9a-f]{64}$/.test(c.secret || '')) {
    c = { uid: hex(16), secret: hex(32) };
    save('circle', c);
  }
  return c;
}

async function call(op, body) {
  const c = identity();
  try {
    const r = await fetch(apiBase() + '/circle/' + op, { ...QUIET, method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify({ uid: c.uid, secret: c.secret, ...body }) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, data: j } : { ok: false, error: j.error || 'http' + r.status, status: r.status };
  } catch (e) {
    return { ok: false, error: 'net' };
  }
}

function remember(state, extra = {}) {
  const c = { ...identity(), ...extra, code: state.code };
  save('circle', c);
  save('circleState', { at: Date.now(), state });
  return state;
}

export const cachedState = () => {
  const s = load('circleState', null);
  return s && s.state && Array.isArray(s.state.members) ? s.state : null;
};

export async function createCircle(nick) {
  const r = await call('create', { nick });
  if (r.ok) remember(r.data, { nick });
  return r;
}

export async function joinCircle(code, nick) {
  const r = await call('join', { code: String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), nick });
  if (r.ok) remember(r.data, { nick });
  return r;
}

/** 刷新：先把没发出去的打卡补上，再取最新的圈 */
export async function refreshCircle(todayKey) {
  const c = myCircle();
  if (!c || !c.code || !circleAvailable()) return { ok: false, error: 'none' };
  if (todayKey) await syncCheckin(todayKey);
  const r = await call('state', { code: c.code });
  if (r.ok) remember(r.data);
  else if (r.status === 401 || r.status === 404) {
    // 被移出、圈已解散
    save('circle', { uid: c.uid, secret: c.secret });
    save('circleState', null);
  }
  return r;
}

/** 打卡后告诉亲友圈（没网时记下，下次补上） */
export async function syncCheckin(todayKey) {
  const c = myCircle();
  if (!c || !c.code || !circleAvailable()) return;
  const s = streakStatus(todayKey);
  if (!s.today) return;
  const r = await call('checkin', { code: c.code, day: todayKey, streak: s.cur, hide: !!c.hide });
  if (r.ok) remember(r.data);
}

export async function nudge(to, kind) {
  const c = myCircle();
  return call('nudge', { code: c.code, to, kind });
}

export async function setHide(hide) {
  const c = myCircle();
  save('circle', { ...c, hide });
  const r = await call('hide', { code: c.code, hide });
  if (r.ok) remember(r.data, { hide });
  return r;
}

export async function setLock(locked) {
  const c = myCircle();
  const r = await call('lock', { code: c.code, locked });
  if (r.ok) remember(r.data);
  return r;
}

export async function removeMember(to) {
  const c = myCircle();
  const r = await call('remove', { code: c.code, to });
  if (r.ok) remember(r.data);
  return r;
}

export async function leaveCircle() {
  const c = myCircle();
  const r = await call('leave', { code: c.code });
  if (r.ok || r.status === 401 || r.status === 404) {
    // 退出后换一个新身份（以后再加入别的圈，和这个圈没有关联）
    save('circle', null);
    save('circleState', null);
  }
  return r;
}
