<script setup>
// Everyone who isn't the artist: follow along. The fun is shouting at the TV, so this
// screen stays calm and points at the big screen.
import { computed, watch } from 'vue';
import GildedMirror from '../../shared/GildedMirror.vue';
import PlayingCard from '../../shared/PlayingCard.vue';
import { useCountdown } from '../../shared/socket.js';
import { fmtTime } from '../../shared/suits.js';

const props = defineProps({ you: Object, state: Object });
const emit = defineEmits(['send']);
const fmtLen = (ms) => `${Math.round(ms / 1000)}s`;
const s = computed(() => props.state);
const round = computed(() => s.value.round);
const artist = computed(() => s.value.players.find((p) => p.id === round.value?.artistId));
const res = computed(() => round.value?.result);
const { ms, set } = useCountdown();
watch(() => props.state, () => round.value && set(round.value.remainingMs), { immediate: true });
</script>

<template>
  <div class="topline">
    <span>{{ round ? `Round ${round.number} of ${s.totalRounds}` : 'Mirror, Mirror' }}</span>
    <span>Kingdom {{ s.scores.kingdom }} · Mirror {{ s.scores.mirror }}</span>
  </div>

  <!-- someone is choosing -->
  <template v-if="s.phase === 'pick'">
    <div class="center">
      <PlayingCard v-if="artist" :suit="artist.suit" :initial="artist.name[0]" :width="96" :tilt="-4" selected />
      <div class="script" style="font-size:44px">{{ round.artistName }} is choosing…</div>
      <div class="muted">Get ready to shout. The Mirror guesses every five seconds.</div>
      <div class="clock">{{ fmtTime(ms) }}</div>
    </div>
  </template>

  <!-- drawing: shout! -->
  <template v-else-if="s.phase === 'draw'">
    <div class="center">
      <div class="script" style="font-size:52px;color:var(--rose)">Shout your guesses!</div>
      <div style="font-size:18px">{{ round.artistName }} is drawing on the big screen.</div>
      <div class="clock">{{ fmtTime(ms) }}</div>
      <div v-if="round.heard?.length" class="heard">Heard: <i v-for="h in round.heard.slice(-2)" :key="h">“{{ h }}” </i></div>
      <div v-if="s.highlights" class="hl">● Highlights on: laughs are saved on the laptop</div>
    </div>
    <div class="mini-mirror" style="margin-top:auto">
      <GildedMirror :mood="round.mirrorGuesses.length ? 'smug' : 'calm'" style="width:46px;height:66px;flex:none" />
      <div class="speech" style="padding:12px 14px">
        <div class="kicker">The Mirror sees</div>
        <div class="line">{{ round.mirrorGuesses.length ? `“${round.mirrorGuesses.at(-1)}…”` : 'Squinting…' }}</div>
      </div>
    </div>
  </template>

  <!-- a round just ended -->
  <template v-else-if="s.phase === 'result' && res">
    <div class="center">
      <GildedMirror :mood="res.winner === 'kingdom' ? 'sulky' : res.winner === 'mirror' ? 'excited' : 'calm'" style="width:110px;height:160px" />
      <div class="script" style="font-size:56px" :style="{ color: res.winner === 'kingdom' ? 'var(--rose)' : undefined }">
        {{ res.winner === 'kingdom' ? 'Hooray!' : res.winner === 'mirror' ? 'The Mirror saw it…' : "Time's up!" }}
      </div>
      <div style="font-size:20px">It was <b style="font-weight:normal;padding:0 8px;background:var(--paper);box-shadow:inset 0 0 0 2px var(--gilt-2);border-radius:6px">{{ res.prompt }}</b></div>
    </div>
  </template>

  <!-- the end: review laugh clips, anyone can veto -->
  <template v-else-if="s.phase === 'highlights' && s.clips?.length">
    <div class="center" style="gap:8px">
      <div class="script" style="font-size:44px">Happily Ever Laughter</div>
      <div class="muted">Don't want a clip shown? Veto it and it's deleted from the laptop.</div>
    </div>
    <div class="clips">
      <div v-for="c in s.clips" :key="c.id" class="clip-row" :class="{ gone: c.vetoed }">
        <span style="flex:1">{{ c.label }} <small class="muted">· {{ fmtLen(c.durationMs) }}</small></span>
        <span v-if="c.vetoed" class="muted" style="font-style:italic">vetoed</span>
        <button v-else class="paper-btn" style="width:auto;min-height:40px;font-size:15px;padding:0 16px" @click="emit('send', { type: 'veto', id: c.id })">Veto</button>
      </div>
    </div>
  </template>

  <template v-else-if="s.phase === 'final' || s.phase === 'highlights'">
    <div class="center">
      <div class="script" style="font-size:52px">And so the tale ends…</div>
      <div class="final">
        <span class="score-pill" style="background:var(--rose);color:var(--cream)">Kingdom {{ s.scores.kingdom }}</span>
        <span class="score-pill" style="background:var(--paper);box-shadow:inset 0 0 0 2px var(--gilt-3);color:var(--gilt-dark)">Mirror {{ s.scores.mirror }}</span>
      </div>
      <div class="muted">Look at the big screen ✦</div>
    </div>
  </template>

  <template v-else>
    <div class="center"><div class="script" style="font-size:44px">Look at the big screen ✦</div></div>
  </template>
</template>

<style scoped>
.center { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; margin-top: 30px; }
.clock { padding: 4px 16px; border-radius: 999px; background: var(--rose); color: var(--cream); font-size: 22px; font-feature-settings: 'tnum'; }
.final { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.final .score-pill { font-size: 22px; }
.heard { font-size: 14px; color: var(--muted); }
.hl { font-size: 13px; color: var(--rose-dark); }
.clips { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.clip-row { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: 12px; background: var(--paper); box-shadow: inset 0 0 0 2px var(--gilt-2); font-size: 15px; }
.clip-row.gone { opacity: .5; text-decoration: line-through; }
</style>
