<script setup>
// The drawing round: the whole screen is the camera and the canvas (design 1f, full-bleed).
// Undo and Clear are big corner targets; every other tool lives in the wand menu that
// opens around the hand when it holds still. The Mirror's portrait ring is its timer.
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import GildedMirror from '../../shared/GildedMirror.vue';
import { useCountdown } from '../../shared/socket.js';
import { fmtTime } from '../../shared/suits.js';
import { guessLine } from '../../shared/quips.js';
import { AirCanvas, COLORS, SIZES } from '../airCanvas.js';
import { cameraStream, landmarker } from '../camera.js';
import { micStream, micError, startListener, startLaughDetector } from '../audio.js';
import { HighlightRecorder } from '../recorder.js';

const GUESS_EVERY_MS = 5000;

const props = defineProps({ state: Object, toolEvent: Object, roundStart: Number });
const emit = defineEmits(['send']);
const ink = ref(null), cursor = ref(null), video = ref(null);
const ui = reactive({});
const showCamera = ref(true);
let engine = null;

const round = computed(() => props.state.round);
const guesses = computed(() => round.value.mirrorGuesses);
const thinking = computed(() => round.value.mirrorThinking);
const { ms: remaining, set: setRemaining } = useCountdown();
watch(() => props.state, () => setRemaining(round.value.remainingMs), { immediate: true });

const speech = computed(() => {
  const g = guesses.value;
  if (thinking.value && !g.length) return 'Hmm… let me look closer…';
  if (!g.length) return "Go on then. Draw something. I'm watching.";
  return guessLine(g.at(-1), g.length - 1);
});
const mood = computed(() => (thinking.value ? 'calm' : guesses.value.length ? 'smug' : 'calm'));
const heard = computed(() => round.value.heard ?? []);
const confirm = computed(() => round.value.confirm);

// ---------- the listener + laugh highlights (only during this screen) ----------
const laughing = ref(false);
const laughLevel = ref(0);
let stopListening = null, stopLaughs = null, recorder = null, laughTimer = null;

function startEars() {
  stopListening = startListener((m) => emit('send', m), { demo: props.state.demo });
  if (!props.state.highlights) return;
  stopLaughs = startLaughDetector({
    onLevel: (l) => (laughLevel.value = l),
    onLaugh: ({ intensity }) => {
      recorder?.laugh(intensity);
      laughing.value = true;
      clearTimeout(laughTimer);
      laughTimer = setTimeout(() => (laughing.value = false), 2500);
    },
  });
}
function startRecorder() {
  if (recorder || !props.state.highlights || !micStream.value || !video.value) return;
  recorder = new HighlightRecorder({
    video: video.value,
    ink: ink.value,
    audioStream: micStream.value,
    meta: () => ({ round: round.value.number, artistName: round.value.artistName }),
  });
}
watch(micStream, (m) => m && startRecorder()); // the mic may still be warming up

// ---------- the Mirror's 5-second guess cadence ----------
const ring = ref(0); // 0..1, fills between guesses
let lastShot = performance.now(), raf = 0;
function tick() {
  raf = requestAnimationFrame(tick);
  if (thinking.value) { ring.value = 1; return; }
  ring.value = Math.min(1, (performance.now() - lastShot) / GUESS_EVERY_MS);
  if (ring.value >= 1) askMirror();
}
function askMirror() {
  lastShot = performance.now();
  if (thinking.value || !engine?.hasInk()) return;
  const image = engine.snapshot(512);
  if (image) emit('send', { type: 'snapshot', image });
}
// A fresh guess restarts the ring, so slow replies never stack up.
watch(thinking, (now, before) => { if (before && !now) lastShot = performance.now(); });

// ---------- tools ----------
const menuItems = computed(() => [
  ...COLORS.map((c, i) => ({ key: 'c' + i, label: `colour ${i + 1}`, color: c, on: !ui.eraser && ui.color === c, act: () => engine.pickColor(i) })),
  { key: 'size', label: 'size', text: SIZES[ui.size ?? 1][1], act: () => engine.cycleSize() },
  { key: 'eraser', label: 'eraser', icon: 'eraser', on: ui.eraser, act: () => engine.toggleEraser() },
  { key: 'redo', label: 'redo', icon: 'redo', disabled: !ui.canRedo, act: () => engine.redo() },
]);
const ringPos = (i, n) => {
  const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
  return { left: `${Math.cos(a) * 150}px`, top: `${Math.sin(a) * 150}px` };
};
const choose = (item) => { item.act(); engine.closeMenu(); };

