<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import LandingHome from './LandingHome.vue'
import RendererDemo from './RendererDemo.vue'

// Progressive enhancement: keep the existing landing/SSR preview intact, and mount
// the real renderer inside its product stage. No fork of the landing or app markup.
const root = ref(null)
const stage = ref(null)
let fallback = []
onMounted(() => {
  const target = root.value?.querySelector('.product-stage')
  if (!target) return
  fallback = [...target.querySelectorAll(':scope > .app-window, :scope > .float-card')]
  for (const element of fallback) element.hidden = true
  stage.value = target
})
onBeforeUnmount(() => { for (const element of fallback) element.hidden = false })
</script>

<template>
  <div ref="root" class="interactive-landing">
    <LandingHome />
    <Teleport v-if="stage" :to="stage"><RendererDemo /></Teleport>
  </div>
</template>

<style scoped>
/* Existing landing CSS declares display:flex, so make native hidden authoritative. */
.interactive-landing :deep(.product-stage > [hidden]) { display: none !important; }
.interactive-landing :deep(.product-stage:has(.renderer-demo)) { perspective: none; }
</style>
