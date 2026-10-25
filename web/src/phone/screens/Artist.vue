<script setup>
// The artist's phone while they draw in the air: the secret prompt, "They got it!",
// remote Undo/Clear, and "Does this count?" for borderline Mirror guesses.
import { computed, watch } from 'vue';
import GildedMirror from '../../shared/GildedMirror.vue';
import { useCountdown } from '../../shared/socket.js';
import { fmtTime } from '../../shared/suits.js';

const props = defineProps({ you: Object, state: Object });
const emit = defineEmits(['send']);
const round = computed(() => props.state.round);
const { ms, set } = useCountdown();
watch(() => props.state, () => set(round.value.remainingMs), { immediate: true });
const lastGuess = computed(() => round.value.mirrorGuesses.at(-1));
const tool = (action) => emit('send', { type: 'tool', action });
</script>

<template>
  <div class="topline">
    <span>Round {{ round.number }} · you're drawing</span>
    <span class="clock" :class="{ low: ms < 15000 }">{{ fmtTime(ms) }}</span>
  </div>

  <div class="secret">
    <div class="kicker" style="color:var(--rose-dark)">Draw this, don't say it</div>
    <div class="prompt">{{ you.prompt }}</div>
  </div>

  <div v-if="you.confirm" class="confirm">
    <div class="kicker">{{ you.confirm.by === 'room' ? 'Someone in the room said' : 'The Mirror guessed' }}</div>
    <div style="font-size:26px;font-style:italic">“{{ you.confirm.guess }}”</div>
    <div style="font-size:15px">Does this count?</div>
    <div class="pair">
      <button class="paper-btn" @click="emit('send', { type: 'confirm', yes: false })">Nope</button>
      <button class="gilt-btn" @click="emit('send', { type: 'confirm', yes: true })">Yes, it counts</button>
    </div>
  </div>

  <button class="got-it" @click="emit('send', { type: 'gotIt' })">✦ They got it!</button>
  <div class="hint">Tap the moment someone in the room shouts the answer.</div>

  <div class="tools">
    <button class="paper-btn" @click="tool('undo')">↶ Undo</button>
    <button class="paper-btn" @click="tool('redo')">↷ Redo</button>
    <button class="paper-btn" @click="tool('clear')">✕ Clear</button>
  </div>

  <div class="mini-mirror" style="margin-top:auto">
    <GildedMirror :mood="lastGuess ? 'smug' : 'calm'" style="width:46px;height:66px;flex:none" />
    <div class="speech" style="padding:12px 14px">
      <div class="kicker">The Mirror sees</div>
      <div class="line">{{ lastGuess ? `“${lastGuess}…”` : 'Nothing yet. Draw!' }}</div>
    </div>
  </div>
</template>

<style scoped>
.clock { padding: 2px 10px; border-radius: 999px; background: var(--rose); color: var(--cream); font-feature-settings: 'tnum'; }
.clock.low { background: var(--rose-dark); }
.secret { padding: 18px; border-radius: 10px; background: var(--paper); text-align: center; border: 2px solid var(--gilt-3); box-shadow: 0 0 0 5px var(--paper), 0 0 0 7px var(--gilt-2); }
.prompt { font-size: 40px; line-height: 1.1; margin-top: 6px; }
.confirm { display: flex; flex-direction: column; gap: 8px; align-items: center; text-align: center; padding: 16px; border-radius: 14px; background: #fff; box-shadow: inset 0 0 0 2px var(--lilac), 0 0 0 4px #E4DCF2; }
.pair { display: flex; gap: 10px; width: 100%; }
.pair button { min-height: 48px; font-size: 16px; padding: 0 12px; }
.got-it {
  min-height: 84px; border: 0; border-radius: 999px; cursor: pointer; font-size: 26px; color: var(--cream);
  background: var(--rose); box-shadow: inset 0 0 0 2px var(--rose-soft), 0 6px 0 #7E1F30;
}
.got-it:active { transform: translateY(4px); box-shadow: inset 0 0 0 2px var(--rose-soft), 0 2px 0 #7E1F30; }
.hint { text-align: center; font-size: 13px; color: var(--muted); margin-top: -6px; }
.tools { display: flex; gap: 8px; }
.tools button { min-height: 48px; font-size: 16px; padding: 0 8px; }
</style>
