#!/usr/bin/env node
// Mirror, Mirror game server: host screen + phone controllers + the Mirror.
//
//   npm run dev            phones join over the local Wi-Fi
//   npm run dev:tunnel     phones join through a Cloudflare quick tunnel (campus Wi-Fi)
//
// Host:   http://localhost:3000 on the laptop (camera needs localhost)
// Phones: scan the QR code on the host screen.
//
// Env: MODEL_API_KEY (Muse Spark; without it the Mirror runs in demo mode),
//      PORT (3000), PUBLIC_URL (override the join address in the QR code).

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import QRCode from 'qrcode';
import { createServer as createVite } from 'vite';
import vue from '@vitejs/plugin-vue';
import { Room } from './game.mjs';
import { DEMO_MODE, transcribe } from './mirror.mjs';

const PORT = Number(process.env.PORT ?? 3000);
const MEDIAPIPE_WASM = {
  wasm: fileURLToPath(new URL('../node_modules/@mediapipe/tasks-vision/wasm', import.meta.url)),
  'audio-wasm': fileURLToPath(new URL('../node_modules/@mediapipe/tasks-audio/wasm', import.meta.url)),
};
const TUNNEL = process.argv.includes('--tunnel');
let publicUrl = (process.env.PUBLIC_URL ?? `http://${lanAddress()}:${PORT}`).replace(/\/$/, '');

// Only the laptop itself may drive the host screen. Tunnel traffic also arrives from
// 127.0.0.1, so anything with proxy headers is remote. The Host header check stops a
// malicious web page from DNS-rebinding its way to "localhost" in the laptop's browser.
const PROXY_HEADERS = ['cf-connecting-ip', 'cf-ray', 'x-forwarded-for', 'forwarded'];
const isLocal = (req) =>
  ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) &&
  !PROXY_HEADERS.some((h) => h in req.headers) &&
  /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.headers.host ?? '');

// ---------- HTTP + Vite ----------

const server = createServer();
const vite = await createVite({
  root: fileURLToPath(new URL('../web', import.meta.url)),
  configFile: false,
  plugins: [vue()],
  appType: 'mpa',
  server: {
    middlewareMode: true,
    // Vite's live-reload socket shares our port (Vite 8 reads this from server.ws, not
    // middlewareMode), so it also works for phones coming through the tunnel.
    ws: { server },
    allowedHosts: ['.trycloudflare.com'], // LAN IPs are always allowed
  },
  logLevel: 'warn',
});

server.on('request', (req, res) => {
  const path = req.url.split('?')[0];
  const query = req.url.slice(path.length);
  if (path === '/' || path === '/index.html') {
    if (!isLocal(req)) {
      res.writeHead(302, { Location: '/join/' + query }); // a phone landed on the host URL
      return res.end();
    }
  }
  if (path === '/join') {
    res.writeHead(302, { Location: '/join/' + query });
    return res.end();
  }
  // Hand tracker runtime, served locally so the demo works without internet.
  const wasm = path.match(/^\/mediapipe\/(wasm|audio-wasm)\/([\w.-]+\.(js|wasm))$/);
  if (wasm) {
    const file = join(MEDIAPIPE_WASM[wasm[1]], wasm[2]);
    if (!existsSync(file)) return res.writeHead(404).end();
    res.writeHead(200, {
      'Content-Type': wasm[3] === 'wasm' ? 'application/wasm' : 'text/javascript',
      'Cache-Control': 'max-age=86400',
    });
    return createReadStream(file).pipe(res);
  }
  vite.middlewares(req, res);
});

// ---------- rooms ----------

const rooms = new Map();
const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O
const HOST_GRACE_MS = 60_000;

const send = (ws, msg) => ws?.readyState === 1 && ws.send(JSON.stringify(msg));

function newCode() {
  let code;
  do code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
  while (rooms.has(code));
  return code;
}

