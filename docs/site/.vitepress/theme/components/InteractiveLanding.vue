<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import LandingHome from './LandingHome.vue'
import McpHandoffPrompt from './McpHandoffPrompt.vue'
import RendererDemo from './RendererDemo.vue'

// Progressive enhancement: keep the existing landing/SSR preview intact, then mount
// the real renderer and canonical MCP handoff prompt into the existing visual shells.
const root = ref(null)
const stage = ref(null)
const handoffTarget = ref(null)
let fallback = []
let handoffFallback = []

onMounted(() => {
  const productTarget = root.value?.querySelector('.product-stage')
  if (productTarget) {
    fallback = [...productTarget.querySelectorAll(':scope > .app-window, :scope > .float-card')]
    for (const element of fallback) element.hidden = true
    stage.value = productTarget
  }

  const promptTarget = root.value?.querySelector('.mcp-demo .terminal > div')
  if (promptTarget) {
    handoffFallback = [...promptTarget.children]
    for (const element of handoffFallback) element.hidden = true
    handoffTarget.value = promptTarget
  }
})

onBeforeUnmount(() => {
  for (const element of fallback) element.hidden = false
  for (const element of handoffFallback) element.hidden = false
})
</script>

<template>
  <div ref="root" class="interactive-landing">
    <LandingHome />
    <Teleport v-if="stage" :to="stage"><RendererDemo /></Teleport>
    <Teleport v-if="handoffTarget" :to="handoffTarget"><McpHandoffPrompt variant="terminal" /></Teleport>
  </div>
</template>

<style scoped>
/* Existing landing CSS declares display:flex, so make native hidden authoritative. */
.interactive-landing :deep(.product-stage > [hidden]),
.interactive-landing :deep(.mcp-demo .terminal > div > [hidden]) { display: none !important; }
.interactive-landing :deep(.product-stage:has(.renderer-demo)) { perspective: none; }
</style>
