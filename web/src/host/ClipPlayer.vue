<script setup>
// Plays a laugh clip: its recorded segments back to back, on a loop.
import { onBeforeUnmount, ref, watch } from 'vue';

const props = defineProps({ parts: Array, muted: Boolean, poster: String });
const video = ref(null);
let urls = [], i = 0;

function load() {
  urls.forEach(URL.revokeObjectURL);
  urls = props.parts.map((b) => URL.createObjectURL(b));
  i = 0;
  play();
}
function play() {
  const v = video.value;
  if (!v || !urls.length) return;
  v.src = urls[i];
  v.muted = props.muted;
  // Browsers may block sound before the page has been clicked; fall back to silent.
  v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
}
const next = () => { i = (i + 1) % urls.length; play(); };

watch(() => props.parts, load);
watch(video, (v) => v && load());
onBeforeUnmount(() => urls.forEach(URL.revokeObjectURL));
</script>

<template>
  <video ref="video" class="clip" playsinline :poster="poster" @ended="next"></video>
</template>

<style scoped>
.clip { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; background: var(--canvas); }
</style>
