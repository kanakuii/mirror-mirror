<script>
let counter = 0; // unique SVG ids per crown on a page
</script>

<script setup>
// The Mirror's crown: a separate topper piece. GildedMirror draws it inside its own SVG
// (via the `crown` prop) at x/y/width/height in the Mirror's coordinates, so it always
// sits on the pearl at the right size, whatever the screen. Viewbox is 100×58.
const uid = 'crown' + ++counter;
const tips = [[6, 16], [28, 8], [50, 2], [72, 8], [94, 16]];
</script>

<template>
  <svg class="crown" viewBox="0 0 100 58" overflow="visible" aria-hidden="true">
    <defs>
      <linearGradient :id="uid + 'Gold'" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#F7E2A2" /><stop offset=".3" stop-color="#C8963E" /><stop offset=".5" stop-color="#F0D384" /><stop offset=".75" stop-color="#B07D2E" /><stop offset="1" stop-color="#E6C06A" />
      </linearGradient>
      <radialGradient :id="uid + 'Pearl'" cx=".35" cy=".35" r=".7">
        <stop offset="0" stop-color="#FFFFFF" /><stop offset=".6" stop-color="#F7E2A2" /><stop offset="1" stop-color="#C8963E" />
      </radialGradient>
    </defs>

    <!-- five points, tallest in the middle -->
    <path d="M8 44 L6 16 L17 30 L28 8 L39 26 L50 2 L61 26 L72 8 L83 30 L94 16 L92 44 Z"
      :fill="`url(#${uid}Gold)`" stroke="#93652A" stroke-width="1.6" stroke-linejoin="round" />
    <path d="M12 40 L11 24 L18 33 M88 40 L89 24 L82 33" fill="none" stroke="#FFF4CF" stroke-width="1" stroke-linecap="round" opacity=".8" />

    <!-- curved band with gems -->
    <path d="M7 41 Q50 50 93 41 L93 51 Q50 60 7 51 Z" :fill="`url(#${uid}Gold)`" stroke="#93652A" stroke-width="1.6" stroke-linejoin="round" />
    <path d="M10 46 Q50 54.5 90 46" fill="none" stroke="#FFF4CF" stroke-width="2" stroke-dasharray="0 5" stroke-linecap="round" />
    <ellipse cx="28" cy="47.5" rx="3.6" ry="2.8" fill="#B9A6D9" stroke="#6A4FA0" stroke-width=".8" />
    <ellipse cx="72" cy="47.5" rx="3.6" ry="2.8" fill="#B9A6D9" stroke="#6A4FA0" stroke-width=".8" />
    <ellipse cx="50" cy="50" rx="5" ry="3.8" fill="#9CC3E0" stroke="#4F7FA8" stroke-width=".9" />
    <circle cx="48.4" cy="48.8" r="1.2" fill="#FFFFFF" />

    <!-- pearls on the tips; the middle one has a rose-pink gem -->
    <circle v-for="([x, y], i) in tips" :key="i" :cx="x" :cy="y" :r="i === 2 ? 4.2 : 3.2"
      :fill="i === 2 ? '#D9677A' : `url(#${uid}Pearl)`" :stroke="i === 2 ? '#8E2335' : '#93652A'" stroke-width=".7" />
    <circle cx="48.8" cy="0.8" r="1.2" fill="#FFFFFF" opacity=".85" />

    <!-- a glint that twinkles off the middle tip -->
    <path class="glint" d="M0 -1 L.22 -.22 L1 0 L.22 .22 L0 1 L-.22 .22 L-1 0 L-.22 -.22Z" transform="translate(62 6) scale(5)" fill="#FFF4CF" />
  </svg>
</template>

<style scoped>
.crown { filter: drop-shadow(0 1.5px 1.5px rgba(80, 50, 10, .25)); }
.glint { transform-box: fill-box; transform-origin: center; animation: glint 3.2s ease-in-out infinite; }
@keyframes glint { 0%, 60%, 100% { opacity: 0; scale: .3; } 75% { opacity: 1; scale: 1.2; } }
</style>
