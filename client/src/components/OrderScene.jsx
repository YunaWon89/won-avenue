import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Small animated scenes on the order page:
 *   preparing        -> three little chefs in a hanok kitchen
 *   out_for_delivery -> a courier on a scooter riding along an illustrated map (not real GPS)
 *   delivered        -> the courier waving at a hanok gate
 * Pure SVG + CSS; the markup is static (no user data). Colours follow the theme (--sc-* variables).
 * Animations stop when the page is hidden and are off for "reduce motion".
 */
const C = { line: '#7a5a35', cream: '#fffaf2', skin: '#f3cfa8', cheek: '#f2a093', navy: '#34466e', navy2: '#26354f', red: '#d0573f', gold: '#c99a3e', gold2: '#e8c77e', pan: '#3b3631', green: '#5fae63', jeon: '#e9b44c', soup: '#c9553b', tire: '#2a2018' };
const sw = 'stroke-linecap="round" stroke-linejoin="round"';
const twinkle = (x, y, i) => `<path class="sc-a" style="transform-origin:center;animation:scTwinkle 2.2s ease-in-out infinite ${i * 0.5}s" d="M${x} ${y - 5} l 1.5 3.5 l 3.5 1.5 l -3.5 1.5 l -1.5 3.5 l -1.5 -3.5 l -3.5 -1.5 l 3.5 -1.5 Z" fill="${C.gold2}"/>`;

