<script setup>
// Design 7b (the Kingdom wins: rose room, falling cards, a cracked Mirror),
// 7c (the Mirror wins: midnight, the glass floods gold), and time's up (ivory).
import { computed } from 'vue';
import GildedMirror from '../../shared/GildedMirror.vue';
import Scores from './Scores.vue';
import { SUITS, fmtTime } from '../../shared/suits.js';
import { kingdomWinQuip, mirrorWinTip, timeUpQuip } from '../../shared/quips.js';

const props = defineProps({ state: Object, drawings: Object });
const emit = defineEmits(['send']);
const round = computed(() => props.state.round);
const res = computed(() => round.value.result);
const entry = computed(() => props.state.history.at(-1));
const img = computed(() => props.drawings[round.value.number]);
const tries = computed(() => entry.value.mirrorGuesses.slice(res.value.winner === 'mirror' ? -5 : -4));
const winningGuess = computed(() => entry.value.mirrorGuesses.at(-1));
const suit = computed(() => SUITS[entry.value.artistSuit] ?? SUITS.hearts);
const last = computed(() => props.state.history.length >= props.state.totalRounds);
const article = (p) => (/^(a|an|the|some)\s/i.test(p) ? p : (/^[aeiou]/i.test(p) ? 'an ' : 'a ') + p);
// Picked once (this screen remounts every round), so a state update never swaps the line.
const quip = (() => {
  const r = res.value;
  return r.winner === 'kingdom' ? kingdomWinQuip(r.prompt, entry.value.mirrorGuesses)
    : r.winner === 'mirror' ? mirrorWinTip() : timeUpQuip();
})();
const next = () => emit('send', { type: 'next' });

// Falling cards and hearts for the Kingdom's win.
const confetti = Array.from({ length: 22 }, (_, i) => ({
  left: 4 + ((i * 37) % 92) + '%',
  delay: (i % 7) * 0.35 + 's',
  dur: 3.2 + (i % 5) * 0.5 + 's',
  rot: (i * 47) % 360 + 'deg',
  kind: i % 3 === 0 ? 'card' : ['♥', '♠', '♦', '♣'][i % 4],
  color: ['#B33A4C', '#2F6B70', '#6A4FA0', '#3F7A55'][i % 4],
}));
</script>

<template>
  <!-- ═══ The Kingdom got it ═══ -->
  <template v-if="res.winner === 'kingdom'">
    <div class="confetti">
      <span v-for="(c, i) in confetti" :key="i" :class="c.kind === 'card' ? 'mini-card' : 'suit'"
        :style="{ left: c.left, animationDelay: c.delay, animationDuration: c.dur, color: c.color, '--r': c.rot }">{{ c.kind === 'card' ? '' : c.kind }}</span>
    </div>
    <div class="left">
      <div class="banner" style="background:var(--rose);color:var(--cream)">Round {{ round.number }} · got it in {{ fmtTime(res.elapsedMs) }}</div>
      <div class="script" style="font-size:120px;color:var(--rose);text-shadow:0 3px 0 #F6D4D4">Hooray!</div>
      <div style="font-size:56px;line-height:1.05;margin-top:-6px">The Kingdom got it.</div>
      <div style="font-size:32px;font-style:italic">It was <span class="answer">{{ article(res.prompt) }}</span></div>
      <div v-if="res.by === 'listener' && entry.heard?.length" class="caught">The Mirror's ears caught “{{ entry.heard.at(-1) }}”</div>
      <div class="mirror-says">
        <GildedMirror mood="sulky" style="width:104px;height:150px;flex:none" />
        <div class="speech"><div class="kicker">The Mirror</div><div class="line" style="font-size:24px">“<span v-html="quip"></span>”</div></div>
      </div>
      <div v-if="tries.length" class="tries">
        <span style="font-size:14px;margin-right:4px">Mirror's tries:</span>
        <span v-for="t in tries" :key="t" class="try">{{ t }}</span>
      </div>
    </div>
    <div class="portrait-col">
      <div class="frame"><div class="glass" style="width:380px;height:380px"><img v-if="img" :src="img" alt="" /></div></div>
      <div class="plaque" style="font-size:20px">by {{ entry.artistName }} <span :style="{ color: suit.color }">{{ suit.sym }}</span></div>
    </div>
    <Scores :scores="state.scores" plus="kingdom" class="scores" />
    <button class="gilt-btn next" @click="next">{{ last ? 'Tip the scales →' : 'Next round →' }}</button>
  </template>

  <!-- ═══ The Mirror saw it first ═══ -->
  <template v-else-if="res.winner === 'mirror'">
    <span class="sparkle" style="left:180px;top:110px;width:30px;height:30px;background:var(--gilt-5)"></span>
    <span class="sparkle" style="left:420px;top:230px;width:16px;height:16px"></span>
    <span class="sparkle" style="left:1010px;top:240px;width:20px;height:20px;background:var(--gilt-5)"></span>
    <span class="sparkle" style="left:1240px;top:120px;width:36px;height:36px"></span>
    <div class="night-top">
      <div class="banner" style="background:linear-gradient(var(--gilt-1),var(--gilt-2));color:var(--ink);align-self:center">
        Round {{ round.number }} · the Mirror saw it first at {{ fmtTime(res.elapsedMs) }}
      </div>
      <div class="ta-da">
        <span class="script" style="font-size:92px;color:var(--gilt-5)">Ta-da! I see…</span>
        <span style="font-size:60px">{{ winningGuess }}!</span>
      </div>
    </div>
    <GildedMirror mood="excited" class="big-mirror" />
    <div class="night-left">
      <div class="frame small"><div class="glass" style="width:220px;height:200px"><img v-if="img" :src="img" alt="" /></div></div>
      <div class="kicker" style="color:var(--gilt-5);margin-top:8px">It was “{{ res.prompt }}”</div>
      <div style="font-size:17px;font-style:italic;opacity:.85">drawn by {{ entry.artistName }} <span :style="{ color: suit.color }">{{ suit.sym }}</span></div>
      <template v-if="entry.heard?.length">
        <div class="kicker" style="color:var(--gilt-5);margin-top:8px">The Kingdom was close!</div>
        <div class="night-tries heard">
          <span v-for="h in entry.heard.slice(-3)" :key="h">“{{ h.length > 40 ? h.slice(0, 40) + '…' : h }}”</span>
        </div>
      </template>
      <div v-else-if="tries.length > 1" class="night-tries">
        <span v-for="t in tries.slice(0, -1)" :key="t">{{ t }}</span>
      </div>
    </div>
    <div class="tip">
      <div class="script" style="font-size:30px;margin-bottom:10px">A little tip</div>
      <p>“<span v-html="quip"></span>”</p>
    </div>
    <Scores :scores="state.scores" plus="mirror" class="scores-center" />
    <button class="gilt-btn next" @click="next">{{ last ? 'Tip the scales →' : 'Next round →' }}</button>
  </template>

  <!-- ═══ Time's up ═══ -->
  <template v-else>
    <div class="left">
      <div class="banner" style="background:var(--lilac);color:var(--cream)">Round {{ round.number }} · time's up</div>
      <div class="script" style="font-size:110px;text-shadow:0 3px 0 var(--gilt-1)">Time's up!</div>
      <div style="font-size:52px;line-height:1.05;margin-top:-6px">Nobody got it.</div>
      <div style="font-size:32px;font-style:italic">It was <span class="answer">{{ article(res.prompt) }}</span></div>
      <div class="mirror-says">
        <GildedMirror mood="calm" style="width:104px;height:150px;flex:none" />
        <div class="speech"><div class="kicker">The Mirror</div><div class="line" style="font-size:24px">“<span v-html="quip"></span>”</div></div>
      </div>
      <div v-if="tries.length" class="tries">
        <span style="font-size:14px;margin-right:4px">Mirror's tries:</span>
        <span v-for="t in tries" :key="t" class="try">{{ t }}</span>
      </div>
    </div>
    <div class="portrait-col">
      <div class="frame"><div class="glass" style="width:380px;height:380px"><img v-if="img" :src="img" alt="" /></div></div>
      <div class="plaque" style="font-size:20px">by {{ entry.artistName }} <span :style="{ color: suit.color }">{{ suit.sym }}</span></div>
    </div>
    <Scores :scores="state.scores" class="scores" />
    <button class="gilt-btn next" @click="next">{{ last ? 'Tip the scales →' : 'Next round →' }}</button>
  </template>
