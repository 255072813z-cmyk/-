// 朝向：手机上用罗盘指向麦加；电脑上看地图和角度。
import { qiblaBearing, distanceKm, compassPoint, startCompass, greatCirclePoints, KAABA } from '../../core/qibla.js';
import { kaaba, ICONS, star8 } from '../../ui/art.js';
import { t, getLang, LANGS } from '../../i18n/index.js';
import { cityName } from '../../i18n/format.js';

function dial(bearing) {
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const a = i * 5;
    const long = a % 30 === 0;
    return `<line x1="0" y1="${long ? -92 : -95}" x2="0" y2="-100" transform="rotate(${a})" class="${long ? 'tk-l' : 'tk'}"/>`;
  }).join('');
  const labels = [
    [t('qibla.n'), 0],
    [t('qibla.e'), 90],
    [t('qibla.s'), 180],
    [t('qibla.w'), 270],
  ]
    .map(([l, a]) => `<text transform="rotate(${a}) translate(0 -76) rotate(${-a})" class="dir ${a === 0 ? 'n' : ''}">${l}</text>`)
    .join('');
  return `<svg class="dial" viewBox="-110 -110 220 220" role="img" aria-label="${t('qibla.dialAria', { deg: bearing.toFixed(0) })}">
    <circle r="104" class="ring"/>
    <g class="rose" data-rose>
      ${ticks}${labels}
      <path d="M0 -100A100 100 0 0 1 ${(100 * Math.sin((bearing * Math.PI) / 180)).toFixed(1)} ${(-100 * Math.cos((bearing * Math.PI) / 180)).toFixed(1)}" class="arc"/>
      <g transform="rotate(${bearing})">
        <path d="M0 -58L9 0L0 -8L-9 0Z" class="needle"/>
        <g transform="translate(-13 -94)"><foreignObject width="26" height="26">${kaaba(26)}</foreignObject></g>
      </g>
    </g>
    <path d="M0 -106L6 -96H-6Z" class="lubber"/>
    <circle r="5" class="hub"/>
  </svg>`;
}

// 中亚的城市用中亚—阿拉伯半岛小图（看得清）；俄罗斯等更远的地方用大图
const inRegion = (c) => c.lon >= 32 && c.lon <= 78 && c.lat >= 14 && c.lat <= 45;

async function mapSVG(city) {
  const { MAP, LAND, HOME, SAUDI } = await (inRegion(city) ? import('../../content/region-map.js') : import('../../content/wide-map.js'));
  const px = (lon) => (lon - MAP.lonMin) * MAP.kx;
  const py = (lat) => (MAP.latMax - lat) * MAP.k;
  const line = greatCirclePoints(city.lat, city.lon)
    .map(([lon, lat], i) => `${i ? 'L' : 'M'}${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`)
    .join('');
  const cx = px(city.lon);
  const cy = py(city.lat);
  const flip = cx > MAP.width * 0.65; // 靠右边的城市，名字写在点的左边，免得出界
  return `<svg class="map" viewBox="0 0 ${MAP.width} ${MAP.height}" role="img" aria-label="${t('qibla.mapAria', { city: cityName(city) })}">
    <rect width="${MAP.width}" height="${MAP.height}" class="sea"/>
    <path d="${LAND}" class="land"/><path d="${HOME}" class="land tj"/><path d="${SAUDI}" class="land sa"/>
    <path d="${line}" class="route"/>
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" class="pin"/>
    <text x="${(cx + (flip ? -8 : 8)).toFixed(1)}" y="${(cy - 8).toFixed(1)}" class="lbl"${flip ? ' text-anchor="end"' : ''}>${city.id === 'here' ? t('city.here') : cityName(city)}</text>
    <circle cx="${px(KAABA.lon).toFixed(1)}" cy="${py(KAABA.lat).toFixed(1)}" r="5" class="pin mecca"/>
    <text x="${(px(KAABA.lon) + 8).toFixed(1)}" y="${(py(KAABA.lat) + 4).toFixed(1)}" class="lbl">${t('qibla.mecca')}</text>
    <text x="8" y="${MAP.height - 8}" class="credit">${t('qibla.credit')}</text>
  </svg>`;
}

