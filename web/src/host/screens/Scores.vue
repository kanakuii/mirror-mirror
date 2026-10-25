<script setup>
// "Kingdom 4 +1 · Mirror 1" pills. The side that just scored gets the filled style.
defineProps({ scores: Object, plus: { type: String, default: '' } }); // plus: 'kingdom' | 'mirror'
</script>

<template>
  <div class="scores">
    <div class="score-pill" :class="plus === 'kingdom' ? 'k-on' : 'k-off'">
      Kingdom {{ scores.kingdom }} <span v-if="plus === 'kingdom'" class="plus">+1</span>
    </div>
    <div class="score-pill" :class="plus === 'mirror' ? 'm-on' : 'm-off'">
      Mirror {{ scores.mirror }} <span v-if="plus === 'mirror'" class="plus">+1</span>
    </div>
  </div>
</template>

<style scoped>
.scores { display: flex; gap: 16px; }
.plus { font-size: 17px; }
.k-on { background: var(--rose); color: var(--cream); box-shadow: inset 0 0 0 2px var(--rose-soft), 0 4px 0 #7E1F30; }
.k-off { background: var(--paper); color: var(--rose-dark); box-shadow: inset 0 0 0 2px var(--rose-soft); }
.m-on { background: linear-gradient(180deg, var(--gilt-1), var(--gilt-2) 50%, var(--gilt-3)); color: var(--ink); box-shadow: inset 0 0 0 2px var(--cream), 0 4px 0 var(--gilt-dark); }
.m-off { background: var(--paper); color: var(--gilt-dark); box-shadow: inset 0 0 0 2px var(--gilt-3); }
</style>
