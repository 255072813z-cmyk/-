// 跟着做礼拜：先选哪一部分（逊奈/主命/威特尔），再一步一步跟做。
// 画面上是一排人和你做同样的动作——在家礼拜，也像站在清真寺的班里。
import { PRAYER_INFO, buildSteps, unitLabel, AFTER_PRAYER } from '../../content/prayers.js';
import { prayerRow, ICONS, star8 } from '../../ui/art.js';
import { reciteCard } from '../../ui/recite.js';
import { t } from '../../i18n/index.js';

const POSTURE_ZH = { stand: '站立', raise: '举手', ruku: '鞠躬', sujud: '叩头', sit: '坐' };

function chooser(ctx, prayerKey) {
  const info = PRAYER_INFO[prayerKey];
  const isFri = prayerKey === 'dhuhr' && ctx.sched.today.wd === 5;
  const units = info.units
    .map((u) => {
      const l = unitLabel(u);
      return `<li><a class="card card-link unit lv-${l.level}" href="#/pray/guide/${prayerKey}/${u.id}">
        <span class="unit-name">${l.name}</span><span class="unit-tag">${l.tag}</span><span class="unit-go">开始 →</span></a></li>`;
    })
    .join('');
  const total = info.units.reduce((a, u) => a + u.rakats, 0);
  return `
  <div class="page guide">
    <div class="page-head"><a class="back" href="#/pray" aria-label="返回在家礼拜">${ICONS.back}</a>
      <h1>${info.zh} <span class="ar-sm" lang="ar" dir="rtl">${info.ar}</span></h1></div>
    <section class="card row-card">${prayerRow('stand')}</section>
    <p class="lead">${info.zh}一共 ${total} 拜，按顺序礼。点一部分开始跟做：</p>
    ${isFri ? '<p class="note friday">今天是主麻日。在家礼晌礼 4 拜主命，不礼主麻的 2 拜。</p>' : ''}
    <ol class="units">${units}</ol>
    <p class="note">"必须"的部分不可缺；"圣行"是先知常做的，尽量礼；"可选"的礼了更好。</p>
    <div class="pick-grid small">${Object.keys(PRAYER_INFO)
      .map((p) => `<a class="pick ${p === prayerKey ? 'is-on' : ''}" href="#/pray/guide/${p}">${t('prayer.' + p)}</a>`)
      .join('')}</div>
  </div>`;
}

export function guidePage(ctx, prayerKey, unitId) {
  if (!PRAYER_INFO[prayerKey]) prayerKey = ctx.sched.current || ctx.sched.next;
  if (!unitId) return { html: chooser(ctx, prayerKey) };

  const { steps, label, info, unit } = buildSteps(prayerKey, unitId);
  let i = 0;
  const next = info.units[info.units.indexOf(unit) + 1];
  const html = `
  <div class="page guide">
    <div class="page-head"><a class="back" href="#/pray/guide/${prayerKey}" aria-label="返回">${ICONS.back}</a>
      <h1>${info.zh} · ${label.name}</h1></div>
    <div data-stage></div>
  </div>`;

  function finishHTML() {
    return `<section class="card done-card">
      <p class="done-ar" lang="ar" dir="rtl">تَقَبَّلَ اللَّهُ</p>
      <h2>愿真主接受你的礼拜</h2>
      <p>出拜后，可以念：</p>
      ${AFTER_PRAYER.map(reciteCard).join('')}
      <div class="step-btns">
        ${next ? `<a class="btn btn-primary" href="#/pray/guide/${prayerKey}/${next.id}">接着礼${unitLabel(next).name}</a>` : ''}
        <a class="btn ${next ? 'btn-ghost' : 'btn-primary'}" href="#/tasbih">礼拜后赞念</a>
      </div>
      <button class="btn btn-ghost btn-sm" type="button" data-restart>从头再看一遍</button>
    </section>`;
  }

  function draw(el) {
    const stage = el.querySelector('[data-stage]');
    if (i >= steps.length) {
      stage.innerHTML = finishHTML();
      stage.querySelector('[data-restart]').addEventListener('click', () => {
        i = 0;
        draw(el);
      });
      return;
    }
    const st = steps[i];
    stage.innerHTML = `
      <section class="card stepper">
        <div class="progress" aria-hidden="true"><span style="width:${((i + 1) / steps.length) * 100}%"></span></div>
        <p class="step-count">第 ${st.rakah} 拜 / 共 ${unit.rakats} 拜 · 第 ${i + 1} 步，共 ${steps.length} 步</p>
        <div class="row-stage posture-${st.posture}">${prayerRow(st.posture)}</div>
        <div class="step-head">
          <h2 class="step-title">${st.title}</h2>
          <span class="ar-sm" lang="ar" dir="rtl">${st.ar}</span>
          <span class="posture-tag">${POSTURE_ZH[st.posture]}</span>
        </div>
        <p class="how">${st.how}</p>
        ${st.women ? `<p class="note women">${st.women}</p>` : ''}
        ${st.items.map(reciteCard).join('')}
        ${st.note ? `<p class="note">${st.note}</p>` : ''}
      </section>
      <div class="step-btns sticky">
        <button class="btn btn-ghost" type="button" data-prev ${i === 0 ? 'disabled' : ''}>上一步</button>
        <button class="btn btn-primary" type="button" data-next>${i === steps.length - 1 ? '完成' : '下一步'}</button>
      </div>`;
    stage.querySelector('[data-prev]').addEventListener('click', () => go(el, -1));
    stage.querySelector('[data-next]').addEventListener('click', () => go(el, 1));
  }
  function go(el, d) {
    i = Math.max(0, Math.min(steps.length, i + d));
    draw(el);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const onKey = (e) => {
    if (e.key === 'ArrowRight') go(document.getElementById('app'), 1);
    if (e.key === 'ArrowLeft') go(document.getElementById('app'), -1);
  };
  return {
    html,
    mount(el) {
      draw(el);
      window.addEventListener('keydown', onKey);
    },
    unmount() {
      window.removeEventListener('keydown', onKey);
    },
  };
}
