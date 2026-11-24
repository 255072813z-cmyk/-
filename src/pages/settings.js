// 设置：字号、提醒、按清真寺微调时间、伊斯兰历调整。全部只存在本机。
import { getSettings, setSettings } from '../core/settings.js';
import { unlockAudio, playChime } from '../core/chime.js';
import { timesFor } from '../core/prayer-times.js';
import { fmtHM } from '../core/clock.js';
import { PRAYERS } from '../core/prayer-times.js';
import { toHijri, HIJRI_MONTHS } from '../core/hijri.js';
import { ICONS, star8 } from '../ui/art.js';
import { t } from '../i18n/index.js';

export function settingsPage(ctx) {
  const s = getSettings();
  const base = timesFor(ctx.city, ctx.sched.today);
  const h = toHijri(ctx.sched.today, s.hijriAdjust);
  const fs = ['标准', '大', '特大'];
  const html = `
  <div class="page settings">
    <div class="page-head"><a class="back" href="#/" aria-label="返回首页">${ICONS.back}</a><h1>设置</h1></div>

    <section class="card">
      <h2 class="card-title">${star8(18)} 字的大小</h2>
      <div class="segmented big" role="group" aria-label="字的大小">
        ${fs.map((n, i) => `<button type="button" class="seg ${s.fontScale === i ? 'is-on' : ''}" data-fs="${i}" aria-pressed="${s.fontScale === i}" style="font-size:${1 + i * 0.12}em">${n}</button>`).join('')}
      </div>
    </section>

    <section class="card">
      <h2 class="card-title">${star8(18)} 到时间提醒</h2>
      <label class="switch-row"><span><b>页面上轻轻提示一次</b><small>网页开着时，到点出现一条安静的提示</small></span>
        <input type="checkbox" data-remind ${s.remind ? 'checked' : ''}></label>
      <label class="switch-row"><span><b>提示时响一声</b><small>默认静音。打开后会先试听一声</small></span>
        <input type="checkbox" data-sound ${s.sound ? 'checked' : ''}></label>
    </section>

    <section class="card">
      <h2 class="card-title">${star8(18)} 按我们清真寺的时间微调</h2>
      <p class="note">如果你常去的清真寺公布的时间和这里不同，可以按分钟调整，以后都按你的调整显示。（${t('city.' + ctx.city.id)}，今天）</p>
      <ul class="adj-list">
        ${PRAYERS.map((p) => {
          const v = Number(s.offsets[p]) || 0;
          return `<li class="adj">
            <span class="adj-name">${t('prayer.' + p)}</span>
            <span class="adj-base">计算 ${fmtHM(base[p])}</span>
            <span class="adj-ctrl">
              <button type="button" class="btn-round" data-adj="${p}" data-d="-1" aria-label="${t('prayer.' + p)}提前 1 分钟">−</button>
              <output class="adj-val">${v > 0 ? '+' : ''}${v} 分</output>
              <button type="button" class="btn-round" data-adj="${p}" data-d="1" aria-label="${t('prayer.' + p)}推后 1 分钟">+</button>
            </span>
            <span class="adj-res">显示 <b>${fmtHM(new Date(base[p].getTime() + v * 60000))}</b></span>
          </li>`;
        }).join('')}
      </ul>
      <button type="button" class="btn btn-ghost btn-sm" data-adj-reset>全部恢复为计算时间</button>
    </section>

    <section class="card">
      <h2 class="card-title">${star8(18)} 伊斯兰历</h2>
      <p>今天：${h.y} 年 ${HIJRI_MONTHS[h.m - 1].zh} ${h.d} 日</p>
      <p class="note">日期为天文推算（${h.source === 'umalqura' ? '乌姆古拉历法' : '算术历法'}），实际以当地宗教机构宣布为准。如果当地宣布的日期不同，可以在这里调整：</p>
      <div class="segmented" role="group" aria-label="伊斯兰历调整">
        ${[-2, -1, 0, 1, 2].map((d) => `<button type="button" class="seg ${s.hijriAdjust === d ? 'is-on' : ''}" data-hj="${d}" aria-pressed="${s.hijriAdjust === d}">${d > 0 ? '+' : ''}${d} 天</button>`).join('')}
      </div>
    </section>

    <section class="card">
      <h2 class="card-title">${star8(18)} 语言</h2>
      <p>中文。塔吉克语、俄语以后加。</p>
    </section>

    <p class="privacy">${t('privacy')}</p>
  </div>`;

  return {
    html,
    mount(el) {
      el.querySelectorAll('[data-fs]').forEach((b) => b.addEventListener('click', () => setSettings({ fontScale: +b.dataset.fs })));
      el.querySelector('[data-remind]').addEventListener('change', (e) => setSettings({ remind: e.target.checked }));
      el.querySelector('[data-sound]').addEventListener('change', (e) => {
        if (e.target.checked) {
          unlockAudio();
          playChime();
        }
        setSettings({ sound: e.target.checked });
      });
      el.querySelectorAll('[data-adj]').forEach((b) =>
        b.addEventListener('click', () => {
          const cur = getSettings().offsets;
          const p = b.dataset.adj;
          const v = Math.max(-30, Math.min(30, (Number(cur[p]) || 0) + Number(b.dataset.d)));
          setSettings({ offsets: { ...cur, [p]: v } });
          const again = document.querySelector(`[data-adj="${p}"][data-d="${b.dataset.d}"]`);
          if (again) again.focus();
        }),
      );
      el.querySelector('[data-adj-reset]').addEventListener('click', () =>
        setSettings({ offsets: { fajr: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 } }),
      );
      el.querySelectorAll('[data-hj]').forEach((b) => b.addEventListener('click', () => setSettings({ hijriAdjust: +b.dataset.hj })));
    },
  };
}