</template>

<style scoped>
.left { position: absolute; left: 100px; top: 84px; width: 700px; display: flex; flex-direction: column; gap: 14px; }
.caught { font-size: 17px; font-style: italic; color: var(--rose-dark); }
.answer { padding: 0 14px; background: var(--paper); box-shadow: inset 0 0 0 2px var(--gilt-2); border-radius: 6px; font-style: normal; }
.mirror-says { display: flex; gap: 26px; align-items: center; margin-top: 14px; }
.tries { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-top: 8px; }
.try { padding: 5px 14px; border-radius: 999px; background: var(--paper); box-shadow: inset 0 0 0 1px var(--gilt-3); color: var(--muted); font-size: 16px; text-decoration: line-through; }
.portrait-col { position: absolute; left: 900px; top: 96px; width: 440px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.scores { position: absolute; left: 100px; bottom: 56px; }
.scores-center { position: absolute; left: 0; right: 0; bottom: 54px; justify-content: center; }
.next { position: absolute; right: 100px; bottom: 56px; min-height: 60px; padding: 0 34px; font-size: 22px; }

.confetti { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.confetti > span { position: absolute; top: -40px; animation: fall linear infinite; }
.suit { font-size: 28px; }
.mini-card { width: 22px; height: 30px; border-radius: 3px; background: var(--card); box-shadow: inset 0 0 0 1px var(--gilt-3); }
@keyframes fall { to { transform: translateY(980px) rotate(var(--r)); } }

.night-top { position: absolute; top: 62px; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.ta-da { display: flex; align-items: baseline; gap: 22px; }
.big-mirror { position: absolute; left: 570px; top: 250px; width: 300px; height: 440px; }
.big-mirror :deep(.glass) { animation: flood 1.2s ease-out; transform-origin: 100px 150px; transform-box: view-box; }
@keyframes flood { from { transform: scale(.1); opacity: 0; } }
.night-left { position: absolute; left: 110px; top: 290px; width: 340px; display: flex; flex-direction: column; gap: 8px; }
.frame.small { align-self: flex-start; padding: 12px; transform: rotate(-3deg); box-shadow: inset 0 0 0 2px var(--gilt-dark), 0 10px 22px rgba(0, 0, 0, .35); }
.night-tries { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; margin-top: 6px; }
.night-tries span { padding: 6px 16px; border-radius: 999px; background: var(--rose); font-size: 17px; text-decoration: line-through; }
.night-tries.heard span { text-decoration: none; }
.tip {
  position: absolute; right: 110px; top: 330px; width: 340px; padding: 22px 26px; border-radius: 10px; background: var(--paper); color: var(--ink);
  border: 2px solid var(--gilt-3); box-shadow: 0 0 0 5px var(--paper), 0 0 0 7px var(--gilt-2), 0 12px 24px rgba(0, 0, 0, .35);
}
.tip p { margin: 0; font-size: 17px; line-height: 1.6; }
</style>
