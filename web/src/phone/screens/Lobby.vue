<script setup>
// Waiting in the lobby. Adding your own prompts is optional: the Mirror has plenty.
import PlayingCard from '../../shared/PlayingCard.vue';
import GildedMirror from '../../shared/GildedMirror.vue';
import { tiltFor } from '../../shared/suits.js';

defineProps({ you: Object, state: Object });
defineEmits(['edit']);
</script>

<template>
  <div class="head">
    <PlayingCard :suit="you.suit" :initial="you.name[0]" :width="84" :tilt="-5" selected />
    <div class="script" style="font-size:44px;text-align:center">Welcome, {{ you.name }}</div>
    <div class="muted" style="text-align:center">
      <template v-if="you.prompts.length">Your {{ you.prompts.length === 1 ? 'prompt is' : `${you.prompts.length} prompts are` }} in the hat, mixed in with the Mirror's own.</template>
      <template v-else>You're in! Watch the big screen. The game starts soon.</template>
    </div>
    <div v-if="state.highlights" class="hl-note">● Laugh highlights are on: short clips stay on the laptop, and you can veto any of them at the end.</div>
  </div>

  <div class="table">
    <div v-for="p in state.players" :key="p.id" class="guest">
      <PlayingCard :suit="p.suit" :initial="p.name[0]" :width="48" :tilt="tiltFor(p.id)" :faded="!p.connected" />
      <span class="name">{{ p.name }}</span>
      <span v-if="p.prompts" class="note">✎ {{ p.prompts }}</span>
    </div>
  </div>

  <div class="mini-mirror" style="margin-top:auto">
    <GildedMirror mood="smug" style="width:46px;height:66px;flex:none" />
    <div class="speech" style="padding:12px 14px">
      <div class="line">“Add your own things to draw, if you like. Or use mine. Mine are very good.”</div>
    </div>
  </div>
  <button :class="you.prompts.length ? 'paper-btn' : 'gilt-btn'" style="min-height:52px;font-size:18px" @click="$emit('edit')">
    {{ you.prompts.length ? 'Edit my prompts' : 'Add your own prompts ✎' }}
  </button>
</template>

<style scoped>
.head { display: flex; flex-direction: column; align-items: center; gap: 10px; margin-top: 8px; }
.table { display: flex; flex-wrap: wrap; gap: 12px 10px; justify-content: center; }
.guest { display: flex; flex-direction: column; align-items: center; gap: 3px; width: 64px; }
.name { font-size: 13px; max-width: 64px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hl-note { font-size: 13px; color: var(--rose-dark); text-align: center; }
.note { font-size: 11px; font-style: italic; color: var(--muted); }
</style>