function onKey(e) {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 'z' && (e.shiftKey)) return engine.redo();
  if (k === 'z') return engine.undo();
  if (k === 'y') return engine.redo();
  if (e.ctrlKey || e.metaKey) return;
  if (k === 'c') engine.clear();
  else if (k === 'e') engine.toggleEraser();
  else if (k === 's') engine.cycleSize();
  else if (k === 'g') askMirror();
  else if (k === 'k') emit('send', { type: 'gotIt' });
  else if (k === 'h') showCamera.value = !showCamera.value;
  else if (k >= '1' && k <= String(COLORS.length)) engine.pickColor(Number(k) - 1);
}

watch(() => props.toolEvent, (t) => {
  if (!t || !engine) return;
  if (t.action === 'undo') engine.undo();
  if (t.action === 'redo') engine.redo();
  if (t.action === 'clear') engine.clear();
});
watch(() => props.roundStart, () => engine?.reset());

function attachCamera(stream) {
  if (!stream || !video.value) return;
  video.value.srcObject = stream;
  video.value.play().catch(() => {});
}
watch(cameraStream, attachCamera);

onMounted(() => {
  engine = new AirCanvas({ ink: ink.value, cursor: cursor.value, video: video.value, ui });
  attachCamera(cameraStream.value);
  landmarker.then((lm) => engine && engine.startTracking(lm)).catch(() => {});
  addEventListener('keydown', onKey);
  lastShot = performance.now();
  tick();
  startEars();
  startRecorder();
});
onBeforeUnmount(() => {
  stopListening?.();
  stopLaughs?.();
  recorder?.stop();
  clearTimeout(laughTimer);
  cancelAnimationFrame(raf);
  removeEventListener('keydown', onKey);
  engine?.destroy();
  engine = null;
});

defineExpose({ capture: () => engine?.snapshot(640) ?? null });
</script>

