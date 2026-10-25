#!/usr/bin/env node
// Mirror playground: host screen (draw, the Mirror guesses) + phone join/lobby.
// The server proxies to Muse Spark so the API key never reaches a browser.
//
// Usage:
//   npm install
//   MODEL_API_KEY=... node scripts/mirror-playground.mjs
//   Host:   open http://localhost:3000 on the laptop (camera needs localhost)
//   Phones: scan the QR code on the host screen (same Wi-Fi)
//
// Env: PORT (default 3000), PUBLIC_URL to override the join address the QR code
// points at (e.g. http://192.168.1.20:3000 if the wrong network adapter is picked).
//
// --tunnel: for Wi-Fi that blocks device-to-device traffic (campus, hackathon venues).
// Starts a free Cloudflare quick tunnel (needs `cloudflared` installed) and points the
// QR code at its public https address, so phones join over the internet instead.

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';

const API_BASE = process.env.MODEL_API_BASE ?? 'https://api.meta.ai/v1';
const API_KEY = process.env.MODEL_API_KEY;
const PORT = Number(process.env.PORT ?? 3000);

const MIRROR_PROMPT =
  'You are the Magic Mirror in a drawing guessing game. This is a rough sketch ' +
  'drawn in the air with a finger, so lines are wobbly. Guess what it depicts. ' +
  'Reply with ONLY your guess: one or two words, lowercase, no punctuation.';

if (!API_KEY) {
  console.error('MODEL_API_KEY is not set. Get a key at https://dev.meta.ai/api-keys/');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const hostPage = readFileSync(join(here, 'mirror-playground.html'));
const joinPage = readFileSync(join(here, 'join.html'));

const TUNNEL = process.argv.includes('--tunnel');
let publicUrl = (process.env.PUBLIC_URL ?? `http://${lanAddress()}:${PORT}`).replace(/\/$/, '');

// Only the laptop itself may drive the host screen or spend API credits.
// Tunnel traffic also arrives from 127.0.0.1, so anything carrying proxy headers is remote.
const PROXY_HEADERS = ['cf-connecting-ip', 'cf-ray', 'x-forwarded-for', 'forwarded'];
const isLocal = (req) =>
  ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) &&
  !PROXY_HEADERS.some((h) => h in req.headers);

// ---------- HTTP ----------

const server = createServer(async (req, res) => {
  const path = req.url.split('?')[0];
  if (req.method === 'GET' && path === '/') {
    if (!isLocal(req)) {
      // A phone landed on the host URL: send it to the join page instead.
      res.writeHead(302, { Location: '/join' });
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(hostPage);
  }
  if (req.method === 'GET' && path === '/join') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(joinPage);
  }
  if (req.method === 'POST' && path === '/guess') {
    if (!isLocal(req)) return res.writeHead(403).end();
    try {
      const { image, model, effort } = JSON.parse(await readBody(req));
      const result = await askMirror(image, model, effort);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(result));
    } catch (e) {
      console.error(e.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: e.message }));
    }
  }
  res.writeHead(404).end();
});

// ---------- rooms (in memory) ----------
// room: { code, host: ws|null, players: Map<id, {id, name, ws, connected}>, expiry }

const rooms = new Map();
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O, easy to read off a TV
const MAX_PLAYERS = 12;
const HOST_GRACE_MS = 60_000; // keep the room this long if the host page reloads

function newCode() {
  let code;
  do code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
  while (rooms.has(code));
  return code;
}

function lobbyState(room) {
  return {
    type: 'lobby',
    code: room.code,
    players: [...room.players.values()].map(({ id, name, connected }) => ({ id, name, connected })),
  };
}

function broadcast(room, msg) {
  const data = JSON.stringify(msg);
  if (room.host?.readyState === 1) room.host.send(data);
  for (const p of room.players.values()) if (p.ws?.readyState === 1) p.ws.send(data);
}

const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg));

async function attachHost(ws, prevCode) {
  let room = rooms.get(prevCode);
  if (room && !room.host) {
    clearTimeout(room.expiry); // host page reloaded: reclaim the same room
  } else {
    room = { code: newCode(), host: null, players: new Map(), expiry: null };
    rooms.set(room.code, room);
    console.log(`Room ${room.code} opened`);
  }
  room.host = ws;
  ws.room = room;
  await sendRoomInfo(room);
  broadcast(room, lobbyState(room));
}

async function sendRoomInfo(room) {
  if (!room.host) return;
  const joinUrl = `${publicUrl}/join?room=${room.code}`;
  const qrSvg = await QRCode.toString(joinUrl, { type: 'svg', margin: 1, color: { dark: '#1a1538', light: '#ffffff' } });
  send(room.host, { type: 'room', code: room.code, joinUrl, joinBase: `${publicUrl}/join`, qrSvg });
}

