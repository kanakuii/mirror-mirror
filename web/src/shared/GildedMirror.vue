<script>
// One counter per module so each mirror on a page gets unique SVG ids.
let counter = 0;
</script>

<script setup>
// The Mirror has no face: its glass shows its mood. Frame: scrolls, roses, sky gems and a
// pink bow, with a heart and pearl on top (the design's shell fan is removed so the Mirror
// sits lower under titles) (design: Gilded Mirror.dc.html).
import MirrorTopper from './MirrorTopper.vue';

defineProps({
  mood: { type: String, default: 'calm' }, // calm | smug | excited | sulky
  crown: Boolean, // add the separate crown topper between the heart and the pearl
});
const uid = 'gm' + ++counter;
const SCROLLS =
  'M34 108 C10 112 2 136 14 146 C24 154 36 144 28 136 C22 130 16 138 20 142 M34 192 C10 188 2 164 14 154 C24 146 36 156 28 164 C22 170 16 162 20 158 M166 108 C190 112 198 136 186 146 C176 154 164 144 172 136 C178 130 184 138 180 142 M166 192 C190 188 198 164 186 154 C176 146 164 156 172 164 C178 170 184 162 180 158 M74 58 C56 60 48 42 60 34 C70 28 80 38 72 44 C66 48 62 42 66 39 M126 58 C144 60 152 42 140 34 C130 28 120 38 128 44 C134 48 138 42 134 39 M78 254 C60 256 52 272 62 280 C70 286 80 278 74 272 M122 254 C140 256 148 272 138 280 C130 286 120 278 126 272 M48 66 C36 56 38 42 50 40 M152 66 C164 56 162 42 150 40 M48 234 C36 244 38 258 50 260 M152 234 C164 244 162 258 150 260';
const STAR = 'M0 -1 L.22 -.22 L1 0 L.22 .22 L0 1 L-.22 .22 L-1 0 L-.22 -.22Z';
const scrollPasses = [{ color: '#93652A', w: 7 }, { color: '#E6C06A', w: 4.4 }, { color: '#FFF4CF', w: 1.1 }];
const gemCorners = [[50, 40], [150, 40], [50, 260], [150, 260]];
const roseSpots = [[45, 74], [155, 74], [45, 226], [155, 226]];
</script>