async function sendRoomInfo(room) {
  if (!room.host) return;
  const joinUrl = `${publicUrl}/join/?room=${room.code}`;
  const qrSvg = await QRCode.toString(joinUrl, { type: 'svg', margin: 1, color: { dark: '#2b2421', light: '#ffffff' } });
  send(room.host, { type: 'room', code: room.code, joinUrl, joinHost: publicUrl.replace(/^https?:\/\//, ''), qrSvg });
}

async function attachHost(ws, prevCode) {
  let room = rooms.get(prevCode);
  if (room && !room.host) {
    clearTimeout(room.expiry); // host page reloaded: reclaim the room
  } else {
    room = new Room(newCode(), send);
    rooms.set(room.code, room);
    console.log(`Room ${room.code} opened`);
  }
  room.host = ws;
  ws.room = room;
  ws.isHost = true;
  await sendRoomInfo(room);
  room.sync();
}

function handlePlayer(ws, msg) {
  if (msg.type === 'join') {
    const room = rooms.get(String(msg.code ?? '').trim().toUpperCase());
    if (!room) return send(ws, { type: 'error', reason: 'no-room', message: 'No room with that code.' });
    const res = room.join(ws, msg);
    if (res.error) return send(ws, { type: 'error', reason: res.error, message: res.message });
    ws.room = room;
    ws.playerId = res.player.id;
    send(ws, { type: 'joined', code: room.code, playerId: res.player.id });
    console.log(`Room ${room.code}: ${res.player.name} is here`);
    return room.sync();
  }
  const room = ws.room;
  if (!room || !ws.playerId) return;
  const isArtist = room.round?.artistId === ws.playerId;
  switch (msg.type) {
    case 'prompts': return room.setPrompts(ws.playerId, msg.prompts);
    case 'pick': return room.pick(ws.playerId, Number(msg.index));
    case 'confirm': return room.confirm(ws.playerId, Boolean(msg.yes));
    case 'gotIt': if (isArtist) room.kingdomGotIt(); return;
    case 'tool': if (isArtist && room.phase === 'draw') send(room.host, { type: 'tool', action: String(msg.action) }); return;
    case 'veto': return room.veto(String(msg.id));
    case 'leave': return room.kick(ws.playerId);
  }
}

function handleHost(ws, msg) {
  const room = ws.room;
  if (!room || room.host !== ws) return;
  switch (msg.type) {
    case 'start': return room.start();
    case 'snapshot': return room.mirrorSnapshot(msg.image);
    case 'gotIt': return room.kingdomGotIt();
    case 'next': return room.next();
    case 'finish': return room.finish();
    case 'highlights': return room.highlights();
    case 'lobby': return room.toLobby();
    case 'kick': return room.kick(msg.playerId);
    case 'highlights:on': return room.setHighlights(msg.on);
    case 'clips': return room.setClips(msg.clips);
    case 'veto': return room.veto(String(msg.id));
    case 'heard': return room.heard(String(msg.text ?? '')); // browser speech recognition (demo)
    case 'audio': return listen(room, msg.wav);
  }
}

// Room audio from the host mic, a few seconds at a time, only while a round is live.
const MAX_LISTENING = 2; // transcriptions in flight per room
async function listen(room, wavBase64) {
  if (room.phase !== 'draw' || typeof wavBase64 !== 'string' || (room.listening ?? 0) >= MAX_LISTENING) return;
  room.listening = (room.listening ?? 0) + 1;
  try {
    const text = await transcribe(Buffer.from(wavBase64, 'base64'));
    if (text) await room.heard(text);
  } catch (e) {
    console.error(`[${room.code}] listener error:`, e.message);
    send(room.host, { type: 'mirrorError', message: 'The listener is having trouble: ' + e.message });
  } finally {
    room.listening--;
  }
}

// ---------- WebSockets (/ws; Vite's HMR socket shares the server) ----------

const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 * 1024 });
server.on('upgrade', (req, socket, head) => {
  if (req.url.split('?')[0] !== '/ws') return; // Vite handles its own HMR upgrades
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'host') return isLocal(req) && attachHost(ws, msg.code);
    if (ws.isHost) return handleHost(ws, msg);
    handlePlayer(ws, msg);
  });
  ws.on('close', () => {
    const room = ws.room;
    if (!room) return;
    if (room.host === ws) {
      room.host = null;
      room.expiry = setTimeout(() => {
        for (const p of room.players.values()) send(p.ws, { type: 'closed' });
        clearTimeout(room.timer);
        rooms.delete(room.code);
        console.log(`Room ${room.code} closed`);
      }, HOST_GRACE_MS);
    } else if (ws.playerId) {
      room.disconnect(ws.playerId, ws);
    }
  });
});

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 15_000);

