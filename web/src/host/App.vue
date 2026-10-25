<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useSocket } from '../shared/socket.js';
import { startCamera, stopCamera } from './camera.js';
import { startMic, stopMic } from './audio.js';
import { clearClips } from './recorder.js';
import Stage from './Stage.vue';
import Lobby from './screens/Lobby.vue';
import Pick from './screens/Pick.vue';
import Draw from './screens/Draw.vue';
import Result from './screens/Result.vue';
import Scoreboard from './screens/Scoreboard.vue';
import Highlights from './screens/Highlights.vue';

const room = ref(null); // { code, joinUrl, joinHost, qrSvg }
const state = ref(null);
const drawings = reactive({}); // round number -> PNG data URL (stays on this laptop)
const drawRef = ref(null);
const toolEvent = ref(null); // artist's phone: undo/clear remote
const roundStart = ref(0);
const toast = ref('');

const { connected, send } = useSocket({
  onOpen() {
    let code = null;
    try { code = sessionStorage.getItem('mirror-room'); } catch {}
    send({ type: 'host', code });
  },
  onMessage(msg) {
    if (msg.type === 'room') {
      room.value = msg;
      try { sessionStorage.setItem('mirror-room', msg.code); } catch {}
    } else if (msg.type === 'state') {
      state.value = msg.state;
    } else if (msg.type === 'roundStart') {
      roundStart.value++;
    } else if (msg.type === 'tool') {
      toolEvent.value = { action: msg.action, n: Date.now() };
    } else if (msg.type === 'mirrorError') {
      showToast('The Mirror is foggy: ' + msg.message);
    }
  },
});

let toastTimer;
function showToast(text) {
  toast.value = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = ''), 6000);
}

// Keep the finished drawing for the result screen and the gallery.
watch(
  () => state.value?.phase,
  (phase, old) => {
    if (old === 'draw' && phase !== 'draw') {
      const n = state.value?.history.at(-1)?.number;
      const img = drawRef.value?.capture();
      if (n && img) drawings[n] = img;
    }
    if (phase === 'lobby' && old && old !== 'lobby') {
      for (const k in drawings) delete drawings[k];
      clearClips(); // laugh clips are ephemeral: gone when you play again
    }
  },
  { flush: 'pre' }, // before the draw screen unmounts
);

const phase = computed(() => state.value?.phase ?? 'connecting');
const lastResult = computed(() => state.value?.round?.result);
const tone = computed(() => {
  if (phase.value === 'result') return lastResult.value?.winner === 'kingdom' ? 'rose' : lastResult.value?.winner === 'mirror' ? 'night' : 'ivory';
  return 'ivory';
});

// Camera and mic turn on when the game starts (the first "choosing" screen gives them a
// few seconds to warm up before anyone draws) and off again back in the lobby.
watch(phase, (p) => {
  if (p === 'connecting') return;
  if (p === 'lobby') { stopCamera(); stopMic(); }
  else { startCamera(); startMic(); }
});
</script>

<template>
  <Draw
    v-if="phase === 'draw'"
    ref="drawRef"
    :state="state"
    :tool-event="toolEvent"
    :round-start="roundStart"
    @send="send"
  />
  <Stage v-else :tone="tone" :low="phase === 'highlights'">
    <div v-if="phase === 'connecting'" class="connecting script">Polishing the Mirror…</div>
    <Lobby v-else-if="phase === 'lobby'" :state="state" :room="room" @send="send" />
    <Pick v-else-if="phase === 'pick'" :state="state" @send="send" />
    <Result v-else-if="phase === 'result'" :state="state" :drawings="drawings" @send="send" />
    <Scoreboard v-else-if="phase === 'final'" :state="state" @send="send" />
    <Highlights v-else-if="phase === 'highlights'" :state="state" :drawings="drawings" @send="send" />
  </Stage>

  <div v-if="!connected && state" class="banner-offline">Reconnecting to the game server…</div>
  <div v-if="state?.demo && phase !== 'draw'" class="demo-pill">Demo Mirror · no API key, canned guesses</div>
  <Transition name="fade"><div v-if="toast" class="toast">{{ toast }}</div></Transition>
</template>

<style scoped>
.connecting { position: absolute; inset: 0; display: grid; place-items: center; font-size: 72px; }
.banner-offline, .toast, .demo-pill {
  position: fixed; left: 50%; transform: translateX(-50%); z-index: 50; padding: 10px 22px; border-radius: 999px;
  background: var(--paper); box-shadow: inset 0 0 0 2px var(--gilt-3), 0 6px 14px rgba(0, 0, 0, .18); font-size: 16px;
}
.banner-offline { top: 16px; color: var(--rose-dark); }
.toast { bottom: 24px; max-width: 80vw; }
.demo-pill { top: 16px; right: 16px; left: auto; transform: none; font-size: 13px; color: var(--muted); }
.fade-enter-active, .fade-leave-active { transition: opacity .3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
