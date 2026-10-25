<script setup>
// The room: striped wall, rose garland valance, harlequin floor. Tone follows the moment:
// ivory for play, rose when the Kingdom wins, night when the Mirror does.
defineProps({
  tone: { type: String, default: 'ivory' }, // 'ivory' | 'rose' | 'night'
  low: Boolean, // lower floor line (phones, gallery)
});
const floor = (w, h, sw) =>
  `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='${w}' height='${h}' fill='#FBF1D6'/>` +
      `<path d='M0 0H${w / 2}L0 ${h / 2}ZM${w} 0H${w / 2}L${w} ${h / 2}ZM0 ${h}H${w / 2}L0 ${h / 2}ZM${w} ${h}H${w / 2}L${w} ${h / 2}Z' fill='#356069'/>` +
      `<path d='M0 0L${w} ${h}M${w} 0L0 ${h}' stroke='#C8963E' stroke-width='${sw}' stroke-dasharray='5 4'/></svg>`,
  )}") 50% 0/${w}px ${h}px repeat`;
const highFloor = floor(140, 64, 1.5);
const lowFloor = floor(90, 40, 1);
</script>

<template>
  <div class="room" :class="tone">
    <div class="wall"></div>
    <div class="valance"></div>
    <div class="valance-edge"></div>
    <div class="floor" :class="{ low }">
      <div class="tiles" :style="{ background: low ? lowFloor : highFloor }"></div>
      <div class="shade"></div>
    </div>
    <div v-if="tone === 'night'" class="night-shade"></div>
  </div>
</template>

<style scoped>
.room { position: absolute; inset: 0; overflow: hidden; pointer-events: none; transition: filter .6s; }
.wall { position: absolute; inset: 0; transition: background .8s; }
.ivory .wall { background: repeating-linear-gradient(90deg, rgba(143, 181, 154, .2) 0 46px, transparent 46px 92px), #FBF1D6; }
.rose .wall { background: repeating-linear-gradient(90deg, rgba(179, 58, 76, .08) 0 46px, transparent 46px 92px), #FBEBE4; }
.night .wall { background: repeating-linear-gradient(90deg, rgba(240, 211, 132, .06) 0 46px, transparent 46px 92px), radial-gradient(ellipse 60% 70% at 50% 45%, #3f3466, #211c38 75%); }
.valance {
  position: absolute; left: 0; right: 0; top: 0; height: 40px;
  background:
    radial-gradient(circle 7px at 60px 28px, #E58C9B 85%, #B33A4C 90%, transparent 100%) 0 0/120px 40px repeat-x,
    radial-gradient(ellipse 7px 4px at 49px 31px, #8FB59A 90%, transparent 100%) 0 0/120px 40px repeat-x,
    radial-gradient(ellipse 7px 4px at 71px 31px, #8FB59A 90%, transparent 100%) 0 0/120px 40px repeat-x,
    radial-gradient(ellipse 62px 26px at 60px 0, #C8963E 96%, transparent 100%) 0 0/120px 34px repeat-x;
}
.valance-edge { position: absolute; left: 0; right: 0; top: 0; height: 8px; background: linear-gradient(#F7E2A2, #B07D2E); }
.floor { position: absolute; left: 0; right: 0; top: 66%; bottom: 0; overflow: hidden; border-top: 8px solid #C8963E; box-shadow: inset 0 3px 0 #F7E2A2; }
.floor.low { top: 80%; border-top-width: 6px; }
.tiles, .shade { position: absolute; inset: 0; }
.shade { background: linear-gradient(rgba(60, 40, 20, .32), transparent 30%, transparent 70%, rgba(60, 40, 20, .18)); }
.night-shade { position: absolute; inset: 0; background: linear-gradient(transparent 62%, rgba(20, 16, 24, .45)); }
</style>
