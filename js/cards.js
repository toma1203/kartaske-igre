// Špilovi, miješanje i iscrtavanje karata.

export const IT_SUITS = ['kupe', 'bati', 'spade', 'dinari'];
export const IT_RANKS = ['A', '2', '3', '4', '5', '6', '7', 'F', 'C', 'K'];
export const IT_SUIT_NAMES = { kupe: 'Kupe', bati: 'Bati', spade: 'Špade', dinari: 'Dinari' };
const IT_LABEL = { A: 'A', F: '11', C: '12', K: '13' };
const IT_FIGURE = { F: 'Fanat', C: 'Konj', K: 'Kralj' };

export const FR_SUITS = ['S', 'H', 'D', 'C'];
const FR_SYM = { S: '♠', H: '♥', D: '♦', C: '♣' };
const FR_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

export function rand(n) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function italianDeck() {
  const d = [];
  for (const s of IT_SUITS) for (const r of IT_RANKS) d.push({ id: `${s}-${r}`, s, r });
  return d;
}

// Dva francuska špila + jokeri (za remi).
export function frenchDeck(decks = 2, jokers = 4) {
  const d = [];
  for (let k = 0; k < decks; k++)
    for (const s of FR_SUITS) for (let r = 1; r <= 13; r++) d.push({ id: `${k}${s}${r}`, s, r });
  for (let i = 0; i < jokers; i++) d.push({ id: `X${i}`, j: true });
  return d;
}

export const isItalian = (c) => IT_SUITS.includes(c.s);

export function cardName(c) {
  if (!c) return '';
  if (c.j) return 'Joker';
  if (isItalian(c)) return `${IT_FIGURE[c.r] || (c.r === 'A' ? 'As' : c.r)} ${IT_SUIT_NAMES[c.s].toLowerCase()}`;
  return `${FR_LABEL[c.r] || c.r}${FR_SYM[c.s]}`;
}

export function frLabel(r) {
  return FR_LABEL[r] || String(r);
}
export const frSym = (s) => FR_SYM[s];

// --- Klasični (tršćanski) znakovi talijanskih boja ---
const GOLD = '#f0c030';
const GOLD_D = '#946400';
const RED = '#c62a2a';
const RED_D = '#741212';
const BLUE = '#2f62b8';
const petals = [0, 45, 90, 135, 180, 225, 270, 315]
  .map((a) => `<ellipse cx="20" cy="14.2" rx="1.7" ry="3.4" transform="rotate(${a} 20 20)"/>`)
  .join('');
const SUIT_SVG = {
  dinari: `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18.2" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="1.5"/><circle cx="20" cy="20" r="14" fill="none" stroke="${RED}" stroke-width="2.4"/><circle cx="20" cy="20" r="10.6" fill="#f8da6c" stroke="${GOLD_D}" stroke-width=".9"/><g fill="${RED}">${petals}</g><circle cx="20" cy="20" r="2.8" fill="${BLUE}" stroke="${GOLD_D}" stroke-width=".6"/></svg>`,
  kupe: `<svg viewBox="0 0 40 40"><path d="M7.5 5h25c0 9.5-5 15-12.5 16C12.5 20 7.5 14.5 7.5 5z" fill="${RED}" stroke="${RED_D}" stroke-width="1.2"/><path d="M8.2 5.6h23.6" stroke="${GOLD}" stroke-width="2.6"/><path d="M10.4 11.2h19.2" stroke="${GOLD}" stroke-width="1.6"/><path d="M12.6 15.6h14.8" stroke="${BLUE}" stroke-width="1.2"/><rect x="18" y="20.5" width="4" height="8.5" fill="${GOLD}" stroke="${GOLD_D}" stroke-width=".9"/><ellipse cx="20" cy="24.6" rx="4.4" ry="1.9" fill="${BLUE}" stroke="${GOLD_D}" stroke-width=".6"/><path d="M10 36c1.8-4.6 5.4-7 10-7s8.2 2.4 10 7z" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="1.2"/><path d="M12.4 34h15.2" stroke="${RED}" stroke-width="1.2"/></svg>`,
  spade: `<svg viewBox="0 0 40 40"><path d="M19.5 2c7.5 6.5 8 17.5 3.4 27h-4.6c4-9 3.8-18.5 1.2-27z" fill="#4a86e0" stroke="#173a78" stroke-width="1.2"/><path d="M20.6 6c3.4 6.4 3.6 14.4.9 21" stroke="#dbe8ff" stroke-width="1.1" fill="none"/><path d="M10.5 28.6h19l-2.2 3.4H12.7z" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="1"/><rect x="18.2" y="32" width="3.6" height="4.6" fill="${RED}" stroke="${RED_D}" stroke-width=".8"/><circle cx="20" cy="37.6" r="1.9" fill="${GOLD}" stroke="${GOLD_D}" stroke-width=".8"/></svg>`,
  bati: `<svg viewBox="0 0 40 40"><path d="M14.4 12.4l-5-3.4 2 5.6zM25.8 17.4l5-2.6-2 5.2zM16.4 23.4l-4.6-1.2 2.8 4.2z" fill="#3c9447" stroke="#1b5226" stroke-width="1"/><path d="M15.6 3.6c3.6-2.6 11.2-1.6 11.4 4.8l-3.4 28c-.3 2.6-4 2.6-4.3 0L14 10.4c-.6-2.6.2-5.3 1.6-6.8z" fill="#3c9447" stroke="#1b5226" stroke-width="1.2"/><path d="M18 5.4c2-1.2 5.4-.8 6.4 1.6" stroke="#9fd8a2" stroke-width="1.2" fill="none"/><path d="M18.4 9.6l1 1.4M22.6 13.6l-1 1.2M19.4 18.8l1 1.2" stroke="#1b5226" stroke-width="1"/><path d="M19 30.4h5.4M19.2 32.6h5" stroke="${RED}" stroke-width="1.5"/></svg>`,
};
export const suitIcon = (s) => `<span class="suit-ico s-${s}">${SUIT_SVG[s]}</span>`;

