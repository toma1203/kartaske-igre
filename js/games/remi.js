// Remi i Slagalica za dva igrača (2 špila + 4 jokera).
// Slagalica = remi bez minimuma za otvaranje i bez obveze korištenja karte sa stola.
import { frenchDeck, shuffle, cardName, FR_SUITS } from '../cards.js';

export const OPEN_MIN = { remi: 51, slagalica: 0 };

const strip = (c) => {
  const { rep, ...rest } = c;
  return rest;
};

export function cardValue(r) {
  return r === 1 ? 10 : Math.min(r, 10);
}

export function penalty(c) {
  return c.j ? 20 : cardValue(c.r);
}

// Analiza grupe karata: vraća { type, value, order } ili null.
export function analyze(input) {
  const cards = input.map(strip);
  if (cards.length < 3) return null;
  const nat = cards.filter((c) => !c.j);
  const jk = cards.filter((c) => c.j);
  if (!nat.length) return null;
  const r0 = nat[0].r;
  if (nat.every((c) => c.r === r0)) {
    const suits = nat.map((c) => c.s);
    if (new Set(suits).size === suits.length && cards.length <= 4) {
      const missing = FR_SUITS.filter((s) => !suits.includes(s));
      const order = [...nat, ...jk.map((j, i) => ({ ...j, rep: { r: r0, s: missing[i] } }))];
      return { type: 'set', value: cardValue(r0) * cards.length, order };
    }
    if (nat.length > 1) return null;
  }
  const s0 = nat[0].s;
  if (!nat.every((c) => c.s === s0)) return null;
  return tryRun(nat, jk, s0, false) || tryRun(nat, jk, s0, true);
}

function tryRun(nat, jk, suit, aceHigh) {
  const items = nat.map((c) => ({ c, v: c.r === 1 ? (aceHigh ? 14 : 1) : c.r }));
  const aces = items.filter((i) => i.c.r === 1);
  if (aces.length > 2) return null;
  if (aces.length === 2) {
    if (aceHigh) return null;
    aces[0].v = 1;
    aces[1].v = 14;
  }
  items.sort((a, b) => a.v - b.v);
  let gaps = 0;
  for (let i = 1; i < items.length; i++) {
    if (items[i].v === items[i - 1].v) return null;
    gaps += items[i].v - items[i - 1].v - 1;
  }
  if (gaps > jk.length) return null;
  let extra = jk.length - gaps;
  let lo = items[0].v;
  let hi = items[items.length - 1].v;
  const up = Math.min(extra, 14 - hi);
  hi += up;
  extra -= up;
  lo -= extra;
  if (lo < 1) return null;
  const order = [];
  let ni = 0;
  let ji = 0;
  let value = 0;
  for (let v = lo; v <= hi; v++) {
    if (ni < items.length && items[ni].v === v) order.push(items[ni++].c);
    else order.push({ ...jk[ji++], rep: { r: v === 14 ? 1 : v, s: suit } });
    value += v === 1 ? 1 : v === 14 ? 10 : Math.min(v, 10);
  }
  return { type: 'run', value, order };
}

export function create(gameId, names, opts = {}) {
  const g = {
    game: gameId,
    names,
    limit: Number(opts.limit) || 5, // < 50 = broj ruku, inače granica bodova
    minOpen: OPEN_MIN[gameId],
    mustUseDiscard: gameId === 'remi',
    scores: [0, 0],
    starter: Math.random() < 0.5 ? 0 : 1,
    handNo: 0,
    history: [],
  };
  deal(g);
  return g;
}

