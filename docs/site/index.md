---
layout: home
title: Free Rider
description: Ride on your API for Free — all-free, open-source, local-first API client for macOS
---

<script setup>
import { onMounted, ref } from 'vue'

const mounted = ref(false)
onMounted(() => {
  mounted.value = true
})
</script>

<LandingHome />

<Teleport v-if="mounted" to=".hero .actions">
  <a
    class="hero-support-button"
    href="https://fairy.hada.io/@free-rider"
    target="_blank"
    rel="noopener noreferrer"
  >
    후원하기 ↗
  </a>
</Teleport>

<style>
.hero-support-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0 18px;
  border: 1px solid rgba(215, 255, 102, .18);
  border-radius: 13px;
  color: #d7ff66 !important;
  background: rgba(215, 255, 102, .06);
  font-size: 14px;
  font-weight: 800;
  text-decoration: none !important;
  transition: .2s ease;
}

.hero-support-button:hover {
  transform: translateY(-2px);
  background: rgba(215, 255, 102, .1);
}

@media (max-width: 640px) {
  .hero .actions .ghost {
    grid-column: auto !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-support-button {
    transition: none !important;
  }
}
</style>