<template>
  <div class="round">
    <video ref="video" class="cam" :class="{ hidden: !showCamera }" playsinline muted></video>
    <div class="tint"></div>
    <canvas ref="ink" class="layer ink"></canvas>

    <!-- corners -->
    <button class="corner air-zone" style="left:28px" data-air="Undo" :disabled="!ui.canUndo" @click="engine.undo()">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" /></svg>
      Undo
    </button>
    <button class="corner air-zone" style="right:28px" data-air="Clear" @click="engine.clear()">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      Clear
    </button>

    <!-- score pill -->
    <div class="pill air-zone">
      <span>Kingdom <b>{{ state.scores.kingdom }}</b></span>
      <span class="mid">Round {{ round.number }}/{{ state.totalRounds }} · {{ round.artistName }} · <b class="clock" :class="{ low: remaining < 15000 }">{{ fmtTime(remaining) }}</b></span>
      <span>Mirror <b>{{ state.scores.mirror }}</b></span>
    </div>

    <!-- borderline guess (the Mirror's or the room's): the artist decides -->
    <Transition name="drop">
      <div v-if="confirm" class="confirm">
        {{ confirm.by === 'room' ? 'Someone said' : 'The Mirror said' }} “{{ confirm.guess }}”. Does it count?
        <span class="muted">{{ round.artistName }} decides on their phone.</span>
      </div>
    </Transition>

    <Transition name="drop">
      <div v-if="laughing" class="laugh-flash">✦ The room is laughing ✦</div>
    </Transition>

    <!-- the Mirror -->
    <div class="mirror-corner air-zone">
      <div class="speech-card">
        <div class="kicker" style="color:var(--gilt-5)">The Mirror sees</div>
        <div class="said">“{{ speech }}”</div>
        <div v-if="guesses.length > 1" class="tries">
          <span v-for="g in guesses.slice(0, -1).slice(-4)" :key="g">{{ g }}</span>
        </div>
      </div>
      <div class="portrait" :class="{ thinking }">
        <div class="timer-ring" :style="{ '--p': ring }"></div>
        <GildedMirror :mood="mood" style="width:120px;height:174px" />
      </div>
    </div>

    <!-- status + the room's button -->
    <div class="status air-zone">
      <span class="chip">
        <span class="swatch" :style="{ background: ui.eraser ? 'transparent' : ui.color, borderStyle: ui.eraser ? 'dashed' : 'solid' }"></span>
        {{ ui.eraser ? 'Eraser' : SIZES[ui.size ?? 1][1] }}
      </span>
      <span>{{ ui.status }}</span>
      <span v-if="micError" class="ears warn">🎙 {{ micError }}</span>
      <span v-else class="ears">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
        Listening<template v-if="heard.length">: <i v-for="h in heard.slice(-3)" :key="h">“{{ h.length > 28 ? h.slice(0, 28) + '…' : h }}” </i></template><template v-else>{{ state.demo ? ' (browser speech, demo)' : '…' }}</template>
      </span>
      <span v-if="state.highlights" class="ears">
        <span class="hl-dot" :style="{ transform: `scale(${1 + laughLevel * 1.5})` }"></span>Highlights on
      </span>
      <button class="got-it" data-air="They got it!" @click="emit('send', { type: 'gotIt' })">✦ They got it!</button>
    </div>

    <!-- wand menu -->
    <div v-if="ui.menu?.open" class="wand" :style="{ left: ui.menu.x + 'px', top: ui.menu.y + 'px' }">
      <div class="wand-ring"></div>
      <button
        v-for="(item, i) in menuItems" :key="item.key"
        class="wand-item" :class="{ on: item.on }" :data-air="item.label" :disabled="item.disabled"
        :style="{ ...ringPos(i, menuItems.length), background: item.color ?? undefined }"
        @click="choose(item)"
      >
        <template v-if="item.text">{{ item.text }}</template>
        <svg v-else-if="item.icon === 'eraser'" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></svg>
        <svg v-else-if="item.icon === 'redo'" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" /></svg>
      </button>
    </div>

    <canvas ref="cursor" class="layer cursor"></canvas>
  </div>
</template>

<style scoped>
.round { position: fixed; inset: 0; overflow: hidden; background: var(--canvas); color: #f3f2f2; font-family: var(--font-body); user-select: none; }
.cam { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); opacity: .55; }
.cam.hidden { visibility: hidden; }
.tint { position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(18, 14, 40, .25), rgba(18, 14, 40, .7)); pointer-events: none; }
.layer { position: absolute; inset: 0; width: 100%; height: 100%; }
.ink { touch-action: none; cursor: crosshair; }
.cursor { z-index: 20; pointer-events: none; }

.corner {
  position: absolute; top: 28px; z-index: 5; width: 124px; height: 124px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  border: 0; border-radius: 10px; background: rgba(28, 22, 48, .78); color: var(--ivory); font-size: 19px; cursor: pointer;
  box-shadow: inset 0 0 0 2px rgba(230, 192, 106, .7), 0 0 0 4px rgba(28, 22, 48, .5); transition: transform .1s, background .15s;
}
.corner:disabled { opacity: .45; cursor: default; }