// Figure: fanat, konj, kralj
const SKIN = '#f3d3b2';
const FIGURE_SVG = {
  F: (c) => `<svg viewBox="0 0 40 50"><path d="M7 50c0-13 5.5-19 13-19s13 6 13 19z" fill="${c}"/><path d="M15 50l5-18.5 5 18.5z" fill="${GOLD}"/><path d="M13 31.6c2 2 12 2 14 0" stroke="${GOLD}" stroke-width="1.6" fill="none"/><circle cx="20" cy="23" r="7" fill="${SKIN}" stroke="#8a5a3a" stroke-width=".8"/><path d="M14.4 22.6c.8-3.8 10.4-3.8 11.2 0" stroke="#6a3c1c" stroke-width="2.2" fill="none"/><path d="M10.6 17.4c1.4-7.6 17.4-7.6 18.8 0-4.6-2.2-14.2-2.2-18.8 0z" fill="${RED}" stroke="${RED_D}" stroke-width=".7"/><path d="M27.4 13.2c3.4-5.2 7-4.6 7.8-1.6-3 .2-5 1.4-6.6 3.6z" fill="${GOLD}" stroke="${GOLD_D}" stroke-width=".6"/><circle cx="17.6" cy="24" r=".9" fill="#222"/><circle cx="22.4" cy="24" r=".9" fill="#222"/></svg>`,
  C: (c) => `<svg viewBox="0 0 40 50"><path d="M9 49c-.6-9 2.4-16.4 6.8-21.6-3.4-.6-7.4.4-9.6-2.6-1.6-2.4 1.6-7.6 6-11.6 2-4.2 5.8-7 9.8-7.4l1-4.4 3.4 5.2c5.8 3.6 8.2 11.6 7.4 21.4-.6 8 .2 14.2 1 21z" fill="#a8703e" stroke="#4a2a14" stroke-width="1"/><path d="M25 7.6c5.4 4.2 7.4 12.4 6.4 22-.8 8 .2 13.8 1 19.4h3c-1.6-7.6 1.6-16.8.6-25.2-.8-7.4-4-12.6-8-16.2z" fill="#3a2414"/><circle cx="19.8" cy="13.6" r="1.5" fill="#111"/><path d="M8.6 22.2l7.4-2.6M14.4 14.6l3 8.4" stroke="${RED}" stroke-width="1.5"/><path d="M9.4 41.6h23v7.4h-23z" fill="${c}"/><path d="M9.4 41.6h23" stroke="${GOLD}" stroke-width="1.6"/></svg>`,
  K: (c) => `<svg viewBox="0 0 40 50"><path d="M5 50c0-14 6-19.5 15-19.5S35 36 35 50z" fill="${c}"/><path d="M17 31h6v19h-6z" fill="${GOLD}"/><path d="M8 38c4 2 20 2 24 0" stroke="#f4f0e6" stroke-width="2" fill="none"/><circle cx="20" cy="22.6" r="6.8" fill="${SKIN}" stroke="#8a5a3a" stroke-width=".8"/><path d="M13.4 23.4c.2 8.8 13 8.8 13.2 0-2.4 3.6-10.8 3.6-13.2 0z" fill="#d9d1c2" stroke="#9a8f7c" stroke-width=".5"/><circle cx="17.6" cy="22.4" r=".9" fill="#222"/><circle cx="22.4" cy="22.4" r=".9" fill="#222"/><path d="M12 16.6l1-9.4 3.6 4.2L20 4.8l3.4 6.6 3.6-4.2 1 9.4z" fill="${GOLD}" stroke="${GOLD_D}" stroke-width=".8"/><circle cx="20" cy="12.6" r="1.4" fill="${RED}"/><circle cx="14.6" cy="14.2" r=".9" fill="${BLUE}"/><circle cx="25.4" cy="14.2" r=".9" fill="${BLUE}"/></svg>`,
};
const FIG_COLOR = { kupe: RED, bati: '#2f7d3a', spade: BLUE, dinari: '#b07d10' };