function chef(x, y, kind, delay = 0) {
  const face = {
    taste: `<path d="M-7 -41 q 3 -3 6 0 M2 -41 q 3 -3 6 0" fill="none" stroke="${C.line}" stroke-width="1.6" ${sw}/><path d="M-3 -34 q 3 2.5 6 0" fill="none" stroke="${C.line}" stroke-width="1.4" ${sw}/>`,
    flip: `<g class="sc-a" style="transform-origin:center;animation:scBlink 4s infinite ${delay}s"><circle cx="-4.5" cy="-41" r="1.9" fill="${C.line}"/><circle cx="4.5" cy="-41" r="1.9" fill="${C.line}"/></g><path d="M-4 -34 q 4 4 8 0" fill="${C.red}" stroke="${C.line}" stroke-width="1.2" ${sw}/>`,
    chop: `<g class="sc-a" style="transform-origin:center;animation:scBlink 5s infinite 1s"><circle cx="-4.5" cy="-41" r="1.9" fill="${C.line}"/><circle cx="4.5" cy="-41" r="1.9" fill="${C.line}"/></g><path d="M-5 -35.5 q 5 6 10 0 Z" fill="${C.soup}" stroke="${C.line}" stroke-width="1.2" stroke-linejoin="round"/><path d="M-3.5 -34.8 h 7" stroke="#fff" stroke-width="1.2" opacity=".85"/>`,
  }[kind];
  const arms = {
    taste: `
      <path d="M-11 -18 q -6 6 -4 12" fill="none" stroke="${C.cream}" stroke-width="6" ${sw}/>
      <g class="sc-a" style="transform-origin:0% 100%;animation:scSway 2.4s ease-in-out infinite ${delay}s">
        <path d="M10 -20 q 7 -3 6 -11" fill="none" stroke="${C.cream}" stroke-width="6" ${sw}/>
        <path d="M7 -39 h 13 l -1.6 8.5 q -4.9 3.2 -9.8 0 Z" fill="${C.cream}" stroke="${C.line}" stroke-width="1.2" stroke-linejoin="round"/>
        <line x1="7.5" y1="-36.5" x2="19.5" y2="-36.5" stroke="${C.gold}" stroke-width="1.2"/>
        <circle cx="16" cy="-29" r="3" fill="${C.skin}" stroke="${C.line}" stroke-width=".8"/>
        ${[0, 0.6].map((d, i) => `<path class="sc-a" style="animation:scSteam 1.6s ease-out infinite ${d}s" d="M${11 + i * 5} -42 q 2 -3 0 -6 q -2 -3 0 -6" fill="none" stroke="#cdbfa9" stroke-width="1.4" ${sw}/>`).join('')}
      </g>
      <path class="sc-a" style="animation:scHeart 2.4s ease-out infinite ${delay}s" d="M22 -56 c -3 -4 -9 -1 -6 4 l 6 6 l 6 -6 c 3 -5 -3 -8 -6 -4 Z" fill="${C.red}"/>`,
    flip: `
      <g class="sc-a" style="transform-origin:10% 50%;animation:scToss 1.6s ease-in-out infinite ${delay}s">
        <path d="M-10 -18 q 8 2 14 -2" fill="none" stroke="${C.cream}" stroke-width="6" ${sw}/>
        <path d="M10 -18 q 6 2 10 -2" fill="none" stroke="${C.cream}" stroke-width="6" ${sw}/>
        <ellipse cx="22" cy="-18" rx="12" ry="3.5" fill="${C.pan}"/>
        <line x1="10" y1="-18" x2="-2" y2="-14" stroke="${C.pan}" stroke-width="3" ${sw}/>
        <circle cx="5" cy="-17" r="3" fill="${C.skin}" stroke="${C.line}" stroke-width=".8"/>
      </g>
      <g transform="translate(22 -22)"><g class="sc-a" style="transform-origin:center;animation:scFlip 1.6s ease-in-out infinite ${delay}s">
        <ellipse rx="9" ry="3" fill="${C.jeon}" stroke="#b9852b" stroke-width=".8"/><circle cx="-3" cy="-.5" r="1.3" fill="${C.green}"/><circle cx="3" cy=".3" r="1.1" fill="${C.red}"/>
      </g></g>`,
    chop: `
      <rect x="2" y="-12" width="30" height="6" rx="2" fill="${C.jeon}" stroke="#b9852b" stroke-width=".8"/>
      ${[8, 13, 18].map((cx, i) => `<rect class="sc-a" style="--dx:${(i - 1) * 6}px;animation:scBits .9s ease-out infinite ${i * 0.15}s" x="${cx}" y="-16" width="3.5" height="4" rx="1" fill="${C.green}"/>`).join('')}
      <rect x="22" y="-17" width="9" height="5" rx="2.5" fill="${C.green}"/>
      <path d="M-11 -18 q 4 8 12 8" fill="none" stroke="${C.cream}" stroke-width="6" ${sw}/>
      <g class="sc-a" style="transform-origin:0% 100%;animation:scChop .35s ease-in-out infinite">
        <path d="M10 -20 q 6 -2 10 2" fill="none" stroke="${C.cream}" stroke-width="6" ${sw}/>
        <path d="M18 -16 L 30 -16 L 30 -24 Q 22 -24 18 -16 Z" fill="#e8eef1" stroke="#9aa6ad" stroke-width=".8"/>
        <circle cx="18" cy="-18" r="3" fill="${C.skin}" stroke="${C.line}" stroke-width=".8"/>
      </g>`,
  }[kind];
  return `<g transform="translate(${x} ${y})"><g class="sc-a" style="animation:scBob 1.6s ease-in-out infinite ${delay}s">
    <ellipse cx="0" cy="0" rx="17" ry="3.2" fill="#000" opacity=".12"/>
    <path d="M-13 -2 Q -15 -26 0 -27 Q 15 -26 13 -2 Z" fill="${C.cream}" stroke="${C.line}" stroke-width="1.3"/>
    <circle cx="0" cy="-17" r="1.3" fill="${C.gold}"/><circle cx="0" cy="-11" r="1.3" fill="${C.gold}"/>
    <path d="M-6 -27 L 6 -27 L 0 -21 Z" fill="${C.red}"/>
    <circle cx="0" cy="-40" r="14" fill="${C.skin}" stroke="${C.line}" stroke-width="1.2"/>
    <circle cx="-8" cy="-36" r="2.6" fill="${C.cheek}" opacity=".6"/><circle cx="8" cy="-36" r="2.6" fill="${C.cheek}" opacity=".6"/>
    ${face}
    <path d="M-13 -50 C -21 -55 -17 -71 -7 -66 C -5 -77 7 -77 9 -66 C 19 -71 22 -55 13 -50 Z" fill="#fff" stroke="${C.line}" stroke-width="1.2"/>
    <rect x="-12.5" y="-53" width="25" height="5" rx="2" fill="#fff" stroke="${C.line}" stroke-width="1.1"/>
    ${arms}
  </g></g>`;
}

