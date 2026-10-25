// The room's ears. One mic, three uses, all only while a round is being drawn:
//   - the listener: room guesses -> text (Muse Voice Transcribe via our server, or the
//     browser's own speech recognition in demo mode). Never sent to the Mirror.
//   - the laugh detector: MediaPipe's YAMNet audio classifier, in this browser. It hears
//     that the ROOM is laughing; it knows nothing about who.
//   - the highlight recorder's audio track (recorder.js).
import { ref } from 'vue';
import { FilesetResolver, AudioClassifier } from '@mediapipe/tasks-audio';

export const micStream = ref(null);
export const micError = ref('');
let ctx = null, node = null;

// ---------- mic + ring buffer ----------

const RING_SECONDS = 6;
let ring = null, ringPos = 0, ringFilled = 0;

let micStarting = null;
export function startMic() {
  if (micStream.value || micStarting) return micStarting;
  micStarting = openMic().finally(() => (micStarting = null));
  return micStarting;
}

async function openMic() {
  micError.value = '';
  try {
    micStream.value = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: true },
      video: false,
    });
    ctx = new AudioContext();
    await ctx.audioWorklet.addModule('/capture-worklet.js');
    node = new AudioWorkletNode(ctx, 'capture');
    ring = new Float32Array(ctx.sampleRate * RING_SECONDS);
    ringPos = ringFilled = 0;
    node.port.onmessage = (e) => {
      const chunk = e.data;
      for (let i = 0; i < chunk.length; i++) ring[(ringPos + i) % ring.length] = chunk[i];
      ringPos = (ringPos + chunk.length) % ring.length;
      ringFilled = Math.min(ring.length, ringFilled + chunk.length);
    };
    ctx.createMediaStreamSource(micStream.value).connect(node);
  } catch (e) {
    micError.value = e.name === 'NotAllowedError' ? 'Microphone permission was denied.' : `Microphone error: ${e.message}`;
    stopMic();
  }
}

export function stopMic() {
  micStream.value?.getTracks().forEach((t) => t.stop());
  micStream.value = null;
  node?.disconnect();
  ctx?.close().catch(() => {});
  ctx = node = ring = null;
}

/** The last `seconds` of mic audio at the context's sample rate. */
function recent(seconds) {
  if (!ring) return null;
  const n = Math.min(ringFilled, Math.round(seconds * ctx.sampleRate));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = ring[(ringPos - n + i + ring.length) % ring.length];
  return out;
}

const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / (a.length || 1));

// ---------- the listener ----------

const CHUNK_S = 3; // seconds of audio per transcription
const STEP_S = 2.6; // a little overlap so words on a boundary aren't cut in half
const SILENCE_RMS = 0.012; // skip near-silent chunks: saves API calls

/** 16 kHz mono PCM16 WAV from float samples at `rate`. */
export function toWav(samples, rate) {
  const outRate = 16000;
  const n = Math.floor((samples.length * outRate) / rate);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, outRate, true); v.setUint32(28, outRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  const ratio = rate / outRate;
  for (let i = 0; i < n; i++) {
    // average the source samples that fall into this output sample (simple low-pass)
    const a = Math.floor(i * ratio), b = Math.max(a + 1, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = a; j < b && j < samples.length; j++) sum += samples[j];
    const x = Math.max(-1, Math.min(1, sum / (b - a)));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return buf;
}
const toBase64 = (buf) => {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/**
 * Start listening for guesses. `send` is the game socket. In demo mode (no API key) the
 * browser's speech recognition does the transcribing instead. Returns a stop function.
 */
export function startListener(send, { demo }) {
  if (demo) return startBrowserListener(send);
  const timer = setInterval(() => {
    const audio = recent(CHUNK_S);
    if (!audio || audio.length < ctx.sampleRate * 1 || rms(audio) < SILENCE_RMS) return;
    send({ type: 'audio', wav: toBase64(toWav(audio, ctx.sampleRate)) });
  }, STEP_S * 1000);
  return () => clearInterval(timer);
}

function startBrowserListener(send) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return () => {};
  let active = true;
  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = 'en-US';
  rec.onresult = (e) => {
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) send({ type: 'heard', text: e.results[i][0].transcript });
    }
  };
  rec.onend = () => { if (active) try { rec.start(); } catch {} }; // it stops after pauses
  rec.onerror = () => {};
  try { rec.start(); } catch {}
  return () => { active = false; try { rec.stop(); } catch {} };
}

// ---------- the laugh detector ----------

const LAUGH = ['Laughter', 'Baby laughter', 'Giggle', 'Snicker', 'Belly laugh', 'Chuckle, chortle'];
const LAUGH_THRESHOLD = 0.2; // YAMNet score for "someone is laughing"
const LAUGH_WINDOWS = 2; // consecutive half-second windows above threshold = a real laugh
const LAUGH_COOLDOWN_MS = 9000;

let classifierPromise = null;
function classifier() {
  classifierPromise ??= (async () => {
    const fileset = await FilesetResolver.forAudioTasks('/mediapipe/audio-wasm');
    return AudioClassifier.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: '/models/yamnet.tflite' },
      categoryAllowlist: LAUGH,
      maxResults: LAUGH.length,
    });
  })();
  return classifierPromise;
}

/**
 * Calls onLaugh({ intensity }) when the room laughs (0..1, louder and surer = higher).
 * `onLevel(level)` gets every reading, for a little meter. Returns a stop function.
 */
export function startLaughDetector({ onLaugh, onLevel }) {
  let stopped = false, timer = null, above = 0, peak = 0, lastLaugh = 0;
  classifier()
    .then((c) => {
      if (stopped) return;
      timer = setInterval(() => {
        const audio = recent(1);
        if (!audio || audio.length < ctx.sampleRate * 0.9) return;
        let score = 0;
        for (const r of c.classify(audio, ctx.sampleRate)) {
          for (const cat of r.classifications[0]?.categories ?? []) score = Math.max(score, cat.score);
        }
        const loud = Math.min(1, rms(audio) * 8);
        const level = score * (0.5 + 0.5 * loud);
        onLevel?.(level);
        if (score > LAUGH_THRESHOLD) {
          above++;
          peak = Math.max(peak, level);
          if (above === LAUGH_WINDOWS && Date.now() - lastLaugh > LAUGH_COOLDOWN_MS) {
            lastLaugh = Date.now();
            onLaugh({ intensity: peak });
          }
        } else {
          above = 0;
          peak = 0;
        }
      }, 500);
    })
    .catch((e) => console.error('Laugh detector failed to load:', e));
  return () => { stopped = true; clearInterval(timer); };
}
