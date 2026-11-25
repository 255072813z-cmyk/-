// 管理后台（只在管理员的浏览器里运行）
// - 口令只放在 sessionStorage（关掉标签页就没了）
// - 私钥文件只在本地读取、签名，绝不上传
// - 所有显示的数据都按纯文字处理（esc），防止注入
import { sanitizeConfig, signBody, generateKeys, PRAYERS, FLAGS, LANGS } from './remote-config.js';
import { CITY_NAMES } from './city-names.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => Number(n || 0).toLocaleString('zh-CN');
const CITY = Object.fromEntries(CITY_NAMES.map((c) => [c.id, c.name]));
const CITY_IDS = CITY_NAMES.map((c) => c.id);
const LABELS = {
  p: { web: '网页', android: '安卓', ios: '苹果' },
  src: { share: '分享链接', direct: '直接打开网页', app: '应用商店' },
  pk: { 0: '0 番', 1: '1 番', 2: '2 番', 3: '3 番', 4: '4 番', 5: '5 番' },
  ad: { 1: '1 天', 2: '2 天', 3: '3 天', 4: '4 天', 5: '5 天', 6: '6 天', 7: '7 天（每天）' },
  fs: { 0: '标准', 1: '大', 2: '特大' },
  l: { zh: '中文', tg: '塔吉克语', ru: '俄语', uz: '乌兹别克语', ky: '吉尔吉斯语' },
  f: {
    home: '首页', pray: '礼拜标签', wudu: '小净', guide: '跟着做礼拜', qibla: '朝向', tasbih: '赞念', qada: '补礼记录',
    ramadan: '封斋/斋月', tarawih: '间歇拜', quran: '读古兰经', qplan: '古兰经 30 天计划',
    masjid: '清真寺入口', hall: '礼拜大殿', courtyard: '庭院', poetry: '诗歌夜',
    me: '我的', streak: '坚持与徽章', circle: '亲友圈', times: '月时间表', settings: '设置', city: '选择城市', here: '用我的位置', share: '分享',
  },
  flags: { masjid: '清真寺三个空间', presence: '在线人数', weather: '天气提示', stats: '匿名统计' },
};
const label = (k, v) => (k === 'c' ? CITY[v] || (v === 'other' ? '其他/未知' : v) : (LABELS[k] && LABELS[k][v]) || v);

// ---- 登录 ----
let token = sessionStorage.getItem('admin-session') || ''; // 登录后拿到的 8 小时会话（不是口令本身）
async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { ...(opts.headers || {}), authorization: 'Bearer ' + token }, cache: 'no-store', credentials: 'omit' });
  if (r.status === 401 || r.status === 429) {
    const why = r.status === 429 ? '输错次数太多，已锁定 1 小时。' : '登录已过期，请重新登录。';
    logout(why);
    throw new Error(why);
  }
  return r;
}
function logout(msg = '') {
  token = '';
  sessionStorage.removeItem('admin-session');
  $('[data-login]').hidden = false;
  $('.tabs').hidden = true;
  $('[data-logout]').hidden = true;
  $$('[data-panel]').forEach((p) => (p.hidden = true));
  $('[data-login-msg]').textContent = msg;
  $('[data-login-msg]').className = 'msg bad';
}
async function enter() {
  try {
    await loadStats();
  } catch (e) {
    return;
  }
  $('[data-login]').hidden = true;
  $('.tabs').hidden = false;
  $('[data-logout]').hidden = false;
  show('stats');
}
$('[data-login-form]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass = $('[data-token]').value.trim();
  const totp = $('[data-totp]').value.trim();
  $('[data-token]').value = '';
  $('[data-totp]').value = '';
  try {
    const r = await fetch('/admin/api/login', { method: 'POST', headers: { authorization: 'Bearer ' + pass, 'content-type': 'application/json' }, body: JSON.stringify({ totp }), cache: 'no-store', credentials: 'omit' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      logout(r.status === 429 ? '输错次数太多，已锁定 1 小时。' : j.error === 'bad-totp' ? '6 位数字不对（注意手机时间要准）。' : j.error === 'totp-not-configured' ? '服务器还没设置两步验证（ADMIN_TOTP），见"密钥"页。' : '口令不对。');
      return;
    }
    token = j.session;
    sessionStorage.setItem('admin-session', token);
    enter();
  } catch (err) {
    logout('连不上服务器。');
  }
});
$('[data-logout]').addEventListener('click', () => logout());

