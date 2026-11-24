// 在线人数与垫子的规则（服务端，纯逻辑，线上 Cloudflare 版和本地测试版共用）。
//
// 隐私：每个连接只有一个服务端随机生成的编号；不收集、不保存任何个人信息，
// 不写数据库，人走了（连接断开）就什么都不剩。
//
// 大殿：capacity 张垫子。空垫子可以直接坐；坐满了可以排队，有人起身时，
// 空出来的垫子自动留给排在最前面的人。
// 庭院、诗歌夜：只数人数，没有垫子。

export const ROOMS = {
  hall: { capacity: 40, maxOnline: 2000 },
  courtyard: { capacity: 0, maxOnline: 2000 },
  poetry: { capacity: 0, maxOnline: 2000 },
};

/** 新连接 */
export function newSession(id) {
  return { id, mat: null, queued: null };
}

const takenMats = (list) => new Set(list.filter((s) => s.mat != null).map((s) => s.mat));

function firstFree(list, capacity) {
  const taken = takenMats(list);
  for (let i = 0; i < capacity; i++) if (!taken.has(i)) return i;
  return null;
}

const queueOf = (list) => list.filter((s) => s.queued != null).sort((a, b) => a.queued - b.queued || (a.id < b.id ? -1 : 1));

/** 把空垫子按排队顺序分出去，返回被分到垫子的人的编号 */
export function assignFromQueue(list, capacity) {
  const assigned = [];
  for (const s of queueOf(list)) {
    const free = firstFree(list, capacity);
    if (free == null) break;
    s.mat = free;
    s.queued = null;
    assigned.push(s.id);
  }
  return assigned;
}

/**
 * 处理一个动作。list 是房间里所有连接（会被直接修改），me 是发出动作的连接。
 * 返回 { ok, error?, assigned: [被分到垫子的编号] }
 */
export function applyAction(list, me, action, capacity, now = Date.now()) {
  const res = { ok: true, assigned: [] };
  if (!action || typeof action !== 'object') return { ok: false, error: 'bad', assigned: [] };
  if (action.type === 'hello') return res; // 连上后客户端先打招呼，服务端回当前状态
  if (action.type === 'sit') {
    const mat = action.mat;
    if (!Number.isInteger(mat) || mat < 0 || mat >= capacity) return { ok: false, error: 'bad', assigned: [] };
    if (takenMats(list).has(mat) && me.mat !== mat) return { ok: false, error: 'taken', assigned: [] };
    if (me.mat == null && queueOf(list).some((s) => s.id !== me.id)) return { ok: false, error: 'queue', assigned: [] };
    me.mat = mat;
    me.queued = null;
    return res;
  }
  if (action.type === 'queue') {
    if (me.mat != null) return res;
    if (firstFree(list, capacity) != null && !queueOf(list).length) return { ok: false, error: 'free', assigned: [] };
    if (me.queued == null) me.queued = now;
    res.assigned = assignFromQueue(list, capacity);
    return res;
  }
  if (action.type === 'stand') {
    me.mat = null;
    me.queued = null;
    res.assigned = assignFromQueue(list, capacity);
    return res;
  }
  return { ok: false, error: 'bad', assigned: [] };
}

/** 某人离开（断线）后，剩下的人重新分配 */
export function removeSession(list, id, capacity) {
  const i = list.findIndex((s) => s.id === id);
  if (i >= 0) list.splice(i, 1);
  return assignFromQueue(list, capacity);
}

/** 发给某个连接的状态：只有人数、哪些垫子有人、自己的垫子和排队位置 */
export function snapshotFor(list, me, capacity, event) {
  const q = queueOf(list);
  const pos = q.findIndex((s) => s.id === me.id);
  return {
    type: 'state',
    online: list.length,
    capacity,
    taken: [...takenMats(list)].sort((a, b) => a - b),
    queue: q.length,
    you: { mat: me.mat, queuePos: pos >= 0 ? pos + 1 : null },
    event: event || null,
  };
}

/** 解析客户端消息：只接受很短的 JSON */
export function parseMessage(raw) {
  if (typeof raw !== 'string' || raw.length > 200) return null;
  try {
    const m = JSON.parse(raw);
    if (!m || typeof m.type !== 'string') return null;
    return { type: m.type, mat: m.mat };
  } catch (e) {
    return null;
  }
}