server.listen(PORT, () => {
  console.log(`Host screen:  http://localhost:${PORT}`);
  if (DEMO_MODE) console.log('MODEL_API_KEY not set: the Mirror is in demo mode (silly canned guesses).');
  if (TUNNEL) return startTunnel();
  console.log(`Phones join:  ${publicUrl}/join`);
  console.log("(Phones can't connect? Campus/venue Wi-Fi often blocks it: use npm run dev:tunnel.)");
});

// ---------- Cloudflare quick tunnel ----------

// A quick tunnel dies quietly when the laptop changes networks: cloudflared keeps running,
// but its address stops existing. So we watch its health endpoint and start a fresh
// tunnel (new address, QR code updates on screen) if it stays down.
const TUNNEL_METRICS = `127.0.0.1:${PORT + 20000}`;
const TUNNEL_CHECK_MS = 10_000;
const TUNNEL_DOWN_LIMIT = 3; // ~30 s unhealthy before restarting

function startTunnel() {
  // Check install folders first: terminals opened before installing (including VS Code's,
  // until VS Code restarts) still have the old PATH.
  const exe = [
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
  ].find((p) => existsSync(p)) ?? 'cloudflared';
  let proc = null, healthTimer = null, stopping = false;

  const launch = () => {
    console.log('Starting tunnel…');
    proc = spawn(exe, ['tunnel', '--no-autoupdate', '--metrics', TUNNEL_METRICS, '--url', `http://localhost:${PORT}`]);
    const mine = proc;
    let found = false;
    const onOutput = (chunk) => {
      const m = !found && String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (!m) return;
      found = true;
      publicUrl = m[0];
      console.log(`Phones join:  ${publicUrl}/join   (works on any network)`);
      for (const room of rooms.values()) sendRoomInfo(room);
    };
    proc.stdout.on('data', onOutput);
    proc.stderr.on('data', onOutput);
    proc.on('error', (e) => {
      if (e.code !== 'ENOENT') return console.error('Tunnel error:', e.message);
      console.error('cloudflared is not installed. Install it with:\n  winget install --id Cloudflare.cloudflared');
      stopping = true;
      clearInterval(healthTimer);
    });
    proc.on('exit', (code) => {
      if (stopping || mine !== proc) return;
      console.error(`Tunnel stopped (exit ${code}). Restarting it…`);
      setTimeout(restart, 3000);
    });
  };

  const restart = () => {
    if (stopping) return;
    const old = proc;
    proc = null;
    old?.kill();
    launch();
  };

  let down = 0;
  healthTimer = setInterval(async () => {
    if (!proc) return;
    let ok = false;
    try { ok = (await fetch(`http://${TUNNEL_METRICS}/ready`, { signal: AbortSignal.timeout(3000) })).ok; } catch {}
    down = ok ? 0 : down + 1;
    if (down === 1) console.warn('Tunnel looks unhealthy (network change?). Watching…');
    if (down >= TUNNEL_DOWN_LIMIT) {
      down = 0;
      console.warn('Tunnel is down. Starting a fresh one; the QR code will update. Phones already in the room may need to rescan.');
      restart();
    }
  }, TUNNEL_CHECK_MS);

  launch();
  const stop = () => { stopping = true; clearInterval(healthTimer); proc?.kill(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

// Best guess at the laptop's Wi-Fi/Ethernet address, skipping virtual adapters.
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
      if (a.address.startsWith('169.254.')) score -= 10;
      candidates.push({ address: a.address, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.address ?? 'localhost';
}
