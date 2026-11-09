import { useId } from 'react';
import { AVENUE_PATH, YUNA_PATH } from './brandPaths';

/**
 * WON AVENUE emblem: the Korean syllable 원 drawn as a hanok under the moon
 * (ㅇ = moon with the 윤아 signature, ㅜ = tiled roof + post, ㅓ = gate column, ㄴ = stone base).
 * Colours come from CSS variables (--logo-a/b/c, --logo-cut), so it follows the light / dark theme.
 */
function Gradient({ id }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="200">
      <stop offset="0" style={{ stopColor: 'var(--logo-a)' }} />
      <stop offset=".55" style={{ stopColor: 'var(--logo-b)' }} />
      <stop offset="1" style={{ stopColor: 'var(--logo-c)' }} />
    </linearGradient>
  );
}

const TILES = [44, 53, 62, 71, 80];

export function EmblemShapes({ g, signature = true }) {
  return (
    <g strokeLinecap="round">
      <circle cx="50" cy="31" r="20" fill={g} fillOpacity=".2" stroke={g} strokeWidth="8.5" />
      {signature && (
        <>
          <g transform="translate(50 34) skewX(-14)"><path d={YUNA_PATH} fill={g} /></g>
          <path d="M41 38.5 C 46 40.5 54 40.5 60 37.5" fill="none" stroke={g} strokeWidth=".9" />
        </>
      )}
      <path d="M62 50 h 18 a 6 6 0 1 0 -6 -6 a 3.5 3.5 0 1 1 3.5 3.5" fill="none" stroke={g} strokeWidth="3" />
      <path d="M2 74 C 12 90 24 97 40 97 L 84 97 C 100 97 112 90 122 74 C 110 80 101 79 93 72 L 87 64 L 37 64 L 31 72 C 23 79 14 80 2 74 Z" fill={g} />
      <g style={{ stroke: 'var(--logo-cut)' }} strokeWidth="2" opacity=".55">
        {TILES.map((x) => <line key={x} x1={x} y1="68" x2={x + (x - 62) * 0.25} y2="93" />)}
      </g>
      <path d="M28 61 L96 61" stroke={g} strokeWidth="5.5" />
      <path d="M28 61 l -4 -5 M96 61 l 4 -5" stroke={g} strokeWidth="4" />
      <line x1="62" y1="96" x2="62" y2="128" stroke={g} strokeWidth="10" />
      <path d="M120 38 C 127 46 134 48 142 48 C 150 48 157 46 164 38 C 157 41 151 39 147 32 L 137 32 C 133 39 127 41 120 38 Z" fill={g} />
      <line x1="134" y1="30" x2="150" y2="30" stroke={g} strokeWidth="4" />
      <line x1="142" y1="46" x2="142" y2="134" stroke={g} strokeWidth="10" />
      <line x1="114" y1="76" x2="142" y2="76" stroke={g} strokeWidth="9" />
      <rect x="135" y="70" width="14" height="12" rx="2" fill={g} />
      <path d="M34 148 V 168 H 172" fill="none" stroke={g} strokeWidth="10" strokeLinejoin="round" />
      <line x1="28" y1="181" x2="178" y2="181" stroke={g} strokeWidth="4" opacity=".75" />
      <line x1="22" y1="191" x2="184" y2="191" stroke={g} strokeWidth="3" opacity=".5" />
    </g>
  );
}

/** Emblem only (header, icons). The signature is hidden below ~48px where it would be unreadable. */
export function Emblem({ size = 40, signature, title }) {
  const id = useId().replace(/:/g, '');
  const showSig = signature ?? size >= 48;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs><Gradient id={id} /></defs>
      <EmblemShapes g={`url(#${id})`} signature={showSig} />
    </svg>
  );
}

/**
 * Mugunghwa (Korean national flower): five broad separate petals with veins, the red heart
 * at the centre (단심, its signature) and a golden stamen. Petal edges are cut in the background
 * colour so it reads as a flower even when small.
 */
const PETAL = 'M0 -3 C -9 -6 -17 -16 -14 -27 C -12 -33 -6 -35 -2 -32 C -1 -33.5 1 -33.5 2 -32 C 6 -35 12 -33 14 -27 C 17 -16 9 -6 0 -3 Z';
function Mugunghwa({ g, x, y, scale }) {
  const angles = [0, 72, 144, 216, 288];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {angles.map((r) => (
        <g key={r} transform={`rotate(${r})`}>
          <path d={PETAL} fill={g} style={{ stroke: 'var(--logo-cut)' }} strokeWidth="2.4" strokeLinejoin="round" />
          <path d="M0 -6 L0 -26 M0 -10 L-6 -24 M0 -10 L6 -24" fill="none" style={{ stroke: 'var(--logo-cut)' }} strokeWidth="1.3" strokeLinecap="round" opacity=".55" />
        </g>
      ))}
      <circle r="8.5" fill="#a8322a" />
      {angles.map((r) => <path key={r} d="M0 0 L0 -11" transform={`rotate(${r + 36})`} stroke="#a8322a" strokeWidth="3" strokeLinecap="round" />)}
      <path d="M0 0 C 2 -6 5 -11 8 -15" fill="none" stroke={g} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="8.5" cy="-16" r="3" fill={g} />
    </g>
  );
}

/**
 * The WON AVENUE logo: the 원 emblem on top (it already says "Won"), AVENUE underneath,
 * and a line - mugunghwa - line ornament at the bottom. Pass `height` (header) or `width`.
 * The 윤아 signature in the moon is drawn only where the logo is big enough to read it.
 */
export function LogoFull({ width, height, signature }) {
  const id = useId().replace(/:/g, '');
  const g = `url(#${id})`;
  const w = width ?? (height ? (height * 240) / 186 : 220);
  const showSig = signature ?? w >= 150;
  return (
    <svg width={w} height={(w * 186) / 240} viewBox="0 0 240 186" role="img" aria-label="WON AVENUE" className="logo-full">
      <defs>
        <Gradient id={id} />
      </defs>
      <g transform="translate(75.4 2) scale(.48)"><EmblemShapes g={g} signature={showSig} /></g>
      <g transform="translate(122.5 132) scale(1.98)"><path d={AVENUE_PATH} fill={g} /></g>
      <line x1="22" y1="162" x2="94" y2="162" stroke={g} strokeWidth="1.8" strokeLinecap="round" />
      <Mugunghwa g={g} x={120} y={162} scale={0.62} />
      <line x1="146" y1="162" x2="218" y2="162" stroke={g} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
