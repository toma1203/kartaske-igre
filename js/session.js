// Sobe i mreža. Domaćin drži stanje igre i šalje svakom igraču samo ono što smije vidjeti.
// Veza između uređaja ide preko WebRTC-a (PeerJS), pa nije potreban vlastiti server.
import { GAMES, defaultOpts } from './games/index.js';
import { rand } from './cards.js';

const PREFIX = 'kartaske-igre-hr-v1-';
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const HOST_KEY = 'kartaske-host';

export function newCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += ALPH[rand(ALPH.length)];
  return s;
}

function store(kind, key, val) {
  try {
    const st = kind === 'local' ? localStorage : sessionStorage;
    if (val === undefined) return st.getItem(key);
    if (val === null) st.removeItem(key);
    else st.setItem(key, val);
  } catch {
    return null;
  }
}
export const storage = store;

export function myCid() {
  let c = store('local', 'kartaske-cid');
  if (!c) {
    c = Math.random().toString(36).slice(2) + Date.now().toString(36);
    store('local', 'kartaske-cid', c);
  }
  return c;
}

export function savedHost(code) {
  try {
    const d = JSON.parse(store('session', HOST_KEY) || 'null');
    return d && d.code === code ? d : null;
  } catch {
    return null;
  }
}

export function inviteLink(code) {
  return `${location.origin}${location.pathname}#join=${code}`;
}

const BOT_NAMES = ['Robo', 'Mate', 'Šime', 'Frane'];

export class HostSession {
  constructor(ui, { name, mode, saved }) {
    this.ui = ui;
    this.role = 'host';
    this.mode = saved?.mode || mode; // 'online' | 'bot'
    this.code = saved?.code || newCode();
    this.room = saved?.room || {
      players: [
        { name, connected: true },
        this.mode === 'bot' ? { name: BOT_NAMES[rand(BOT_NAMES.length)], bot: true, connected: true } : null,
      ],
      gameId: 'briskula',
      opts: defaultOpts('briskula'),
      status: 'lobby',
      game: null,
    };
    if (this.room.players[1] && !this.room.players[1].bot) this.room.players[1].connected = false;
    this.conn = null;
    this.timers = new Set();
    if (this.mode === 'online') this.listen();
    if (this.room.game?.pending) this.later(() => this.resolve(), 600);
    this.scheduleBot();
  }

  get engine() {
    return GAMES[this.room.gameId].engine;
  }

  later(fn, ms) {
    const t = setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
    return t;
  }