function deal(g) {
  const deck = shuffle(frenchDeck(2, 4));
  g.hands = [[], []];
  for (let i = 0; i < 14; i++) {
    g.hands[0].push(deck.shift());
    g.hands[1].push(deck.shift());
  }
  g.hands[g.starter].push(deck.shift());
  g.stock = deck;
  g.discard = [];
  g.melds = [];
  g.meldSeq = 0;
  g.opened = [false, false];
  g.turn = g.starter;
  g.step = 'play'; // prvi igrač ima 15 karata i samo odbacuje
  g.phase = 'play';
  g.ts = { mustUse: null, openedAtStart: false, laid: false, drawn: null };
  g.result = null;
  g.handNo++;
  g.events = [`Ruka ${g.handNo}: prvi igra ${g.names[g.starter]}`];
}

function event(g, text) {
  g.events.push(text);
  if (g.events.length > 4) g.events.shift();
}

function takeFromHand(g, seat, ids) {
  const hand = g.hands[seat];
  if (new Set(ids).size !== ids.length) return null;
  const cards = ids.map((id) => hand.find((c) => c.id === id));
  if (cards.some((c) => !c)) return null;
  return cards;
}

function removeFromHand(g, seat, ids) {
  g.hands[seat] = g.hands[seat].filter((c) => !ids.includes(c.id));
}

function nextTurn(g) {
  g.turn = 1 - g.turn;
  g.step = 'draw';
  g.ts = { mustUse: null, openedAtStart: g.opened[g.turn], laid: false, drawn: null };
}

