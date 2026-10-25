<script setup>
// Design 7d: the scales tip, with the Mirror on top. A heart per Kingdom point,
// a star per Mirror point; the heavier pan sinks.
import { computed } from 'vue';
import GildedMirror from '../../shared/GildedMirror.vue';
import { scoreQuip } from '../../shared/quips.js';
import { numberWord } from '../../shared/suits.js';

const props = defineProps({ state: Object });
const emit = defineEmits(['send']);
const k = computed(() => props.state.scores.kingdom);
const m = computed(() => props.state.scores.mirror);
const rounds = computed(() => props.state.history.length);
// Beam angle (CSS degrees, clockwise): negative = left (Kingdom) side down.
const angle = computed(() => Math.max(-8, Math.min(8, (m.value - k.value) * 2.5)));
const dy = computed(() => 380 * Math.sin((angle.value * Math.PI) / 180)); // beam half-length 380
const leftY = computed(() => 280 - dy.value); // beam centre y ≈ 280
const rightY = computed(() => 280 + dy.value);
const hearts = computed(() => Math.min(k.value, 14));
const stars = computed(() => Math.min(m.value, 14));
const mood = computed(() => (m.value > k.value ? 'excited' : m.value < k.value ? 'sulky' : 'smug'));
</script>

<template>
  <div class="top">
    <div style="font-size:14px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)">
      After {{ numberWord(rounds).toLowerCase() }} round{{ rounds === 1 ? '' : 's' }}
    </div>
    <div class="script" style="font-size:72px;line-height:1.1;text-shadow:0 3px 0 var(--gilt-1)">Who tipped the scales?</div>
  </div>

  <div class="post"></div>
  <div class="base"></div>
  <div class="beam" :style="{ transform: `rotate(${angle}deg)` }"></div>

  <span class="string" :style="{ left: '343px', top: leftY + 'px' }"></span>
  <span class="string" :style="{ left: '1095px', top: rightY + 'px' }"></span>

  <div class="load hearts" :style="{ left: '224px', top: leftY + 148 - 84 + 'px' }"><span v-for="i in hearts" :key="i">♥</span></div>
  <div class="pan" :style="{ left: '214px', top: leftY + 148 + 'px' }"></div>
  <div class="load stars" :style="{ left: '976px', top: rightY + 148 - 84 + 'px' }"><span v-for="i in stars" :key="i" class="star"></span></div>
  <div class="pan" :style="{ left: '966px', top: rightY + 148 + 'px' }"></div>

  <div class="tally" :style="{ left: '224px', top: leftY + 148 + 75 + 'px' }">
    <div class="num" style="color:var(--rose)">{{ k }}</div><div class="who">the Kingdom</div>
  </div>
  <div class="tally" :style="{ left: '976px', top: rightY + 148 + 75 + 'px' }">
    <div class="num" style="color:var(--gilt-dark)">{{ m }}</div><div class="who">the Mirror</div>
  </div>

  <GildedMirror :mood="mood" class="on-top" />
  <div class="speech verdict">“{{ scoreQuip(k, m) }}”</div>

  <div class="actions">
    <button class="paper-btn" @click="emit('send', { type: 'lobby' })">Rematch</button>
    <button class="gilt-btn" @click="emit('send', { type: 'highlights' })">Happily Ever Laughter ✦</button>
  </div>
</template>

<style scoped>
.top { position: absolute; top: 52px; left: 0; right: 0; text-align: center; }
.post { position: absolute; left: 711px; top: 250px; width: 18px; height: 380px; background: linear-gradient(90deg, #B07D2E, #F7E2A2 45%, #C8963E); box-shadow: inset 0 0 0 1px var(--gilt-dark); }
.base { position: absolute; left: 650px; top: 618px; width: 140px; height: 34px; border-radius: 70px 70px 6px 6px; background: linear-gradient(180deg, #F7E2A2, #C8963E); box-shadow: inset 0 0 0 2px var(--gilt-dark), 0 6px 10px rgba(60, 40, 10, .25); }
.beam { position: absolute; left: 340px; top: 273px; width: 760px; height: 14px; border-radius: 7px; background: linear-gradient(180deg, #F7E2A2, #C8963E); box-shadow: inset 0 0 0 1px var(--gilt-dark); transition: transform 1.2s cubic-bezier(.3, 1.6, .5, 1); }
.string { position: absolute; width: 2px; height: 150px; background: var(--gilt-dark); transition: top 1.2s cubic-bezier(.3, 1.6, .5, 1); }
.pan { position: absolute; width: 260px; height: 56px; border-radius: 0 0 130px 130px / 0 0 56px 56px; background: linear-gradient(180deg, #F7E2A2, #C8963E 60%, #B07D2E); box-shadow: inset 0 0 0 2px var(--gilt-dark), 0 10px 18px rgba(60, 40, 10, .2); transition: top 1.2s cubic-bezier(.3, 1.6, .5, 1); }
.load { position: absolute; width: 240px; height: 84px; display: flex; flex-wrap: wrap-reverse; justify-content: center; align-content: flex-start; gap: 0 6px; transition: top 1.2s cubic-bezier(.3, 1.6, .5, 1); }
.hearts { font-size: 40px; line-height: 42px; color: var(--rose); }
.stars { gap: 4px 12px; align-content: flex-end; }
.star { width: 34px; height: 34px; background: var(--gilt-3); clip-path: polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%); }
.tally { position: absolute; width: 240px; display: flex; flex-direction: column; align-items: center; transition: top 1.2s cubic-bezier(.3, 1.6, .5, 1); }
.num { font-size: 74px; line-height: 1; font-feature-settings: 'tnum'; }
.who { font-size: 22px; font-style: italic; padding: 0 14px; border-radius: 999px; background: var(--paper); box-shadow: inset 0 0 0 1.5px var(--gilt-2); } /* readable over the floor tiles */
.on-top { position: absolute; left: 672px; top: 176px; width: 96px; height: 136px; animation: sway 3s ease-in-out infinite; transform-origin: 50% 100%; }
.verdict { position: absolute; left: 50%; top: 690px; width: 520px; margin-left: -260px; text-align: center; font-size: 20px; font-style: italic; line-height: 1.3; }
.actions { position: absolute; left: 0; right: 0; bottom: 46px; display: flex; justify-content: center; gap: 16px; }
@keyframes sway { 25% { rotate: -2deg; } 75% { rotate: 2deg; } }
</style>