  // ---------- mreža ----------
  listen(attempt = 0) {
    if (this.closed) return;
    this.ui.net('Spajanje na server…');
    const peer = new Peer(PREFIX + this.code, { debug: 1 });
    this.peer = peer;
    peer.on('open', () => {
      this.ui.net('');
      this.broadcast();
    });
    peer.on('connection', (conn) => this.attach(conn));
    peer.on('disconnected', () => {
      if (this.closed || peer.destroyed) return;
      this.ui.net('Veza sa serverom je prekinuta, ponovno spajanje…');
      this.later(() => !peer.destroyed && peer.reconnect(), 1500);
    });
    peer.on('error', (err) => {
      if (this.closed) return;
      console.warn('peer error', err.type, err);
      if (['unavailable-id', 'network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
        peer.destroy();
        this.ui.net(err.type === 'unavailable-id' ? 'Ponovno otvaranje sobe…' : 'Problem s vezom, pokušavam ponovo…');
        this.later(() => this.listen(attempt + 1), Math.min(2000 + attempt * 1000, 8000));
      }
    });
    if (!this.hb) {
      this.hb = setInterval(() => this.heartbeat(), 4000);
    }
  }

  attach(conn) {
    conn.on('data', (m) => this.onData(conn, m));
    conn.on('close', () => {
      if (this.conn === conn) this.dropGuest();
    });
    conn.on('error', () => {
      if (this.conn === conn) this.dropGuest();
    });
  }

  dropGuest() {
    const p = this.room.players[1];
    this.conn = null;
    if (p && p.connected) {
      p.connected = false;
      this.ui.toast(`${p.name} se odspojio`);
      this.broadcast();
    }
  }

  heartbeat() {
    if (!this.conn) return;
    if (this.conn.open) this.conn.send({ t: 'ping' });
    if (Date.now() - (this.lastSeen || 0) > 13000) {
      try {
        this.conn.close();
      } catch {}
      this.dropGuest();
    }
  }

  onData(conn, m) {
    if (!m || typeof m !== 'object') return;
    if (conn === this.conn) this.lastSeen = Date.now();
    if (m.t === 'hello') {
      const name = String(m.name || 'Gost').slice(0, 16);
      const p = this.room.players[1];
      if (p && p.connected && p.cid !== m.cid && this.conn && this.conn.open) {
        conn.send({ t: 'full' });
        setTimeout(() => conn.close(), 500);
        return;
      }
      if (this.conn && this.conn !== conn) {
        try {
          this.conn.close();
        } catch {}
      }
      this.conn = conn;
      this.lastSeen = Date.now();
      this.room.players[1] = { name, cid: m.cid, connected: true };
      if (this.room.game) this.room.game.names[1] = name;
      this.ui.toast(p && p.cid === m.cid ? `${name} se vratio` : `${name} se pridružio`);
      this.broadcast();
      return;
    }
    if (conn !== this.conn) return;
    if (m.t === 'act') this.action(1, m.a || {});
    else if (m.t === 'emote') this.ui.emote(false, String(m.e).slice(0, 4));
  }

  send(m) {
    if (this.conn && this.conn.open) this.conn.send(m);
  }

  // ---------- soba ----------
  pub(seat) {
    const r = this.room;
    return {
      role: seat === 0 ? 'host' : 'guest',
      mode: this.mode,
      code: this.code,
      mySeat: seat,
      players: r.players.map((p) => (p ? { name: p.name, connected: p.connected, bot: !!p.bot } : null)),
      gameId: r.gameId,
      opts: r.opts,
      status: r.status,
      view: r.game ? this.engine.view(r.game, seat) : null,
    };
  }

  broadcast() {
    this.save();
    this.ui.state(this.pub(0));
    this.send({ t: 'state', pub: this.pub(1) });
  }

  save() {
    if (this.closed) return;
    store('session', HOST_KEY, JSON.stringify({ code: this.code, mode: this.mode, room: this.room }));
  }

  setGame(id) {
    if (this.room.status !== 'lobby' || !GAMES[id]) return;
    this.room.gameId = id;
    this.room.opts = defaultOpts(id);
    this.broadcast();
  }

  setOpt(key, val) {
    if (this.room.status !== 'lobby') return;
    this.room.opts = { ...this.room.opts, [key]: val };
    this.broadcast();
  }

  start() {
    const [a, b] = this.room.players;
    if (!b) return this.ui.toast('Čeka se protivnik.');
    this.room.game = this.engine.create([a.name, b.name], this.room.opts);
    this.room.status = 'playing';
    this.broadcast();
    this.scheduleBot();
  }

  toLobby() {
    this.room.status = 'lobby';
    this.room.game = null;
    this.broadcast();
  }

  act(a) {
    if (a.type === 'toLobby') return this.toLobby();
    this.action(0, a);
  }

  action(seat, a) {
    const g = this.room.game;
    if (!g || this.room.status !== 'playing') return;
    let res;
    try {
      res = this.engine.act(g, seat, a);
    } catch (e) {
      console.error(e);
      res = { error: 'Greška u igri.' };
    }
    if (res.error) {
      if (seat === 0) this.ui.toast(res.error, 'err');
      else if (!this.room.players[1]?.bot) this.send({ t: 'error', msg: res.error });
      return res;
    }
    if (res.delay) this.later(() => this.resolve(), res.delay);
    this.broadcast();
    this.scheduleBot();
    return res;
  }

  resolve() {
    const g = this.room.game;
    if (!g) return;
    this.engine.resolve(g);
    this.broadcast();
    this.scheduleBot();
  }

  scheduleBot() {
    if (this.mode !== 'bot' || this.botTimer || !this.room.game) return;
    if (!this.engine.bot(this.room.game, 1)) return;
    this.botTimer = this.later(() => {
      this.botTimer = null;
      const g = this.room.game;
      if (!g) return;
      const a = this.engine.bot(g, 1);
      if (!a) return;
      const res = this.action(1, a);
      if (res && res.error) {
        console.warn('bot', a, res.error);
        const tries = [{ type: 'undoDraw' }, { type: 'drawStock' }, ...(g.hands?.[1] || []).map((c) => ({ type: 'discard', cardId: c.id }))];
        for (const t of tries) if (!this.engine.act(g, 1, t).error) break;
        this.broadcast();
        this.scheduleBot();
      }
    }, 650 + rand(500));
  }

  emote(e) {
    this.ui.emote(true, e);
    this.send({ t: 'emote', e });
  }

  close() {
    this.closed = true;
    clearInterval(this.hb);
    this.timers.forEach(clearTimeout);
    try {
      this.send({ t: 'closed' });
    } catch {}
    setTimeout(() => this.peer?.destroy(), 300);
    store('session', HOST_KEY, null);
  }
}

export class GuestSession {
  constructor(ui, { name, code }) {
    this.ui = ui;
    this.role = 'guest';
    this.name = name;
    this.code = code;
    this.cid = myCid();
    this.lastSeen = Date.now();
    this.connect();
    this.wd = setInterval(() => this.watchdog(), 4000);
  }

