<script setup>
// Design 7a: the room code shows in the Mirror's glass.
import { computed } from 'vue';
import GildedMirror from '../../shared/GildedMirror.vue';
import PlayingCard from '../../shared/PlayingCard.vue';
import { tiltFor } from '../../shared/suits.js';
import { trackerReady } from '../camera.js';

const props = defineProps({ state: Object, room: Object });
const emit = defineEmits(['send']);
const players = computed(() => props.state.players);
const cardW = computed(() => (players.value.length > 11 ? 46 : 62));
const codeLetters = computed(() => (props.room?.code ?? '····').split(''));
// "amazing-words.trycloudflare.com/join" -> ["amazing-words", ".trycloudflare.com/join"]
// so a long tunnel address stays inside the oval glass.
const joinLines = computed(() => {
  const host = (props.room?.joinHost ?? 'connecting…') + (props.room ? '/join' : '');
  const dot = host.indexOf('.');
  return host.length > 26 && dot > 0 ? [host.slice(0, dot), host.slice(dot)] : [host];
});
const promptCount = (p) => p.prompts ?? 0;

// Extra sparkles around the Mirror: [left, top, size, delay]
const sparkles = [
  [452, 250, 18, 0], [968, 300, 22, 0.8], [440, 560, 14, 1.6], [985, 610, 16, 0.4],
  [520, 180, 12, 2.1], [905, 200, 14, 1.2], [470, 420, 10, 2.6], [962, 470, 12, 1.9],
];

function remove(p) {
  if (confirm(`Remove ${p.name} from the room?`)) emit('send', { type: 'kick', playerId: p.id });
}
</script>

<template>
  <span class="sparkle" style="left:300px;top:120px;width:26px;height:26px"></span>
  <span class="sparkle" style="left:1120px;top:90px;width:34px;height:34px;background:var(--gilt-3)"></span>
  <span class="sparkle" style="left:1180px;top:150px;width:16px;height:16px"></span>
  <span v-for="(sp, i) in sparkles" :key="i" class="sparkle orbit"
    :style="{ left: sp[0] + 'px', top: sp[1] + 'px', width: sp[2] + 'px', height: sp[2] + 'px', animationDelay: sp[3] + 's', background: i % 3 ? 'var(--gilt-2)' : 'var(--gilt-5)' }"></span>

  <header class="title">
    <div class="script shimmer" style="font-size:96px;margin-top:20px">Mirror, Mirror,</div>
    <div style="font-size:26px;font-style:italic;margin-top:10px">What Did I Draw?</div>
  </header>

  <!-- The Mirror floats; the QR code and room code float with it, inside the glass. -->
  <div class="mirror-wrap">
    <GildedMirror mood="smug" crown class="mirror" />
    <div class="sheen"></div>
    <div class="glass-content">
      <div class="qr" v-html="room?.qrSvg ?? ''"></div>
      <div class="script" style="font-size:40px;margin-top:6px">Room code</div>
      <div class="code" :key="room?.code">
        <span v-for="(ch, i) in codeLetters" :key="i" :style="{ animationDelay: `${i * 0.12}s, ${0.6 + i * 0.25}s` }">{{ ch }}</span>
      </div>
      <div class="host"><span v-for="l in joinLines" :key="l">{{ l }}</span></div>
    </div>
  </div>

  <section class="how">
    <div class="script" style="font-size:34px">How to play</div>
    <div class="step" style="animation-delay:.2s"><span>I.</span>Scan the code in the Mirror</div>
    <div class="step" style="animation-delay:.45s"><span>II.</span>Add things worth drawing, or use ours</div>
    <div class="step" style="animation-delay:.7s"><span>III.</span>Draw in the air, and guess before the Mirror does</div>
  </section>

  <section class="here">
    <div style="text-align:center">
      <div class="script" style="font-size:38px">Player List</div>
      <div class="sub">
        {{ players.length }} at the table · add your own prompts on your phone, if you like
      </div>
    </div>
    <TransitionGroup name="deal" tag="div" class="grid">
      <button v-for="p in players" :key="p.id" class="guest" :title="`Click to remove ${p.name}`" @click="remove(p)">
        <PlayingCard :suit="p.suit" :initial="p.name[0]" :width="cardW" :tilt="tiltFor(p.id)" :faded="!p.connected" />
        <span class="name">{{ p.name }}</span>
        <span v-if="!p.connected" class="note">asleep…</span>
        <span v-else-if="promptCount(p)" class="note">✎ {{ promptCount(p) }} in the hat</span>
      </button>
      <div key="join-slot" class="guest">
        <div class="join-slot" :style="{ width: cardW + 'px', height: Math.round(cardW * 1.39) + 'px' }">+</div>
        <span class="note" style="font-size:13px">join in</span>
      </div>
    </TransitionGroup>
    <button class="gilt-btn play" :class="{ ready: players.length }" style="min-height:64px;font-size:24px;margin-top:6px" :disabled="!players.length" @click="emit('send', { type: 'start' })">
      Let's play ✦
    </button>
    <!-- Laugh highlights are opt-in, chosen before the game starts (CLAUDE.md privacy rules). -->
    <button class="hl-toggle" :class="{ on: state.highlights }" :aria-pressed="state.highlights"
      @click="emit('send', { type: 'highlights:on', on: !state.highlights })">
      <span class="switch"><span></span></span>
      <span>
        <b>Laugh highlights: {{ state.highlights ? 'on' : 'off' }}</b>
        <small>Saves short clips when the room laughs. They stay on this laptop, anyone can veto one, and they vanish after the game.</small>
      </span>
    </button>
  </section>

  <div class="camera-note">
    Camera &amp; mic turn on when you press Let's play · video stays on this laptop · during rounds, room audio goes to Meta's transcription to hear guesses
    <template v-if="!trackerReady"> · warming up the wand…</template>
  </div>