export function act(g, seat, a) {
  if (a.type === 'next' && g.phase === 'handOver') {
    g.starter = 1 - g.starter;
    deal(g);
    return { ok: true };
  }
  if (a.type === 'rematch' && g.phase === 'matchOver') {
    g.scores = [0, 0];
    g.history = [];
    g.starter = 1 - g.starter;
    deal(g);
    return { ok: true };
  }
  if (g.phase !== 'play') return { error: 'Ruka je završena.' };
  if (seat !== g.turn) return { error: 'Nisi na potezu.' };
  const name = g.names[seat];

  switch (a.type) {
    case 'drawStock': {
      if (g.step !== 'draw') return { error: 'Već si vukao kartu.' };
      if (!g.stock.length) {
        if (g.discard.length <= 1) return endDraw(g);
        const top = g.discard.pop();
        g.stock = shuffle(g.discard);
        g.discard = [top];
        event(g, 'Špil je promiješan iz odbačenih karata');
      }
      const c = g.stock.shift();
      g.hands[seat].push(c);
      g.ts.drawn = c.id;
      g.step = 'play';
      event(g, `${name} vuče iz špila`);
      return { ok: true };
    }
    case 'drawDiscard': {
      if (g.step !== 'draw') return { error: 'Već si vukao kartu.' };
      if (!g.discard.length) return { error: 'Nema karte na stolu.' };
      const c = g.discard.pop();
      g.hands[seat].push(c);
      g.ts.drawn = c.id;
      if (g.mustUseDiscard) g.ts.mustUse = c.id;
      g.step = 'play';
      event(g, `${name} uzima ${cardName(c)} sa stola`);
      return { ok: true };
    }
    case 'undoDraw': {
      const id = g.ts.mustUse;
      if (!id || g.ts.laid) return { error: 'Ne možeš vratiti kartu.' };
      const c = g.hands[seat].find((x) => x.id === id);
      if (!c) return { error: 'Ne možeš vratiti kartu.' };
      removeFromHand(g, seat, [id]);
      g.discard.push(c);
      g.ts.mustUse = null;
      g.ts.drawn = null;
      g.step = 'draw';
      event(g, `${name} vraća kartu na stol`);
      return { ok: true };
    }
    case 'lay': {
      if (g.step !== 'play') return { error: 'Prvo vuci kartu.' };
      const groups = a.groups || [];
      if (!groups.length) return { error: 'Nema grupa za spuštanje.' };
      const all = groups.flat();
      const cards = takeFromHand(g, seat, all);
      if (!cards) return { error: 'Neispravne karte.' };
      const results = [];
      for (const ids of groups) {
        const r = analyze(ids.map((id) => cards.find((c) => c.id === id)));
        if (!r) return { error: 'Neka od grupa nije ispravna (treba 3+ karte: ista vrijednost ili niz u istoj boji).' };
        results.push(r);
      }
      const total = results.reduce((s, r) => s + r.value, 0);
      if (!g.opened[seat] && total < g.minOpen) {
        return { error: `Za otvaranje treba ${g.minOpen} bodova — imaš ${total}.` };
      }
      for (const r of results) g.melds.push({ id: ++g.meldSeq, owner: seat, type: r.type, cards: r.order });
      removeFromHand(g, seat, all);
      const wasOpen = g.opened[seat];
      g.opened[seat] = true;
      g.ts.laid = true;
      if (g.ts.mustUse && all.includes(g.ts.mustUse)) g.ts.mustUse = null;
      event(g, `${name} ${wasOpen ? 'spušta' : 'otvara se s'} ${total} bodova`);
      if (!g.hands[seat].length) return goOut(g, seat);
      return { ok: true };
    }
    case 'add': {
      if (g.step !== 'play') return { error: 'Prvo vuci kartu.' };
      if (!g.opened[seat]) return { error: 'Prvo se moraš otvoriti.' };
      const meld = g.melds.find((m) => m.id === a.meldId);
      if (!meld) return { error: 'Nema te grupe.' };
      const cards = takeFromHand(g, seat, a.ids || []);
      if (!cards || !cards.length) return { error: 'Odaberi karte.' };
      const r = analyze([...meld.cards, ...cards]);
      if (!r) return { error: 'Te karte ne pašu u tu grupu.' };
      meld.cards = r.order;
      meld.type = r.type;
      removeFromHand(g, seat, a.ids);
      g.ts.laid = true;
      if (g.ts.mustUse && a.ids.includes(g.ts.mustUse)) g.ts.mustUse = null;
      event(g, `${name} dodaje ${cards.map(cardName).join(', ')}`);
      if (!g.hands[seat].length) return goOut(g, seat);
      return { ok: true };
    }
    case 'swap': {
      if (g.step !== 'play') return { error: 'Prvo vuci kartu.' };
      if (!g.opened[seat]) return { error: 'Prvo se moraš otvoriti.' };
      const meld = g.melds.find((m) => m.id === a.meldId);
      const card = g.hands[seat].find((c) => c.id === a.cardId);
      if (!meld || !card || card.j) return { error: 'Neispravna zamjena.' };
      const idx = jokerIndexFor(meld, card);
      if (idx < 0) return { error: 'Ta karta ne mijenja jokera u toj grupi.' };
      const joker = strip(meld.cards[idx]);
      const next = meld.cards.map((c, i) => (i === idx ? card : c));
      const r = analyze(next);
      if (!r) return { error: 'Neispravna zamjena.' };
      meld.cards = r.order;
      meld.type = r.type;
      removeFromHand(g, seat, [card.id]);
      g.hands[seat].push(joker);
      g.ts.laid = true;
      if (g.ts.mustUse === card.id) g.ts.mustUse = null;
      event(g, `${name} uzima jokera za ${cardName(card)}`);
      return { ok: true };
    }
    case 'discard': {
      if (g.step !== 'play') return { error: 'Prvo vuci kartu.' };
      if (g.ts.mustUse && g.hands[seat].some((c) => c.id === g.ts.mustUse)) {
        return { error: 'Kartu uzetu sa stola moraš iskoristiti (ili je vrati).' };
      }
      const cards = takeFromHand(g, seat, [a.cardId]);
      if (!cards) return { error: 'Odaberi kartu za odbacivanje.' };
      removeFromHand(g, seat, [a.cardId]);
      g.discard.push(cards[0]);
      event(g, `${name} odbacuje ${cardName(cards[0])}`);
      if (!g.hands[seat].length) return goOut(g, seat);
      nextTurn(g);
      return { ok: true };
    }
  }
  return { error: 'Nepoznata akcija.' };
}

