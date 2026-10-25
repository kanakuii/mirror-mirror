<script setup>
// Design 7g, now optional (like skribbl.io custom words): add up to three prompts to mix in
// with the built-in ones. The Mirror pipes up about ones strangers couldn't guess.
import { computed, nextTick, reactive } from 'vue';
import GildedMirror from '../../shared/GildedMirror.vue';
import { SUITS } from '../../shared/suits.js';

const props = defineProps({ you: Object });
const emit = defineEmits(['send', 'done']);
const prompts = reactive([0, 1, 2].map((i) => props.you.prompts[i] ?? ''));
const kept = reactive(new Set(props.you.prompts)); // already accepted ones don't nag again
const inputs = []; // the three <input> elements

// Names and private references: inside jokes belong in HOW you draw, not in the prompt.
function looksPrivate(raw) {
  raw = raw.trim();
  if (/\b(my|our|his|her|their)\b/i.test(raw)) return true;
  if (/\b\w+'s\b/i.test(raw)) return true;
  return raw.split(/\s+/).slice(1).some((w) => /^[A-Z][a-z]/.test(w));
}
const flagged = computed(() => prompts.findIndex((p) => p.trim() && looksPrivate(p) && !kept.has(p.trim())));
const written = computed(() => prompts.filter((p) => p.trim()).length);
const canSubmit = computed(() => flagged.value === -1);
const hadSome = props.you.prompts.length > 0;
const submitLabel = computed(() => (written.value ? 'Into the hat!' : hadSome ? 'Take mine out of the hat' : 'Back'));
const suit = computed(() => SUITS[props.you.suit]);

async function change(i) {
  await nextTick();
  inputs[i]?.focus();
  inputs[i]?.select();
}
function submit() {
  if (!canSubmit.value) return;
  if (written.value || hadSome) emit('send', { type: 'prompts', prompts: prompts.map((p) => p.trim()).filter(Boolean) });
  emit('done');
}
</script>

<template>
  <div class="topline">
    <span class="who-chip"><span class="mini" :style="{ color: suit.color }">{{ suit.sym }}</span>{{ you.name }}</span>
    <span style="color:var(--rose-dark)">optional · {{ written }} of 3</span>
  </div>
  <div class="script" style="font-size:42px">Things worth drawing</div>
  <p style="margin:0;font-size:14px;line-height:1.5">Add up to three, and they'll be mixed in with the Mirror's own. Things a stranger could guess. Save the inside jokes for <i>how</i> you draw them!</p>

  <form class="list" @submit.prevent="submit">
    <label v-for="i in 3" :key="i" class="row" :class="{ done: prompts[i - 1].trim() && flagged !== i - 1, flag: flagged === i - 1 }">
      <input
        :ref="(el) => (inputs[i - 1] = el)"
        v-model="prompts[i - 1]"
        maxlength="40"
        :placeholder="['lighthouse', 'a cat in a teacup', 'a dragon'][i - 1]"
        :aria-label="`Prompt ${i}`"
        @keydown.enter.prevent="i < 3 ? inputs[i].focus() : submit()"
      />
      <span v-if="prompts[i - 1].trim() && flagged !== i - 1" class="tick">✓</span>
    </label>
  </form>

  <template v-if="flagged !== -1">
    <div class="mini-mirror">
      <GildedMirror mood="calm" style="width:46px;height:66px;flex:none" />
      <div class="speech" style="padding:12px 14px">
        <div class="line" style="font-size:16px">“Ooh, ‘{{ prompts[flagged].trim() }}’? Strangers might not know that one. Try something anyone could guess, and save the joke for how you draw it.”</div>
      </div>
    </div>
    <div class="pair">
      <button class="paper-btn" @click="kept.add(prompts[flagged].trim())">Keep it</button>
      <button class="gilt-btn" @click="change(flagged)">Change it</button>
    </div>
  </template>

  <div class="go">
    <button class="gilt-btn" :disabled="!canSubmit" @click="submit">{{ submitLabel }}</button>
    <button v-if="written" class="text-btn" @click="emit('done')">Never mind</button>
  </div>
</template>

<style scoped>
.mini { width: 22px; height: 30px; border-radius: 4px; background: var(--card); box-shadow: inset 0 0 0 1.5px var(--gilt-3); display: grid; place-items: center; font-size: 13px; }
.list { display: flex; flex-direction: column; gap: 12px; }
.row { display: flex; align-items: center; gap: 12px; min-height: 54px; padding: 0 18px; border-radius: 999px; background: #fff; box-shadow: inset 0 0 0 2px var(--gilt-dark), 0 0 0 4px var(--gilt-1); }
.row.done { background: var(--paper); box-shadow: inset 0 0 0 2px var(--gilt-2); }
.row.flag { box-shadow: inset 0 0 0 2px var(--rose), 0 0 0 4px #F6D4D4; }
.row input { flex: 1; min-width: 0; border: 0; background: transparent; font: inherit; font-size: 17px; color: var(--ink); padding: 14px 0; }
.row input:focus { outline: none; }
.tick { color: var(--rose); }
.pair { display: flex; gap: 10px; }
.pair button { min-height: 48px; font-size: 16px; }
.go { margin-top: auto; display: flex; flex-direction: column; gap: 6px; }
.go .gilt-btn { min-height: 58px; }
.text-btn { border: 0; background: none; padding: 10px; font-size: 15px; color: var(--muted); text-decoration: underline; cursor: pointer; }
</style>
