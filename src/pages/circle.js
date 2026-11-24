// 亲友圈页面：建圈、用邀请码加入、看亲友今天打卡了没有、发预设的提醒和祝福
import { ymdKey } from '../core/clock.js';
import { circleAvailable, myCircle, cachedState, createCircle, joinCircle, refreshCircle, nudge, setHide, setLock, removeMember, leaveCircle } from '../core/circle.js';
import { shareText, shareLink } from '../core/share.js';
import { ICONS, star8 } from '../ui/art.js';
import { t } from '../i18n/index.js';
import { esc } from '../i18n/format.js';

const KINDS = ['remind', 'dua', 'salam', 'congrats'];
const ERR = { full: 'circle.errFull', locked: 'circle.errCode', 'no-circle': 'circle.errCode', bad: 'circle.errNick', net: 'circle.errNet', limit: 'circle.limit' };
const errText = (e) => t(ERR[e] || 'circle.errNet');

function inviteFromUrl() {
  try {
    const m = /[?&]circle=([A-Za-z0-9]{10})\b/.exec(location.search || '');
    return m ? m[1].toUpperCase() : '';
  } catch (e) {
    return '';
  }
}

function joinedHTML(st, today, yesterday) {
  const me = myCircle() || {};
  const done = (m) => m.day === today; // 亲友所在时区不同，按各自的日期算
  const count = st.members.filter(done).length;
  const inbox = st.inbox.length
    ? `<section class="card circle-inbox" aria-live="polite"><h2 class="card-title">${star8(18)} ${t('circle.inbox')}</h2>
        <ul class="dots">${st.inbox.map((x) => `<li>${t('circle.from', { nick: esc(x.nick), text: t('circle.nudge.' + x.kind) })}</li>`).join('')}</ul></section>`
    : '';
  const rows = st.members
    .map(
      (m) => `<li class="cm ${done(m) ? 'is-done' : ''}">
        <span class="cm-dot" aria-hidden="true"></span>
        <span class="cm-name">${esc(m.nick)}${m.me ? ` <small>${t('circle.me')}</small>` : ''}${m.owner ? ` <small class="cm-owner">${t('circle.owner')}</small>` : ''}</span>
        <span class="cm-state">${done(m) ? t('circle.today') : t('circle.notYet')}${m.streak != null && m.streak > 0 ? ` · ${t('streak.days', { n: m.streak })}` : m.streak == null ? ` · ${t('circle.hidden')}` : ''}</span>
        ${m.me ? '' : `<span class="cm-acts">${KINDS.map((k) => `<button type="button" class="btn btn-ghost btn-xs" data-nudge="${m.mid}" data-kind="${k}">${t('circle.nudge.' + k)}</button>`).join('')}${st.owner ? `<button type="button" class="btn btn-ghost btn-xs cm-remove" data-remove="${m.mid}">${t('circle.remove')}</button>` : ''}</span>`}
      </li>`,
    )
    .join('');
  return `${inbox}
    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('circle.members')}</h2>
      <p class="circle-count">${t('circle.countLine', { n: count, all: st.members.length })}</p>
      <ul class="circle-list">${rows}</ul>
      <p class="note" data-circle-msg aria-live="polite"></p>
    </section>
    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('circle.invite')}</h2>
      <p class="circle-code" aria-label="${t('circle.code')}">${esc(st.code)}</p>
      <button type="button" class="btn btn-primary" data-invite>${t('circle.inviteBtn')}</button>
      ${st.owner ? `<label class="switch-row"><span><b>${t('circle.lock')}</b></span><input type="checkbox" data-lock ${st.locked ? 'checked' : ''}></label>` : ''}
    </section>
    <section class="card">
      <label class="switch-row"><span><b>${t('circle.hide')}</b></span><input type="checkbox" data-hide ${me.hide ? 'checked' : ''}></label>
      <button type="button" class="btn btn-ghost btn-sm" data-leave>${t('circle.leave')}</button>
    </section>`;
}

function startHTML() {
  const code = inviteFromUrl();
  return `<section class="card">
      <p>${t('circle.lead')}</p>
      <p class="note">${t('circle.privacy')}</p>
      <label class="field">${t('circle.nick')}<input data-nick maxlength="20" autocomplete="nickname" enterkeyhint="done"></label>
    </section>
    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('circle.joinTitle')}</h2>
      <label class="field">${t('circle.code')}<input data-code maxlength="12" autocapitalize="characters" autocomplete="off" value="${esc(code)}"></label>
      <button type="button" class="btn btn-primary" data-join>${t('circle.join')}</button>
    </section>
    <section class="card">
      <h2 class="card-title">${star8(18)} ${t('circle.createTitle')}</h2>
      <button type="button" class="btn btn-ghost" data-create>${t('circle.create')}</button>
    </section>
    <p class="note center" data-circle-msg aria-live="polite"></p>`;
}