const kitchenSVG = () => `<svg viewBox="0 0 340 200" role="img">
  <rect width="340" height="200" style="fill:var(--sc-wall)"/>
  <g transform="translate(118 14)">
    <rect width="104" height="70" rx="6" style="fill:var(--sc-window)" stroke="${C.line}" stroke-opacity=".5" stroke-width="2"/>
    <circle cx="74" cy="26" r="11" fill="${C.gold2}" opacity=".8"/>
    <g stroke="${C.line}" stroke-opacity=".45" stroke-width="1.5">${[20, 42, 62, 84].map((x) => `<line x1="${x}" y1="0" x2="${x}" y2="70"/>`).join('')}${[18, 36, 54].map((y) => `<line x1="0" y1="${y}" x2="104" y2="${y}"/>`).join('')}</g>
  </g>
  <line x1="14" y1="60" x2="100" y2="60" style="stroke:var(--sc-wood-2)" stroke-width="4" ${sw}/>
  ${[[30, 12], [54, 15], [80, 11]].map(([x, h]) => `<path d="M${x - h * 0.8} 60 q -2 -${h} ${h * 0.8} -${h * 1.6} q ${h * 0.8 + 2} ${h * 0.6} ${h * 0.8} ${h * 1.6} Z" fill="#8a5a3a" stroke="${C.line}" stroke-width="1"/><rect x="${x - 4}" y="${60 - h * 1.7}" width="8" height="3" rx="1.5" fill="#6d4429"/>`).join('')}
  <line x1="240" y1="60" x2="326" y2="60" style="stroke:var(--sc-wood-2)" stroke-width="4" ${sw}/>
  ${[258, 282, 306].map((x) => `<circle cx="${x}" cy="50" r="9" fill="${C.cream}" stroke="${C.line}" stroke-width="1.2"/><circle cx="${x}" cy="50" r="5" fill="${C.green}" opacity=".7"/>`).join('')}
  <rect x="0" y="152" width="340" height="48" style="fill:var(--sc-wood)"/>
  <line x1="0" y1="152" x2="340" y2="152" style="stroke:var(--sc-wood-2)" stroke-width="3"/>
  <g transform="translate(40 152)">
    <path d="M-16 -16 h 32 v 12 q 0 6 -6 6 h -20 q -6 0 -6 -6 Z" fill="${C.pan}"/>
    <ellipse cx="0" cy="-16" rx="16" ry="3.5" fill="${C.soup}"/>
    ${[0, 0.5, 1].map((d, i) => `<path class="sc-a" style="animation:scSteam 1.8s ease-out infinite ${d}s" d="M${-6 + i * 6} -22 q 3 -5 0 -10 q -3 -5 0 -10" fill="none" stroke="#cdbfa9" stroke-width="1.8" ${sw}/>`).join('')}
  </g>
  ${chef(84, 152, 'taste', 0)}${chef(170, 152, 'flip', 0.3)}${chef(248, 152, 'chop', 0.6)}
  ${[[110, 96], [214, 100], [318, 106], [20, 104]].map(([x, y], i) => twinkle(x, y, i)).join('')}
</svg>`;

