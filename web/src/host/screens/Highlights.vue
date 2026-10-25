<script setup>
// Design 7e: a portrait gallery, the Mirror's silliest guesses, and honours.
// The portraits play the laugh clips (if highlights were on), else the night's drawings.
// Clips live in this browser tab only: phones see just their labels to veto them, a veto
// deletes the clip, and everything vanishes on Play again. Nothing is saved.
import { computed, onMounted, watch } from 'vue';
import GildedMirror from '../../shared/GildedMirror.vue';
import ClipPlayer from '../ClipPlayer.vue';
import { clips } from '../recorder.js';
import { SUITS, fmtTime } from '../../shared/suits.js';

const props = defineProps({ state: Object, drawings: Object });
const emit = defineEmits(['send']);
const history = computed(() => props.state.history);

const roundOf = (n) => history.value.find((h) => h.number === n);

// ---------- laugh clips: review + veto ----------
const labelFor = (c) => {
  const h = roundOf(c.round);
  return `Round ${c.round} · ${c.artistName}${h ? ` drawing “${h.prompt}”` : ''}`;
};
function publishClips() {
  emit('send', { type: 'clips', clips: clips.map((c) => ({ id: c.id, label: labelFor(c), durationMs: c.durationMs })) });
}
onMounted(publishClips);
// A veto from any phone (or here) deletes the clip on this laptop.
watch(() => props.state.clips, (list) => {
  for (const c of list ?? []) {
    if (!c.vetoed) continue;
    const i = clips.findIndex((x) => x.id === c.id);
    if (i >= 0) clips.splice(i, 1);
  }
});
const veto = (c) => emit('send', { type: 'veto', id: c.id });
const topClips = computed(() => [...clips].sort((a, b) => b.intensity - a.intensity).slice(0, 3));

const wrongGuesses = (h) => (h.winner === 'mirror' ? h.mirrorGuesses.slice(0, -1) : h.mirrorGuesses);
const silliest = (h) => [...wrongGuesses(h)].sort((a, b) => b.length - a.length)[0];

const gallery = computed(() =>
  topClips.value.length
    ? topClips.value.map((c) => {
        const h = roundOf(c.round);
        return { clip: c, caption: h ? `${c.artistName}'s ${h.prompt}${silliest(h) ? ` → “${silliest(h)}”` : ''}` : labelFor(c) };
      })
    : history.value
    .filter((h) => props.drawings[h.number])
    .sort((a, b) => wrongGuesses(b).length - wrongGuesses(a).length)
    .slice(0, 3)
    .map((h) => ({
      img: props.drawings[h.number],
      caption: silliest(h) ? `${h.artistName}'s ${h.prompt} → “${silliest(h)}”` : `${h.artistName}'s ${h.prompt}`,
    })),
);

const silly = computed(() => {
  const all = [...new Set(history.value.flatMap(wrongGuesses))];
  return all.sort((a, b) => b.length - a.length).slice(0, 3);
});

const honours = computed(() => {
  const list = [];
  const kingdomWins = history.value.filter((h) => h.winner === 'kingdom');
  const mirrorWins = history.value.filter((h) => h.winner === 'mirror');
  const proof = [...kingdomWins].sort((a, b) => wrongGuesses(b).length - wrongGuesses(a).length || b.elapsedMs - a.elapsedMs)[0];
  if (proof) list.push({ title: 'Mirror-Proof', h: proof, note: `“${proof.prompt}.” The Mirror had no idea.` });
  const open = [...mirrorWins].sort((a, b) => a.elapsedMs - b.elapsedMs)[0];
  if (open) list.push({ title: 'Open Book', h: open, note: `The Mirror read their ${open.prompt} in ${Math.round(open.elapsedMs / 1000)} seconds.` });
  const abstract = history.value.find((h) => h.winner === 'none');
  if (abstract) list.push({ title: 'Abstract Artist', h: abstract, note: 'Nobody guessed it. Not even the Mirror.' });
  const jester = topClips.value[0];
  const jesterRound = jester && roundOf(jester.round);
  if (jesterRound) list.push({ title: 'Court Jester', h: jesterRound, note: 'Drawing during the biggest laugh of the night.' });
  const quick = [...kingdomWins].sort((a, b) => a.elapsedMs - b.elapsedMs)[0];
  if (quick && quick !== proof) list.push({ title: 'Quick Draw', h: quick, note: `The room got “${quick.prompt}” in ${fmtTime(quick.elapsedMs)}.` });
  return list.slice(0, 4);
});

const frames = ['landscape', 'oval', 'tall'];
</script>