export function jokerIndexFor(meld, card) {
  if (card.j) return -1;
  return meld.cards.findIndex((c) => {
    if (!c.j || !c.rep) return false;
    if (meld.type === 'run') return c.rep.r === card.r && c.rep.s === card.s;
    return c.rep.r === card.r && !meld.cards.some((x) => !x.j && x.s === card.s);
  });
}

function endDraw(g) {
  g.result = { winner: -1, pts: [0, 0], text: 'Nema više karata — ruka se ne boduje.' };
  g.history.push([0, 0]);
  finishHand(g);
  return { ok: true };
}

function goOut(g, w) {
  const l = 1 - w;
  const ruka = !g.ts.openedAtStart;
  const handPts = g.hands[l].reduce((s, c) => s + penalty(c), 0);
  let lp = g.opened[l] ? handPts : 100;
  if (ruka) lp *= 2;
  const wp = ruka ? -80 : -40;
  const pts = [0, 0];
  pts[w] = wp;
  pts[l] = lp;
  g.scores = g.scores.map((s, i) => s + pts[i]);
  g.history.push(pts);
  g.result = {
    winner: w,
    pts,
    ruka,
    oppHand: g.hands[l],
    text: `${g.names[w]} je završio${ruka ? ' iz ruke (dupli bodovi)!' : '!'} · ${g.names[l]} +${lp}${g.opened[l] ? '' : ' (nije otvoren)'}`,
  };
  event(g, `${g.names[w]} je završio ruku`);
  finishHand(g);
  return { ok: true };
}

function finishHand(g) {
  const over = g.limit < 50 ? g.handNo >= g.limit : g.scores.some((s) => s >= g.limit);
  g.matchWinner = over ? (g.scores[0] < g.scores[1] ? 0 : g.scores[1] < g.scores[0] ? 1 : -1) : -1;
  g.phase = over ? 'matchOver' : 'handOver';
}

export function view(g, seat) {
  const opp = 1 - seat;
  return {
    kind: 'rummy',
    game: g.game,
    seat,
    names: g.names,
    phase: g.phase,
    turn: g.turn,
    step: g.step,
    hand: g.hands[seat],
    oppCount: g.hands[opp].length,
    stockCount: g.stock.length,
    discardTop: g.discard[g.discard.length - 1] || null,
    discardCount: g.discard.length,
    melds: g.melds,
    opened: g.opened,
    mustUse: g.turn === seat ? g.ts.mustUse : null,
    drawn: g.turn === seat ? g.ts.drawn : null,
    canUndo: g.turn === seat && !!g.ts.mustUse && !g.ts.laid,
    scores: g.scores,
    limit: g.limit,
    minOpen: g.minOpen,
    handNo: g.handNo,
    result: g.result,
    matchWinner: g.matchWinner,
    history: g.history,
    events: g.events,
  };
}

// ---------- Bot ----------

