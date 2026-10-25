<script setup>
// Design 7h: the artist picks one of three sealed letters. Only this phone sees them.
import { computed, ref, watch } from 'vue';
import GildedMirror from '../../shared/GildedMirror.vue';
import { useCountdown } from '../../shared/socket.js';
import { fmtTime } from '../../shared/suits.js';

const props = defineProps({ you: Object, state: Object });
const emit = defineEmits(['send']);
const chosen = ref(null);
const sent = ref(false);
const { ms, set } = useCountdown();
watch(() => props.state, () => set(props.state.round.remainingMs), { immediate: true });
const seals = [
  { sym: '♥', cls: 'rose' },
  { sym: '♠', cls: 'dark' },
  { sym: '♦', cls: 'rose' },
];
const choices = computed(() => props.you.choices ?? []);
function go() {
  if (chosen.value == null || sent.value) return;
  sent.value = true;
  emit('send', { type: 'pick', index: chosen.value });
}
</script>

<template>
  <div class="topline">
    <span>Round {{ state.round.number }} · shh, only you can see this</span>
    <span class="clock">{{ fmtTime(ms) }}</span>
  </div>
  <div>
    <div style="font-size:13px;color:var(--rose-dark)">{{ you.name }}, you're the artist!</div>
    <div class="script" style="font-size:50px;margin-top:8px">Pick a letter</div>
  </div>

  <div class="letters">
    <button v-for="(c, i) in choices" :key="c" class="letter" :class="{ on: chosen === i }" :aria-pressed="chosen === i" @click="chosen = i">
      <span class="flap"></span>
      <span class="seal" :class="seals[i].cls">{{ seals[i].sym }}</span>
      <span class="word">{{ c }}</span>
    </button>
  </div>

  <div class="mini-mirror">
    <GildedMirror mood="smug" style="width:46px;height:66px;flex:none" />
    <div class="speech" style="padding:12px 14px"><div class="line">“Pick any! I'll get it anyway. Probably. Mostly.”</div></div>
  </div>
  <button class="gilt-btn go" :disabled="chosen == null || sent" @click="go">Break the seal &amp; draw ✦</button>
</template>

<style scoped>
.clock { padding: 2px 10px; border-radius: 999px; background: var(--rose); color: var(--cream); font-feature-settings: 'tnum'; }
.letters { display: grid; gap: 16px; }
.letter {
  position: relative; height: 106px; border: 0; border-radius: 6px; background: var(--paper); overflow: hidden; cursor: pointer;
  box-shadow: inset 0 0 0 2px var(--gilt-2), 0 5px 12px rgba(60, 40, 10, .14); transition: transform .15s, box-shadow .15s;
}
.letter.on { background: #fff; transform: scale(1.03) rotate(-1deg); box-shadow: inset 0 0 0 2px var(--gilt-dark), 0 0 0 4px var(--gilt-1), 0 0 0 6px var(--gilt-3), 0 10px 22px rgba(60, 40, 10, .2); }
.flap { position: absolute; left: 0; right: 0; top: 0; height: 40px; background: linear-gradient(180deg, var(--gilt-1), var(--gilt-2)); clip-path: polygon(0 0, 100% 0, 50% 100%); }
.seal { position: absolute; left: 50%; top: 16px; margin-left: -19px; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; font-size: 17px; }
.seal.rose { background: radial-gradient(circle at 35% 35%, #D2566A, var(--rose-dark)); box-shadow: 0 2px 0 #5e1522; color: var(--cream); }
.seal.dark { background: radial-gradient(circle at 35% 35%, #5a4a44, var(--ink)); box-shadow: 0 2px 0 #000; color: var(--gilt-5); }
.word { position: absolute; left: 0; right: 0; bottom: 10px; text-align: center; font-size: 23px; line-height: 1; padding: 0 10px; }
.go { margin-top: auto; min-height: 58px; }
</style>