<template>
  <div class="head">
    <div style="font-size:14px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)">Once upon a game night…</div>
    <div class="script" style="font-size:82px;line-height:1.1;text-shadow:0 3px 0 var(--gilt-1)">Happily Ever Laughter</div>
  </div>

  <div v-for="(g, i) in gallery" :key="i" class="portrait" :class="frames[i]">
    <div class="pframe">
      <div class="pglass">
        <ClipPlayer v-if="g.clip" :parts="g.clip.parts" :poster="g.clip.thumb" :muted="i > 0" />
        <img v-else :src="g.img" alt="" />
        <button v-if="g.clip" class="veto" @click="veto(g.clip)">Veto</button>
      </div>
    </div>
    <div class="plaque" style="font-size:17px">{{ g.caption }}</div>
  </div>
  <div v-if="!gallery.length" class="portrait landscape">
    <div class="pframe"><div class="pglass empty">No drawings survived the night</div></div>
  </div>

  <div v-if="silly.length" class="silly">
    <GildedMirror mood="calm" style="width:64px;height:92px;flex:none" />
    <div class="speech" style="padding:12px 18px">
      <div class="kicker" style="color:var(--gilt-dark)">The Mirror's silliest guesses</div>
      <div style="font-size:19px;font-style:italic">{{ silly.map((s) => `“${s}”`).join(' · ') }}</div>
    </div>
  </div>

  <div class="honours">
    <div class="script" style="font-size:34px">With honours to…</div>
    <div v-for="o in honours" :key="o.title" class="honour">
      <span class="mini" :style="{ color: SUITS[o.h.artistSuit]?.color }">{{ SUITS[o.h.artistSuit]?.sym }}</span>
      <div style="flex:1">
        <div style="font-size:20px;line-height:1.1">{{ o.title }} · <i>{{ o.h.artistName }}</i></div>
        <div style="font-size:13px;color:var(--muted)">{{ o.note }}</div>
      </div>
    </div>
    <div v-if="!honours.length" class="muted" style="font-style:italic">Play a round or two and the Mirror will hand out honours.</div>
  </div>

  <button class="gilt-btn again" @click="emit('send', { type: 'lobby' })">Play again ✦</button>

  <div class="footer">
    <span v-if="clips.length">Clips stay on this laptop · anyone can veto one from their phone · nothing is saved</span>
    <span v-else>Drawings stay on this laptop · nothing is saved · they vanish when you play again</span>
    <span style="font-size:20px;font-style:italic">…and they all lived happily ever after</span>
  </div>
</template>

<style scoped>
.head { position: absolute; left: 84px; top: 52px; }
.portrait { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.landscape { left: 84px; top: 200px; }
.oval { left: 544px; top: 196px; }
.tall { left: 784px; top: 226px; }
.pframe { padding: 16px; border-radius: 3px; background: var(--gilt-grad); box-shadow: inset 0 0 0 2px var(--gilt-dark), inset 0 0 0 6px var(--gilt-1), inset 0 0 0 8px var(--gilt-dark), 0 12px 24px rgba(60, 40, 10, .22); }
.pglass { position: relative; background: var(--canvas); box-shadow: 0 0 0 2px var(--gilt-dark); overflow: hidden; }
.pglass img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.landscape .pglass { width: 380px; height: 250px; }
.oval .pframe { padding: 14px; border-radius: 50%; }
.oval .pglass { width: 190px; height: 240px; border-radius: 50%; box-shadow: 0 0 0 2px var(--gilt-dark), 0 0 0 6px var(--gilt-1); }
.tall .pframe { padding: 12px; }
.tall .pglass { width: 170px; height: 200px; }
.pglass.empty { display: grid; place-items: center; color: rgba(255, 255, 255, .5); font-style: italic; }
.portrait .plaque { max-width: 420px; text-align: center; }
.veto {
  position: absolute; top: 8px; right: 8px; z-index: 2; padding: 3px 12px; border: 0; border-radius: 999px; cursor: pointer;
  background: var(--rose); color: var(--cream); font: 12px var(--font-body); opacity: .85;
}
.veto:hover { opacity: 1; }
.silly { position: absolute; left: 84px; top: 580px; display: flex; gap: 14px; align-items: flex-end; max-width: 820px; }
.honours { position: absolute; left: 1010px; right: 70px; top: 176px; display: flex; flex-direction: column; gap: 12px; }
.honour { display: flex; gap: 14px; align-items: center; padding: 10px 16px 10px 10px; border-radius: 10px; background: var(--paper); box-shadow: inset 0 0 0 2px var(--gilt-2); }
.mini { width: 44px; height: 60px; flex: none; border-radius: 5px; background: var(--card); box-shadow: inset 0 0 0 2px var(--card), inset 0 0 0 3px var(--gilt-3); display: grid; place-items: center; font-size: 24px; }
.again { position: absolute; right: 70px; top: 64px; min-height: 52px; font-size: 19px; }
.footer {
  position: absolute; left: 84px; right: 84px; bottom: 34px; display: flex; justify-content: space-between; align-items: center;
  padding: 12px 24px; border-radius: 999px; background: var(--paper); box-shadow: inset 0 0 0 2px var(--gilt-3), 0 6px 14px rgba(0, 0, 0, .18); font-size: 14px;
}
</style>
