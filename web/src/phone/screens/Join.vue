<script setup>
// Design 7f: join and pick your suit.
import { computed, ref } from 'vue';
import GildedMirror from '../../shared/GildedMirror.vue';
import { SUITS, SUIT_ORDER } from '../../shared/suits.js';

const props = defineProps({ initialCode: String, error: String, notice: String, busy: Boolean });
const emit = defineEmits(['join']);
const code = ref((props.initialCode || '').toUpperCase().slice(0, 4));
const name = ref('');
const suit = ref(SUIT_ORDER[Math.floor(Math.random() * 4)]);
const codeInput = ref(null);
const tiles = computed(() => Array.from({ length: 4 }, (_, i) => code.value[i] ?? ''));
const ready = computed(() => code.value.length === 4 && name.value.trim());

function onCode(e) {
  code.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  e.target.value = code.value;
}
function submit() {
  if (ready.value && !props.busy) emit('join', { code: code.value, name: name.value.trim(), suit: suit.value });
}
</script>

<template>
  <form class="join" @submit.prevent="submit">
    <div class="head">
      <GildedMirror mood="calm" style="width:62px;height:88px" />
      <div class="script" style="font-size:50px;margin-top:6px">Mirror, Mirror</div>
    </div>

    <p v-if="notice" class="notice">{{ notice }}</p>

    <div class="field">
      <label for="code">Room code</label>
      <div class="tiles" @click="codeInput?.focus()">
        <div v-for="(ch, i) in tiles" :key="i" class="tile" :class="{ cur: i === code.length }" :style="{ color: SUITS[SUIT_ORDER[i]].color }">
          {{ ch }}<span class="pip">{{ SUITS[SUIT_ORDER[i]].sym }}</span>
        </div>
        <input id="code" ref="codeInput" :value="code" @input="onCode" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Room code" />
      </div>
    </div>

    <div class="field">
      <label for="name">What shall the Mirror call you?</label>
      <input id="name" v-model="name" class="pill-input" maxlength="16" autocomplete="nickname" placeholder="Alice" />
    </div>

    <div class="field">
      <label>Pick your suit</label>
      <div class="suits">
        <button v-for="s in SUIT_ORDER" :key="s" type="button" class="suit" :class="{ on: suit === s }" :style="{ color: SUITS[s].color }" :aria-pressed="suit === s" @click="suit = s">
          {{ SUITS[s].sym }}
        </button>
      </div>
      <div class="hint">Share a suit with anyone. Your initial goes on the card.</div>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
    <button class="gilt-btn go" type="submit" :disabled="!ready || busy">{{ busy ? 'Opening the door…' : 'Step through ✦' }}</button>
  </form>
</template>

<style scoped>
.join { display: flex; flex-direction: column; gap: 18px; flex: 1; }
.head { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.field > label { display: block; font-size: 13px; margin-bottom: 6px; }
.tiles { position: relative; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.tile {
  position: relative; height: 84px; border-radius: 8px; background: var(--card); display: grid; place-items: center; font-size: 36px;
  box-shadow: inset 0 0 0 3px var(--card), inset 0 0 0 4px var(--gilt-3), 0 4px 10px rgba(60, 40, 10, .15);
}
.tile.cur { box-shadow: inset 0 0 0 3px var(--card), inset 0 0 0 4px var(--gilt-dark), 0 0 0 3px var(--gilt-1), 0 4px 10px rgba(60, 40, 10, .15); }
.pip { position: absolute; left: 7px; top: 4px; font-size: 11px; }
.tiles input { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; font-size: 16px; }
.pill-input {
  width: 100%; min-height: 52px; font: inherit; font-size: 18px; border-radius: 999px; padding: 0 20px;
  border: 2px solid var(--gilt-3); background: var(--paper); color: var(--ink);
}
.pill-input:focus { outline: none; border-color: var(--gilt-dark); box-shadow: 0 0 0 3px var(--gilt-1); }
.suits { display: flex; justify-content: space-between; align-items: center; padding: 0 10px; min-height: 96px; }
.suit {
  width: 46px; height: 64px; border: 0; border-radius: 6px; background: var(--card); box-shadow: inset 0 0 0 2px var(--gilt-3);
  display: grid; place-items: center; font-size: 24px; cursor: pointer; transition: all .18s;
}
.suit.on {
  width: 64px; height: 90px; border-radius: 8px; font-size: 36px; transform: rotate(-6deg);
  box-shadow: inset 0 0 0 3px var(--card), inset 0 0 0 4px var(--gilt-3), 0 0 0 4px var(--gilt-1), 0 0 0 6px var(--gilt-dark);
}
.hint { font-size: 12px; margin-top: 6px; text-align: center; color: var(--muted); }
.error { margin: 0; text-align: center; color: var(--rose-dark); }
.notice { margin: 0; text-align: center; font-style: italic; }
.go { margin-top: auto; min-height: 60px; font-size: 22px; }
</style>
