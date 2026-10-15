// Briškula i Trešeta za dva igrača — zajednički "štih" engine.
import { italianDeck, shuffle, cardName, IT_SUIT_NAMES } from '../cards.js';

const BRISKULA = {
  id: 'briskula',
  handSize: 3,
  trump: true,
  mustFollow: false,
  str: { A: 10, 3: 9, K: 8, C: 7, F: 6, 7: 5, 6: 4, 5: 3, 4: 2, 2: 1 },
  pts: { A: 11, 3: 10, K: 4, C: 3, F: 2 },
};

const TRESETA = {
  id: 'treseta',
  handSize: 10,
  trump: false,
  mustFollow: true,
  str: { 3: 10, 2: 9, A: 8, K: 7, C: 6, F: 5, 7: 4, 6: 3, 5: 2, 4: 1 },
  // u trećinama boda: as = 1 bod, 3/2/figure = 1/3 boda
  pts: { A: 3, 3: 1, 2: 1, K: 1, C: 1, F: 1 },
};

const V = { briskula: BRISKULA, treseta: TRESETA };

export function create(gameId, names, opts = {}) {
  const v = V[gameId];
  const g = {
    game: gameId,
    names,
    match: [0, 0],
    target: Number(opts.target) || (gameId === 'briskula' ? 2 : 31),
    akuze: gameId === 'treseta' && opts.akuze !== false,
    starter: Math.random() < 0.5 ? 0 : 1,
    handNo: 0,
    history: [],
  };
  deal(g, v);
  return g;
}

function deal(g, v = V[g.game]) {
  const deck = shuffle(italianDeck());
  g.hands = [deck.splice(0, v.handSize), deck.splice(0, v.handSize)];
  g.trumpCard = null;
  if (v.trump) {
    g.trumpCard = deck.shift();
    deck.push(g.trumpCard); // zadnja karta u špilu
  }
  g.stock = deck;
  g.trick = [];
  g.taken = [[], []];
  g.turn = g.starter;
  g.phase = 'play';
  g.pending = false;
  g.lastTrick = null;
  g.lastDraw = null;
  g.result = null;
  g.handNo++;
  g.events = [];
  g.declared = [[], []];
  if (g.akuze) {
    g.declared = g.hands.map(findAkuze);
    g.declared.forEach((d, i) => d.forEach((a) => g.events.push(`${g.names[i]} akuža: ${a.text} (+${a.pts})`)));
  }
}

function findAkuze(hand) {
  const out = [];
  const has = (r, s) => hand.some((c) => c.r === r && c.s === s);
  for (const s of Object.keys(IT_SUIT_NAMES)) {
    if (has('A', s) && has('2', s) && has('3', s)) out.push({ text: `Napolitana ${IT_SUIT_NAMES[s].toLowerCase()}`, pts: 3 });
  }
  const NAMES = { 3: 'trice', 2: 'duje', A: 'asa' };
  for (const r of ['3', '2', 'A']) {
    const n = hand.filter((c) => c.r === r).length;
    if (n >= 3) out.push({ text: `${n === 4 ? 'četiri' : 'tri'} ${NAMES[r]}`, pts: n });
  }
  return out;
}

// Pobjeđuje li karta b (odigrana druga) kartu a (vodeća)?
function beats(v, b, a, trumpSuit) {
  if (b.s === a.s) return v.str[b.r] > v.str[a.r];
  if (v.trump && b.s === trumpSuit) return true;
  return false;
}

export function playable(g, seat) {
  const v = V[g.game];
  const hand = g.hands[seat];
  if (g.phase !== 'play' || g.pending || g.turn !== seat) return [];
  if (v.mustFollow && g.trick.length === 1) {
    const led = g.trick[0].card.s;
    const follow = hand.filter((c) => c.s === led);
    if (follow.length) return follow.map((c) => c.id);
  }
  return hand.map((c) => c.id);
}

export function act(g, seat, a) {
  const v = V[g.game];
  if (a.type === 'play') {
    if (g.phase !== 'play') return { error: 'Ruka je završena.' };
    if (g.pending) return { error: 'Pričekaj trenutak…' };
    if (seat !== g.turn) return { error: 'Nisi na potezu.' };
    if (!playable(g, seat).includes(a.card)) {
      return { error: v.mustFollow ? 'Moraš odgovoriti na boju.' : 'Ne možeš odigrati tu kartu.' };
    }
    const hand = g.hands[seat];
    const card = hand.splice(hand.findIndex((c) => c.id === a.card), 1)[0];
    g.trick.push({ seat, card });
    if (g.trick.length < 2) {
      g.turn = 1 - seat;
      return { ok: true };
    }
    const [x, y] = g.trick;
    g.trickWinner = beats(v, y.card, x.card, g.trumpCard?.s) ? y.seat : x.seat;
    g.pending = true;
    return { ok: true, delay: 1300 };
  }
  if (a.type === 'next' && g.phase === 'handOver') {
    g.starter = 1 - g.starter;
    deal(g);
    return { ok: true };
  }
  if (a.type === 'rematch' && g.phase === 'matchOver') {
    g.match = [0, 0];
    g.history = [];
    g.starter = 1 - g.starter;
    deal(g);
    return { ok: true };
  }
  return { error: 'Nepoznata akcija.' };
}

// Poziva domaćin nakon kratke pauze da se vidi odigrani štih.
export function resolve(g) {
  if (!g.pending) return;
  const v = V[g.game];
  const w = g.trickWinner;
  const pts = g.trick.reduce((s, t) => s + (v.pts[t.card.r] || 0), 0);
  g.taken[w].push(...g.trick.map((t) => t.card));
  g.lastTrick = { cards: g.trick, winner: w, pts };
  g.trick = [];
  g.pending = false;
  g.turn = w;
  g.lastDraw = null;
  if (g.stock.length) {
    const a = g.stock.shift();
    const b = g.stock.shift();
    g.hands[w].push(a);
    g.hands[1 - w].push(b);
    g.lastDraw = [
      { seat: w, card: a },
      { seat: 1 - w, card: b },
    ];
  }
  if (!g.hands[0].length && !g.hands[1].length) endHand(g, w);
}

