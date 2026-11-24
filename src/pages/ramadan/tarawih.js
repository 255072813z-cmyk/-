// 间歇拜（泰拉威）：哈乃斐学派 20 拜，每 2 拜一出拜，共 10 组；每 4 拜后坐下稍歇。
// 记录今晚礼了几组（只存本机）。
import { load, save } from '../../core/storage.js';
import { ymdKey, addDays } from '../../core/clock.js';
import { ICONS, star8 } from '../../ui/art.js';

const SETS = 10;

export function tarawihPage(ctx) {
  // 夜里过了零点、还没到晨礼时，仍算"昨晚"
  const s = ctx.sched;
  const night = s.current === 'isha' && ctx.now < s.times.fajr ? addDays(s.today, -1) : s.today;
  const key = 'tarawih:' + ymdKey(night);
  let done = Math.min(SETS, load(key, 0));

  const html = `
  <div class="page tarawih">
    <div class="page-head"><a class="back" href="#/ramadan" aria-label="返回斋月">${ICONS.back}</a>
      <h1>间歇拜 <span class="ar-sm" lang="ar" dir="rtl">التَّرَاوِيح</span></h1></div>
    <section class="card">
      <p class="step-count">今晚（${night.m}月${night.d}日）</p>
      <div class="sets" data-sets></div>
      <p class="center" data-sets-text></p>
      <div class="step-btns">
        <a class="btn btn-primary" href="#/pray/guide/tarawih/set">跟着做这 2 拜</a>
        <button class="btn btn-ghost" type="button" data-add>礼完一组，记一下</button>
      </div>
      <div class="step-btns">
        <button class="btn btn-ghost btn-sm" type="button" data-undo>退一组</button>
        <a class="btn btn-ghost btn-sm" href="#/pray/guide/isha/witr">最后礼威特尔 3 拜</a>
      </div>
    </section>
    <section class="card">
      <h2 class="card-title">${star8(18)} 怎么礼</h2>
      <ul class="dots">
        <li>时间：宵礼主命和后 2 拜逊奈之后，威特尔之前。</li>
        <li>按哈乃斐学派共 20 拜，是强调的圣行。每 2 拜出一次拜，一共 10 组。</li>
        <li>每礼完 4 拜，坐下稍歇一会儿，可以默念赞词，也可以安静坐着。</li>
        <li>去不了清真寺时，在家礼同样可以；家里有人可以一起礼，一人领拜。</li>
        <li>念的经文：会背哪章念哪章。清真寺里通常在斋月念完整部古兰经。</li>
        <li>斋月里，威特尔在间歇拜之后礼。</li>
      </ul>
      <p class="note">依哈乃斐学派。有疑问请教当地伊玛目。</p>
    </section>
  </div>`;

  function draw(el) {
    el.querySelector('[data-sets]').innerHTML = Array.from(
      { length: SETS },
      (_, i) => `<span class="set ${i < done ? 'is-done' : ''} ${i % 2 === 1 ? 'is-rest' : ''}" aria-hidden="true">${(i + 1) * 2}</span>`,
    ).join('');
    el.querySelector('[data-sets-text]').textContent =
      done >= SETS ? '今晚 20 拜礼完了。接着礼威特尔。' : `已礼 ${done * 2} 拜，还有 ${(SETS - done) * 2} 拜${done > 0 && done % 2 === 0 ? '。礼完 4 拜了，坐下歇一会儿。' : '。'}`;
    el.querySelector('[data-add]').disabled = done >= SETS;
    el.querySelector('[data-undo]').disabled = done <= 0;
  }
  return {
    html,
    mount(el) {
      draw(el);
      el.querySelector('[data-add]').addEventListener('click', () => {
        done = Math.min(SETS, done + 1);
        save(key, done);
        draw(el);
      });
      el.querySelector('[data-undo]').addEventListener('click', () => {
        done = Math.max(0, done - 1);
        save(key, done);
        draw(el);
      });
    },
  };
}
