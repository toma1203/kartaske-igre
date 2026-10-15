import * as tricks from './tricks.js';
import * as remi from './remi.js';

const trickEngine = (id) => ({
  create: (names, opts) => tricks.create(id, names, opts),
  act: tricks.act,
  resolve: tricks.resolve,
  view: tricks.view,
  bot: tricks.bot,
});
const remiEngine = (id) => ({
  create: (names, opts) => remi.create(id, names, opts),
  act: remi.act,
  resolve: () => {},
  view: remi.view,
  bot: remi.bot,
});

export const GAMES = {
  briskula: {
    id: 'briskula',
    name: 'Briškula',
    tag: 'Klasika s adutom',
    icon: 'spade',
    deck: 'Talijanske karte · 40',
    engine: trickEngine('briskula'),
    options: [{ key: 'target', label: 'Partija do', values: [1, 2, 3, 4], def: 2, fmt: (v) => `${v} pobjede` }],
    rules: [
      'Svaki igrač ima 3 karte, okrenuta karta određuje adut (briškulu).',
      'Ne mora se odgovarati na boju. Adut nosi sve ostale boje.',
      'Jačina: A, 3, 13 (kralj), 12 (konj), 11 (fanat), 7, 6, 5, 4, 2.',
      'Bodovi: A = 11, 3 = 10, kralj = 4, konj = 3, fanat = 2. Ukupno 120.',
      'Ruku dobiva tko skupi 61+ bod. Nakon štiha prvi vuče onaj tko je nosio.',
    ],
  },
  treseta: {
    id: 'treseta',
    name: 'Trešeta',
    tag: 'Odgovaraj na boju',
    icon: 'dinari',
    deck: 'Talijanske karte · 40',
    engine: trickEngine('treseta'),
    options: [
      { key: 'target', label: 'Igra se do', values: [11, 21, 31, 41], def: 31, fmt: (v) => `${v} bodova` },
      { key: 'akuze', label: 'Akuže', values: [true, false], def: true, fmt: (v) => (v ? 'Da' : 'Ne') },
    ],
    rules: [
      'Svatko dobije 10 karata, ostalo je u špilu. Nakon štiha oba igrača vuku (izvučena karta se vidi).',
      'Mora se odgovoriti na boju ako je imaš. Nema aduta.',
      'Jačina: 3, 2, A, 13, 12, 11, 7, 6, 5, 4.',
      'As = 1 bod; 3, 2 i figure = 1/3 boda. Zadnji štih = 1 bod.',
      'Akuže: napolitana (A-2-3 iste boje) = 3, tri trice/duje/asa = 3, četiri = 4.',
    ],
  },
  remi: {
    id: 'remi',
    name: 'Remi',
    tag: 'Otvaranje s 51',
    icon: 'kupe',
    deck: '2 špila + 4 jokera',
    engine: remiEngine('remi'),
    options: [{ key: 'limit', label: 'Partija', values: [3, 5, 10, 501], def: 5, fmt: (v) => (v < 50 ? `${v} ruku` : `do ${v} bodova`) }],
    rules: [
      '14 karata (prvi igrač 15). Na potezu vučeš iz špila ili sa stola, slažeš i odbacuješ jednu kartu.',
      'Grupe: 3–4 iste vrijednosti različitih boja ili niz od 3+ u istoj boji (A-2-3 … Q-K-A).',
      'Prvo otvaranje mora vrijediti barem 51 bod. Kartu sa stola moraš odmah iskoristiti.',
      'Nakon otvaranja možeš dodavati na sve grupe na stolu i mijenjati jokere.',
      'Tko završi dobiva −40 (iz ruke −80). Protivnik dobiva zbroj karata u ruci (ako nije otvoren 100).',
    ],
  },
  slagalica: {
    id: 'slagalica',
    name: 'Slagalica',
    tag: 'Remi bez minimuma',
    icon: 'bati',
    deck: '2 špila + 4 jokera',
    engine: remiEngine('slagalica'),
    options: [{ key: 'limit', label: 'Partija', values: [3, 5, 10, 501], def: 5, fmt: (v) => (v < 50 ? `${v} ruku` : `do ${v} bodova`) }],
    rules: [
      'Isto kao remi, ali za otvaranje nije potreban minimum bodova.',
      'Grupe možeš spuštati čim ih složiš, a kartu sa stola uzimaš slobodno.',
      'Grupe: 3–4 iste vrijednosti različitih boja ili niz od 3+ u istoj boji.',
      'Tko završi dobiva −40 (sve odjednom −80). Protivnik dobiva zbroj karata u ruci.',
    ],
  },
};

export function defaultOpts(id) {
  const o = {};
  for (const op of GAMES[id].options) o[op.key] = op.def;
  return o;
}