export function qiblaPage(ctx) {
  const c = ctx.city;
  const b = qiblaBearing(c.lat, c.lon);
  const km = distanceKm(c.lat, c.lon);
  const hasSensor = typeof window.DeviceOrientationEvent !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const html = `
  <div class="page qibla">
    <div class="page-head"><a class="back" href="#/pray" aria-label="${t('common.back')}">${ICONS.back}</a><h1>${t('qibla.title')} <span class="ar-sm" lang="ar" dir="rtl">القِبْلَة</span></h1></div>
    <div class="qibla-grid">
      <section class="card compass-card">
        <div class="bearing">
          <span class="bearing-num">${b.toFixed(1)}°</span>
          <span class="bearing-txt">${t('qibla.bearing', { deg: b.toFixed(0), dir: `<strong>${t('compass.' + compassPoint(b))}</strong>` })}</span>
        </div>
        <div class="dial-wrap" data-dial>${dial(b)}</div>
        <p class="turn" data-turn aria-live="polite">${hasSensor ? t('qibla.tapStart') : t('qibla.noSensor')}</p>
        ${hasSensor ? `<button class="btn btn-primary btn-wide" type="button" data-start>${t('qibla.start')}</button>` : ''}
        <p class="note">${t(c.declination < 0 ? 'qibla.distanceW' : 'qibla.distance', { city: cityName(c), km: Math.round(km).toLocaleString(LANGS[getLang()].locale), decl: Math.abs(c.declination) })}</p>
        ${c.id === 'here' && c.nearKm > 150 ? `<p class="note">${t('city.farNote', { name: t('city.' + c.near), km: c.nearKm.toLocaleString(LANGS[getLang()].locale) })}</p>` : ''}
      </section>
      <section class="card map-card">
        <h2 class="card-title">${star8(18)} ${t('qibla.map')}</h2>
        <div class="map-wrap" data-map><p class="note">${t('common.loading')}</p></div>
        <p class="note">${t('qibla.mapNote')}</p>
      </section>
    </div>
    <section class="card soft-card">
      <h2 class="card-title">${star8(18)} ${t('qibla.tipsTitle')}</h2>
      <ul class="dots"><li>${t('qibla.tip1')}</li><li>${t('qibla.tip2')}</li><li>${t('qibla.tip3')}</li></ul>
    </section>
  </div>`;

  let stop = null;
  return {
    html,
    mount(el) {
      mapSVG(c)
        .then((svg) => {
          const m = el.querySelector('[data-map]');
          if (m) m.innerHTML = svg;
        })
        .catch(() => {
          const m = el.querySelector('[data-map]');
          if (m) m.innerHTML = `<p class="note">${t('common.offlineMissing')}</p>`;
        });
      const btn = el.querySelector('[data-start]');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const rose = el.querySelector('[data-rose]');
        const turn = el.querySelector('[data-turn]');
        let aligned = false;
        let smooth = null;
        btn.hidden = true;
        turn.textContent = t('qibla.reading');
        stop = startCompass({
          onHeading(mag) {
            const heading = (mag + c.declination + 360) % 360; // 磁北 → 真北
            // 平滑一下，避免指针乱抖
            if (smooth == null) smooth = heading;
            let d = heading - smooth;
            if (d > 180) d -= 360;
            if (d < -180) d += 360;
            smooth = (smooth + d * 0.25 + 360) % 360;
            rose.setAttribute('transform', `rotate(${(-smooth).toFixed(1)})`);
            let rel = b - smooth;
            if (rel > 180) rel -= 360;
            if (rel < -180) rel += 360;
            const ok = Math.abs(rel) <= 5;
            el.querySelector('.compass-card').classList.toggle('is-aligned', ok);
            turn.textContent = ok ? t('qibla.aligned') : rel > 0 ? t('qibla.right', { deg: Math.round(rel) }) : t('qibla.left', { deg: Math.round(-rel) });
            if (ok && !aligned && navigator.vibrate) navigator.vibrate(60);
            aligned = ok;
          },
          onError(why) {
            btn.hidden = false;
            turn.textContent =
              why === 'denied' ? t('qibla.denied') : t('qibla.noData');
          },
        });
      });
    },
    unmount() {
      if (stop) stop();
    },
  };
}