<template>
  <div class="gm" :class="mood">
    <div v-if="mood === 'excited'" class="halo"></div>
    <svg viewBox="0 0 200 290" class="layer">
      <defs>
        <linearGradient :id="uid + 'Gold'" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#F7E2A2" /><stop offset=".3" stop-color="#C8963E" /><stop offset=".5" stop-color="#F0D384" /><stop offset=".75" stop-color="#B07D2E" /><stop offset="1" stop-color="#E6C06A" />
        </linearGradient>
        <radialGradient :id="uid + 'Pearl'" cx=".35" cy=".35" r=".7">
          <stop offset="0" stop-color="#FFFFFF" /><stop offset=".6" stop-color="#F7E2A2" /><stop offset="1" stop-color="#C8963E" />
        </radialGradient>
        <g :id="uid + 'Rose'">
          <path d="M-6 4 q-9 2 -11 -4 q8 -3 11 4z" fill="#8FB59A" stroke="#5E8C6E" stroke-width=".7" />
          <path d="M6 4 q9 2 11 -4 q-8 -3 -11 4z" fill="#8FB59A" stroke="#5E8C6E" stroke-width=".7" />
          <circle r="7.5" fill="#F2B8C0" stroke="#B33A4C" stroke-width=".9" />
          <path d="M0 -1 a2.2 2.2 0 1 1 -2.2 2.2 a4.4 4.4 0 0 1 4.4 -4.4 a5.5 5.5 0 0 1 3 8" fill="none" stroke="#B33A4C" stroke-width=".9" />
        </g>
        <clipPath :id="uid + 'Clip'"><ellipse cx="100" cy="150" rx="62" ry="92" /></clipPath>
        <radialGradient :id="uid + 'Calm'" cx=".35" cy=".28" r=".8"><stop offset="0" stop-color="#FFFFFF" /><stop offset=".4" stop-color="#E9EFF2" /><stop offset="1" stop-color="#BFD0DB" /></radialGradient>
        <radialGradient :id="uid + 'Smug'" cx=".65" cy=".25" r=".85"><stop offset="0" stop-color="#FFF8FA" /><stop offset=".45" stop-color="#EDE3F2" /><stop offset="1" stop-color="#C9B8DE" /></radialGradient>
        <radialGradient :id="uid + 'Exc'" cx=".5" cy=".45" r=".7"><stop offset="0" stop-color="#FFFCEB" /><stop offset=".45" stop-color="#F7E2A2" /><stop offset="1" stop-color="#E9B97A" /></radialGradient>
        <radialGradient :id="uid + 'Sulk'" cx=".35" cy=".28" r=".8"><stop offset="0" stop-color="#D9DCDF" /><stop offset=".5" stop-color="#B5BBC1" /><stop offset="1" stop-color="#959CA4" /></radialGradient>
      </defs>

      <!-- carved scrolls: dark, gold, highlight passes -->
      <path v-for="(c, i) in scrollPasses" :key="i" :d="SCROLLS" fill="none" :stroke="c.color" :stroke-width="c.w" stroke-linecap="round" />
      <circle v-for="p in gemCorners" :key="'g' + p[0] + p[1]" :cx="p[0]" :cy="p[1]" r="3.4" fill="#B9A6D9" stroke="#6A4FA0" stroke-width=".7" />

      <!-- crown mount: a gilded neck rising out of the frame's top (its base is hidden behind
           the frame) up to the crown's band, with a carved curl on each side -->
      <g v-if="crown">
        <path d="M78 50 C86 44 89 38 86 31 L114 31 C111 38 114 44 122 50 Z" :fill="`url(#${uid}Gold)`" stroke="#93652A" stroke-width="1.5" stroke-linejoin="round" />
        <path d="M89 33 C91 38 90 42 86 46 M111 33 C109 38 110 42 114 46" fill="none" stroke="#FFF4CF" stroke-width="1" stroke-linecap="round" opacity=".8" />
        <path d="M87 36 C80 36 76 31 79 27 C81 24 85 25 84 28 M113 36 C120 36 124 31 121 27 C119 24 115 25 116 28" fill="none" stroke="#93652A" stroke-width="3.4" stroke-linecap="round" />
        <path d="M87 36 C80 36 76 31 79 27 C81 24 85 25 84 28 M113 36 C120 36 124 31 121 27 C119 24 115 25 116 28" fill="none" stroke="#E6C06A" stroke-width="1.8" stroke-linecap="round" />
      </g>
      <ellipse cx="100" cy="150" rx="78" ry="108" :fill="`url(#${uid}Gold)`" stroke="#93652A" stroke-width="2.5" />
      <ellipse cx="100" cy="150" rx="74.5" ry="104.5" fill="none" stroke="#F7E2A2" stroke-width="1" />
      <ellipse cx="100" cy="150" rx="71" ry="101" fill="none" stroke="#FFF4CF" stroke-width="3.4" stroke-dasharray="0 6.2" stroke-linecap="round" />
      <ellipse cx="100" cy="150" rx="67" ry="97" fill="#93652A" />
      <ellipse cx="100" cy="150" rx="64.5" ry="94.5" fill="none" stroke="#F0D384" stroke-width="1.2" />


      <!-- the frame's top, bottom to top: heart, then (optional) crown, then the pearl -->
      <path d="M100 48 C91 42 89 35 94.5 33 C98 32 100 35 100 36.5 C100 35 102 32 105.5 33 C111 35 109 42 100 48Z" fill="#D9677A" stroke="#8E2335" stroke-width=".9" />
      <circle cx="96.5" cy="36" r="1.4" fill="#FFFFFF" opacity=".85" />
      <!-- crown: 30 wide (100:58), its band resting on the heart's lobes (top of heart y≈32) -->
      <MirrorTopper v-if="crown" x="85" y="16" width="30" height="17.4" />
      <!-- pearl: on the crown's middle tip, or straight on the heart without one -->
      <circle cx="100" :cy="crown ? 13.5 : 27" r="5" :fill="`url(#${uid}Pearl)`" stroke="#93652A" stroke-width=".6" />

      <!-- sky gems, roses, bow -->
      <ellipse cx="28" cy="150" rx="4.6" ry="7.2" fill="#9CC3E0" stroke="#4F7FA8" stroke-width=".8" />
      <ellipse cx="172" cy="150" rx="4.6" ry="7.2" fill="#9CC3E0" stroke="#4F7FA8" stroke-width=".8" />
      <circle cx="26.6" cy="147" r="1.2" fill="#FFFFFF" /><circle cx="170.6" cy="147" r="1.2" fill="#FFFFFF" />
      <use v-for="p in roseSpots" :key="'r' + p[0] + p[1]" :href="`#${uid}Rose`" :x="p[0]" :y="p[1]" />
      <path d="M100 262 C88 250 76 254 80 264 C83 272 94 268 100 262Z" fill="#E58C9B" stroke="#B33A4C" stroke-width="1" />
      <path d="M100 262 C112 250 124 254 120 264 C117 272 106 268 100 262Z" fill="#E58C9B" stroke="#B33A4C" stroke-width="1" />
      <path d="M98 264 L90 284 L95 282 L97 287 L101 266Z" fill="#D9677A" stroke="#B33A4C" stroke-width=".8" />
      <path d="M102 264 L110 284 L105 282 L103 287 L99 266Z" fill="#D9677A" stroke="#B33A4C" stroke-width=".8" />
      <circle cx="100" cy="262" r="4.2" fill="#D9677A" stroke="#B33A4C" stroke-width="1" />

      <!-- the glass: its mood -->
      <g class="glass">
        <template v-if="mood === 'calm'">
          <ellipse cx="100" cy="150" rx="62" ry="92" :fill="`url(#${uid}Calm)`" />
          <g :clip-path="`url(#${uid}Clip)`">
            <path d="M58 40 L76 40 L40 260 L22 260Z" fill="#FFFFFF" opacity=".6" />
            <path d="M84 40 L90 40 L54 260 L48 260Z" fill="#FFFFFF" opacity=".6" />
          </g>
        </template>
        <template v-else-if="mood === 'smug'">
          <ellipse cx="100" cy="150" rx="62" ry="92" :fill="`url(#${uid}Smug)`" />
          <g :clip-path="`url(#${uid}Clip)`"><path d="M58 40 L76 40 L40 260 L22 260Z" fill="#FFFFFF" opacity=".55" /></g>
          <path :d="STAR" transform="translate(128 102) scale(13)" fill="#E6C06A" class="twinkle" />
          <path :d="STAR" transform="translate(146 128) scale(6)" fill="#6A4FA0" class="twinkle slow" />
        </template>
        <template v-else-if="mood === 'excited'">
          <ellipse cx="100" cy="150" rx="62" ry="92" :fill="`url(#${uid}Exc)`" />
          <g :clip-path="`url(#${uid}Clip)`"><path d="M58 40 L76 40 L40 260 L22 260Z" fill="#FFFFFF" opacity=".5" /></g>
          <path :d="STAR" transform="translate(100 150) scale(24)" fill="#FFFFFF" />
          <path :d="STAR" transform="translate(-6 104) scale(10)" fill="#E6C06A" class="twinkle" />
          <path :d="STAR" transform="translate(204 76) scale(8)" fill="#E58C9B" class="twinkle slow" />
          <path :d="STAR" transform="translate(206 204) scale(11)" fill="#E6C06A" class="twinkle" />
          <path :d="STAR" transform="translate(-4 222) scale(7)" fill="#9CC3E0" class="twinkle slow" />
        </template>
        <template v-else>
          <ellipse cx="100" cy="150" rx="62" ry="92" :fill="`url(#${uid}Sulk)`" />
          <path d="M128 62 L114 100 L124 122 L102 156 L108 186 L94 240 M124 122 L150 130 M102 156 L74 162" fill="none" stroke="#2b2421" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="crack" />
        </template>
      </g>
    </svg>
    <div class="slot"><slot /></div>
  </div>
</template>

<style scoped>
.gm { position: relative; width: 100%; height: 100%; }
.layer { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.halo { position: absolute; left: 12%; right: 12%; top: 14%; bottom: 14%; border-radius: 50%; box-shadow: 0 0 60px 30px rgba(247, 226, 162, .85); animation: glow 1.8s ease-in-out infinite; }
.slot { position: absolute; inset: 0; }
.twinkle { transform-box: fill-box; transform-origin: center; animation: tw 2.4s ease-in-out infinite; }
.twinkle.slow { animation-duration: 3.4s; }
.crack { stroke-dasharray: 260; stroke-dashoffset: 260; animation: crack .5s .2s ease-out forwards; }
.excited { animation: wobble 2.2s ease-in-out infinite; }
@keyframes glow { 50% { box-shadow: 0 0 80px 40px rgba(247, 226, 162, .95); } }
@keyframes tw { 50% { opacity: .4; } }
@keyframes crack { to { stroke-dashoffset: 0; } }
@keyframes wobble { 25% { transform: rotate(-1.5deg); } 75% { transform: rotate(1.5deg); } }
</style>