function rider({ waving = false } = {}) {
  const ivory = '#f7f1e6', chrome = '#d9dde0', leather = '#6b4a33', pants = '#2b2f3a', boot = '#5a3d2a';
  return `<g>
    ${waving ? '' : `<g style="stroke:var(--sc-muted)" stroke-width="1.6" stroke-dasharray="12 12" opacity=".55" ${sw}>
      <line class="sc-a" style="animation:scSpeed .5s linear infinite" x1="-26" y1="26" x2="-4" y2="26"/>
      <line class="sc-a" style="animation:scSpeed .5s linear infinite .15s" x1="-34" y1="40" x2="-6" y2="40"/></g>
      ${[0, 0.3].map((d) => `<circle class="sc-a" style="transform-origin:center;animation:scPuff .9s ease-out infinite ${d}s" cx="16" cy="62" r="2.6" fill="#c9bcaa"/>`).join('')}`}
    <g class="sc-a" style="transform-origin:50% 100%;animation:scRide ${waving ? '2.4s' : '.6s'} ease-in-out infinite">
      ${[[34, 66], [96, 66]].map(([x, y]) => `<g transform="translate(${x} ${y})"><circle r="10.5" fill="${C.tire}"/><circle r="6" fill="${chrome}"/><circle r="2.4" fill="${C.gold}"/>${waving ? '' : `<g class="sc-a" style="transform-origin:center;animation:scSpin .45s linear infinite"><line x1="-5" y1="0" x2="5" y2="0" stroke="#9aa0a5" stroke-width="1"/><line x1="0" y1="-5" x2="0" y2="5" stroke="#9aa0a5" stroke-width="1"/></g>`}</g>`).join('')}
      <line x1="6" y1="42" x2="34" y2="42" stroke="${chrome}" stroke-width="2.4" ${sw}/>
      <rect x="4" y="14" width="30" height="27" rx="5" fill="${C.navy2}" stroke="${C.line}" stroke-width="1.2"/>
      <rect x="6.5" y="16.5" width="25" height="22" rx="3.5" fill="none" stroke="${C.gold}" stroke-width=".8" opacity=".8"/>
      <circle cx="19" cy="27.5" r="7" fill="none" stroke="${C.gold2}" stroke-width="1.4"/>
      <text x="19" y="31" text-anchor="middle" font-family="'Noto Serif KR', serif" font-weight="700" font-size="9" fill="${C.gold2}">원</text>
      <path d="M16 58 C 14 44 26 38 42 40 L 60 42 L 64 56 C 64 62 60 65 54 65 L 24 65 C 19 65 16 62 16 58 Z" fill="${ivory}" stroke="${C.line}" stroke-width="1.3"/>
      <path d="M22 50 C 30 44 46 44 58 46" fill="none" stroke="#fff" stroke-width="3" opacity=".8" ${sw}/>
      <path d="M21 56 C 30 52 48 52 60 54" fill="none" stroke="${C.gold}" stroke-width=".9"/>
      <rect x="52" y="60" width="34" height="5" rx="2" fill="${C.navy2}"/>
      <path d="M82 65 L 87 36 C 88 31 92 29 95 31 L 100 37 C 97 47 96 57 98 65 Z" fill="${ivory}" stroke="${C.line}" stroke-width="1.3"/>
      <path d="M88 40 C 89 35 92 33 95 35" fill="none" stroke="${C.gold}" stroke-width=".9"/>
      <path d="M85 65 C 87 55 104 55 107 65" fill="${ivory}" stroke="${C.line}" stroke-width="1.3"/>
      <path d="M37 40 Q 49 34 61 40 L 59 44 L 39 44 Z" fill="${leather}" stroke="${C.line}" stroke-width="1"/>
      <line x1="93" y1="31" x2="93" y2="20" stroke="${C.line}" stroke-width="2.6" ${sw}/>
      <line x1="85" y1="20" x2="101" y2="18" stroke="${C.line}" stroke-width="2.6" ${sw}/>
      <line x1="89" y1="19" x2="87" y2="10" stroke="${chrome}" stroke-width="1.4" ${sw}/><circle cx="87" cy="9" r="2.2" fill="${chrome}" stroke="${C.line}" stroke-width=".6"/>
      <circle cx="101" cy="24" r="4.6" fill="#fff6d8" stroke="${chrome}" stroke-width="1.8"/>
      <path d="M105 19 L 124 13 L 124 35 Z" fill="#fff3c9" opacity=".3"/>
      <path d="M52 41 L 69 45 L 71 58" fill="none" stroke="${pants}" stroke-width="7.5" ${sw}/>
      <rect x="66" y="56" width="11" height="6" rx="2.5" fill="${boot}"/>
      <path d="M44 43 C 42 28 50 17 60 17 C 69 17 71 28 69 43 Z" fill="${C.navy}" stroke="${C.line}" stroke-width="1.2"/>
      <path d="M54 18 L 60 24 L 66 18" fill="none" stroke="${ivory}" stroke-width="2.6" ${sw}/>
      <line x1="60" y1="24" x2="58.5" y2="42" stroke="${C.gold2}" stroke-width="1.1"/>
      ${waving
    ? `<g class="sc-a" style="transform-origin:0% 100%;animation:scWave .8s ease-in-out infinite"><path d="M58 24 q -6 -10 -2 -22" fill="none" stroke="${C.navy}" stroke-width="6.5" ${sw}/><circle cx="56.5" cy="1" r="3.6" fill="${leather}"/></g>
           <path d="M64 26 L 86 20" stroke="${C.navy}" stroke-width="6.5" ${sw}/><circle cx="86.5" cy="19.5" r="3.4" fill="${leather}"/>`
    : `<path d="M64 25 C 70 26 78 23 86 20" fill="none" stroke="${C.navy}" stroke-width="6.5" ${sw}/><circle cx="86.5" cy="19.5" r="3.4" fill="${leather}"/>`}
      <circle cx="65" cy="8" r="9.5" fill="${C.skin}" stroke="${C.line}" stroke-width="1.1"/>
      <path d="M55 10 C 53 -4 71 -8 76 3 L 75 5.5 L 63 4.5 L 58 12 Z" fill="${C.navy2}" stroke="${C.line}" stroke-width="1.1"/>
      <path d="M58 -1 C 63 -4.5 70 -4 74 0.5" fill="none" stroke="${C.gold2}" stroke-width="1.6" ${sw}/>
      <path d="M71 3 L 80 4.5 L 73 6.5 Z" fill="${C.navy2}"/>
      <path d="M67.5 7 h 3.5" stroke="${C.line}" stroke-width="1" ${sw}/>
      <circle cx="69.5" cy="9.2" r="1.3" fill="${C.line}"/>
      <path d="M66.5 13 q 3 2.2 6 -.3" fill="none" stroke="${C.line}" stroke-width="1.2" ${sw}/>
      <path d="M59 11 v 6" stroke="${C.navy2}" stroke-width="1.2"/>
    </g>
  </g>`;
}

