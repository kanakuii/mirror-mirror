<script setup>
// Host screens are designed at 1440×900. The room fills the window; the content is
// scaled to fit and centred, so it looks the same on a laptop or a TV.
import { onBeforeUnmount, onMounted, ref } from 'vue';
import WonderlandRoom from '../shared/WonderlandRoom.vue';

defineProps({ tone: { type: String, default: 'ivory' }, low: Boolean });
const scale = ref(1);
const fit = () => (scale.value = Math.min(innerWidth / 1440, innerHeight / 900));
onMounted(() => { fit(); addEventListener('resize', fit); });
onBeforeUnmount(() => removeEventListener('resize', fit));
</script>

<template>
  <div class="viewport" :class="tone">
    <WonderlandRoom :tone="tone" :low="low" />
    <div class="stage" :style="{ transform: `translate(-50%, -50%) scale(${scale})` }">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.viewport { position: fixed; inset: 0; overflow: hidden; }
.stage { position: absolute; left: 50%; top: 50%; width: 1440px; height: 900px; transform-origin: center; }
.night { color: var(--ivory); }
</style>
