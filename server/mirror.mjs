// The Magic Mirror: guesses drawings from canvas snapshots and judges answers.
// It only ever sees the canvas image. Never the room transcript, never the prompt
// (the prompt is only used afterwards, by the judge).

const API_BASE = process.env.MODEL_API_BASE ?? 'https://api.meta.ai/v1';
const API_KEY = process.env.MODEL_API_KEY;
const MODEL = process.env.MIRROR_MODEL ?? 'muse-spark-1.1';
const EFFORT = process.env.MIRROR_EFFORT ?? 'minimal';

export const DEMO_MODE = !API_KEY;

const GUESS_PROMPT =
  'You are the Magic Mirror in a drawing guessing game. This is a rough sketch ' +
  'drawn in the air with a finger, so lines are wobbly. Guess what it depicts. ' +
  'Reply with ONLY your guess: one to four words, lowercase, no punctuation. ' +
  'Never repeat any of these earlier guesses: ';

async function chat(content, maxTokens = 200) {
  const body = { model: MODEL, messages: [{ role: 'user', content }], max_tokens: maxTokens };
  if (EFFORT !== 'default') body.reasoning_effort = EFFORT;
  const r = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) throw new Error(`Muse HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const json = await r.json();
  return (json.choices?.[0]?.message?.content ?? '').trim();
}

const DEMO_GUESSES = [
  'a potato', 'a cloud', 'a lumpy bean', 'angry soup', 'a tax form', 'a very confident potato',
  'a sad lasagna', 'modern art', 'a sock', 'a haunted spoon', 'a map of ohio', 'a sneeze',
];

/** One guess from a PNG data URL. `previous` keeps the Mirror from repeating itself. */
export async function guessDrawing(imageDataUrl, previous = []) {
  const t0 = performance.now();
  let text;
  if (DEMO_MODE) {
    await new Promise((r) => setTimeout(r, 900 + Math.random() * 900));
    const fresh = DEMO_GUESSES.filter((g) => !previous.includes(g));
    text = fresh[Math.floor(Math.random() * fresh.length)] ?? 'a mystery';
  } else {
    text = await chat([
      { type: 'text', text: GUESS_PROMPT + (previous.length ? previous.join(', ') : '(none)') },
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ]);
  }
  text = text.toLowerCase().replace(/[^\p{L}\p{N}' -]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return { text: text || 'a mystery', ms: performance.now() - t0 };
}

// ---------- judging ----------

const ARTICLES = new Set(['a', 'an', 'the', 'some', 'my', 'your', 'his', 'her', 'their', 'our']);
const FILLER = new Set(['of', 'in', 'on', 'with', 'and', 'at', 'to', 'for', 'is', 'it', 'its', 'thing']);

function stem(w) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 3 && /(ses|xes|zes|ches|shes)$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}
const words = (s) =>
  s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter((w) => w && !ARTICLES.has(w)).map(stem);
const contentWords = (s) => words(s).filter((w) => !FILLER.has(w));

/**
 * Lenient check: does `guess` count as `prompt`? Cheap local rules first;
 * only if they share a word but don't clearly match do we ask Muse Spark.
 * Returns 'yes' | 'no' | 'maybe' (maybe = borderline, the artist's phone decides).
 */
export async function judge(guess, prompt) {
  const g = contentWords(guess), p = contentWords(prompt);
  if (!g.length || !p.length) return 'no';
  if (g.join(' ') === p.join(' ')) return 'yes';
  // "cat" for "a cat in a teacup" is not enough; "teacup cat" for it is.
  const pInG = p.every((w) => g.includes(w));
  if (pInG) return 'yes';
  const shared = g.filter((w) => p.includes(w));
  if (!shared.length && DEMO_MODE) return 'no';
  if (DEMO_MODE) return shared.length / p.length >= 0.5 ? 'maybe' : 'no';
  try {
    const answer = await chat(
      `In a drawing guessing game the answer is "${prompt}". Someone guessed "${guess}". ` +
        'Be lenient: synonyms, nicknames, and close variants count ("kitty" counts for "cat"; ' +
        '"ship" counts for "boat"). A guess that names only part of the answer does not count ' +
        '("cat" does not count for "cat in a teacup"). Reply with exactly one word: yes, no, or maybe.',
      20,
    );
    const a = answer.toLowerCase();
    return a.startsWith('yes') ? 'yes' : a.startsWith('maybe') ? 'maybe' : 'no';
  } catch (e) {
    console.error('judge failed:', e.message);
    return shared.length ? 'maybe' : 'no';
  }
}

// ---------- the listener (Muse Voice Transcribe) ----------
// Room audio goes ONLY here, during guessing windows. The Mirror never sees transcripts.

const ASR_MODEL = process.env.ASR_MODEL ?? 'muse-voice-transcribe-1.0';

/** Transcribe a short mono 16 kHz PCM16 WAV clip. Returns '' for silence. */
export async function transcribe(wav) {
  if (DEMO_MODE) return ''; // the host uses the browser's speech recognition instead
  const form = new FormData();
  form.append('request', new Blob([JSON.stringify({ model: ASR_MODEL, audioEncoding: 'WAV', mode: 'PUSH_TO_TALK', sampleRate: 16000 })], { type: 'application/json' }));
  form.append('audio', new Blob([wav], { type: 'audio/wav' }), 'room.wav');
  const r = await fetch(`${API_BASE}/asr/transcribe`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, Accept: 'application/json' },
    body: form,
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`Transcribe HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return ((await r.json()).transcript ?? '').trim();
}