.pill {
  position: absolute; top: 34px; left: 50%; transform: translateX(-50%); z-index: 5; display: flex; align-items: center; gap: 24px;
  padding: 10px 30px; border-radius: 999px; background: rgba(28, 22, 48, .8); box-shadow: inset 0 0 0 2px rgba(230, 192, 106, .6);
  font-size: 22px; font-feature-settings: 'tnum'; white-space: nowrap;
}
.pill b { font-weight: normal; color: var(--gilt-2); }
.pill .mid { font-size: 15px; color: rgba(243, 242, 242, .7); }
.clock.low { color: #ff8a8a; }

.confirm {
  position: absolute; top: 100px; left: 50%; transform: translateX(-50%); z-index: 6; padding: 12px 26px; border-radius: 12px;
  background: var(--paper); color: var(--ink); font-size: 20px; box-shadow: inset 0 0 0 2px var(--gilt-3), 0 10px 24px rgba(0, 0, 0, .35);
}

.mirror-corner { position: absolute; right: 40px; bottom: 36px; z-index: 5; display: flex; align-items: flex-end; gap: 22px; }
.speech-card {
  max-width: 340px; padding: 16px 20px; border-radius: 8px; background: rgba(28, 22, 48, .86);
  box-shadow: inset 0 0 0 2px rgba(230, 192, 106, .55);
}
.said { font-size: 26px; font-style: italic; line-height: 1.2; }
.tries { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.tries span { padding: 2px 10px; border-radius: 999px; font-size: 13px; text-decoration: line-through; color: rgba(243, 242, 242, .6); box-shadow: inset 0 0 0 1px rgba(230, 192, 106, .45); }
.portrait { position: relative; width: 150px; height: 200px; display: grid; place-items: center; flex: none; }
.timer-ring {
  position: absolute; inset: 0; border-radius: 50%;
  background: conic-gradient(var(--gilt-2) calc(var(--p) * 360deg), rgba(230, 192, 106, .15) 0);
  -webkit-mask: radial-gradient(closest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
  mask: radial-gradient(closest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
}
.thinking .timer-ring { animation: pulse .9s ease-in-out infinite; }
.thinking :deep(.gm) { transform: translateY(-6px) scale(1.04); transition: transform .3s; }

.status { position: absolute; left: 40px; bottom: 40px; z-index: 5; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; font-size: 15px; color: rgba(243, 242, 242, .75); }
.chip { display: inline-flex; align-items: center; gap: 8px; padding: 5px 14px 5px 6px; border-radius: 999px; background: rgba(28, 22, 48, .8); box-shadow: inset 0 0 0 1px rgba(230, 192, 106, .5); }
.swatch { width: 20px; height: 20px; border-radius: 50%; border: 2px solid #fff; }
.ears { display: inline-flex; align-items: center; gap: 7px; max-width: 520px; }
.ears i { font-style: italic; color: var(--ivory); }
.ears.warn { color: #ff8a8a; }
.hl-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--gilt-2); transition: transform .3s; }
.laugh-flash {
  position: absolute; top: 160px; left: 50%; transform: translateX(-50%); z-index: 6; padding: 10px 26px; border-radius: 999px;
  background: var(--rose); color: var(--cream); font-size: 22px; box-shadow: 0 0 30px rgba(255, 122, 156, .6);
}
.got-it {
  margin-top: 4px; padding: 14px 26px; border: 0; border-radius: 999px; cursor: pointer; font-size: 20px; color: var(--cream);
  background: var(--rose); box-shadow: inset 0 0 0 2px var(--rose-soft), 0 4px 0 #7E1F30;
}

.wand { position: absolute; z-index: 15; width: 0; height: 0; }
.wand-ring { position: absolute; left: -150px; top: -150px; width: 300px; height: 300px; border-radius: 50%; border: 1px dashed rgba(230, 192, 106, .6); animation: open .18s ease-out; }
.wand-item {
  position: absolute; width: 68px; height: 68px; margin: -34px 0 0 -34px; border-radius: 50%; border: 0; cursor: pointer;
  background: rgba(28, 22, 48, .92); color: #f3f2f2; box-shadow: inset 0 0 0 1.5px var(--gilt-2), 0 4px 12px rgba(0, 0, 0, .35);
  display: grid; place-items: center; font-size: 14px; animation: open .18s ease-out;
}
.wand-item.on { box-shadow: 0 0 0 3px var(--canvas), 0 0 0 6px #fff; }
.wand-item:disabled { opacity: .35; }

/* air-button feedback (hover with the hand cursor, flash when pinched) */
:deep(.air-hover) { transform: scale(1.1); box-shadow: inset 0 0 0 3px #fff, 0 0 0 4px rgba(255, 255, 255, .3) !important; }
.air-flash { filter: brightness(1.6); }
:deep(.air-flash) { filter: brightness(1.6); }

.drop-enter-active, .drop-leave-active { transition: opacity .25s, translate .25s; }
.drop-enter-from, .drop-leave-to { opacity: 0; translate: 0 -12px; }
@keyframes pulse { 50% { opacity: .45; } }
@keyframes open { from { opacity: 0; scale: .6; } }
</style>