function joinPlayer(ws, { code, name, playerId }) {
  const room = rooms.get(String(code ?? '').trim().toUpperCase());
  if (!room) return send(ws, { type: 'error', reason: 'no-room', message: 'No room with that code.' });

  // Rejoin after a phone sleeps or reloads: same id, same seat.
  const existing = playerId && room.players.get(playerId);
  if (existing) {
    existing.ws?.terminate();
    existing.ws = ws;
    existing.connected = true;
  } else {
    name = String(name ?? '').replace(/\s+/g, ' ').trim().slice(0, 16);
    if (!name) return send(ws, { type: 'error', reason: 'name', message: 'Pick a name first.' });
    const taken = [...room.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase());
    if (taken) return send(ws, { type: 'error', reason: 'name', message: `"${name}" is taken. Try another name.` });
    if (room.players.size >= MAX_PLAYERS) return send(ws, { type: 'error', reason: 'full', message: 'This room is full.' });
    playerId = crypto.randomUUID();
    room.players.set(playerId, { id: playerId, name, ws, connected: true });
    console.log(`Room ${room.code}: ${name} joined`);
  }
  ws.room = room;
  ws.playerId = playerId;
  send(ws, { type: 'joined', code: room.code, playerId, name: room.players.get(playerId).name });
  broadcast(room, lobbyState(room));
}

// ---------- WebSockets ----------

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'host' && isLocal(req)) attachHost(ws, msg.code);
    else if (msg.type === 'join') joinPlayer(ws, msg);
    else if (msg.type === 'kick' && ws.room?.host === ws) {
      const p = ws.room.players.get(msg.playerId);
      if (p) {
        ws.room.players.delete(p.id);
        if (p.ws) send(p.ws, { type: 'kicked' });
        broadcast(ws.room, lobbyState(ws.room));
      }
    }
  });

  ws.on('close', () => {
    const room = ws.room;
    if (!room) return;
    if (room.host === ws) {
      room.host = null;
      room.expiry = setTimeout(() => {
        broadcast(room, { type: 'closed' });
        rooms.delete(room.code);
        console.log(`Room ${room.code} closed`);
      }, HOST_GRACE_MS);
    } else {
      const p = room.players.get(ws.playerId);
      if (p && p.ws === ws) {
        p.connected = false;
        p.ws = null;
        broadcast(room, lobbyState(room));
      }
    }
  });
});

// Phones drop off Wi-Fi silently when they sleep; ping to notice.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 15_000);

server.listen(PORT, () => {
  console.log(`Host screen:  http://localhost:${PORT}`);
  if (TUNNEL) return startTunnel();
  console.log(`Phones join:  ${publicUrl}/join`);
  console.log('(Phones can\'t connect? Campus/venue Wi-Fi often blocks it: run with --tunnel.)');
});

// ---------- Cloudflare quick tunnel ----------

function startTunnel() {
  // Check the install folders first: terminals opened before installing (including
  // VS Code's, until VS Code restarts) still have the old PATH.
  const exe = [
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
  ].find((p) => existsSync(p)) ?? 'cloudflared';
  console.log('Starting tunnel…');
  const proc = spawn(exe, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${PORT}`]);
  let found = false;
  const onOutput = (chunk) => {
    const m = !found && String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (!m) return;
    found = true;
    publicUrl = m[0];
    console.log(`Phones join:  ${publicUrl}/join   (works on any network)`);
    for (const room of rooms.values()) sendRoomInfo(room); // refresh QR codes already on screen
  };
  proc.stdout.on('data', onOutput);
  proc.stderr.on('data', onOutput);
  proc.on('error', (e) => {
    if (e.code !== 'ENOENT') return console.error('Tunnel error:', e.message);
    console.error('cloudflared is not installed. Install it with:\n  winget install --id Cloudflare.cloudflared\nthen open a new terminal and run this again.');
  });
  proc.on('exit', (code) => found && console.error(`Tunnel stopped (exit ${code}). Phones can no longer join.`));
  const stop = () => { proc.kill(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

// ---------- the Mirror ----------

async function askMirror(image, model, effort) {
  const body = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: MIRROR_PROMPT },
          { type: 'image_url', image_url: { url: image } },
        ],
      },
    ],
    max_tokens: 400,
  };
  if (effort !== 'default') body.reasoning_effort = effort;

  const t0 = performance.now();
  const r = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const json = await r.json();
  const apiMs = performance.now() - t0;
  const text = (json.choices?.[0]?.message?.content ?? '').trim();
  console.log(`${(apiMs / 1000).toFixed(2)}s  ${model}/${effort}  -> ${text}`);
  return { text, apiMs, usage: json.usage };
}

// ---------- helpers ----------

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// Best guess at the laptop's Wi-Fi/Ethernet address, skipping virtual adapters (WSL, VPNs, VMs).
function lanAddress() {
  const candidates = [];
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      let score = 0;
      if (/wi-?fi|wlan|wireless/i.test(name)) score += 3;
      if (/ethernet|^en|^eth/i.test(name)) score += 2;
      if (/vethernet|virtual|vmware|vbox|docker|wsl|hyper-v|tailscale|zerotier|vpn/i.test(name)) score -= 5;
      if (a.address.startsWith('192.168.')) score += 1;
      if (a.address.startsWith('169.254.')) score -= 10; // no DHCP lease
      candidates.push({ name, address: a.address, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length > 1) {
    console.log('Network adapters: ' + candidates.map((c) => `${c.name}=${c.address}`).join(', '));
  }
  return candidates[0]?.address ?? 'localhost';
}
