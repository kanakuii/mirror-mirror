#!/usr/bin/env node
// Mirror latency probe: sends canvas-like doodles to Muse Spark and measures
// how long a guess takes. Answers the question: is a ~5s guess cadence realistic?
//
// Usage:
//   MODEL_API_KEY=... node scripts/mirror-latency.mjs [options]
//
// Options:
//   --runs N           timed requests per config (default 5, plus 1 untimed warmup)
//   --models a,b       models to test (default muse-spark-1.1,muse-spark-1.3)
//   --efforts a,b      reasoning_effort values; "default" omits the param
//                      (default: minimal,default)
//   --size PX          snapshot size in pixels (default 512)
//   --image path.png   use your own image instead of the built-in doodles
//   --stream           also measure time-to-first-token via streaming
//
// No dependencies; needs Node 18+ (global fetch).

import { deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE = process.env.MODEL_API_BASE ?? 'https://api.meta.ai/v1';
const API_KEY = process.env.MODEL_API_KEY;
const BUDGET_MS = 5000;

const args = parseArgs(process.argv.slice(2));
const RUNS = Number(args.runs ?? 5);
const MODELS = (args.models ?? 'muse-spark-1.1,muse-spark-1.3').split(',');
const EFFORTS = (args.efforts ?? 'minimal,default').split(',');
const SIZE = Number(args.size ?? 512);
const STREAM = Boolean(args.stream);

const MIRROR_PROMPT =
  'You are the Magic Mirror in a drawing guessing game. This is a rough sketch ' +
  'drawn in the air with a finger, so lines are wobbly. Guess what it depicts. ' +
  'Reply with ONLY your guess: one or two words, lowercase, no punctuation.';

if (!API_KEY) {
  console.error('MODEL_API_KEY is not set. Get a key at https://dev.meta.ai/api-keys/');
  process.exit(1);
}

// ---------- sample drawings ----------

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'out');
mkdirSync(outDir, { recursive: true });

let samples;
if (args.image) {
  samples = [{ name: args.image, answer: '?', png: readFileSync(args.image) }];
} else {
  samples = Object.entries(DOODLES()).map(([answer, strokes]) => {
    const png = renderPng(strokes, SIZE);
    writeFileSync(join(outDir, `${answer}.png`), png);
    return { name: answer, answer, png };
  });
  console.log(`Wrote sample drawings to ${outDir}`);
}
for (const s of samples) s.dataUrl = `data:image/png;base64,${s.png.toString('base64')}`;
console.log(
  `Snapshot size: ${SIZE}px, ~${Math.round(samples[0].png.length / 1024)} KB PNG\n`,
);

// ---------- run ----------

const results = [];
for (const model of MODELS) {
  for (const effort of EFFORTS) {
    const label = `${model} / effort=${effort}`;
    console.log(`== ${label}`);
    try {
      await guess(model, effort, samples[0]); // warmup: connection + any cold start
    } catch (e) {
      console.log(`   skipped: ${e.message}\n`);
      continue;
    }
    const times = [];
    const ttfts = [];
    let correct = 0;
    for (let i = 0; i < RUNS; i++) {
      const sample = samples[i % samples.length];
      try {
        const r = await guess(model, effort, sample);
        times.push(r.ms);
        if (r.ttft != null) ttfts.push(r.ttft);
        const hit = sample.answer !== '?' && r.text.includes(sample.answer);
        if (hit) correct++;
        console.log(
          `   ${fmt(r.ms).padStart(7)}  ${sample.name.padEnd(10)} -> "${r.text}"` +
            (r.ttft != null ? `  (first token ${fmt(r.ttft)})` : '') +
            (r.usage ? `  [${r.usage}]` : ''),
        );
      } catch (e) {
        console.log(`   error: ${e.message}`);
      }
    }
    if (times.length) results.push({ label, times, ttfts, correct, n: times.length });
    console.log();
  }
}

// ---------- summary ----------