const ROUTE = 'M40 250 L40 190 Q40 176 54 176 L150 176 Q164 176 164 162 L164 112 Q164 98 178 98 L262 98 Q276 98 276 84 L276 58';
const STREETS = '<path d="M40 290 V 20"/><path d="M0 176 H 340"/><path d="M164 290 V 0"/><path d="M0 98 H 340"/><path d="M276 0 V 210"/>';
const mapSVG = (emoji) => `<svg viewBox="0 0 340 290" role="img">
  <rect width="340" height="290" style="fill:var(--sc-m-bg)"/>
  <path d="M0 232 C 80 212, 120 262, 200 246 S 300 214, 340 226 L340 254 C 300 246, 260 272, 200 274 S 80 244, 0 262 Z" style="fill:var(--sc-m-river)"/>
  <rect x="196" y="128" width="64" height="42" rx="8" style="fill:var(--sc-m-park)"/>
  ${[[208, 140], [222, 152], [238, 140], [250, 156]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" style="fill:var(--sc-m-tree)"/>`).join('')}
  ${[[60, 30, 80, 50], [176, 20, 60, 40], [60, 110, 80, 50], [12, 30, 20, 120], [200, 190, 100, 20], [290, 110, 40, 60], [80, 196, 60, 26]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" style="fill:var(--sc-m-block)"/>`).join('')}
  <g style="stroke:var(--sc-m-street)" stroke-width="11" fill="none" stroke-linecap="round">${STREETS}</g>
  <g style="stroke:var(--sc-m-dash)" stroke-width="1" stroke-dasharray="4 6" fill="none">${STREETS}</g>
  <path d="${ROUTE}" style="stroke:var(--sc-route-dim)" stroke-width="6" fill="none" ${sw}/>
  <path data-done d="${ROUTE}" style="stroke:var(--sc-route)" stroke-width="4" fill="none" ${sw}/>
  <path data-route d="${ROUTE}" fill="none"/>
  <g transform="translate(40 256)"><circle r="13" fill="${C.cream}" stroke="${C.line}" stroke-width="1.4"/><text y="4.5" text-anchor="middle" font-size="13">${emoji}</text></g>
  <g transform="translate(276 48)">
    <circle r="11" fill="none" stroke="${C.gold}" class="sc-a" style="transform-origin:center;animation:scPin 1.6s ease-out infinite"/>
    <path d="M-12 2 L 0 -10 L 12 2 Z" fill="${C.red}" stroke="${C.line}" stroke-width="1.2" stroke-linejoin="round"/>
    <rect x="-9" y="2" width="18" height="12" fill="${C.cream}" stroke="${C.line}" stroke-width="1.2"/>
    <rect x="-3" y="7" width="6" height="7" fill="${C.line}" opacity=".6"/>
  </g>
  <g data-rider><g data-flip><g transform="scale(.62) translate(-62 -72)">${rider()}</g></g></g>
</svg>`;

const deliveredSVG = () => `<svg viewBox="0 0 340 200" role="img">
  <rect width="340" height="200" style="fill:var(--sc-m-bg)"/>
  <rect y="166" width="340" height="34" style="fill:var(--sc-m-block)"/>
  <g transform="translate(232 166)">
    <path d="M-62 -92 C -50 -84 -30 -82 0 -82 C 30 -82 50 -84 62 -92 C 52 -96 40 -100 30 -110 L -30 -110 C -40 -100 -52 -96 -62 -92 Z" fill="#5b4632" stroke="${C.line}" stroke-width="1.4"/>
    <rect x="-46" y="-82" width="10" height="82" fill="#8a5a3a"/><rect x="36" y="-82" width="10" height="82" fill="#8a5a3a"/>
    <rect x="-36" y="-76" width="72" height="76" fill="#b0784a" stroke="${C.line}" stroke-width="1.2"/>
    <line x1="0" y1="-76" x2="0" y2="0" stroke="${C.line}" stroke-width="1.4"/>
    <circle cx="-6" cy="-36" r="2.4" fill="${C.gold}"/><circle cx="6" cy="-36" r="2.4" fill="${C.gold}"/>
    <path d="M-14 -106 h 28" stroke="${C.gold}" stroke-width="2" ${sw}/>
  </g>
  <g transform="translate(36 88) scale(1.05)">${rider({ waving: true })}</g>
  ${[0, 0.5, 1, 1.5].map((d, i) => `<path class="sc-a" style="animation:scRise 2s ease-out infinite ${d}s" transform="translate(${88 + i * 18} 80)" d="M0 0 c -3 -4 -9 -1 -6 4 l 6 6 l 6 -6 c 3 -5 -3 -8 -6 -4 Z" fill="${i % 2 ? C.red : C.gold2}"/>`).join('')}
  ${[[160, 36], [210, 26], [300, 40], [30, 36]].map(([x, y], i) => twinkle(x, y, i)).join('')}
</svg>`;

function useRide(ref, active) {
  useEffect(() => {
    const svg = ref.current?.querySelector('svg');
    const route = svg?.querySelector('[data-route]');
    if (!active || !route) return undefined;
    const done = svg.querySelector('[data-done]'); const rd = svg.querySelector('[data-rider]'); const fl = svg.querySelector('[data-flip]');
    const L = route.getTotalLength();
    done.style.strokeDasharray = `${L} ${L}`;
    const place = (t) => {
      const d = t * L;
      const p = route.getPointAtLength(d); const n = route.getPointAtLength(Math.min(L, d + 2));
      const dx = n.x - p.x; const dy = n.y - p.y;
      let ang = (Math.atan2(dy, Math.abs(dx) < 0.01 ? 0.01 : Math.abs(dx)) * 180) / Math.PI;
      ang = Math.max(-12, Math.min(12, ang));
      rd.setAttribute('transform', `translate(${p.x} ${p.y})`);
      fl.setAttribute('transform', `${dx < -0.2 ? 'scale(-1 1) ' : ''}rotate(${ang})`);
      done.style.strokeDashoffset = L - d;
    };
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { place(0.55); return undefined; }
    let raf = 0; const t0 = performance.now();
    const tick = (now) => {
      if (!document.hidden) {
        const raw = ((now - t0) % 9000) / 9000;
        place(0.04 + Math.min(1, raw / 0.85) * 0.92);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref, active]);
}

export default function OrderScene({ order, emoji = '🍲' }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  const kind = order.status === 'preparing' ? 'kitchen'
    : order.status === 'out_for_delivery' ? 'map'
      : order.status === 'delivered' ? 'delivered' : null;
  const html = useMemo(() => (kind === 'kitchen' ? kitchenSVG() : kind === 'map' ? mapSVG(emoji) : kind === 'delivered' ? deliveredSVG() : ''), [kind, emoji]);
  useRide(ref, kind === 'map');
  if (!kind) return null;
  return (
    <figure className={`order-scene is-${kind}`} aria-label={t(`scene.${kind}`)}>
      {/* Static illustration markup built above; contains no user data. */}
      <div ref={ref} className="order-scene-art" dangerouslySetInnerHTML={{ __html: html }} />
      <figcaption>{t(`scene.${kind}`)}</figcaption>
    </figure>
  );
}