  connect() {
    if (this.closed) return;
    this.ui.net('Spajanje na sobu…');
    if (!this.peer || this.peer.destroyed) {
      this.peer = new Peer({ debug: 1 });
      this.peer.on('open', () => this.dial());
      this.peer.on('disconnected', () => {
        if (!this.closed && !this.peer.destroyed) setTimeout(() => this.peer.reconnect(), 1500);
      });
      this.peer.on('error', (err) => {
        console.warn('peer error', err.type, err);
        if (this.closed) return;
        if (err.type === 'peer-unavailable') this.ui.net('Soba nije pronađena — domaćin možda nije online. Pokušavam ponovo…');
        else this.ui.net('Problem s vezom, pokušavam ponovo…');
        if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) {
          this.peer.destroy();
        }
        this.retry();
      });
    } else if (this.peer.open) this.dial();
  }

  retry() {
    clearTimeout(this.rt);
    this.rt = setTimeout(() => this.connect(), 3000);
  }

  dial() {
    if (this.closed) return;
    if (this.conn) {
      try {
        this.conn.close();
      } catch {}
    }
    const conn = this.peer.connect(PREFIX + this.code, { reliable: true });
    this.conn = conn;
    conn.on('open', () => {
      this.lastSeen = Date.now();
      conn.send({ t: 'hello', name: this.name, cid: this.cid });
    });
    conn.on('data', (m) => this.onData(m));
    conn.on('close', () => {
      if (this.conn !== conn || this.closed) return;
      this.ui.net('Veza je prekinuta, ponovno spajanje…');
      this.retry();
    });
  }

  watchdog() {
    if (this.closed) return;
    if (Date.now() - this.lastSeen > 13000) {
      this.lastSeen = Date.now();
      this.ui.net('Nema odgovora domaćina, ponovno spajanje…');
      this.connect();
    }
  }

  onData(m) {
    this.lastSeen = Date.now();
    if (m.t === 'state') {
      this.ui.net('');
      this.ui.state(m.pub);
    } else if (m.t === 'ping') this.conn?.send({ t: 'pong' });
    else if (m.t === 'error') this.ui.toast(m.msg, 'err');
    else if (m.t === 'emote') this.ui.emote(false, String(m.e).slice(0, 4));
    else if (m.t === 'full') {
      this.ui.net('Soba je puna — u njoj već igraju dva igrača.');
      this.closed = true;
    } else if (m.t === 'closed') {
      this.closed = true;
      this.ui.net('Domaćin je zatvorio sobu.');
    }
  }

  act(a) {
    if (this.conn && this.conn.open) this.conn.send({ t: 'act', a });
    else this.ui.toast('Nisi spojen.', 'err');
  }

  emote(e) {
    this.ui.emote(true, e);
    if (this.conn && this.conn.open) this.conn.send({ t: 'emote', e });
  }

  setGame() {}
  setOpt() {}
  start() {}

  close() {
    this.closed = true;
    clearInterval(this.wd);
    clearTimeout(this.rt);
    try {
      this.conn?.close();
    } catch {}
    this.peer?.destroy();
  }
}
