---
layout: home
title: Free Rider
description: Ride on your API for Free — all-free, open-source, local-first API client for macOS
---

<script setup>
import { onMounted, ref } from 'vue'

const mounted = ref(false)
const copied = ref(false)
const brewInstall = `brew tap dohyeon-kr/free-rider https://github.com/dohyeon-kr/free-rider.git
brew install --cask dohyeon-kr/free-rider/free-rider`

onMounted(() => {
  mounted.value = true
})

async function copyBrewInstall() {
  try {
    await navigator.clipboard.writeText(brewInstall)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1800)
  } catch {
    copied.value = false
  }
}
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

<Teleport v-if="mounted" to=".hero .hero-meta">
  <span class="hero-brew-install" aria-label="Homebrew 설치 명령">
    <span class="hero-brew-label">Homebrew</span>
    <code>{{ brewInstall }}</code>
    <button type="button" class="hero-brew-copy" @click="copyBrewInstall" :aria-label="copied ? '복사됨' : 'Homebrew 설치 명령 복사'">
      {{ copied ? '복사됨 ✓' : '복사' }}
    </button>
  </span>
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

.hero-brew-install {
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(100%, 760px);
  margin: 18px auto 0;
  padding: 10px 10px 10px 14px;
  border: 1px solid rgba(255, 255, 255, .11);
  border-radius: 14px;
  background: rgba(12, 12, 13, .76);
  box-shadow: inset 0 1px rgba(255, 255, 255, .05), 0 14px 40px rgba(0, 0, 0, .18);
  backdrop-filter: blur(16px);
  text-align: left;
}

.hero-brew-label {
  flex: 0 0 auto;
  padding: 5px 8px;
  border-radius: 8px;
  color: #d7ff66;
  background: rgba(215, 255, 102, .08);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: .04em;
  text-transform: uppercase;
}

.hero-brew-install code {
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  color: rgba(255, 255, 255, .78);
  background: transparent;
  font-size: 12px;
  line-height: 1.65;
  white-space: pre;
}

.hero-brew-copy {
  flex: 0 0 auto;
  min-width: 70px;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, .12);
  border-radius: 10px;
  color: rgba(255, 255, 255, .86);
  background: rgba(255, 255, 255, .06);
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: .16s ease;
}

.hero-brew-copy:hover {
  border-color: rgba(215, 255, 102, .3);
  color: #d7ff66;
  background: rgba(215, 255, 102, .08);
}

@media (max-width: 760px) {
  .hero-brew-install {
    align-items: stretch;
    flex-wrap: wrap;
    gap: 8px;
    padding: 10px;
  }

  .hero-brew-install code {
    order: 3;
    flex-basis: 100%;
    padding: 2px 4px;
    font-size: 11px;
  }

  .hero-brew-copy {
    margin-left: auto;
  }
}

@media (max-width: 640px) {
  .hero .actions .ghost {
    grid-column: auto !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-support-button,
  .hero-brew-copy {
    transition: none !important;
  }
}
</style>