// Raspored znakova na brojevima, kao na klasičnim kartama.
const PIPS = {
  1: [[50, 50]],
  2: [[50, 20], [50, 80]],
  3: [[50, 14], [50, 50], [50, 86]],
  4: [[29, 20], [71, 20], [29, 80], [71, 80]],
  5: [[29, 16], [71, 16], [50, 50], [29, 84], [71, 84]],
  6: [[29, 13], [71, 13], [29, 50], [71, 50], [29, 87], [71, 87]],
  7: [[29, 11], [71, 11], [50, 31], [29, 52], [71, 52], [29, 89], [71, 89]],
};

function pipsHTML(c) {
  const n = c.r === 'A' ? 1 : Number(c.r);
  const tilt = c.s === 'spade' || c.s === 'bati';
  return PIPS[n]
    .map(([x, y]) => {
      const rot = tilt && n > 1 ? (x < 50 ? -16 : x > 50 ? 16 : 0) : 0;
      return `<span class="pip" style="left:${x}%;top:${y}%;transform:translate(-50%,-50%) rotate(${rot}deg)">${SUIT_SVG[c.s]}</span>`;
    })
    .join('');
}

export function cardHTML(c, { cls = '', attrs = '' } = {}) {
  if (!c) return `<div class="card back ${cls}" ${attrs}><div class="back-pattern"></div></div>`;
  if (c.j) {
    return `<div class="card joker ${cls}" ${attrs}>
      <div class="corner tl"><b>★</b></div>
      <div class="center joker-c"><span>J</span><span>O</span><span>K</span><span>E</span><span>R</span></div>
      ${c.rep ? `<div class="rep">${frLabel(c.rep.r)}${c.rep.s ? FR_SYM[c.rep.s] : ''}</div>` : ''}
    </div>`;
  }
  if (isItalian(c)) {
    const label = IT_LABEL[c.r] || c.r;
    const fig = IT_FIGURE[c.r];
    const center = fig
      ? `<div class="center fig"><div class="fig-art">${FIGURE_SVG[c.r](FIG_COLOR[c.s])}</div>${suitIcon(c.s)}<span class="fig-name">${fig}</span></div>`
      : `<div class="center pips n${c.r === 'A' ? 1 : c.r}">${pipsHTML(c)}</div>`;
    return `<div class="card it it-${c.s} ${cls}" ${attrs}>
      <div class="corner tl"><b>${label}</b>${suitIcon(c.s)}</div>
      ${center}
      <div class="corner br"><b>${label}</b>${suitIcon(c.s)}</div>
    </div>`;
  }
  const red = c.s === 'H' || c.s === 'D';
  const label = frLabel(c.r);
  return `<div class="card fr ${red ? 'red' : 'black'} ${cls}" ${attrs}>
    <div class="corner tl"><b>${label}</b><i>${FR_SYM[c.s]}</i></div>
    <div class="center"><span class="big-sym">${c.r > 10 ? label : FR_SYM[c.s]}</span></div>
    <div class="corner br"><b>${label}</b><i>${FR_SYM[c.s]}</i></div>
  </div>`;
}
