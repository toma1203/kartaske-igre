import { GAMES, defaultOpts } from './games/index.js';
import { cardHTML, suitIcon, IT_SUITS, IT_SUIT_NAMES, FR_SUITS } from './cards.js';
import { analyze, jokerIndexFor } from './games/remi.js';
import { HostSession, GuestSession, savedHost, inviteLink, storage } from './session.js';

const $app = document.getElementById('app');
const S = {
  session: null,
  pub: null,
  net: '',
  joinCode: null,
  homeGame: GAMES[storage('local', 'kartaske-game')] ? storage('local', 'kartaske-game') : 'briskula',
  homeOpts: {},
  sel: [],
  staged: [],
  order: [],
  sortMode: 'suit',
  handKey: null,
  seen: new Set(),
  wasMyTurn: false,
  sheetHidden: false,
};
S.homeOpts = defaultOpts(S.homeGame);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const getName = () => storage('local', 'kartaske-name') || '';
const EMOTES = ['👍', '😂', '😮', '😡', '🔥', '👏'];

// ---------- UI callbacks za sesiju ----------
const ui = {
  state(pub) {
    S.pub = pub;
    onNewState(pub);
    render();
  },
  toast,
  net(msg) {
    S.net = msg;
    renderNet();
  },
  emote(mine, e) {
    showEmote(mine, e);
  },
};

function toast(msg, kind = '') {
  const box = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3000);
}

function renderNet() {
  const el = document.getElementById('net');
  el.textContent = S.net;
  el.classList.toggle('show', !!S.net && !!S.session);
}

function showEmote(mine, e) {
  const el = document.createElement('div');
  el.className = `emote-bubble ${mine ? 'mine' : 'theirs'}`;
  el.textContent = e;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2400);
}

// ---------- stanje ----------
const isMyTurn = (v) => v && v.phase === 'play' && v.turn === v.seat && !v.pending;