function endHand(g, lastWinner) {
  const v = V[g.game];
  let pts, text, winner;
  if (g.game === 'briskula') {
    pts = g.taken.map((t) => t.reduce((s, c) => s + (v.pts[c.r] || 0), 0));
    winner = pts[0] > 60 ? 0 : pts[1] > 60 ? 1 : -1;
    if (winner >= 0) g.match[winner]++;
    text = winner < 0 ? 'Neriješeno 60 : 60' : `${g.names[winner]} dobiva ruku (${pts[winner]} bodova)`;
    g.history.push(pts);
  } else {
    const thirds = g.taken.map((t) => t.reduce((s, c) => s + (v.pts[c.r] || 0), 0));
    const base = thirds.map((t) => Math.floor(t / 3));
    const ak = g.declared.map((d) => d.reduce((s, a) => s + a.pts, 0));
    pts = base.map((b, i) => b + (i === lastWinner ? 1 : 0) + ak[i]);
    g.match = g.match.map((m, i) => m + pts[i]);
    winner = pts[0] === pts[1] ? -1 : pts[0] > pts[1] ? 0 : 1;
    text = `Ruka: ${pts[0]} : ${pts[1]}` + (ak[0] || ak[1] ? ` (akuže ${ak[0]} : ${ak[1]})` : '') + ` · zadnja: ${g.names[lastWinner]}`;
    g.history.push(pts);
  }
  g.result = { pts, winner, text, lastWinner };
  let mw = -1;
  if (g.game === 'briskula') {
    mw = g.match[0] >= g.target ? 0 : g.match[1] >= g.target ? 1 : -1;
  } else if ((g.match[0] >= g.target || g.match[1] >= g.target) && g.match[0] !== g.match[1]) {
    mw = g.match[0] > g.match[1] ? 0 : 1;
  }
  g.matchWinner = mw;
  g.phase = mw >= 0 ? 'matchOver' : 'handOver';
}

export function view(g, seat) {
  const v = V[g.game];
  const opp = 1 - seat;
  return {
    kind: 'trick',
    game: g.game,
    seat,
    names: g.names,
    phase: g.phase,
    turn: g.turn,
    pending: g.pending,
    trickWinner: g.pending ? g.trickWinner : null,
    hand: g.hands[seat],
    oppCount: g.hands[opp].length,
    stockCount: g.stock.length,
    trumpCard: g.stock.length ? g.trumpCard : null,
    trumpSuit: g.trumpCard?.s || null,
    trick: g.trick,
    lastTrick: g.lastTrick,
    oppDrew: g.game === 'treseta' && g.lastDraw ? g.lastDraw.find((d) => d.seat === opp)?.card : null,
    takenCount: g.taken.map((t) => t.length / 2),
    match: g.match,
    target: g.target,
    handNo: g.handNo,
    declared: g.declared,
    result: g.result,
    matchWinner: g.matchWinner,
    history: g.history,
    events: g.events,
    playable: playable(g, seat),
    strength: v.str,
  };
}

// ---------- Bot ----------
export function bot(g, seat) {
  if (g.phase !== 'play' || g.pending || g.turn !== seat) return null;
  const v = V[g.game];
  const ids = playable(g, seat);
  const cards = g.hands[seat].filter((c) => ids.includes(c.id));
  const P = (c) => v.pts[c.r] || 0;
  const S = (c) => v.str[c.r];
  const trump = g.trumpCard?.s;
  const isT = (c) => v.trump && c.s === trump;
  const cheapest = (arr) =>
    [...arr].sort((a, b) => P(a) + (isT(a) ? 20 : 0) + S(a) / 20 - (P(b) + (isT(b) ? 20 : 0) + S(b) / 20))[0];
  let pick;
  if (g.trick.length === 0) {
    if (g.game === 'treseta') {
      // vodi s trojkom ako ju ima (sigurna ruka), inače najslabijom kartom
      pick = cards.find((c) => c.r === '3') || cheapest(cards);
    } else {
      pick = cheapest(cards.filter((c) => !isT(c))) || cheapest(cards);
    }
  } else {
    const led = g.trick[0].card;
    const winners = cards.filter((c) => beats(v, c, led, trump));
    const onTable = P(led);
    if (g.game === 'briskula') {
      const nonTrumpWin = winners.filter((c) => !isT(c)).sort((a, b) => P(b) - P(a));
      const trumpWin = winners.filter(isT).sort((a, b) => S(a) - S(b));
      if (nonTrumpWin.length && (onTable > 0 || P(nonTrumpWin[0]) > 0)) pick = nonTrumpWin[0];
      else if (trumpWin.length && onTable >= 10) pick = trumpWin[0];
      else if (trumpWin.length && onTable >= 3 && P(trumpWin[0]) === 0) pick = trumpWin[0];
      else pick = cheapest(cards);
    } else {
      const sortedW = winners.sort((a, b) => S(a) - S(b));
      if (sortedW.length && (onTable > 0 || g.stock.length === 0)) pick = sortedW[0];
      else if (sortedW.length && P(sortedW[0]) > 0 && S(sortedW[0]) >= 9) pick = sortedW[0];
      else pick = cheapest(cards);
    }
  }
  return { type: 'play', card: (pick || cards[0]).id };
}

export function describeCard(c) {
  return cardName(c);
}
