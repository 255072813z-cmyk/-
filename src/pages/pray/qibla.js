// 朝向：手机上用罗盘指向麦加；电脑上看地图和角度。
import { qiblaBearing, distanceKm, compassWord, startCompass, greatCirclePoints, KAABA } from '../../core/qibla.js';
import { kaaba, ICONS, star8 } from '../../ui/art.js';
import { t } from '../../i18n/index.js';

function dial(bearing) {
  const ticks = Array.from({ length: 72 }, (_, i) => {
    const a = i * 5;
    const long = a % 30 === 0;
    return `<line x1="0" y1="${long ? -92 : -95}" x2="0" y2="-100" transform="rotate(${a})" class="${long ? 'tk-l' : 'tk'}"/>`;
  }).join('');
  const labels = [
    ['北', 0],
    ['东', 90],
    ['南', 180],
    ['西', 270],
  ]
    .map(([l, a]) => `<text transform="rotate(${a}) translate(0 -76) rotate(${-a})" class="dir ${a === 0 ? 'n' : ''}">${l}</text>`)
    .join('');
  return `<svg class="dial" viewBox="-110 -110 220 220" role="img" aria-label="朝向罗盘：与正北顺时针 ${bearing.toFixed(0)} 度">
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

async function mapSVG(city) {
  const { MAP, LAND, TAJIKISTAN, SAUDI } = await import('../../content/region-map.js');
  const px = (lon) => (lon - MAP.lonMin) * MAP.kx;
  const py = (lat) => (MAP.latMax - lat) * MAP.k;
  const line = greatCirclePoints(city.lat, city.lon)
    .map(([lon, lat], i) => `${i ? 'L' : 'M'}${px(lon).toFixed(1)} ${py(lat).toFixed(1)}`)
    .join('');
  const cx = px(city.lon);
  const cy = py(city.lat);
  return `<svg class="map" viewBox="0 0 ${MAP.width} ${MAP.height}" role="img" aria-label="从${t('city.' + city.id)}到麦加的大圆航线地图">
    <rect width="${MAP.width}" height="${MAP.height}" class="sea"/>
    <path d="${LAND}" class="land"/><path d="${TAJIKISTAN}" class="land tj"/><path d="${SAUDI}" class="land sa"/>
    <path d="${line}" class="route"/>
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="5" class="pin"/>
    <text x="${(cx + 8).toFixed(1)}" y="${(cy - 8).toFixed(1)}" class="lbl">${t('city.' + city.id)}</text>
    <circle cx="${px(KAABA.lon).toFixed(1)}" cy="${py(KAABA.lat).toFixed(1)}" r="5" class="pin mecca"/>
    <text x="${(px(KAABA.lon) + 8).toFixed(1)}" y="${(py(KAABA.lat) + 4).toFixed(1)}" class="lbl">麦加</text>
    <text x="8" y="${MAP.height - 8}" class="credit">底图：Natural Earth</text>
  </svg>`;
}

export function qiblaPage(ctx) {
  const c = ctx.city;
  const b = qiblaBearing(c.lat, c.lon);
  const km = distanceKm(c.lat, c.lon);
  const hasSensor = typeof window.DeviceOrientationEvent !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const html = `
  <div class="page qibla">
    <div class="page-head"><a class="back" href="#/pray" aria-label="返回在家礼拜">${ICONS.back}</a><h1>朝向 <span class="ar-sm" lang="ar" dir="rtl">القِبْلَة</span></h1></div>
    <div class="qibla-grid">
      <section class="card compass-card">
        <div class="bearing">
          <span class="bearing-num">${b.toFixed(1)}°</span>
          <span class="bearing-txt">从正北顺时针转 ${b.toFixed(0)}°，大约是<strong>${compassWord(b)}</strong></span>
        </div>
        <div class="dial-wrap" data-dial>${dial(b)}</div>
        <p class="turn" data-turn aria-live="polite">${hasSensor ? '点下面的按钮，打开手机罗盘' : '把手机平放，或用指南针对照上面的角度'}</p>
        ${hasSensor ? '<button class="btn btn-primary btn-wide" type="button" data-start>打开罗盘</button>' : ''}
        <p class="note">${t('city.' + c.id)} 到麦加约 ${Math.round(km).toLocaleString('zh-CN')} 公里。罗盘已按当地磁偏角（向东约 ${c.declination}°）修正为真北。</p>
      </section>
      <section class="card map-card">
        <h2 class="card-title">${star8(18)} 地图</h2>
        <div class="map-wrap" data-map><p class="note">地图加载中…</p></div>
        <p class="note">红线是地球上最短的路线（大圆航线），出发时的方向就是朝向。</p>
      </section>
    </div>
    <section class="card soft-card">
      <h2 class="card-title">${star8(18)} 罗盘用得准</h2>
      <ul class="dots">
        <li>手机平放在手心，离开电器、铁器和暖气片。</li>
        <li>指得不稳时，拿着手机在空中画几次"8"字，校准一下。</li>
        <li>罗盘差几度是正常的，大致朝向正确即可。也可以参照附近清真寺米哈拉布（壁龛）的方向。</li>
      </ul>
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
        .catch(() => {});
      const btn = el.querySelector('[data-start]');
      if (!btn) return;
      btn.addEventListener('click', () => {
        const rose = el.querySelector('[data-rose]');
        const turn = el.querySelector('[data-turn]');
        let aligned = false;
        let smooth = null;
        btn.hidden = true;
        turn.textContent = '正在读取罗盘…';
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
            turn.textContent = ok ? '已对准朝向' : rel > 0 ? `向右转 ${Math.round(rel)}°` : `向左转 ${Math.round(-rel)}°`;
            if (ok && !aligned && navigator.vibrate) navigator.vibrate(60);
            aligned = ok;
          },
          onError(why) {
            btn.hidden = false;
            turn.textContent =
              why === 'denied'
                ? '没有得到罗盘权限。可以在系统设置里允许"运动与方向"，或按上面的角度用指南针对照。'
                : '这台设备读不到罗盘。请按上面的角度，用指南针或参照附近清真寺的方向。';
          },
        });
      });
    },
    unmount() {
      if (stop) stop();
    },
  };
}
