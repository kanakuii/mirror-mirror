// Game state for one room. The server is authoritative; clients render views of it.
//
// Phases: lobby → pick → draw → result → (pick … ) → final → highlights → (rematch → lobby)
//
// Secrets: the prompt is never in the shared view while a round is live. Only the
// artist's phone sees it. The host screen is a TV everyone is looking at.

import { guessDrawing, judge, DEMO_MODE } from './mirror.mjs';

export const SUITS = ['hearts', 'spades', 'diamonds', 'clubs'];
const PICK_MS = 30_000;
const DRAW_MS = 90_000;
const PROMPTS_PER_PLAYER = 3; // optional; this is the most a player can add
const PLAYER_PROMPT_CHANCE = 0.5; // each letter: player-written if any are left, else the built-in list
const MAX_PLAYERS = 16;

// Built-in prompts, mixed in with whatever players add (like skribbl.io's word list).
// All things a stranger could guess; a few fairy-tale ones for the theme.
const BUILT_IN = [
  // creatures
  'cat', 'dog', 'horse', 'dragon', 'snail', 'octopus', 'giraffe', 'penguin', 'owl', 'whale', 'shark',
  'frog', 'spider', 'butterfly', 'dinosaur', 'unicorn', 'mermaid', 'elephant', 'snake', 'rabbit',
  'turtle', 'bee', 'crab', 'jellyfish', 'kangaroo', 'flamingo', 'bat', 'duck', 'pig', 'lion',
  // things
  'teapot', 'crown', 'umbrella', 'bicycle', 'guitar', 'robot', 'key', 'clock', 'telescope', 'anchor',
  'lightbulb', 'scissors', 'toothbrush', 'glasses', 'ladder', 'kite', 'balloon', 'camera', 'candle',
  'trophy', 'skateboard', 'headphones', 'backpack', 'paintbrush', 'hammer', 'magnet', 'piano',
  'treasure chest', 'hourglass', 'compass', 'sock', 'boot', 'top hat', 'bow tie', 'lipstick',
  // food
  'pineapple', 'banana', 'apple', 'carrot', 'pumpkin', 'ice cream', 'birthday cake', 'pizza',
  'hamburger', 'hot dog', 'donut', 'popcorn', 'cupcake', 'watermelon', 'taco', 'sushi', 'pretzel',
  'cheese', 'egg', 'cookie', 'lollipop', 'french fries',
  // places and big things
  'lighthouse', 'castle', 'volcano', 'windmill', 'bridge', 'rainbow', 'tornado', 'island', 'igloo',
  'pyramid', 'waterfall', 'tent', 'treehouse', 'ferris wheel', 'roller coaster', 'snowman',
  'campfire', 'cactus', 'mushroom', 'palm tree', 'moon', 'planet', 'cloud', 'mountain',
  // things that move
  'rocket', 'pirate ship', 'hot air balloon', 'submarine', 'helicopter', 'train', 'tractor',
  'sailboat', 'ufo', 'scooter',
  // fairy tale
  'magic wand', 'glass slipper', 'beanstalk', 'poison apple', 'tower', 'frog prince', 'fairy',
  'witch hat', 'genie lamp', 'gingerbread house', 'spinning wheel', 'magic carpet', 'golden egg',
  'giant', 'troll', 'knight', 'wizard', 'ghost', 'mirror',
  // actions and ideas
  'sneeze', 'juggling', 'yawning', 'swimming', 'fishing', 'sleeping', 'dancing', 'birthday',
  'thunderstorm', 'sunset', 'earthquake',
];

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const clean = (s, max) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export class Room {
  constructor(code, send) {
    this.code = code;
    this.send = send; // (ws, msg) => void
    this.host = null;
    this.players = new Map(); // id -> { id, name, suit, ws, connected, prompts: string[] }
    this.highlightsOn = false; // laugh clips: explicit opt-in on the host's lobby screen
    this.reset();
  }

  reset() {
    this.phase = 'lobby';
    this.scores = { kingdom: 0, mirror: 0 };
    this.totalRounds = 0;
    this.round = null;
    this.history = [];
    this.pool = []; // { text, authorId }
    this.used = new Set();
    this.artistCursor = 0;
    this.drawCounts = new Map();
    this.clips = []; // laugh clip metadata only ({ id, label, durationMs }); video stays on the host
    this.vetoes = new Set();
    clearTimeout(this.timer);
    for (const p of this.players.values()) p.prompts = [];
  }

  // ---------- players ----------

  join(ws, { name, suit, playerId }) {
    const existing = playerId && this.players.get(playerId);
    if (existing) {
      existing.ws?.terminate();
      existing.ws = ws;
      existing.connected = true;
      return { ok: true, player: existing };
    }
    name = clean(name, 16);
    if (!name) return { error: 'name', message: 'What shall the Mirror call you?' };
    if ([...this.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase()))
      return { error: 'name', message: `There's already a ${name} here. Try another name.` };
    if (this.players.size >= MAX_PLAYERS) return { error: 'full', message: 'The table is full.' };
    const player = {
      id: crypto.randomUUID(),
      name,
      suit: SUITS.includes(suit) ? suit : SUITS[this.players.size % 4],
      ws,
      connected: true,
      prompts: [],
    };
    this.players.set(player.id, player);
    return { ok: true, player };
  }

  disconnect(playerId, ws) {
    const p = this.players.get(playerId);
    if (p && p.ws === ws) {
      p.connected = false;
      p.ws = null;
      this.sync();
    }
  }

  kick(playerId) {
    const p = this.players.get(playerId);
    if (!p) return;
    if (p.ws) this.send(p.ws, { type: 'kicked' });
    this.players.delete(playerId);
    this.pool = this.pool.filter((e) => e.authorId !== playerId);
    if (this.round?.artistId === playerId && this.phase === 'pick') this.beginPick();
    this.sync();
  }

  setPrompts(playerId, list) {
    const p = this.players.get(playerId);
    if (!p || !Array.isArray(list)) return;
    p.prompts = list.map((s) => clean(s, 40)).filter(Boolean).slice(0, PROMPTS_PER_PLAYER);
    this.pool = this.pool.filter((e) => e.authorId !== playerId);
    for (const text of p.prompts) if (!this.used.has(text.toLowerCase())) this.pool.push({ text, authorId: playerId });
    this.sync();
  }

  // ---------- rounds ----------

  start() {
    if (this.phase !== 'lobby' || this.players.size === 0) return;
    this.totalRounds = Math.min(10, Math.max(3, this.players.size));
    this.beginPick();
  }

  nextArtist() {
    const all = [...this.players.values()];
    const live = all.filter((p) => p.connected);
    const candidates = live.length ? live : all;
    // Whoever has drawn least goes next; join order breaks ties.
    candidates.sort((a, b) => (this.drawCounts.get(a.id) ?? 0) - (this.drawCounts.get(b.id) ?? 0));
    return candidates[0];
  }

  /** Three letters for the artist: each is a player's prompt (never their own) or a built-in one. */
  takeChoices(artistId) {
    const theirs = shuffle(this.pool.filter((e) => e.authorId !== artistId));
    const builtIn = shuffle(BUILT_IN.filter((t) => !this.used.has(t)));
    const choices = [];
    const taken = new Set();
    const add = (entry) => {
      const k = entry.text.toLowerCase();
      if (taken.has(k)) return false;
      taken.add(k);
      choices.push(entry);
      return true;
    };
    while (choices.length < 3 && (theirs.length || builtIn.length)) {
      const fromPlayers = theirs.length && (!builtIn.length || Math.random() < PLAYER_PROMPT_CHANCE);
      if (fromPlayers) add(theirs.pop());
      else add({ text: builtIn.pop(), authorId: null });
    }
    // Players' prompts we took leave the hat (unpicked ones go back after the pick).
    this.pool = this.pool.filter((e) => !choices.includes(e));
    // Everything has been drawn already: start the built-in list over.
    while (choices.length < 3) add({ text: BUILT_IN[Math.floor(Math.random() * BUILT_IN.length)], authorId: null });
    return choices;
  }

  beginPick() {
    clearTimeout(this.timer);
    // Re-picking (artist left): return the old letters to the hat.
    if (this.round?.choices && !this.round.prompt) this.pool.push(...this.round.choices.filter((c) => c.authorId));
    const artist = this.nextArtist();
    if (!artist) return this.toLobby();
    const number = this.phase === 'pick' && this.round ? this.round.number : this.history.length + 1;
    this.phase = 'pick';
    this.round = {
      number,
      artistId: artist.id,
      choices: this.takeChoices(artist.id),
      prompt: null,
      deadline: Date.now() + PICK_MS,
      mirrorGuesses: [],
      heard: [], // what the listener heard from the room (shown on screen, never sent to the Mirror)
      pending: false,
      confirm: null, // { guess, by: 'mirror' | 'room' } borderline call for the artist
      result: null,
    };
    this.timer = setTimeout(() => this.pick(artist.id, Math.floor(Math.random() * 3)), PICK_MS);
    this.sync();
  }

  pick(playerId, index) {
    const r = this.round;
    if (this.phase !== 'pick' || r.artistId !== playerId) return;
    const choice = r.choices[index] ?? r.choices[0];
    r.prompt = choice;
    this.used.add(choice.text.toLowerCase());
    this.pool.push(...r.choices.filter((c) => c !== choice && c.authorId)); // back in the hat
    this.drawCounts.set(playerId, (this.drawCounts.get(playerId) ?? 0) + 1);
    clearTimeout(this.timer);
    this.phase = 'draw';
    r.startedAt = Date.now();
    r.deadline = r.startedAt + DRAW_MS;
    this.timer = setTimeout(() => this.endRound('none', 'time'), DRAW_MS);
    this.sync();
    this.send(this.host, { type: 'roundStart' }); // host clears its canvas
  }

  /** Host sends a canvas snapshot; the Mirror guesses and we judge it. */
  async mirrorSnapshot(image) {
    const r = this.round;
    if (this.phase !== 'draw' || r.pending || typeof image !== 'string' || !image.startsWith('data:image/')) return;
    r.pending = true;
    this.sync();
    try {
      const previous = r.mirrorGuesses.map((g) => g.text);
      const { text, ms } = await guessDrawing(image, previous);
      if (this.round !== r || this.phase !== 'draw') return; // round ended while thinking
      const verdict = await judge(text, r.prompt.text);
      if (this.round !== r || this.phase !== 'draw') return;
      r.mirrorGuesses.push({ text, at: Date.now() - r.startedAt, verdict });
      console.log(`[${this.code}] Mirror (${(ms / 1000).toFixed(1)}s): "${text}" -> ${verdict}`);
      if (verdict === 'yes') return this.endRound('mirror', 'mirror');
      if (verdict === 'maybe' && !r.confirm) r.confirm = { guess: text, by: 'mirror' };
    } catch (e) {
      console.error(`[${this.code}] Mirror error:`, e.message);
      this.send(this.host, { type: 'mirrorError', message: e.message });
    } finally {
      if (this.round === r) r.pending = false;
      this.sync();
    }
  }

  /**
   * The listener heard the room. Judge it like a guess: a clear match wins the round for
   * the Kingdom; a borderline one goes to the artist's phone. This text never reaches the Mirror.
   */
  async heard(text) {
    const r = this.round;
    text = clean(text, 120);
    if (this.phase !== 'draw' || !text) return;
    r.heard.push(text);
    if (r.heard.length > 12) r.heard.shift();
    this.sync();
    let verdict;
    try { verdict = await judge(text, r.prompt.text); } catch { verdict = 'no'; }
    if (this.round !== r || this.phase !== 'draw') return;
    console.log(`[${this.code}] heard: "${text}" -> ${verdict}`);
    if (verdict === 'yes') return this.endRound('kingdom', 'listener');
    if (verdict === 'maybe' && !r.confirm) { r.confirm = { guess: text, by: 'room' }; this.sync(); }
  }

  /** Artist's phone: "Does this count?" for a borderline guess from the Mirror or the room. */
  confirm(playerId, yes) {
    const r = this.round;
    if (this.phase !== 'draw' || r.artistId !== playerId || !r.confirm) return;
    const { guess, by } = r.confirm;
    r.confirm = null;
    if (by === 'room') {
      if (yes) return this.endRound('kingdom', 'listener');
      return this.sync();
    }
    const g = r.mirrorGuesses.find((x) => x.text === guess);
    if (g) g.verdict = yes ? 'yes' : 'no';
    if (yes) return this.endRound('mirror', 'mirror');
    this.sync();
  }

  /** The room shouted the answer (artist taps "They got it!", or the host presses it). */
  kingdomGotIt() {
    if (this.phase === 'draw') this.endRound('kingdom', 'room');
  }

  endRound(winner, by) {
    const r = this.round;
    if (this.phase !== 'draw') return;
    clearTimeout(this.timer);
    if (winner === 'kingdom') this.scores.kingdom++;
    if (winner === 'mirror') this.scores.mirror++;
    const artist = this.players.get(r.artistId);
    r.result = { winner, by, elapsedMs: Date.now() - r.startedAt, prompt: r.prompt.text };
    r.confirm = null;
    this.history.push({
      number: r.number,
      artistId: r.artistId,
      artistName: artist?.name ?? 'Someone',
      artistSuit: artist?.suit ?? 'hearts',
      prompt: r.prompt.text,
      winner,
      by,
      elapsedMs: r.result.elapsedMs,
      mirrorGuesses: r.mirrorGuesses.map((g) => g.text),
      heard: r.heard.slice(-5), // for "The Kingdom was close!"
    });
    this.phase = 'result';
    this.sync();
  }

  next() {
    if (this.phase !== 'result') return;
    if (this.history.length >= this.totalRounds) {
      this.phase = 'final';
      this.round = null;
      this.sync();
    } else {
      this.beginPick();
    }
  }

  /** Host can end the game early from any round screen. */
  finish() {
    if (!['pick', 'draw', 'result'].includes(this.phase)) return;
    clearTimeout(this.timer);
    if (this.phase === 'pick' && this.round && !this.round.prompt) this.pool.push(...this.round.choices.filter((c) => c.authorId));
    this.phase = 'final';
    this.round = null;
    this.sync();
  }

  highlights() {
    if (this.phase !== 'final') return;
    this.phase = 'highlights';
    this.sync();
  }

  toLobby() {
    this.reset();
    this.sync();
  }

  // ---------- highlights ----------

  setHighlights(on) {
    if (this.phase !== 'lobby') return; // opt-in happens before the game starts
    this.highlightsOn = Boolean(on);
    this.sync();
  }

  /** Host lists its laugh clips for review. Only labels travel; the video stays on the laptop. */
  setClips(list) {
    if (this.phase !== 'highlights' || !Array.isArray(list)) return;
    this.clips = list.slice(0, 12).map((c) => ({
      id: clean(c.id, 40),
      label: clean(c.label, 80),
      durationMs: Math.max(0, Math.min(60_000, Number(c.durationMs) || 0)),
    }));
    this.sync();
  }

  /** Anyone can veto a clip; a vetoed clip is deleted on the host and never saved. */
  veto(id) {
    if (this.phase !== 'highlights' || !this.clips.some((c) => c.id === id)) return;
    this.vetoes.add(id);
    this.sync();
  }

  // ---------- views ----------

  publicView() {
    const r = this.round;
    return {
      code: this.code,
      phase: this.phase,
      demo: DEMO_MODE,
      scores: this.scores,
      totalRounds: this.totalRounds,
      highlights: this.highlightsOn,
      clips: this.clips.map((c) => ({ ...c, vetoed: this.vetoes.has(c.id) })),
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        suit: p.suit,
        connected: p.connected,
        prompts: p.prompts.length, // how many they added (optional)
      })),
      round: r && {
        number: r.number,
        artistId: r.artistId,
        artistName: this.players.get(r.artistId)?.name ?? 'Someone',
        remainingMs: r.result ? 0 : Math.max(0, r.deadline - Date.now()),
        elapsedMs: r.startedAt ? (r.result?.elapsedMs ?? Date.now() - r.startedAt) : 0,
        mirrorGuesses: r.mirrorGuesses.map((g) => g.text),
        mirrorThinking: r.pending,
        heard: r.heard.slice(-4),
        awaitingConfirm: Boolean(r.confirm),
        confirm: r.confirm, // the borderline guess itself (shown on the TV too)
        result: r.result, // includes the prompt, but only once the round is over
      },
      history: this.history,
    };
  }

  privateView(p) {
    const r = this.round;
    const isArtist = r?.artistId === p.id && ['pick', 'draw'].includes(this.phase);
    return {
      id: p.id,
      name: p.name,
      suit: p.suit,
      prompts: p.prompts,
      isArtist,
      choices: isArtist && this.phase === 'pick' ? r.choices.map((c) => c.text) : null,
      prompt: isArtist && this.phase === 'draw' ? r.prompt.text : null,
      confirm: isArtist && this.phase === 'draw' ? r.confirm : null,
    };
  }

  sync() {
    const shared = this.publicView();
    if (this.host) this.send(this.host, { type: 'state', state: shared });
    for (const p of this.players.values()) {
      if (p.ws) this.send(p.ws, { type: 'state', state: shared, you: this.privateView(p) });
    }
  }
}

