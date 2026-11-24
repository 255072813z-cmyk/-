// 补礼记录：以前没礼的拜，自己记个数，补一番减一番。
// 只存在这台手机上：不计分、不排名、不公开。数字是你自己估算的，拿不准就按较多的算（哈乃斐学派的谨慎做法，请教伊玛目）。
import { load, save } from '../../core/storage.js';
import { ICONS, star8 } from '../../ui/art.js';
import { t } from '../../i18n/index.js';

const KINDS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'witr'];
const MAX = 100000;

export function readQada() {
  const raw = load('qada', {});
  const out = {};
  for (const k of KINDS) {
    const v = raw && Number(raw[k]);
    out[k] = Number.isInteger(v) && v >= 0 && v <= MAX ? v : 0;
  }
  return out;
}

export function qadaPage() {
  let q = readQada();
  const row = (k) => `<li class="adj qada-row">
      <span class="adj-name">${k === 'witr' ? t('qada.witr') : t('prayer.' + k)}</span>
      <span class="adj-ctrl">
        <button type="button" class="btn-round" data-q="${k}" data-d="-1" aria-label="${t('qada.done', { name: k === 'witr' ? t('qada.witr') : t('prayer.' + k) })}">−</button>
        <output class="adj-val" data-qv="${k}">${q[k]}</output>
        <button type="button" class="btn-round" data-q="${k}" data-d="1" aria-label="${t('qada.add', { name: k === 'witr' ? t('qada.witr') : t('prayer.' + k) })}">+</button>
      </span></li>`;
  const html = `
  <div class="page qada-page">
    <div class="page-head"><a class="back" href="#/pray" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('qada.title')}</h1></div>
    <section class="card">
      <p>${t('qada.lead')}</p>
      <p class="qada-total" data-total aria-live="polite"></p>
      <ul class="adj-list">${KINDS.map(row).join('')}</ul>
      <div class="step-btns">
        <button type="button" class="btn btn-ghost btn-sm" data-bulk="day">${t('qada.addDay')}</button>
        <button type="button" class="btn btn-ghost btn-sm" data-reset>${t('qada.reset')}</button>
      </div>
    </section>
    <section class="card soft-card">
      <h2 class="card-title">${star8(18)} ${t('qada.howTitle')}</h2>
      <ul class="dots"><li>${t('qada.how.1')}</li><li>${t('qada.how.2')}</li><li>${t('qada.how.3')}</li><li>${t('qada.how.4')}</li></ul>
      <p class="src">${t('qada.hadith')}</p>
      <p class="note">${t('qada.private')}</p>
    </section>
  </div>`;

  let confirmReset = false;
  return {
    html,
    mount(el) {
      const draw = () => {
        for (const k of KINDS) el.querySelector(`[data-qv="${k}"]`).textContent = q[k];
        const sum = KINDS.reduce((s, k) => s + q[k], 0);
        el.querySelector('[data-total]').textContent = sum ? t('qada.total', { n: sum }) : t('qada.none');
      };
      const set = (next) => {
        q = next;
        save('qada', q);
        draw();
      };
      el.querySelectorAll('[data-q]').forEach((b) =>
        b.addEventListener('click', () => {
          const k = b.dataset.q;
          set({ ...q, [k]: Math.max(0, Math.min(MAX, q[k] + Number(b.dataset.d))) });
        }),
      );
      // 一整天没礼：五番拜和威特尔各加一
      el.querySelector('[data-bulk]').addEventListener('click', () => set(Object.fromEntries(KINDS.map((k) => [k, Math.min(MAX, q[k] + 1)]))));
      const reset = el.querySelector('[data-reset]');
      reset.addEventListener('click', () => {
        if (!confirmReset) {
          confirmReset = true;
          reset.textContent = t('quran.confirm');
          return;
        }
        confirmReset = false;
        reset.textContent = t('qada.reset');
        set(Object.fromEntries(KINDS.map((k) => [k, 0])));
      });
      draw();
    },
  };
}
