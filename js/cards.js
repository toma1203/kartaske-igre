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

// --- SVG ikone talijanskih boja ---
const SUIT_SVG = {
  dinari: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.5" fill="currentColor"/><circle cx="12" cy="12" r="6.5" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.4"/><path d="M12 7.5l1.3 3.2 3.2 1.3-3.2 1.3L12 16.5l-1.3-3.2L7.5 12l3.2-1.3z" fill="#fff" fill-opacity=".85"/></svg>`,
  kupe: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M5 3h14c0 5.6-2.8 9-5.6 9.7V17h3.4v2.6H7.2V17h3.4v-4.3C7.8 12 5 8.6 5 3z"/><path d="M7.4 5.2h9.2" stroke="#fff" stroke-opacity=".6" stroke-width="1.2"/></svg>`,
  spade: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 1.5l2.2 3V14h-4.4V4.5z"/><rect x="6" y="14" width="12" height="2.4" rx="1.2" fill="currentColor"/><rect x="10.8" y="16.4" width="2.4" height="4.2" fill="currentColor"/><circle cx="12" cy="21.4" r="1.6" fill="currentColor"/></svg>`,
  bati: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9.6 2.5c1.6-.9 3.6-.6 4.8.6.9.9 1 2.3.5 3.4l-2.6 14.6c-.2 1.1-1.8 1.1-2 0L7.9 6.7c-.4-1.6.2-3.3 1.7-4.2z"/><circle cx="9.3" cy="9.5" r="1.4" fill="currentColor"/><circle cx="14.4" cy="12.5" r="1.4" fill="currentColor"/><circle cx="9.8" cy="15.6" r="1.3" fill="currentColor"/></svg>`,
};
export const suitIcon = (s) => `<span class="suit-ico s-${s}">${SUIT_SVG[s]}</span>`;

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
      ? `<div class="center fig">${suitIcon(c.s)}<span class="fig-name">${fig}</span></div>`
      : `<div class="center pips">${suitIcon(c.s)}</div>`;
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
