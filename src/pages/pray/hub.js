// 在家礼拜（冬季模式的核心）：去不了清真寺的日子，从这里开始。
import { homeInterior, star8 } from '../../ui/art.js';
import { isWinter } from '../home.js';
import { PRAYER_INFO } from '../../content/prayers.js';
import { fmtHM } from '../../core/clock.js';
import { t } from '../../i18n/index.js';

export function hubPage(ctx) {
  const s = ctx.sched;
  const target = s.current || s.next;
  const name = t('prayer.' + target);
  const friday =
    s.today.wd === 5
      ? `<p class="note friday">今天是主麻日。去不了清真寺的人（大雪、严寒、生病等），在家礼晌礼 4 拜主命，不礼主麻的 2 拜。</p>`
      : '';
  const html = `
  <div class="page hub">
    <section class="interior-wrap">${homeInterior({ winter: isWinter(ctx) })}</section>
    <section class="hub-intro">
      <h1>在家礼拜</h1>
      <p>去不了清真寺的日子，在家按时礼拜，同样有效。</p>
      <p class="soft">同一番拜的时间里，全城的穆斯林都朝着同一个方向礼拜。你在家里，也站在这一班里。</p>
      ${friday}
    </section>

    <ol class="steps-nav">
      <li><a class="card card-link step-link" href="#/pray/wudu">
        <span class="step-no">1</span><span class="step-t">小净</span><span class="step-s">一步一步跟着做，冬天可以用温水</span></a></li>
      <li><a class="card card-link step-link" href="#/qibla">
        <span class="step-no">2</span><span class="step-t">找朝向</span><span class="step-s">手机罗盘指向麦加</span></a></li>
      <li><a class="card card-link step-link is-main" href="#/pray/guide/${target}">
        <span class="step-no">3</span><span class="step-t">跟着做${name}</span>
        <span class="step-s">${s.current ? '现在正是' + name + '时间' : '下一番 ' + fmtHM(s.nextTime)} · 每一步都有念词</span></a></li>
      <li><a class="card card-link step-link" href="#/tasbih">
        <span class="step-no">4</span><span class="step-t">礼拜后赞念</span><span class="step-s">33 遍一组，只给自己记</span></a></li>
    </ol>

    <section class="card">
      <h2 class="card-title">${star8(18)} 选别的拜</h2>
      <div class="pick-grid">
        ${Object.keys(PRAYER_INFO)
          .map(
            (p) =>
              `<a class="pick ${p === target ? 'is-on' : ''}" href="#/pray/guide/${p}"><span>${t('prayer.' + p)}</span><span class="ar-sm" lang="ar" dir="rtl">${PRAYER_INFO[p].ar}</span></a>`,
          )
          .join('')}
      </div>
    </section>

    <section class="card soft-card">
      <h2 class="card-title">${star8(18)} 和家人一起</h2>
      <p>家里有人可以一起礼拜：一人在前面领拜，其他人在后面跟随。孩子站在大人身边，跟着学。</p>
      <p class="note">本站内容按哈乃斐学派整理，念词都标了出处。有疑问，请请教当地伊玛目。</p>
    </section>
  </div>`;
  return { html };
}
