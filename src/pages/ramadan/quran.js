// 古兰经 30 天读完：每天 1 卷（朱兹），读完打勾。只存本机。
import { JUZ, SURAH_NAMES } from '../../content/juz.js';
import { ramadanStatus } from '../../core/ramadan.js';
import { load, save } from '../../core/storage.js';
import { ICONS, star8 } from '../../ui/art.js';

export function quranPage(ctx) {
  const st = ramadanStatus(ctx.sched.today, ctx.settings.hijriAdjust);
  const key = 'quran:' + st.year;
  const todayJuz = st.active ? Math.min(30, st.day) : 0;

  const rows = (done) =>
    JUZ.map((j) => {
      const on = done.includes(j.n);
      const s = SURAH_NAMES[j.from.surah];
      const pages = j.pages[1] - j.pages[0] + 1;
      return `<li class="juz ${on ? 'is-done' : ''} ${j.n === todayJuz ? 'is-today' : ''}">
        <span class="juz-no">${j.n}</span>
        <span class="juz-main"><b>第 ${j.n} 天 · 第 ${j.n} 卷${j.n === todayJuz ? '（今天）' : ''}</b>
          <span>从第 ${j.from.surah} 章 <span lang="ar" dir="rtl">${s.ar}</span> 第 ${j.from.ayah} 节起 · 第 ${j.pages[0]}–${j.pages[1]} 页（${pages} 页）</span></span>
        <input type="checkbox" data-juz="${j.n}" ${on ? 'checked' : ''} aria-label="第 ${j.n} 卷读完了">
      </li>`;
    }).join('');

  const html = `
  <div class="page quran">
    <div class="page-head"><a class="back" href="#/ramadan" aria-label="返回斋月">${ICONS.back}</a><h1>古兰经 30 天读完</h1></div>
    <section class="card">
      <p class="lead" data-q-summary></p>
      <p class="note">每天读 1 卷，约 20 页。分在五番拜之后读，每次约 4 页，就不吃力。</p>
      <p class="note">页码按麦地那标准本（604 页）。你用的版本页码不同时，按卷数读即可。</p>
    </section>
    <section class="card"><ol class="juz-list" data-juz-list></ol>
      <button type="button" class="btn btn-ghost btn-sm" data-q-reset>全部清空，重新开始</button>
    </section>
    <section class="card soft-card">
      <h2 class="card-title">${star8(18)} 说明</h2>
      <p>这是你自己的计划，只存在这台手机上：不计分，不排名，不公开。哪天没读完，第二天接着读就好。</p>
      <p class="src">卷与页码数据：Tanzil 古兰经文本（经 alquran.cloud）</p>
    </section>
  </div>`;

  function draw(el) {
    const done = load(key, []);
    el.querySelector('[data-juz-list]').innerHTML = rows(done);
    el.querySelector('[data-q-summary]').textContent =
      done.length >= 30 ? '30 卷都读完了。愿真主接受。' : `已读 ${done.length} 卷，还有 ${30 - done.length} 卷。`;
    el.querySelectorAll('[data-juz]').forEach((cb) =>
      cb.addEventListener('change', () => {
        const cur = load(key, []).filter((n) => n !== +cb.dataset.juz);
        if (cb.checked) cur.push(+cb.dataset.juz);
        save(key, cur.sort((a, b) => a - b));
        draw(el);
        const again = el.querySelector(`[data-juz="${cb.dataset.juz}"]`);
        if (again) again.focus();
      }),
    );
  }
  return {
    html,
    mount(el) {
      draw(el);
      // 防止误触：要点两次才清空
      const reset = el.querySelector('[data-q-reset]');
      let armed = false;
      reset.addEventListener('click', () => {
        if (!armed) {
          armed = true;
          reset.textContent = '再点一次，确认清空';
          setTimeout(() => {
            armed = false;
            reset.textContent = '全部清空，重新开始';
          }, 4000);
          return;
        }
        armed = false;
        reset.textContent = '全部清空，重新开始';
        save(key, []);
        draw(el);
      });
    },
  };
}
