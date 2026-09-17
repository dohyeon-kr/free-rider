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
let hero = null
let heroFrame = 0
let pendingHeroPointer = null

function paintHeroLight() {
  heroFrame = 0
  if (!hero || !pendingHeroPointer) return

  const rect = hero.getBoundingClientRect()
  hero.style.setProperty('--hero-pointer-x', `${pendingHeroPointer.x - rect.left}px`)
  hero.style.setProperty('--hero-pointer-y', `${pendingHeroPointer.y - rect.top}px`)
  hero.style.setProperty('--hero-pointer-opacity', '1')
  pendingHeroPointer = null
}

function onHeroPointerMove(event) {
  pendingHeroPointer = { x: event.clientX, y: event.clientY }
  if (!heroFrame) heroFrame = window.requestAnimationFrame(paintHeroLight)
}

function onHeroPointerLeave() {
  pendingHeroPointer = null
  hero?.style.setProperty('--hero-pointer-opacity', '0')
}

function attachHeroLight() {
  hero = root.value?.querySelector('.hero') ?? null
  if (!hero || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

  hero.addEventListener('pointermove', onHeroPointerMove, { passive: true })
  hero.addEventListener('pointerleave', onHeroPointerLeave)
}

function detachHeroLight() {
  if (heroFrame) window.cancelAnimationFrame(heroFrame)
  heroFrame = 0
  pendingHeroPointer = null

  if (hero) {
    hero.removeEventListener('pointermove', onHeroPointerMove)
    hero.removeEventListener('pointerleave', onHeroPointerLeave)
    hero.style.removeProperty('--hero-pointer-x')
    hero.style.removeProperty('--hero-pointer-y')
    hero.style.removeProperty('--hero-pointer-opacity')
  }

  hero = null
}

onMounted(() => {
  attachHeroLight()

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
  detachHeroLight()
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

/* Embossed dot field + a cursor-local light, inspired by machined/perforated surfaces. */
.interactive-landing :deep(.hero) {
  --hero-pointer-x: 50%;
  --hero-pointer-y: 24%;
  --hero-pointer-opacity: 0;
  isolation: isolate;
}

.interactive-landing :deep(.hero)::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(
    360px circle at var(--hero-pointer-x) var(--hero-pointer-y),
    rgba(154, 207, 255, .18) 0%,
    rgba(100, 164, 224, .09) 34%,
    transparent 72%
  );
  opacity: var(--hero-pointer-opacity);
  mix-blend-mode: screen;
  transition: opacity 180ms ease;
}

.interactive-landing :deep(.hero-grid) {
  z-index: 0;
  opacity: .82;
  background-image:
    radial-gradient(circle at 10px 10px, rgba(255, 255, 255, .28) 0 .65px, transparent .95px),
    radial-gradient(circle at 11px 11px, rgba(126, 143, 156, .68) 0 1.05px, transparent 1.4px),
    radial-gradient(circle at 12px 12px, rgba(0, 0, 0, .88) 0 1.15px, transparent 1.6px);
  background-size: 22px 22px;
  background-position: 0 0;
  mask-image: linear-gradient(to bottom, #000 0%, #000 74%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, #000 0%, #000 74%, transparent 100%);
}

.interactive-landing :deep(.hero-grid)::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: radial-gradient(circle at 11px 11px, rgba(206, 231, 255, .96) 0 1.2px, transparent 1.65px);
  background-size: 22px 22px;
  background-position: 0 0;
  mask-image: radial-gradient(
    270px circle at var(--hero-pointer-x) var(--hero-pointer-y),
    #000 0%,
    rgba(0, 0, 0, .96) 36%,
    transparent 72%
  );
  -webkit-mask-image: radial-gradient(
    270px circle at var(--hero-pointer-x) var(--hero-pointer-y),
    #000 0%,
    rgba(0, 0, 0, .96) 36%,
    transparent 72%
  );
  filter: drop-shadow(0 0 5px rgba(142, 198, 255, .58));
  opacity: var(--hero-pointer-opacity);
  transition: opacity 180ms ease;
}

@media (prefers-reduced-motion: reduce) {
  .interactive-landing :deep(.hero)::before,
  .interactive-landing :deep(.hero-grid)::after { transition: none; }
}
</style>
