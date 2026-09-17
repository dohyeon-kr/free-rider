<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { withBase } from 'vitepress'
import { watchRailActivity } from './rail-activity.mjs'

const root = ref(null)
const active = ref(false)
const paused = ref(false)
const playing = computed(() => active.value && !paused.value)
const providers = [
  { name: 'Codex', icon: withBase('/brands/codex.svg'), className: 'is-codex' },
  { name: 'Claude Code', icon: withBase('/brands/claude.svg'), className: 'is-claude-code' },
  { name: 'Gemini CLI', icon: withBase('/brands/gemini.svg'), className: 'is-gemini' },
  { name: 'Cursor', icon: withBase('/brands/cursor.svg'), className: 'is-cursor' }
]
const carriers = Array.from({ length: 10 }, (_, index) => providers[(index - 2 + providers.length) % providers.length])
let stop = () => {}
onMounted(() => { stop = watchRailActivity(root.value, value => { active.value = value }) })
onUnmounted(() => stop())
</script>

<template>
  <figure ref="root" class="mcp-rail" :class="{ 'is-playing': playing }">
    <div class="mcp-rail-heading">
      <span>ONE WORKSPACE. ANY AGENT.</span>
      <button class="mcp-rail-toggle" type="button" :aria-pressed="paused"
        aria-label="에이전트 애니메이션 일시정지" @click="paused = !paused">
        <svg v-if="paused" viewBox="0 0 16 16" aria-hidden="true"><path d="m5 3 8 5-8 5Z" /></svg>
        <svg v-else viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zm5 0h3v10H9z" /></svg>
      </button>
    </div>
    <div class="mcp-rail-scene" aria-hidden="true">
      <div class="mcp-rail-viewport">
        <div class="mcp-rail-groove" />
        <div class="mcp-rail-socket"><span>MCP</span><i class="mcp-rail-signal" /></div>
        <div class="mcp-rail-track">
          <div v-for="(provider, index) in carriers" :key="index" class="mcp-rail-carrier">
            <i class="mcp-rail-wheel" />
            <div class="mcp-rail-tile" :class="index >= 2 && index <= 5 ? provider.className : ''">
              <img :src="provider.icon" alt="" width="30" height="30" decoding="async">
              <b>{{ provider.name }}</b>
            </div>
          </div>
        </div>
        <div class="mcp-rail-provider">
          <span v-for="provider in providers" :key="provider.name" class="mcp-rail-name" :class="provider.className">{{ provider.name }}</span>
          <span class="mcp-rail-static-name">Codex · Claude Code · Gemini CLI · Cursor</span>
          <small>via MCP</small>
        </div>
      </div>
      <div class="mcp-rail-wire"><i class="mcp-rail-signal" /></div>
      <div class="mcp-rail-rider">
        <img :src="withBase('/free-rider-app-icon.png')" alt="" width="64" height="64" decoding="async">
        <div><b>Free Rider</b><small>Your local workspace</small></div>
        <i class="mcp-rail-led mcp-rail-signal" />
      </div>
      <div class="mcp-rail-wire"><i class="mcp-rail-signal" /></div>
      <div class="mcp-rail-api"><span>{ }</span> Your API <small>200 OK</small></div>
    </div>
    <figcaption>Codex / Claude Code / Gemini CLI / Cursor → Free Rider MCP → Your API<span>연결 흐름 예시</span></figcaption>
  </figure>
</template>

<style src="./mcp-agent-rail.css" />