// Pohlepno traženje grupa u ruci.
export function findMelds(hand) {
  const nat = hand.filter((c) => !c.j);
  const jokers = hand.filter((c) => c.j);
  const cands = [];
  // skupine iste vrijednosti
  const byRank = {};
  for (const c of nat) (byRank[c.r] ||= []).push(c);
  for (const r in byRank) {
    const uniq = [];
    for (const c of byRank[r]) if (!uniq.some((u) => u.s === c.s)) uniq.push(c);
    if (uniq.length >= 3) cands.push(uniq.slice(0, 4));
  }
  // nizovi
  for (const s of FR_SUITS) {
    const bySuit = {};
    for (const c of nat) if (c.s === s && !bySuit[c.r]) bySuit[c.r] = c;
    const at = (v) => bySuit[v === 14 ? 1 : v];
    let run = [];
    for (let v = 1; v <= 15; v++) {
      const c = v <= 14 ? at(v) : null;
      if (c && !(v === 14 && run.some((x) => x === c))) run.push(c);
      else {
        if (run.length >= 3) cands.push(run);
        run = c ? [c] : [];
      }
    }
  }
  const scored = cands.map((cs) => ({ cs, r: analyze(cs) })).filter((x) => x.r);
  scored.sort((a, b) => b.r.value - a.r.value || b.cs.length - a.cs.length);
  const used = new Set();
  const groups = [];
  for (const { cs } of scored) {
    if (cs.some((c) => used.has(c.id))) continue;
    cs.forEach((c) => used.add(c.id));
    groups.push([...cs]);
  }
  // jokeri: dopuni parove u grupe
  let jk = [...jokers];
  if (jk.length) {
    const rest = nat.filter((c) => !used.has(c.id)).sort((a, b) => cardValue(b.r) - cardValue(a.r));
    for (let i = 0; i < rest.length && jk.length; i++) {
      for (let k = i + 1; k < rest.length && jk.length; k++) {
        const a = rest[i];
        const b = rest[k];
        if (used.has(a.id) || used.has(b.id)) continue;
        if (analyze([a, b, jk[0]])) {
          const j = jk.shift();
          groups.push([a, b, j]);
          used.add(a.id);
          used.add(b.id);
          used.add(j.id);
        }
      }
    }
    // preostale jokere dodaj u postojeće grupe
    for (const j of [...jk]) {
      const gi = groups.findIndex((gr) => analyze([...gr, j]));
      if (gi >= 0) {
        groups[gi].push(j);
        jk = jk.filter((x) => x !== j);
      }
    }
  }
  const value = groups.reduce((s, gr) => s + analyze(gr).value, 0);
  return { groups, value };
}

function connections(c, hand) {
  return hand.filter(
    (o) => o !== c && !o.j && ((o.r === c.r && o.s !== c.s) || (o.s === c.s && Math.abs(o.r - c.r) <= 2 && o.r !== c.r)),
  ).length;
}

export function bot(g, seat) {
  if (g.phase !== 'play' || g.turn !== seat) return null;
  const hand = g.hands[seat];
  const opened = g.opened[seat];
  if (g.step === 'draw') {
    const top = g.discard[g.discard.length - 1];
    if (top) {
      const f = findMelds([...hand, top]);
      const usesTop = f.groups.some((gr) => gr.includes(top));
      const fitsTable = opened && g.melds.some((m) => analyze([...m.cards, top]));
      if (usesTop && (opened || f.value >= g.minOpen) && f.value > 0) return { type: 'drawDiscard' };
      if (!g.mustUseDiscard && fitsTable) return { type: 'drawDiscard' };
    }
    return { type: 'drawStock' };
  }
  const f = findMelds(hand);
  if (f.groups.length && (opened || f.value >= g.minOpen)) {
    return { type: 'lay', groups: f.groups.map((gr) => gr.map((c) => c.id)) };
  }
  if (g.ts.mustUse && hand.some((c) => c.id === g.ts.mustUse) && !g.ts.laid) return { type: 'undoDraw' };
  if (opened) {
    for (const c of hand) {
      for (const m of g.melds) {
        if (jokerIndexFor(m, c) >= 0) return { type: 'swap', meldId: m.id, cardId: c.id };
        if (analyze([...m.cards, c])) return { type: 'add', meldId: m.id, ids: [c.id] };
      }
    }
  }
  const cand = hand.filter((c) => !c.j && c.id !== g.ts.mustUse);
  const pool = cand.length ? cand : hand;
  const worst = [...pool].sort(
    (a, b) => (a.j ? -99 : penalty(a) - 6 * connections(a, hand)) - (b.j ? -99 : penalty(b) - 6 * connections(b, hand)),
  );
  return { type: 'discard', cardId: worst[worst.length - 1].id };
}