function show(tab) {
  $$('.tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $$('[data-panel]').forEach((p) => (p.hidden = p.dataset.panel !== tab));
  if (tab === 'config') loadConfig();
}
$$('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));

// ---- 数据 ----
async function loadStats() {
  const days = $('[data-days]').value;
  const r = await api('/admin/api/stats?days=' + days);
  if (!r.ok) throw new Error('stats ' + r.status);
  renderStats(await r.json(), Number(days));
}
$('[data-days]').addEventListener('change', () => loadStats());
$('[data-refresh]').addEventListener('click', () => loadStats());

function sumKey(list, k) {
  const out = {};
  for (const d of list) for (const [key, n] of Object.entries(d[k] || {})) out[key] = (out[key] || 0) + n;
  return out;
}

function renderStats(data, nDays) {
  const today = data.today;
  const dates = [];
  for (let i = nDays - 1; i >= 0; i--) dates.push(new Date(Date.parse(today + 'T00:00:00Z') - i * 864e5).toISOString().slice(0, 10));
  const empty = { n: 0, fn: 0, p: {}, l: {}, c: {}, v: {}, f: {}, e: {}, nw: 0, src: {}, coh: {}, ntf: 0, ntfn: 0, fs: {}, ad: {}, pk: {}, gd: 0 };
  const rows = dates.map((d) => ({ d, ...empty, ...(data.days[d] || {}) }));
  const t = rows[rows.length - 1];
  const last7 = rows.slice(-8, -1);
  const avg7 = last7.length ? Math.round(last7.reduce((s, r) => s + r.n, 0) / last7.length) : 0;
  const online = Object.values(data.rooms || {}).reduce((s, r) => s + (r.online || 0), 0);
  const new7 = last7.reduce((a, r) => a + (r.nw || 0), 0);
  const share7 = last7.reduce((a, r) => a + ((r.src || {}).share || 0), 0);
  const ntf = rows.reduce((a, r) => a + (r.ntf || 0), 0);
  const ntfn = rows.reduce((a, r) => a + (r.ntfn || 0), 0);
  $('[data-tiles]').innerHTML = [
    [fmt(t.n), '今天使用的设备'],
    [fmt(avg7), '前 7 天日均'],
    [fmt(t.nw || 0), '今天新增'],
    [new7 ? Math.round((share7 / new7) * 100) + '%' : '—', '前 7 天新增中来自分享'],
    [ntfn ? Math.round((ntf / ntfn) * 100) + '%' : '—', '开着礼拜提醒的比例'],
    [fmt(online), '此刻在三个空间里'],
  ]
    .map(([b, s]) => `<div class="tile"><b>${esc(b)}</b><span>${esc(s)}</span></div>`)
    .join('');
  dauChart($('[data-dau]'), rows, 'n', '台设备');
  dauChart($('[data-new]'), rows, 'nw', '台新设备');
  retention($('[data-retention]'), data.days);
  for (const k of ['p', 'l', 'c', 'v', 'src', 'pk', 'ad', 'fs']) bars($(`[data-bars="${k}"]`), sumKey(rows, k), k, k === 'c' ? 15 : 10);
  // 功能使用率：用过的设备 / 上报功能的设备
  const fn = rows.reduce((s, r) => s + (r.fn || 0), 0);
  const f = sumKey(rows, 'f');
  bars($('[data-bars="f"]'), Object.fromEntries(Object.entries(f).map(([k, n]) => [k, fn ? n / fn : 0])), 'f', 20, true);
  const e = sumKey(rows, 'e');
  const errs = Object.entries(e).sort((a, b) => b[1] - a[1]).slice(0, 30);
  $('[data-errors]').innerHTML = errs.length
    ? `<table><thead><tr><th>次数</th><th>版本</th><th>平台</th><th>错误</th></tr></thead><tbody>${errs
        .map(([key, n]) => {
          const [v, p, s, ...m] = key.split('|');
          return `<tr><td>${fmt(n)}</td><td>${esc(v)}</td><td>${esc(label('p', p))}</td><td class="err-m">${esc(m.join('|'))}<br><small>${esc(s)}</small></td></tr>`;
        })
        .join('')}</tbody></table>`
    : '<p class="note">这段时间没有错误报告。</p>';
}

function bars(el, obj, k, max, pct = false) {
  const list = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  if (!list.length) {
    el.innerHTML = '<p class="note">暂无数据。</p>';
    return;
  }
  const shown = list.slice(0, max);
  const rest = list.slice(max).reduce((s, x) => s + x[1], 0);
  if (rest && !pct) shown.push(['__rest', rest]);
  const total = pct ? 1 : list.reduce((s, x) => s + x[1], 0);
  const top = Math.max(...shown.map((x) => x[1])) || 1;
  el.innerHTML = `<ul class="bars">${shown
    .map(([key, n]) => {
      const name = key === '__rest' ? '其余' : label(k, key);
      const share = pct ? `${Math.round(n * 100)}%` : `${fmt(n)}（${Math.round((n / total) * 100)}%）`;
      return `<li><span>${esc(name)}</span><span class="track"><span class="fill" data-w="${((n / top) * 100).toFixed(1)}"></span></span><span class="val">${esc(share)}</span></li>`;
    })
    .join('')}</ul>`;
  // 宽度用脚本设置（内容安全策略不允许行内样式）
  el.querySelectorAll('[data-w]').forEach((x) => (x.style.width = x.dataset.w + '%'));
}

/** 留存表：按第一次打开的那一周分组，看之后每一周平均每天还有多少比例在用 */
function retention(el, days) {
  const DAY = 864e5;
  const week = (d) => {
    const t = Date.parse(d + 'T00:00:00Z');
    return new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
  };
  const installs = {};
  for (const [d, v] of Object.entries(days)) if (v.nw) installs[week(d)] = (installs[week(d)] || 0) + v.nw;
  const cohorts = Object.keys(installs).sort().slice(-8);
  if (!cohorts.length) {
    el.innerHTML = '<p class="note">还没有新用户数据。</p>';
    return;
  }
  const head = Array.from({ length: 8 }, (_, k) => `<th>第 ${k} 周</th>`).join('');
  const body = cohorts
    .map((c) => {
      const cells = Array.from({ length: 8 }, (_, k) => {
        const start = Date.parse(c + 'T00:00:00Z') + k * 7 * DAY;
        let sum = 0;
        let n = 0;
        for (let i = 0; i < 7; i++) {
          const d = new Date(start + i * DAY).toISOString().slice(0, 10);
          if (!days[d]) continue;
          sum += (days[d].coh || {})[c] || 0;
          n++;
        }
        return n ? `<td>${Math.round((sum / n / installs[c]) * 100)}%</td>` : '<td></td>';
      }).join('');
      return `<tr><th scope="row">${esc(c)}（${fmt(installs[c])}）</th>${cells}</tr>`;
    })
    .join('');
  el.innerHTML = `<table><thead><tr><th>开始那周（人数）</th>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function dauChart(el, rows, key = 'n', unit = '台设备') {
  const W = 760, H = 220, L = 44, B = 24, T = 10, R = 8;
  const val = (r) => r[key] || 0;
  const max = Math.max(1, ...rows.map(val));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const bw = (W - L - R) / rows.length;
  const barW = Math.max(2, Math.min(24, bw - 2));
  const y = (v) => T + (H - T - B) * (1 - v / top);
  let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="每天${unit}">`;
  for (let v = 0; v <= top; v += step) svg += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
  const every = Math.ceil(rows.length / 8);
  rows.forEach((r, i) => {
    const x = L + i * bw + (bw - barW) / 2;
    const h = Math.max(0, y(0) - y(val(r)));
    const rr = Math.min(4, h / 2, barW / 2);
    // 顶端圆角、底部方角
    const top = y(val(r));
    if (h > 0) svg += `<path class="bar" data-i="${i}" d="M${x} ${y(0)}V${top + rr}Q${x} ${top} ${x + rr} ${top}H${x + barW - rr}Q${x + barW} ${top} ${x + barW} ${top + rr}V${y(0)}Z"/>`;
    svg += `<rect class="hit" data-i="${i}" x="${L + i * bw}" y="${T}" width="${bw}" height="${H - T - B}"/>`;
    if ((rows.length - 1 - i) % every === 0) svg += `<text class="axis" x="${L + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(r.d.slice(5))}</text>`;
  });
  svg += '</svg><div class="tip" hidden></div>';
  el.innerHTML = svg;
  const tip = $('.tip', el);
  el.querySelectorAll('.hit').forEach((h) => {
    h.addEventListener('mouseenter', () => {
      const i = +h.dataset.i;
      const r = rows[i];
      const box = el.getBoundingClientRect();
      const hb = h.getBoundingClientRect();
      const bar = el.querySelector(`.bar[data-i="${i}"]`);
      const barTop = bar ? bar.getBoundingClientRect().top : hb.bottom;
      tip.textContent = `${r.d}：${fmt(val(r))} ${unit}`;
      tip.style.left = hb.left - box.left + hb.width / 2 + 'px';
      tip.style.top = Math.max(24, barTop - box.top - 4) + 'px';
      tip.hidden = false;
      el.querySelectorAll('.bar').forEach((b) => b.classList.toggle('is-hover', b.dataset.i === h.dataset.i));
    });
    h.addEventListener('mouseleave', () => {
      tip.hidden = true;
      el.querySelectorAll('.bar').forEach((b) => b.classList.remove('is-hover'));
    });
  });
}
function niceStep(max) {
  const raw = max / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p);
}

// ---- 远程配置 ----
const LANG_NAMES = { zh: '中文', tg: '塔吉克语', ru: '俄语', uz: '乌兹别克语（拉丁字母）', ky: '吉尔吉斯语' };
let current = null; // 当前线上配置（清洗后）

function textInputs(prefix, val = {}, area = true) {
  return LANGS
    .map((l) => `<label>${LANG_NAMES[l]}${area ? `<textarea data-${prefix}-${l} maxlength="400">${esc(val[l] || '')}</textarea>` : `<input class="src" data-${prefix}-${l} maxlength="400" value="${esc(val[l] || '')}">`}</label>`)
    .join('');
}

function fillForm(cfg) {
  const c = cfg || { notices: [], hijri: {}, cityOffsets: {}, flags: {}, store: {} };
  const ns = $('[data-notices]');
  ns.innerHTML = [0, 1, 2]
    .map((i) => {
      const n = c.notices[i] || {};
      return `<div class="notice" data-notice="${i}">
        <label><input type="checkbox" data-n-on ${n.text ? 'checked' : ''}> 公告 ${i + 1}</label>
        <div class="row"><label>类型 <select data-n-level><option value="info">普通</option><option value="warn" ${n.level === 'warn' ? 'selected' : ''}>重要</option></select></label>
        <label>从 <input type="date" data-n-from value="${esc(n.from || '')}"></label>
        <label>到 <input type="date" data-n-until value="${esc(n.until || '')}"></label></div>
        ${textInputs('n', n.text || {})}
        <input type="hidden" data-n-id value="${esc(n.id || '')}">
      </div>`;
    })
    .join('');
  $('[data-hijri]').innerHTML = [
    ['TJ', '塔吉克斯坦'],
    ['UZ', '乌兹别克斯坦'],
    ['KG', '吉尔吉斯斯坦'],
    ['RU', '俄罗斯'],
  ]
    .map(([cc, name]) => {
      const h = c.hijri[cc] || {};
      return `<div class="notice" data-hj="${cc}"><label><input type="checkbox" data-h-on ${h.src ? 'checked' : ''}> ${name}</label>
        <label>调整 <select data-h-adj>${[-2, -1, 0, 1, 2].map((d) => `<option value="${d}" ${(h.adjust || 0) === d ? 'selected' : ''}>${d > 0 ? '+' : ''}${d} 天</option>`).join('')}</select></label>
        ${textInputs('h', h.src || {}, false)}</div>`;
    })
    .join('');
  const tb = $('[data-offsets]');
  tb.innerHTML = '';
  for (const [id, o] of Object.entries(c.cityOffsets)) addOffsetRow(id, o);
  $('[data-flags]').innerHTML = FLAGS.map((k) => `<label><input type="checkbox" data-flag="${k}" ${c.flags[k] === false ? '' : 'checked'}> ${LABELS.flags[k]}</label>`).join('');
  $('[data-min-version]').value = c.minVersion || '';
  $('[data-store-android]').value = c.store.android || '';
  $('[data-store-ios]').value = c.store.ios || '';
  updatePreview();
}

function addOffsetRow(id = '', o = {}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><select data-o-city>${CITY_NAMES.map((c) => `<option value="${esc(c.id)}" ${c.id === id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></td>
    ${PRAYERS.map((p) => `<td><input type="number" min="-30" max="30" step="1" data-o-${p} value="${Number(o[p]) || 0}"></td>`).join('')}
    <td>${LANGS.map((l) => `<input class="src" data-o-src-${l} placeholder="${LANG_NAMES[l]}" maxlength="400" value="${esc((o.src && o.src[l]) || '')}">`).join('')}</td>
    <td><button type="button" class="ghost" data-o-del>删除</button></td>`;
  $('[data-o-del]', tr).addEventListener('click', () => {
    tr.remove();
    updatePreview();
  });
  $('[data-offsets]').appendChild(tr);
}
$('[data-add-offset]').addEventListener('click', () => {
  addOffsetRow();
  updatePreview();
});

const val = (el, s) => ($(s, el) ? $(s, el).value.trim() : '');
const texts = (el, prefix) => Object.fromEntries(LANGS.map((l) => [l, val(el, `[data-${prefix}-${l}]`)]).filter(([, v]) => v));

function readForm() {
  const raw = { v: 1, issued: new Date().toISOString(), notices: [], hijri: {}, cityOffsets: {}, flags: {}, store: {} };
  for (const el of $$('[data-notice]')) {
    if (!$('[data-n-on]', el).checked) continue;
    const id = val(el, '[data-n-id]') || 'n' + Date.now().toString(36) + el.dataset.notice;
    $('[data-n-id]', el).value = id;
    raw.notices.push({ id, level: val(el, '[data-n-level]'), text: texts(el, 'n'), from: val(el, '[data-n-from]') || undefined, until: val(el, '[data-n-until]') || undefined });
  }
  for (const el of $$('[data-hj]')) {
    if ($('[data-h-on]', el).checked) raw.hijri[el.dataset.hj] = { adjust: Number(val(el, '[data-h-adj]')), src: texts(el, 'h') };
  }
  for (const tr of $$('[data-offsets] tr')) {
    const o = { src: texts(tr, 'o-src') };
    for (const p of PRAYERS) o[p] = Number(val(tr, `[data-o-${p}]`)) || 0;
    raw.cityOffsets[val(tr, '[data-o-city]')] = o;
  }
  for (const k of FLAGS) {
    const on = $(`[data-flag="${k}"]`).checked;
    if (!on) raw.flags[k] = false;
  }
  const mv = $('[data-min-version]').value.trim();
  if (mv) raw.minVersion = mv;
  const a = $('[data-store-android]').value.trim();
  const i = $('[data-store-ios]').value.trim();
  if (a) raw.store.android = a;
  if (i) raw.store.ios = i;
  return raw;
}

/** 检查表单：说出哪些内容会被手机丢弃（格式不对、缺来源等） */
function problems(raw, clean) {
  const out = [];
  if (raw.notices.length !== clean.notices.length) out.push('有公告没写文字，不会发布。');
  for (const n of clean.notices) if (!n.text.tg || !n.text.ru) out.push(`公告"${n.text.zh || n.id}"缺塔吉克语或俄语，这些用户会看到另一种语言的版本。`);
  for (const cc of Object.keys(raw.hijri)) if (!clean.hijri[cc]) out.push(`伊斯兰历（${cc}）没写依据，不会发布。`);
  for (const id of Object.keys(raw.cityOffsets)) if (!clean.cityOffsets[id]) out.push(`${CITY[id] || id} 的时间校正没写来源或分钟数超出 ±30，不会发布。`);
  if (Object.keys(raw.cityOffsets).length !== $$('[data-offsets] tr').length) out.push('同一个城市填了两行，只用最后一行。');
  if (raw.minVersion && !clean.minVersion) out.push('最低版本格式不对（例如 1.0.0）。');
  if (raw.store.android && !clean.store.android) out.push('安卓商店链接不是 Google Play 或三星商店的地址。');
  if (raw.store.ios && !clean.store.ios) out.push('苹果商店链接不是 App Store 的地址。');
  return out;
}

function updatePreview() {
  const raw = readForm();
  const clean = sanitizeConfig(raw, CITY_IDS);
  $('[data-preview]').textContent = JSON.stringify(clean, null, 2);
  const p = problems(raw, clean);
  $('[data-check]').textContent = p.join(' ');
  return { raw, clean };
}
$('[data-config-form]').addEventListener('input', updatePreview);
$('[data-config-form]').addEventListener('change', updatePreview);

async function loadConfig() {
  $('[data-current]').textContent = '读取中…';
  try {
    const r = await fetch('/config', { cache: 'no-store', credentials: 'omit' });
    const env = r.status === 200 ? await r.json() : null;
    current = env ? sanitizeConfig(JSON.parse(env.body), CITY_IDS) : null;
    $('[data-current]').textContent = current ? `线上配置发布于 ${new Date(current.issued).toLocaleString('zh-CN')}。下面是它的内容，修改后重新签名发布。` : '还没有发布过配置（手机上一切按默认）。';
    fillForm(current);
  } catch (e) {
    $('[data-current]').textContent = '读取失败：' + e.message;
  }
  try {
    const h = await (await api('/admin/api/history')).json();
    $('[data-history]').innerHTML = h.length
      ? h.map((x, i) => `<li>${esc(new Date(x.issued).toLocaleString('zh-CN'))} <button type="button" class="ghost" data-load-h="${i}">载入这一版</button></li>`).join('')
      : '<li class="note">暂无</li>';
    $$('[data-load-h]').forEach((b) =>
      b.addEventListener('click', () => {
        fillForm(sanitizeConfig(JSON.parse(h[+b.dataset.loadH].body), CITY_IDS));
        $('[data-publish-msg]').textContent = '已载入旧版内容。检查无误后签名发布，就会成为最新配置。';
        $('[data-publish-msg]').className = 'msg';
      }),
    );
  } catch (e) {
    /* 登录失效时 api() 已处理 */
  }
}

$('[data-config-form]').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('[data-publish-msg]');
  const file = $('[data-key-file]').files[0];
  msg.className = 'msg bad';
  if (!file) {
    msg.textContent = '请先选择私钥文件。';
    return;
  }
  const { clean } = updatePreview();
  if (!clean) {
    msg.textContent = '配置格式不对。';
    return;
  }
  let key;
  try {
    key = JSON.parse(await file.text());
    if (!key.d) throw new Error('not private');
  } catch (err) {
    msg.textContent = '这不是私钥文件。';
    return;
  }
  try {
    const body = JSON.stringify(clean);
    const envelope = await signBody(body, key);
    const r = await api('/admin/api/config', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(envelope) });
    const res = await r.json();
    if (r.ok) {
      msg.className = 'msg ok';
      msg.textContent = '已发布。约 5 分钟内所有手机生效。';
      loadConfig();
    } else {
      msg.textContent =
        { 'bad-signature': '签名不对：这个私钥和服务器上的公钥不是一对。', stale: '线上已有更新的配置，请刷新后再改。', 'no-public-key': '服务器还没设置公钥（CONFIG_PUBLIC_KEY）。', 'bad-config': '配置格式不对。', future: '电脑时间不对（比现在晚），请校准电脑时间后再发布。' }[res.error] || '发布失败：' + res.error;
    }
  } catch (err) {
    msg.textContent = '发布失败：' + err.message;
  }
});

// ---- 密钥 ----
$('[data-gen-keys]').addEventListener('click', async () => {
  if (!confirm('生成新密钥？如果已经有在用的密钥，换掉后需要发布新版应用。')) return;
  const { privateJwk, publicJwk } = await generateKeys();
  const blob = new Blob([JSON.stringify(privateJwk)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'masjid-config-private.jwk';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  const pre = $('[data-pubkey]');
  pre.hidden = false;
  pre.textContent = JSON.stringify(publicJwk);
});

// 两步验证密钥：在浏览器里随机生成（不经过服务器）
$('[data-gen-totp]').addEventListener('click', () => {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const b = crypto.getRandomValues(new Uint8Array(20));
  let bits = 0;
  let val = 0;
  let out = '';
  for (const x of b) {
    val = (val << 8) | x;
    bits += 8;
    while (bits >= 5) {
      out += A[(val >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  const pre = $('[data-totp-secret]');
  pre.hidden = false;
  pre.textContent = out.match(/.{1,4}/g).join(' ') + '\n\n' + `otpauth://totp/Masjid%20Admin?secret=${out}&issuer=Masjid`;
});

if (token) enter();
