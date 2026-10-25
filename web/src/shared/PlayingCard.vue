<script setup>
import { computed } from 'vue';
import { SUITS } from './suits.js';

const props = defineProps({
  suit: { type: String, default: 'hearts' },
  initial: { type: String, default: '' }, // empty: show the suit itself
  width: { type: Number, default: 62 },
  tilt: { type: Number, default: 0 },
  selected: Boolean,
  faded: Boolean,
});
const s = computed(() => SUITS[props.suit] ?? SUITS.hearts);
const h = computed(() => Math.round(props.width * 1.39));
</script>

<template>
  <div
    class="card"
    :class="{ selected, faded }"
    :style="{
      width: width + 'px', height: h + 'px', color: s.color,
      fontSize: Math.round(width * (initial ? 0.52 : 0.55)) + 'px',
      transform: `rotate(${tilt}deg)`,
    }"
  >
    {{ initial ? initial.toUpperCase() : s.sym }}
    <template v-if="initial && width >= 40">
      <span class="pip tl" :style="{ fontSize: Math.round(width * 0.19) + 'px' }">{{ s.sym }}</span>
      <span class="pip br" :style="{ fontSize: Math.round(width * 0.19) + 'px' }">{{ s.sym }}</span>
    </template>
  </div>
</template>

<style scoped>
.card {
  position: relative; flex: none; display: grid; place-items: center; border-radius: 7px; background: var(--card);
  box-shadow: inset 0 0 0 3px var(--card), inset 0 0 0 4px var(--gilt-3), 0 5px 12px rgba(60, 40, 10, .18);
  font-family: var(--font-body); line-height: 1; transition: transform .2s, opacity .2s;
}
.card.selected { box-shadow: inset 0 0 0 3px var(--card), inset 0 0 0 4px var(--gilt-3), 0 0 0 4px var(--gilt-1), 0 0 0 6px var(--gilt-dark); }
.card.faded { opacity: .45; }
.pip { position: absolute; line-height: 1; }
.tl { left: 11%; top: 5%; }
.br { right: 11%; bottom: 5%; transform: rotate(180deg); }
</style>