</template>

<style scoped>
.title { position: absolute; left: 0; right: 0; top: 44px; text-align: center; }
.mirror-wrap { position: absolute; left: 500px; top: 212px; width: 440px; height: 638px; animation: float 6s ease-in-out infinite; } /* design: 400×580 */
.mirror { position: absolute; inset: 0; }
/* A soft band of light sweeping across the glass (the glass ellipse is 62% × 63% of the frame). */
.sheen { position: absolute; left: 19%; right: 19%; top: 20%; bottom: 17.5%; border-radius: 50%; overflow: hidden; pointer-events: none; }
.sheen::after {
  content: ''; position: absolute; top: -20%; bottom: -20%; width: 40%; left: -60%;
  background: linear-gradient(100deg, transparent, rgba(255, 255, 255, .55), transparent);
  transform: skewX(-12deg); animation: sweep 7s ease-in-out infinite 1.5s;
}
.glass-content { position: absolute; left: 0; right: 0; top: 176px; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.qr { width: 160px; height: 160px; padding: 6px; border-radius: 6px; background: #fff; box-shadow: 0 0 0 2px var(--gilt-3); }
.qr :deep(svg) { display: block; width: 100%; height: 100%; }
.code { display: flex; font-size: 58px; line-height: 1; letter-spacing: .14em; padding-left: .14em; }
.code span { display: inline-block; animation: pop .5s cubic-bezier(.3, 1.6, .5, 1) both, wave 3.2s ease-in-out infinite; }
.host { display: flex; flex-direction: column; align-items: center; font-size: 13px; line-height: 1.3; color: var(--muted); margin-top: 6px; }
.how {
  position: absolute; left: 84px; top: 300px; width: 370px; padding: 22px 26px; border-radius: 10px; background: var(--paper);
  border: 2px solid var(--gilt-3); box-shadow: 0 0 0 5px var(--paper), 0 0 0 7px var(--gilt-2), 0 10px 20px rgba(80, 50, 10, .14);
  display: flex; flex-direction: column; gap: 14px;
}
.step { display: flex; gap: 14px; align-items: baseline; font-size: 17px; animation: rise .5s ease-out both; }
.step span { width: 30px; flex: none; font-size: 22px; color: var(--rose); }
.here { position: absolute; left: 986px; width: 370px; top: 226px; display: flex; flex-direction: column; gap: 14px; }
.sub { font-size: 13px; color: var(--muted); margin-top: 6px; }
.grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px 8px; justify-items: center; max-height: 470px; overflow: hidden; }
.guest { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: 0; padding: 0; cursor: pointer; }
.guest:hover .name { text-decoration: line-through; }
.name { font-size: 15px; max-width: 86px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.note { font-size: 11px; font-style: italic; color: var(--muted); }
.join-slot { border-radius: 7px; border: 2px dashed var(--gilt-3); display: grid; place-items: center; font-size: 26px; color: var(--gilt-dark); }
.camera-note {
  position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); white-space: nowrap;
  display: flex; align-items: center; gap: 10px; padding: 8px 18px; border-radius: 999px;
  background: var(--paper); box-shadow: inset 0 0 0 2px var(--gilt-3), 0 6px 14px rgba(0, 0, 0, .18); font-size: 14px; color: var(--muted);
}
.title .shimmer {
  /* a gold gloss drifting through the title. background-clip: text only paints inside the
     box, so pad it generously: Princess Sofia's swashes reach well past the line box. */
  display: inline-block; padding: .12em .4em .35em; margin: -.12em -.4em -.35em;
  background: linear-gradient(100deg, var(--gilt-dark) 44%, var(--gilt-2) 48%, #F7E2A2 50%, var(--gilt-2) 52%, var(--gilt-dark) 56%) 0 0 / 350% 100%;
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 3px 0 var(--gilt-1)); animation: gloss 6s linear infinite;
}
.orbit { animation: twinkle 2.6s ease-in-out infinite, drift 7s ease-in-out infinite; }
.play.ready:not(:disabled) { animation: glow 2.4s ease-in-out infinite; }
.deal-enter-active { transition: all .6s cubic-bezier(.3, 1.4, .5, 1); }
.deal-enter-from { opacity: 0; transform: translate(-260px, 120px) rotate(-40deg) scale(.4); }
.deal-leave-active { transition: all .35s ease-in; position: absolute; }
.deal-leave-to { opacity: 0; transform: translateY(30px) rotate(12deg) scale(.6); }
.deal-move { transition: transform .4s ease; }
@keyframes float { 50% { transform: translateY(-10px); } }
@keyframes sweep { 0% { left: -60%; } 45%, 100% { left: 130%; } }
@keyframes pop { from { opacity: 0; transform: translateY(18px) scale(.4); } }
@keyframes wave { 0%, 70%, 100% { translate: 0 0; } 35% { translate: 0 -6px; } }
@keyframes rise { from { opacity: 0; transform: translateY(10px); } }
@keyframes gloss { from { background-position: 100% 0; } to { background-position: -50% 0; } }
@keyframes drift { 50% { translate: 0 -10px; } }
@keyframes glow {
  50% { box-shadow: inset 0 0 0 2px var(--cream), 0 0 0 2px var(--gilt-dark), 0 5px 0 var(--gilt-dark), 0 0 28px 6px rgba(247, 226, 162, .9); }
}
.hl-toggle {
  display: flex; gap: 12px; align-items: center; text-align: left; padding: 10px 14px; border: 0; border-radius: 12px; cursor: pointer;
  background: var(--paper); box-shadow: inset 0 0 0 2px var(--gilt-2); font-family: var(--font-body); color: var(--ink);
}
.hl-toggle b { display: block; font-weight: normal; font-size: 17px; }
.hl-toggle small { display: block; font-size: 12px; color: var(--muted); line-height: 1.35; }
.switch { flex: none; width: 44px; height: 26px; border-radius: 999px; background: #d9d2bf; position: relative; transition: background .2s; }
.switch span { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .3); transition: left .2s; }
.hl-toggle.on .switch { background: var(--rose); }
.hl-toggle.on .switch span { left: 21px; }
.dot { width: 9px; height: 9px; border-radius: 50%; background: var(--rose); box-shadow: 0 0 0 3px rgba(179, 58, 76, .2); }
</style>
