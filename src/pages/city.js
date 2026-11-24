// 选择城市：搜索、按国家分组；也可以"用我的位置"（只在手机上计算，不上传）。
// 很多用户在俄罗斯打工，城市名用自己的语言搜；也可以输入拉丁字母（如 kazan）。
import { setSettings } from '../core/settings.js';
import { CITIES, CITY_GROUPS } from '../core/cities.js';
import { fmtHM } from '../core/clock.js';
import { locate } from '../core/location.js';
import { ICONS, star8 } from '../ui/art.js';
import { t } from '../i18n/index.js';
import { cityName } from '../i18n/format.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[\s\-·.]/g, '');

function backHref(ctx) {
  const p = ctx.prevPath;
  return p && p !== 'city' ? '#/' + p : '#/';
}

function row(ctx, id, showTime) {
  const c = CITIES[id];
  const on = ctx.city.id === id;
  return `<li><button type="button" class="city-item ${on ? 'is-on' : ''}" data-pick="${id}" data-q="${esc(norm(t('city.' + id)) + ' ' + id)}" aria-pressed="${on}">
    <span class="city-item-name">${t('city.' + id)}</span>
    ${showTime ? `<span class="city-item-time" data-tz="${c.utcOffset}">${t('city.nowTime', { time: fmtHM(ctx.now, c.utcOffset) })}</span>` : ''}
    ${on ? `<span class="prow-badge">${t('city.current')}</span>` : ''}
  </button></li>`;
}

export function cityPage(ctx) {
  const here = ctx.city.id === 'here';
  const html = `
  <div class="page city-page">
    <div class="page-head"><a class="back" href="${backHref(ctx)}" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('city.title')}</h1></div>

    <section class="card here-card">
      ${here ? `<p class="here-now"><b>${cityName(ctx.city)}</b> · ${t('city.nowTime', { time: fmtHM(ctx.now) })}</p>` : ''}
      <button type="button" class="btn ${here ? 'btn-ghost' : 'btn-primary'} btn-wide" data-locate>${t(here ? 'city.updateHere' : 'city.useHere')}</button>
      <p class="note" data-locate-msg aria-live="polite">${t('city.hereSub')}</p>
    </section>

    <label class="city-search">
      <span class="sr-only">${t('city.search')}</span>
      <input type="search" data-search placeholder="${t('city.search')}" autocomplete="off" enterkeyhint="search">
    </label>

    ${CITY_GROUPS.map((g) => {
      const tz = new Set(g.ids.map((id) => CITIES[id].utcOffset));
      const one = tz.size === 1 ? [...tz][0] : null;
      return `<section class="card city-group" data-group>
        <h2 class="card-title">${star8(18)} ${t('city.group' + g.cc)}${one != null ? `<span class="city-item-time group-time" data-tz="${one}">${t('city.nowTime', { time: fmtHM(ctx.now, one) })}</span>` : ''}</h2>
        <ul class="city-list">${g.ids.map((id) => row(ctx, id, one == null)).join('')}</ul>
      </section>`;
    }).join('')}
    <p class="note center" data-empty hidden>${t('city.searchEmpty')}</p>
  </div>`;

  const done = () => {
    location.hash = backHref(ctx);
  };

  return {
    html,
    mount(el) {
      el.querySelectorAll('[data-pick]').forEach((b) =>
        b.addEventListener('click', () => {
          setSettings({ city: b.dataset.pick });
          done();
        }),
      );
      const input = el.querySelector('[data-search]');
      input.addEventListener('input', () => {
        const q = norm(input.value.trim());
        let shown = 0;
        el.querySelectorAll('[data-group]').forEach((g) => {
          let n = 0;
          g.querySelectorAll('[data-pick]').forEach((b) => {
            const ok = !q || b.dataset.q.includes(q);
            b.parentElement.hidden = !ok;
            if (ok) n++;
          });
          g.hidden = n === 0;
          shown += n;
        });
        el.querySelector('[data-empty]').hidden = shown > 0;
      });
      const btn = el.querySelector('[data-locate]');
      const msg = el.querySelector('[data-locate-msg]');
      btn.addEventListener('click', () => {
        btn.disabled = true;
        msg.textContent = t('city.locating');
        locate()
          .then((loc) => {
            setSettings({ city: 'here', loc });
            done();
          })
          .catch((e) => {
            btn.disabled = false;
            msg.textContent = t(e && e.code === 1 ? 'city.denied' : e && e.message === 'unsupported' ? 'city.unsupported' : 'city.failed');
          });
      });
    },
    tick(c) {
      // update each city's local time once a minute
      if (c.now.getUTCSeconds() !== 0) return;
      document.querySelectorAll('[data-tz]').forEach((el) => {
        el.textContent = t('city.nowTime', { time: fmtHM(c.now, Number(el.dataset.tz)) });
      });
    },
  };
}
