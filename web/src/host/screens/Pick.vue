<script setup>
// Between rounds: the artist privately picks a letter on their phone (design 7h).
// The TV shows only that they're choosing, never the prompts.
import { computed, watch } from 'vue';
import GildedMirror from '../../shared/GildedMirror.vue';
import PlayingCard from '../../shared/PlayingCard.vue';
import Scores from './Scores.vue';
import { useCountdown } from '../../shared/socket.js';
import { fmtTime } from '../../shared/suits.js';
import { pickQuips } from '../../shared/quips.js';

const props = defineProps({ state: Object });
const emit = defineEmits(['send']);
const round = computed(() => props.state.round);
const artist = computed(() => props.state.players.find((p) => p.id === round.value.artistId));
const { ms, set } = useCountdown();
watch(() => props.state, () => set(round.value.remainingMs), { immediate: true });
const quip = computed(() => pickQuips[round.value.number % pickQuips.length]);
</script>

<template>
  <div class="top">
    <div class="banner" style="background:var(--rose);color:var(--cream);align-self:center">
      Round {{ round.number }} of {{ state.totalRounds }}
    </div>
    <div class="script" style="font-size:84px;text-shadow:0 3px 0 var(--gilt-1)">
      {{ round.artistName }} is choosing…
    </div>
    <div style="font-size:24px;font-style:italic">Three sealed letters. Only the artist can see them.</div>
  </div>

  <div class="artist">
    <PlayingCard v-if="artist" :suit="artist.suit" :initial="artist.name[0]" :width="150" :tilt="-4" selected />
    <div class="plaque" style="font-size:22px">the artist</div>
  </div>

  <div class="letters">
    <div v-for="(seal, i) in ['♥', '♠', '♦']" :key="i" class="letter" :style="{ transform: `rotate(${[-6, 2, 7][i]}deg)`, animationDelay: i * 0.25 + 's' }">
      <div class="flap"></div>
      <span class="seal" :class="{ dark: i === 1 }">{{ seal }}</span>
    </div>
  </div>

  <div class="mirror-quip">
    <GildedMirror mood="smug" style="width:110px;height:160px;flex:none" />
    <div class="speech">
      <div class="kicker">The Mirror</div>
      <div class="line">“{{ quip }}”</div>
    </div>
  </div>

  <div class="timer">{{ fmtTime(ms) }}</div>
  <Scores :scores="state.scores" class="scores" />
  <button class="paper-btn end" @click="emit('send', { type: 'finish' })">End game</button>
</template>

<style scoped>
.top { position: absolute; top: 70px; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
.artist { position: absolute; left: 200px; top: 340px; display: flex; flex-direction: column; align-items: center; gap: 24px; }
.letters { position: absolute; left: 560px; top: 360px; display: flex; gap: 34px; }
.letter {
  position: relative; width: 170px; height: 118px; border-radius: 6px; background: var(--paper); overflow: hidden;
  box-shadow: inset 0 0 0 2px var(--gilt-2), 0 8px 16px rgba(60, 40, 10, .16); animation: bob 2.4s ease-in-out infinite;
}
.flap { position: absolute; left: 0; right: 0; top: 0; height: 52px; background: linear-gradient(180deg, var(--gilt-1), var(--gilt-2)); clip-path: polygon(0 0, 100% 0, 50% 100%); }
.seal {
  position: absolute; left: 50%; top: 26px; margin-left: -23px; width: 46px; height: 46px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #D2566A, var(--rose-dark)); box-shadow: 0 2px 0 #5e1522;
  display: grid; place-items: center; font-size: 20px; color: var(--cream);
}
.seal.dark { background: radial-gradient(circle at 35% 35%, #5a4a44, var(--ink)); box-shadow: 0 2px 0 #000; color: var(--gilt-5); }
.mirror-quip { position: absolute; left: 560px; top: 560px; width: 680px; display: flex; gap: 22px; align-items: flex-end; }
.timer {
  position: absolute; right: 100px; top: 80px; padding: 8px 22px; border-radius: 999px; background: var(--rose); color: var(--cream);
  font-size: 30px; font-feature-settings: 'tnum';
}
.scores { position: absolute; left: 100px; bottom: 56px; }
.end { position: absolute; right: 100px; bottom: 56px; min-height: 46px; font-size: 17px; }
@keyframes bob { 50% { translate: 0 -8px; } }
</style>