function onNewState(pub) {
  const v = pub.view;
  if (!v || pub.status !== 'playing') {
    S.handKey = null;
    document.title = 'Kartaške igre';
    return;
  }
  const key = `${v.game}-${v.handNo}`;
  const ids = v.hand.map((c) => c.id);
  if (S.handKey !== key) {
    S.handKey = key;
    S.order = sortCards(v.hand, v).map((c) => c.id);
    S.sel = [];
    S.staged = [];
    S.seen = new Set();
    S.sheetHidden = false;
  } else {
    S.order = S.order.filter((id) => ids.includes(id));
    for (const id of ids) if (!S.order.includes(id)) S.order.push(id);
    S.sel = S.sel.filter((id) => ids.includes(id));
    S.staged = S.staged.map((g) => g.filter((id) => ids.includes(id))).filter((g) => g.length);
  }
  const mine = isMyTurn(v);
  if (mine && !S.wasMyTurn && pub.mode !== 'bot' && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(25);
  S.wasMyTurn = mine;
  document.title = mine ? '● Tvoj potez · Kartaške' : 'Kartaške igre';
}

const FR_ORDER = ['S', 'H', 'C', 'D'];
function sortCards(hand, v) {
  if (v.kind === 'trick') {
    return [...hand].sort((a, b) => IT_SUITS.indexOf(a.s) - IT_SUITS.indexOf(b.s) || v.strength[b.r] - v.strength[a.r]);
  }
  return [...hand].sort((a, b) => {
    if (a.j || b.j) return (a.j ? 1 : 0) - (b.j ? 1 : 0);
    if (S.sortMode === 'rank') return a.r - b.r || FR_ORDER.indexOf(a.s) - FR_ORDER.indexOf(b.s);
    return FR_ORDER.indexOf(a.s) - FR_ORDER.indexOf(b.s) || a.r - b.r;
  });
}

// ---------- render ----------
function render() {
  if (!S.session) renderHome();
  else if (!S.pub) renderConnecting();
  else if (S.pub.status === 'playing' && S.pub.view) renderGame(S.pub);
  else renderLobby(S.pub);
  renderNet();
  requestAnimationFrame(fitHands);
}

function gameIcon(id) {
  if (id === 'briskula') return `<div class="g-ico">${suitIcon('spade')}${suitIcon('kupe')}</div>`;
  if (id === 'treseta') return `<div class="g-ico">${suitIcon('dinari')}${suitIcon('bati')}</div>`;
  if (id === 'remi') return `<div class="g-ico fr"><span class="red">♥</span><span>♠</span></div>`;
  return `<div class="g-ico fr"><span>♣</span><span class="red">♦</span></div>`;
}

function gameTiles(cur, action) {
  return `<div class="tiles">${Object.values(GAMES)
    .map(
      (g) => `<button class="tile ${cur === g.id ? 'on' : ''}" data-a="${action}" data-id="${g.id}">
        ${gameIcon(g.id)}
        <div class="t-name">${g.name}</div>
        <div class="t-tag">${g.tag}</div>
        <div class="t-deck">${g.deck}</div>
      </button>`,
    )
    .join('')}</div>`;
}

function optionsHTML(gameId, opts, editable) {
  return `<div class="opts">${GAMES[gameId].options
    .map(
      (op) => `<div class="opt"><span>${op.label}</span><div class="seg">${op.values
        .map(
          (val) =>
            `<button class="${opts[op.key] === val ? 'on' : ''}" ${editable ? '' : 'disabled'} data-a="opt" data-key="${op.key}" data-val='${esc(JSON.stringify(val))}'>${op.fmt(val)}</button>`,
        )
        .join('')}</div></div>`,
    )
    .join('')}</div>`;
}

function renderHome() {
  const join = S.joinCode;
  $app.innerHTML = `
  <div class="screen home">
    <div class="hero">
      <div class="logo-cards">
        ${cardHTML({ id: 'x1', s: 'dinari', r: 'A' }, { cls: 'l1' })}
        ${cardHTML({ id: 'x2', s: 'H', r: 1 }, { cls: 'l2' })}
        ${cardHTML({ id: 'x3', s: 'kupe', r: '3' }, { cls: 'l3' })}
      </div>
      <h1>Kartaške</h1>
      <p>Briškula, trešeta, remi i slagalica — igraj 1 na 1 s prijateljem na bilo kojem uređaju.</p>
    </div>
    ${
      join
        ? `<div class="panel join-panel">
        <div class="badge">Pozivnica</div>
        <h2>Pozvan si u sobu <span class="code">${esc(join)}</span></h2>
        <label class="field"><span>Tvoje ime</span><input id="name" maxlength="16" placeholder="npr. Ivana" value="${esc(getName())}" autocomplete="nickname"></label>
        <button class="btn primary big" data-a="join">Uđi u igru</button>
        <button class="btn link" data-a="cancel-join">Ne, želim otvoriti svoju igru</button>
      </div>`
        : `<div class="panel">
        <label class="field"><span>Tvoje ime</span><input id="name" maxlength="16" placeholder="npr. Ivana" value="${esc(getName())}" autocomplete="nickname"></label>
        <div class="section-label">Odaberi igru</div>
        ${gameTiles(S.homeGame, 'home-game')}
        ${optionsHTML(S.homeGame, S.homeOpts, true)}
        <div class="cta">
          <button class="btn primary big" data-a="play-friend">Igraj s prijateljem</button>
          <button class="btn ghost big" data-a="play-bot">Vježbaj protiv računala</button>
        </div>
        <button class="btn link" data-a="rules" data-id="${S.homeGame}">Pravila: ${GAMES[S.homeGame].name}</button>
      </div>`
    }
    <footer class="foot">Dobiješ link, pošalješ ga prijatelju i igrate — bez registracije.</footer>
  </div>`;
}

function renderConnecting() {
  $app.innerHTML = `<div class="screen center-screen">
    <div class="panel narrow">
      <div class="spinner"></div>
      <h2>Spajanje na sobu ${esc(S.session.code)}</h2>
      <p class="muted">${esc(S.net || 'Pričekaj trenutak…')}</p>
      <button class="btn ghost" data-a="leave-now">Odustani</button>
    </div></div>`;
}

function playerRow(p, label, me) {
  if (!p) return `<div class="p-row waiting"><div class="avatar empty"><span class="pulse"></span></div><div><b>Čeka se protivnik…</b><small>Pošalji mu link</small></div></div>`;
  return `<div class="p-row"><div class="avatar ${me ? 'me' : ''}">${esc(p.name[0] || '?').toUpperCase()}</div>
    <div><b>${esc(p.name)}</b><small>${label}${p.bot ? ' · računalo' : ''}</small></div>
    <span class="dot ${p.connected ? 'on' : ''}" title="${p.connected ? 'spojen' : 'nije spojen'}"></span></div>`;
}

function renderLobby(p) {
  const host = p.role === 'host';
  const me = p.mySeat;
  const ready = p.players[1] && p.players[1].connected;
  const g = GAMES[p.gameId];
  $app.innerHTML = `
  <div class="screen lobby">
    <header class="topbar">
      <button class="icon-btn" data-a="leave" aria-label="Izađi">←</button>
      <div class="title"><b>${p.mode === 'bot' ? 'Vježba' : `Soba ${esc(p.code)}`}</b><span>${host ? 'Ti si domaćin' : 'Gost'}</span></div>
      <div class="top-actions"></div>
    </header>
    ${
      host && p.mode === 'online'
        ? `<div class="panel invite">
      <div class="section-label">Pozovi prijatelja</div>
      <div class="link-box"><input readonly value="${esc(inviteLink(p.code))}" id="invite"><button class="btn primary" data-a="copy">Kopiraj</button></div>
      ${navigator.share ? `<button class="btn ghost wide" data-a="share">Podijeli link…</button>` : ''}
      <p class="muted small">Prijatelj otvori link na svom mobitelu ili računalu i odmah je u sobi.</p>
    </div>`
        : ''
    }
    <div class="panel players">
      ${playerRow(p.players[0], host ? 'domaćin · ti' : 'domaćin', me === 0)}
      ${playerRow(p.players[1], host ? 'gost' : 'gost · ti', me === 1)}
    </div>
    <div class="panel">
      <div class="section-label">${host ? 'Odaberi igru' : 'Igra'}</div>
      ${host ? gameTiles(p.gameId, 'lobby-game') : `<div class="chosen">${gameIcon(g.id)}<div><b>${g.name}</b><small>${g.tag}</small></div></div>`}
      ${optionsHTML(p.gameId, p.opts, host)}
      <ul class="rules-list">${g.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    </div>
    <div class="lobby-cta">
      ${
        host
          ? `<button class="btn primary big wide" data-a="start" ${ready ? '' : 'disabled'}>${ready ? `Započni: ${g.name}` : 'Čeka se protivnik…'}</button>`
          : `<div class="wait-host"><div class="spinner small"></div>Čeka se da domaćin pokrene igru…</div>`
      }
    </div>
  </div>`;
}

// ---------- igra ----------
function seatHeader(p, v, seat) {
  const pl = p.players[seat] || { name: '?' };
  const mine = seat === v.seat;
  const active = v.phase === 'play' && v.turn === seat;
  let score = '';
  if (v.kind === 'trick') score = v.match[seat];
  else score = v.scores[seat];
  let status = '';
  if (!pl.connected && !pl.bot) status = '<span class="warn">nije spojen</span>';
  else if (active) status = mine ? 'tvoj potez' : 'razmišlja…';
  if (v.kind === 'rummy' && v.opened[seat]) status += `${status ? ' · ' : ''}<span class="ok">otvoren</span>`;
  return `<div class="who ${active ? 'active' : ''}">
    <div class="avatar ${mine ? 'me' : ''}">${esc(pl.name[0] || '?').toUpperCase()}</div>
    <div class="who-txt"><b>${esc(pl.name)}</b><small>${status || '&nbsp;'}</small></div>
    <div class="score-chip" title="Bodovi">${score}</div>
  </div>`;
}

function subtitle(v) {
  if (v.game === 'briskula') return `Ruka ${v.handNo} · do ${v.target} pobjede`;
  if (v.game === 'treseta') return `Ruka ${v.handNo} · do ${v.target} bodova`;
  return v.limit < 50 ? `Ruka ${v.handNo} od ${v.limit} · manje bodova pobjeđuje` : `Ruka ${v.handNo} · gubi se na ${v.limit}`;
}

function renderGame(p) {
  const v = p.view;
  const g = GAMES[v.game];
  const opp = 1 - v.seat;
  const backs = Array.from({ length: Math.min(v.oppCount, 16) }, () => cardHTML(null, { cls: 'sm' })).join('');
  $app.innerHTML = `
  <div class="screen game kind-${v.kind} g-${v.game}">
    <header class="topbar">
      <button class="icon-btn" data-a="leave" aria-label="Izađi">←</button>
      <div class="title"><b>${g.name}</b><span>${subtitle(v)}</span></div>
      <div class="top-actions">
        <button class="icon-btn" data-a="scores" aria-label="Rezultati">☰</button>
        <button class="icon-btn" data-a="rules" data-id="${v.game}" aria-label="Pravila">?</button>
        <button class="icon-btn" data-a="emotes" aria-label="Emoji">☺</button>
      </div>
      <div class="emote-tray" id="tray">${EMOTES.map((e) => `<button data-a="emote" data-e="${e}">${e}</button>`).join('')}</div>
    </header>
    <section class="seat opp">
      ${seatHeader(p, v, opp)}
      <div class="opp-hand">${backs}<span class="count">${v.oppCount}</span></div>
    </section>
    ${v.kind === 'trick' ? trickTable(v) : rummyTable(v)}
    <section class="seat me">
      <div class="status-line ${isMyTurn(v) ? 'mine' : ''}">${statusText(p, v)}</div>
      ${v.kind === 'rummy' ? rummyControls(v) : ''}
      <div class="hand ${v.kind}">${handHTML(v)}</div>
      ${seatHeader(p, v, v.seat)}
    </section>
    ${v.phase !== 'play' ? resultSheet(p, v) : ''}
  </div>`;
}

function statusText(p, v) {
  const oppName = esc(p.players[1 - v.seat]?.name || 'protivnik');
  if (v.phase !== 'play') return 'Kraj ruke';
  if (v.kind === 'trick') {
    if (v.pending) return v.trickWinner === v.seat ? 'Nosiš štih!' : `${oppName} nosi štih`;
    if (!isMyTurn(v)) return `Na potezu je ${oppName}…`;
    if (v.game === 'treseta' && v.trick.length === 1 && v.playable.length < v.hand.length) return 'Tvoj potez — odgovori na boju';
    return v.trick.length ? 'Tvoj potez — odgovori' : 'Tvoj potez — igraj prvi';
  }
  if (!isMyTurn(v)) return `Na potezu je ${oppName}…`;
  if (v.step === 'draw') return 'Vuci kartu iz špila ili uzmi s hrpe';
  if (v.mustUse) return 'Iskoristi kartu sa stola u grupi (ili je vrati)';
  if (!v.opened[v.seat]) return v.minOpen ? `Složi grupe za otvaranje (min ${v.minOpen}) ili odbaci kartu` : 'Složi grupe ili odbaci kartu';
  return 'Spusti/dodaj karte, pa odbaci jednu';
}

function handHTML(v) {
  const byId = Object.fromEntries(v.hand.map((c) => [c.id, c]));
  if (v.kind === 'trick') {
    const my = isMyTurn(v);
    return sortCards(v.hand, v)
      .map((c) => {
        const ok = my && v.playable.includes(c.id);
        return `<button class="hc ${ok ? 'ok' : 'no'}" data-a="card" data-id="${c.id}">${cardHTML(c)}</button>`;
      })
      .join('');
  }
  const stagedIds = new Set(S.staged.flat());
  return S.order
    .filter((id) => byId[id] && !stagedIds.has(id))
    .map((id) => {
      const c = byId[id];
      const cls = [S.sel.includes(id) ? 'sel' : '', v.drawn === id ? 'new' : '', v.mustUse === id ? 'must' : ''].join(' ');
      return `<button class="hc ${cls}" data-a="card" data-id="${id}">${cardHTML(c)}</button>`;
    })
    .join('');
}

function trickTable(v) {
  const slot = (seat) => {
    const t = v.trick.find((x) => x.seat === seat);
    if (!t) return `<div class="slot"></div>`;
    const fresh = !S.seen.has(t.card.id);
    S.seen.add(t.card.id);
    const win = v.trickWinner == null ? '' : v.trickWinner === seat ? 'win' : 'lose';
    return cardHTML(t.card, { cls: `played ${fresh ? (seat === v.seat ? 'enter-me' : 'enter-opp') : ''} ${win}` });
  };
  const trump = v.game === 'briskula' && v.trumpSuit;
  const stock = v.stockCount
    ? `<div class="stock">
        ${v.trumpCard ? cardHTML(v.trumpCard, { cls: 'trump-card' }) : ''}
        <div class="stack">${cardHTML(null)}${v.stockCount > 2 ? cardHTML(null, { cls: 'st2' }) : ''}</div>
        <span class="count">${v.stockCount}</span>
      </div>`
    : `<div class="stock empty"><span>Špil je prazan</span></div>`;
  const info = [];
  if (trump) info.push(`<div class="chip trump">Adut ${suitIcon(v.trumpSuit)} ${IT_SUIT_NAMES[v.trumpSuit]}</div>`);
  if (v.oppDrew) info.push(`<div class="chip">Protivnik izvukao ${cardHTML(v.oppDrew, { cls: 'mini' })}</div>`);
  if (v.handNo && v.takenCount) info.push(`<div class="chip">Štihovi ${v.takenCount[v.seat]} : ${v.takenCount[1 - v.seat]}</div>`);
  const ev = v.events.slice(-2).map((e) => `<div class="chip ev">${esc(e)}</div>`).join('');
  return `<section class="table trick-table">
    <div class="deck-area">${stock}</div>
    <div class="trick-area">
      <div class="t-opp">${slot(1 - v.seat)}</div>
      <div class="t-me">${slot(v.seat)}</div>
    </div>
    <div class="info">${info.join('')}${ev}</div>
  </section>`;
}

function rummyTable(v) {
  const my = isMyTurn(v);
  const melds = v.melds.length
    ? v.melds
        .map(
          (m) => `<button class="meld ${m.owner === v.seat ? 'mine' : 'theirs'}" data-a="meld" data-id="${m.id}">
          ${m.cards.map((c) => cardHTML(c, { cls: 'mini' })).join('')}</button>`,
        )
        .join('')
    : `<div class="melds-empty">Ovdje će se slagati grupe</div>`;
  const last = v.events[v.events.length - 1];
  return `<section class="table rummy-table">
    <div class="piles">
      <button class="pile ${my && v.step === 'draw' ? 'glow' : ''}" data-a="draw-stock" aria-label="Špil">
        <div class="stack">${cardHTML(null)}${cardHTML(null, { cls: 'st2' })}</div><span class="count">${v.stockCount}</span>
        <small>Špil</small>
      </button>
      <button class="pile discard ${my && (v.step === 'draw' || S.sel.length === 1) && v.discardTop !== undefined ? 'glow' : ''}" data-a="draw-discard" aria-label="Hrpa">
        ${v.discardTop ? cardHTML(v.discardTop) : '<div class="card-slot"></div>'}
        <small>${my && v.step === 'play' ? 'Odbaci ovdje' : 'Hrpa'}</small>
      </button>
      ${last ? `<div class="last-ev">${esc(last)}</div>` : ''}
    </div>
    <div class="melds">${melds}</div>
  </section>`;
}

function rummyControls(v) {
  const my = isMyTurn(v) && v.step === 'play';
  const byId = Object.fromEntries(v.hand.map((c) => [c.id, c]));
  const results = S.staged.map((ids) => analyze(ids.map((id) => byId[id])));
  const total = results.reduce((s, r) => s + (r ? r.value : 0), 0);
  const opened = v.opened[v.seat];
  const selRes = S.sel.length >= 3 ? analyze(S.sel.map((id) => byId[id])) : null;
  const staging = S.staged.length
    ? `<div class="staging">
        ${S.staged
          .map(
            (ids, i) => `<div class="stage-group ${results[i] ? 'ok' : 'bad'}">
            <div class="sg-cards">${(results[i] ? results[i].order : ids.map((id) => byId[id])).map((c) => cardHTML(c, { cls: 'mini' })).join('')}</div>
            <span class="val">${results[i] ? results[i].value : '✗'}</span>
            <button class="x" data-a="unstage" data-i="${i}" aria-label="Vrati">×</button></div>`,
          )
          .join('')}
        ${!opened && v.minOpen ? `<div class="open-meter ${total >= v.minOpen ? 'ok' : ''}">${total} / ${v.minOpen}</div>` : ''}
      </div>`
    : '';
  return `${staging}<div class="actions">
    <button class="btn sm ghost" data-a="sort">${S.sortMode === 'suit' ? 'Po boji' : 'Po broju'} ⇅</button>
    ${my ? `<button class="btn sm" data-a="stage" ${S.sel.length >= 3 ? '' : 'disabled'}>Grupiraj${selRes ? ` · ${selRes.value}` : ''}</button>` : ''}
    ${my && S.staged.length ? `<button class="btn sm primary" data-a="lay">${opened ? 'Spusti' : 'Otvori se'} (${total})</button>` : ''}
    ${my ? `<button class="btn sm warn" data-a="discard" ${S.sel.length === 1 ? '' : 'disabled'}>Odbaci</button>` : ''}
    ${v.canUndo ? `<button class="btn sm ghost" data-a="undo">Vrati kartu</button>` : ''}
  </div>`;
}

function resultSheet(p, v) {
  const me = v.seat;
  const opp = 1 - me;
  const names = p.players.map((x) => esc(x?.name || '?'));
  const over = v.phase === 'matchOver';
  const r = v.result || {};
  let title = 'Kraj ruke';
  if (over) title = v.matchWinner === me ? 'Pobjeda! 🏆' : v.matchWinner === opp ? 'Ovaj put poraz' : 'Neriješeno';
  else if (r.winner === me) title = 'Ruka je tvoja! 🎉';
  else if (r.winner === opp) title = `Ruku je dobio ${names[opp]}`;
  const tot = v.kind === 'trick' ? v.match : v.scores;
  const hist = (v.history || [])
    .map((h, i) => `<tr><td>${i + 1}.</td><td>${h[me]}</td><td>${h[opp]}</td></tr>`)
    .join('');
  const pointsRow =
    v.game === 'briskula' && r.pts ? `<div class="big-score"><span>${r.pts[me]}</span><em>:</em><span>${r.pts[opp]}</span></div><div class="muted small">bodovi u ruci</div>` : '';
  const reveal =
    v.kind === 'rummy' && r.oppHand && r.oppHand.length
      ? `<div class="reveal"><div class="muted small">Ostalo u ruci (${names[1 - r.winner]}):</div><div class="reveal-cards">${r.oppHand.map((c) => cardHTML(c, { cls: 'mini' })).join('')}</div></div>`
      : '';
  const host = p.role === 'host';
  if (S.sheetHidden) {
    return `<div class="sheet-min"><span>${esc(title)}</span><button class="btn sm primary" data-a="sheet-show">Rezultat</button></div>`;
  }
  return `<div class="sheet-backdrop"><div class="sheet ${over ? 'over' : ''}">
    <h2>${title}</h2>
    <p class="muted">${esc(r.text || '')}</p>
    ${pointsRow}
    ${reveal}
    <table class="hist"><thead><tr><th></th><th>${names[me]}</th><th>${names[opp]}</th></tr></thead>
      <tbody>${hist}</tbody>
      <tfoot><tr><td>${v.game === 'briskula' ? 'Pobjede' : 'Ukupno'}</td><td>${tot[me]}</td><td>${tot[opp]}</td></tr></tfoot></table>
    <div class="sheet-actions">
      ${over ? `<button class="btn primary big" data-a="rematch">Nova partija</button>` : `<button class="btn primary big" data-a="next">Sljedeća ruka</button>`}
      ${host ? `<button class="btn ghost" data-a="to-lobby">Druga igra</button>` : ''}
      <button class="btn link" data-a="sheet-hide">Pogledaj stol</button>
    </div>
  </div></div>`;
}

function fitHands() {
  document.querySelectorAll('.hand, .opp-hand').forEach((el) => {
    const kids = [...el.children].filter((k) => !k.classList.contains('count'));
    kids.forEach((k) => (k.style.marginLeft = ''));
    const n = kids.length;
    if (n < 2) return el.style.setProperty('--ov', '0px');
    const cw = kids[0].getBoundingClientRect().width;
    const avail = el.clientWidth - 12;
    // na uskim ekranima remi ruku slažemo u dva reda
    const twoRows = el.classList.contains('rummy') && n > 9 && n * cw * 0.6 > avail;
    el.classList.toggle('two-rows', twoRows);
    if (twoRows) {
      const per = Math.ceil(n / 2);
      const ov = Math.min(6, -(per * cw - avail) / (per - 1)) - 0.5;
      el.style.setProperty('--ov', `${ov}px`);
      kids[per].style.marginLeft = '0px';
      return;
    }
    const gap = el.classList.contains('opp-hand') ? -cw * 0.55 : 6;
    const need = n * cw + (n - 1) * gap;
    const ov = need > avail ? -(n * cw - avail) / (n - 1) : gap;
    el.style.setProperty('--ov', `${ov}px`);
  });
}
window.addEventListener('resize', () => requestAnimationFrame(fitHands));

// ---------- modali ----------
function modal(html) {
  closeModal();
  const el = document.createElement('div');
  el.className = 'modal-backdrop';
  el.id = 'modal';
  el.innerHTML = `<div class="modal">${html}</div>`;
  el.addEventListener('click', (e) => {
    if (e.target === el) closeModal();
  });
  document.body.appendChild(el);
}
function closeModal() {
  document.getElementById('modal')?.remove();
}

function rulesModal(id) {
  const g = GAMES[id];
  modal(`<h2>${gameIcon(id)} ${g.name}</h2><ul class="rules-list">${g.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    <button class="btn primary wide" data-a="close-modal">U redu</button>`);
}

// ---------- akcije ----------
function act(a) {
  S.session?.act(a);
}

function saveName() {
  const inp = document.getElementById('name');
  const n = (inp?.value || '').trim().slice(0, 16);
  if (n) storage('local', 'kartaske-name', n);
  return n;
}

function startGuest() {
  const name = getName() || 'Gost';
  storage('session', 'kartaske-guest', S.joinCode);
  history.replaceState(null, '', `#join=${S.joinCode}`);
  S.session = new GuestSession(ui, { name, code: S.joinCode });
  render();
}

function leave() {
  S.session?.close();
  S.session = null;
  S.pub = null;
  S.joinCode = null;
  S.net = '';
  storage('session', 'kartaske-guest', null);
  history.replaceState(null, '', location.pathname);
  document.title = 'Kartaške igre';
  render();
}

function selectedRummyCard(v) {
  return S.sel.length === 1 ? v.hand.find((c) => c.id === S.sel[0]) : null;
}

const H = {
  'home-game'(el) {
    S.homeGame = el.dataset.id;
    S.homeOpts = defaultOpts(S.homeGame);
    storage('local', 'kartaske-game', S.homeGame);
    saveName();
    render();
  },
  opt(el) {
    const val = JSON.parse(el.dataset.val);
    if (!S.session) {
      S.homeOpts[el.dataset.key] = val;
      saveName();
      render();
    } else S.session.setOpt(el.dataset.key, val);
  },
  'lobby-game'(el) {
    S.session.setGame(el.dataset.id);
  },
  'play-friend'() {
    const name = saveName();
    if (!name) return toast('Upiši svoje ime.', 'err'), document.getElementById('name')?.focus();
    const s = new HostSession(ui, { name, mode: 'online' });
    s.room.gameId = S.homeGame;
    s.room.opts = { ...S.homeOpts };
    S.session = s;
    history.replaceState(null, '', `#host=${s.code}`);
    s.broadcast();
  },
  'play-bot'() {
    const name = saveName() || 'Ja';
    const s = new HostSession(ui, { name, mode: 'bot' });
    s.room.gameId = S.homeGame;
    s.room.opts = { ...S.homeOpts };
    S.session = s;
    history.replaceState(null, '', `#host=${s.code}`);
    s.start();
  },
  join() {
    const name = saveName();
    if (!name) return toast('Upiši svoje ime.', 'err'), document.getElementById('name')?.focus();
    startGuest();
  },
  'cancel-join'() {
    leave();
  },
  copy() {
    const link = inviteLink(S.pub.code);
    navigator.clipboard?.writeText(link).then(
      () => toast('Link je kopiran ✓'),
      () => {
        document.getElementById('invite')?.select();
        toast('Označi i kopiraj link.');
      },
    );
  },
  share() {
    const g = GAMES[S.pub.gameId];
    navigator.share?.({ title: 'Kartaške igre', text: `Igrajmo ${g.name}!`, url: inviteLink(S.pub.code) }).catch(() => {});
  },
  start() {
    S.session.start();
  },
  leave() {
    modal(`<h2>Napustiti ${S.session?.role === 'host' && S.session.mode === 'online' ? 'sobu' : 'igru'}?</h2>
      <p class="muted">${S.session?.role === 'host' && S.session.mode === 'online' ? 'Soba će se zatvoriti i protivnik će biti odspojen.' : 'Igra će se prekinuti.'}</p>
      <div class="row"><button class="btn ghost" data-a="close-modal">Ostani</button><button class="btn warn" data-a="leave-now">Izađi</button></div>`);
  },
  'leave-now'() {
    closeModal();
    leave();
  },
  'close-modal'() {
    closeModal();
  },
  rules(el) {
    rulesModal(el.dataset.id || S.pub?.gameId || S.homeGame);
  },
  scores() {
    const v = S.pub?.view;
    if (!v) return;
    const names = S.pub.players.map((x) => esc(x?.name || '?'));
    const tot = v.kind === 'trick' ? v.match : v.scores;
    const rows = (v.history || []).map((h, i) => `<tr><td>${i + 1}.</td><td>${h[v.seat]}</td><td>${h[1 - v.seat]}</td></tr>`).join('');
    modal(`<h2>Rezultat</h2><table class="hist"><thead><tr><th></th><th>${names[v.seat]}</th><th>${names[1 - v.seat]}</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="3" class="muted">Još nema odigranih ruku</td></tr>'}</tbody>
      <tfoot><tr><td>${v.game === 'briskula' ? 'Pobjede' : 'Ukupno'}</td><td>${tot[v.seat]}</td><td>${tot[1 - v.seat]}</td></tr></tfoot></table>
      <button class="btn primary wide" data-a="close-modal">Zatvori</button>`);
  },
  emotes() {
    document.getElementById('tray')?.classList.toggle('open');
  },
  emote(el) {
    document.getElementById('tray')?.classList.remove('open');
    S.session.emote(el.dataset.e);
  },
  card(el) {
    const v = S.pub.view;
    const id = el.dataset.id;
    if (v.kind === 'trick') {
      if (!isMyTurn(v)) return toast('Nisi na potezu.');
      if (!v.playable.includes(id)) return toast(v.game === 'treseta' ? 'Moraš odgovoriti na boju.' : 'Ne možeš igrati tu kartu.', 'err');
      return act({ type: 'play', card: id });
    }
    S.sel = S.sel.includes(id) ? S.sel.filter((x) => x !== id) : [...S.sel, id];
    render();
  },
  sort() {
    S.sortMode = S.sortMode === 'suit' ? 'rank' : 'suit';
    const v = S.pub.view;
    S.order = sortCards(v.hand, v).map((c) => c.id);
    render();
  },
  stage() {
    const v = S.pub.view;
    const byId = Object.fromEntries(v.hand.map((c) => [c.id, c]));
    if (!analyze(S.sel.map((id) => byId[id]))) return toast('To nije ispravna grupa.', 'err');
    S.staged.push(S.sel);
    S.sel = [];
    render();
  },
  unstage(el) {
    S.staged.splice(Number(el.dataset.i), 1);
    render();
  },
  lay() {
    act({ type: 'lay', groups: S.staged });
  },
  discard() {
    if (S.sel.length !== 1) return toast('Odaberi jednu kartu.');
    act({ type: 'discard', cardId: S.sel[0] });
  },
  undo() {
    act({ type: 'undoDraw' });
  },
  'draw-stock'() {
    const v = S.pub.view;
    if (!isMyTurn(v)) return toast('Nisi na potezu.');
    if (v.step !== 'draw') return toast('Već si vukao — sada odbaci kartu.');
    act({ type: 'drawStock' });
  },
  'draw-discard'() {
    const v = S.pub.view;
    if (!isMyTurn(v)) return toast('Nisi na potezu.');
    if (v.step === 'draw') return act({ type: 'drawDiscard' });
    if (S.sel.length === 1) return act({ type: 'discard', cardId: S.sel[0] });
    toast('Odaberi jednu kartu za odbacivanje.');
  },
  meld(el) {
    const v = S.pub.view;
    if (!isMyTurn(v) || v.step !== 'play') return toast(isMyTurn(v) ? 'Prvo vuci kartu.' : 'Nisi na potezu.');
    if (!S.sel.length) return toast('Odaberi karte iz ruke pa dodirni grupu.');
    const meldId = Number(el.dataset.id);
    const meld = v.melds.find((m) => m.id === meldId);
    const c = selectedRummyCard(v);
    if (c && meld && jokerIndexFor(meld, c) >= 0) {
      if (analyze([...meld.cards, c])) {
        S.pendingMeld = meldId;
        return modal(`<h2>Joker ili dodavanje?</h2><p class="muted">Ova karta može zamijeniti jokera (joker ide tebi u ruku) ili se samo dodati u grupu.</p>
          <div class="row"><button class="btn primary" data-a="do-swap">Uzmi jokera</button><button class="btn ghost" data-a="do-add">Samo dodaj</button></div>`);
      }
      return act({ type: 'swap', meldId, cardId: c.id });
    }
    act({ type: 'add', meldId, ids: S.sel });
  },
  'do-swap'() {
    closeModal();
    act({ type: 'swap', meldId: S.pendingMeld, cardId: S.sel[0] });
  },
  'do-add'() {
    closeModal();
    act({ type: 'add', meldId: S.pendingMeld, ids: S.sel });
  },
  next() {
    act({ type: 'next' });
  },
  rematch() {
    act({ type: 'rematch' });
  },
  'to-lobby'() {
    act({ type: 'toLobby' });
  },
  'sheet-hide'() {
    S.sheetHidden = true;
    render();
  },
  'sheet-show'() {
    S.sheetHidden = false;
    render();
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const fn = H[el.dataset.a];
  if (fn) fn(el, e);
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'name') storage('local', 'kartaske-name', e.target.value.trim().slice(0, 16));
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Enter' && e.target.id === 'name') (S.joinCode ? H.join : H['play-friend'])();
});

// ---------- start ----------
function init() {
  if (typeof Peer === 'undefined') {
    console.warn('PeerJS nije učitan — igra preko interneta neće raditi.');
  }
  const h = new URLSearchParams(location.hash.slice(1));
  const host = h.get('host');
  const join = h.get('join');
  if (host) {
    const saved = savedHost(host);
    if (saved) {
      S.session = new HostSession(ui, { saved });
      S.session.broadcast();
      return;
    }
    history.replaceState(null, '', location.pathname);
  }
  if (join) {
    S.joinCode = join.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (storage('session', 'kartaske-guest') === S.joinCode && getName()) return startGuest();
  }
  render();
}

init();