console.log('== Summary (5s guess cadence budget)');
console.log(
  'config'.padEnd(36) + 'p50'.padStart(8) + 'p90'.padStart(8) + 'max'.padStart(8) +
    '  <5s'.padStart(7) + (STREAM ? 'ttft50'.padStart(9) : '') + '  correct',
);
for (const r of results) {
  const under = r.times.filter((t) => t < BUDGET_MS).length;
  console.log(
    r.label.padEnd(36) +
      fmt(pct(r.times, 50)).padStart(8) +
      fmt(pct(r.times, 90)).padStart(8) +
      fmt(Math.max(...r.times)).padStart(8) +
      `${under}/${r.n}`.padStart(7) +
      (STREAM ? (r.ttfts.length ? fmt(pct(r.ttfts, 50)) : '-').padStart(9) : '') +
      `  ${r.correct}/${r.n}`,
  );
}
console.log(
  '\nRule of thumb: p90 well under 5s means guesses can fire on a fixed 5s timer.\n' +
    'If p90 is close to 5s, fire the next request as soon as the last one returns\n' +
    'instead of on a fixed clock, so slow replies never pile up.',
);

// ---------- API call ----------

async function guess(model, effort, sample) {
  const body = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: MIRROR_PROMPT },
          { type: 'image_url', image_url: { url: sample.dataUrl } },
        ],
      },
    ],
    max_tokens: 400, // generous so reasoning can't truncate the answer
    stream: STREAM,
  };
  if (effort !== 'default') body.reasoning_effort = effort;

  const t0 = performance.now();
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);

  if (!STREAM) {
    const json = await res.json();
    const ms = performance.now() - t0;
    const u = json.usage;
    return {
      ms,
      text: clean(json.choices?.[0]?.message?.content),
      usage: u && `in ${u.prompt_tokens} / out ${u.completion_tokens}`,
    };
  }

  // Streaming: parse SSE, record when the first content token arrives.
  let ttft = null;
  let text = '';
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true });
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (data === '[DONE]') continue;
      const delta = JSON.parse(data).choices?.[0]?.delta?.content;
      if (delta) {
        if (ttft == null) ttft = performance.now() - t0;
        text += delta;
      }
    }
  }
  return { ms: performance.now() - t0, ttft, text: clean(text) };
}

// ---------- helpers ----------

function clean(s) {
  return (s ?? '').trim().toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').slice(0, 40);
}

function pct(xs, p) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

function fmt(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    out[key] = next && !next.startsWith('--') ? (i++, next) : true;
  }
  return out;
}

// ---------- doodles + tiny PNG rasterizer ----------
// Strokes are in a 0..100 coordinate space; jitter mimics shaky hand tracking.

function DOODLES() {
  const circle = (cx, cy, r, n = 24) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    });
  return {
    house: [
      [[20, 50], [50, 22], [80, 50]],
      [[26, 50], [26, 85], [74, 85], [74, 50]],
      [[44, 85], [44, 66], [56, 66], [56, 85]],
      [[32, 56], [40, 56], [40, 63], [32, 63], [32, 56]],
    ],
    cat: [
      circle(50, 55, 25),
      [[30, 40], [32, 18], [45, 31]],
      [[55, 31], [68, 18], [70, 40]],
      [[41, 50], [42, 51]],
      [[58, 50], [59, 51]],
      [[47, 60], [50, 63], [53, 60]],
      [[22, 58], [40, 60]], [[22, 66], [40, 63]],
      [[60, 60], [78, 58]], [[60, 63], [78, 66]],
    ],
    fish: [
      [[20, 50], [35, 35], [60, 35], [72, 50], [60, 65], [35, 65], [20, 50]],
      [[72, 50], [88, 36], [88, 64], [72, 50]],
      [[32, 46], [33, 47]],
      [[45, 40], [52, 50], [45, 60]],
    ],
  };
}

function renderPng(strokes, size) {
  const px = new Uint8Array(size * size * 3);
  const bg = [18, 14, 40]; // dark indigo, like the host screen
  const ink = [255, 214, 102]; // gold "wand" stroke
  for (let i = 0; i < size * size; i++) px.set(bg, i * 3);

  let seed = 42;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
  const scale = size / 100;
  const radius = Math.max(2, size / 100);

  const dot = (x, y) => {
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const X = Math.round(x + dx), Y = Math.round(y + dy);
        if (X >= 0 && Y >= 0 && X < size && Y < size) px.set(ink, (Y * size + X) * 3);
      }
  };

  for (const stroke of strokes) {
    const pts = stroke.map(([x, y]) => [(x + rand() * 2) * scale, (y + rand() * 2) * scale]);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) || 1;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        dot(x0 + (x1 - x0) * t + rand() * 1.5, y0 + (y1 - y0) * t + rand() * 1.5);
      }
    }
  }
  return encodePng(px, size, size);
}

function encodePng(rgb, w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0; // filter: none
    Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
