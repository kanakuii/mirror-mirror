<script setup>
import { computed, ref } from 'vue';
import { useSocket } from '../shared/socket.js';
import WonderlandRoom from '../shared/WonderlandRoom.vue';
import Join from './screens/Join.vue';
import Prompts from './screens/Prompts.vue';
import Lobby from './screens/Lobby.vue';
import Letters from './screens/Letters.vue';
import Artist from './screens/Artist.vue';
import Watch from './screens/Watch.vue';

const KEY = 'mirror-seat'; // { code, playerId } so a sleeping phone can rejoin
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };
const forget = () => { try { localStorage.removeItem(KEY); } catch {} };

const params = new URLSearchParams(location.search);
const qrCode = (params.get('room') || '').toUpperCase();
let seat = load();
// A different room in the QR link means a new game: drop the old seat.
if (qrCode && seat.code && seat.code !== qrCode) { forget(); seat = {}; }

const state = ref(null);
const you = ref(null);
const joinError = ref('');
const joining = ref(false);
const editingPrompts = ref(false);
const notice = ref('');

const { connected, send } = useSocket({
  onOpen() {
    if (seat.playerId) send({ type: 'join', code: seat.code, playerId: seat.playerId });
  },
  onMessage(msg) {
    if (msg.type === 'joined') {
      seat = { code: msg.code, playerId: msg.playerId };
      save(seat);
      joining.value = false;
      joinError.value = '';
    } else if (msg.type === 'state') {
      state.value = msg.state;
      you.value = msg.you;
    } else if (msg.type === 'error') {
      joining.value = false;
      if (seat.playerId) { forget(); seat = {}; state.value = null; you.value = null; } // stale seat
      joinError.value = msg.message;
    } else if (msg.type === 'closed' || msg.type === 'kicked') {
      forget(); seat = {};
      state.value = null; you.value = null;
      notice.value = msg.type === 'closed' ? 'The game has ended. Thanks for playing!' : 'You were removed from the room.';
    }
  },
});

function join(form) {
  joining.value = true;
  joinError.value = '';
  notice.value = '';
  send({ type: 'join', ...form });
}

const screen = computed(() => {
  const s = state.value, y = you.value;
  if (!s || !y) return 'join';
  if (s.phase === 'lobby') return editingPrompts.value ? 'prompts' : 'lobby'; // prompts are optional
  if (s.phase === 'pick') return y.isArtist ? 'letters' : 'watch';
  if (s.phase === 'draw') return y.isArtist ? 'artist' : 'watch';
  return 'watch';
});
</script>

<template>
  <div class="phone">
    <WonderlandRoom tone="ivory" low />
    <main>
      <Join v-if="screen === 'join'" :initial-code="qrCode || seat.code || ''" :error="joinError" :notice="notice" :busy="joining" @join="join" />
      <Prompts v-else-if="screen === 'prompts'" :you="you" @send="send" @done="editingPrompts = false" />
      <Lobby v-else-if="screen === 'lobby'" :you="you" :state="state" @edit="editingPrompts = true" />
      <Letters v-else-if="screen === 'letters'" :you="you" :state="state" @send="send" />
      <Artist v-else-if="screen === 'artist'" :you="you" :state="state" @send="send" />
      <Watch v-else :you="you" :state="state" @send="send" />
    </main>
    <div v-if="!connected" class="offline">Reconnecting…</div>
  </div>
</template>

<style>
.phone { position: fixed; inset: 0; overflow: hidden; }
.phone main { position: absolute; inset: 0; overflow-y: auto; display: flex; flex-direction: column; padding: max(40px, env(safe-area-inset-top)) 22px max(24px, env(safe-area-inset-bottom)); gap: 16px; max-width: 460px; margin: 0 auto; }
.phone .gilt-btn, .phone .paper-btn { width: 100%; }
.phone .speech .line { font-size: 16px; }
.offline { position: fixed; top: 10px; left: 50%; transform: translateX(-50%); padding: 6px 16px; border-radius: 999px; background: var(--paper); box-shadow: inset 0 0 0 2px var(--rose-soft); color: var(--rose-dark); font-size: 14px; z-index: 10; }
.mini-mirror { display: flex; gap: 10px; align-items: flex-end; }
.topline { display: flex; justify-content: space-between; align-items: center; font-size: 13px; }
.who-chip { display: flex; gap: 8px; align-items: center; }
</style>