export function circlePage(ctx) {
  const today = ymdKey(ctx.sched.today);
  const y = ctx.sched.today;
  const yesterday = new Date(Date.UTC(y.y, y.m - 1, y.d) - 864e5).toISOString().slice(0, 10);
  const head = `<div class="page-head"><a class="back" href="#/streak" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('circle.title')}</h1></div>`;
  if (!circleAvailable()) return { html: `<div class="page circle-page">${head}<section class="card"><p>${t('circle.lead')}</p><p class="note">${t('circle.offline')}</p></section></div>` };
  const mine = myCircle();
  const cached = mine && mine.code ? cachedState() : null;
  const html = `<div class="page circle-page">${head}<div data-circle-body>${cached ? joinedHTML(cached, today, yesterday) : mine && mine.code ? `<p class="loading">${t('circle.loading')}</p>` : startHTML()}</div></div>`;

  function bind(el) {
    const body = el.querySelector('[data-circle-body]');
    const msg = (k) => {
      const m = body.querySelector('[data-circle-msg]');
      if (m) m.textContent = k;
    };
    const draw = (st) => {
      body.innerHTML = st ? joinedHTML(st, today, yesterday) : startHTML();
      bind(el);
    };
    const nickOk = () => {
      const n = (body.querySelector('[data-nick]') || {}).value || '';
      if (!n.trim() || [...n.trim()].length > 20) {
        msg(t('circle.errNick'));
        return null;
      }
      return n.trim();
    };
    const create = body.querySelector('[data-create]');
    if (create)
      create.addEventListener('click', async () => {
        const nick = nickOk();
        if (!nick) return;
        create.disabled = true;
        const r = await createCircle(nick);
        create.disabled = false;
        r.ok ? draw(r.data) : msg(errText(r.error));
      });
    const join = body.querySelector('[data-join]');
    if (join)
      join.addEventListener('click', async () => {
        const nick = nickOk();
        if (!nick) return;
        join.disabled = true;
        const r = await joinCircle(body.querySelector('[data-code]').value, nick);
        join.disabled = false;
        r.ok ? draw(r.data) : msg(errText(r.error));
      });
    body.querySelectorAll('[data-nudge]').forEach((b) =>
      b.addEventListener('click', async () => {
        b.disabled = true;
        const r = await nudge(b.dataset.nudge, b.dataset.kind);
        msg(r.ok ? t('circle.sent') : errText(r.error));
        if (navigator.vibrate && r.ok) navigator.vibrate(20);
      }),
    );
    body.querySelectorAll('[data-remove]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (b.dataset.sure !== '1') {
          b.dataset.sure = '1';
          b.textContent = t('quran.confirm');
          return;
        }
        const r = await removeMember(b.dataset.remove);
        r.ok ? draw(r.data) : msg(errText(r.error));
      }),
    );
    const invite = body.querySelector('[data-invite]');
    if (invite)
      invite.addEventListener('click', async () => {
        const st = cachedState();
        const link = shareLink(ctx.remote);
        const withCode = link ? link + (link.includes('?') ? '&' : '?') + 'circle=' + st.code : '';
        const r = await shareText(t('circle.inviteMsg', { app: t('app.name'), code: st.code, link: withCode }).trim());
        if (r === 'copied') msg(t('times.copied'));
      });
    const lock = body.querySelector('[data-lock]');
    if (lock) lock.addEventListener('change', async () => (await setLock(lock.checked)).ok || msg(t('circle.errNet')));
    const hide = body.querySelector('[data-hide]');
    if (hide) hide.addEventListener('change', async () => (await setHide(hide.checked)).ok || msg(t('circle.errNet')));
    const leave = body.querySelector('[data-leave]');
    if (leave)
      leave.addEventListener('click', async () => {
        if (leave.dataset.sure !== '1') {
          leave.dataset.sure = '1';
          leave.textContent = t('circle.leaveConfirm');
          return;
        }
        await leaveCircle();
        draw(null);
      });
  }

  return {
    html,
    mount(el) {
      bind(el);
      if (mine && mine.code)
        refreshCircle(today).then((r) => {
          const body = el.querySelector('[data-circle-body]');
          if (!body) return;
          if (r.ok) {
            body.innerHTML = joinedHTML(r.data, today, yesterday);
            bind(el);
          } else if (r.error !== 'net') {
            body.innerHTML = startHTML();
            bind(el);
          } else if (!cachedState()) body.innerHTML = `<p class="note center">${t('circle.errNet')}</p>`;
        });
    },
  };
}
