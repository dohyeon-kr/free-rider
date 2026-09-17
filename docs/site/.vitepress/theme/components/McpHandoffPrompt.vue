<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useData } from 'vitepress'
import { getMcpHandoffPrompt, resolveMcpHandoffLocale } from './mcp-handoff-prompts.mjs'

const props = defineProps({
  locale: { type: String, default: '' },
  variant: { type: String, default: 'doc' }
})

const { lang } = useData()
const copied = ref(false)
let resetTimer = null

const resolvedLocale = computed(() => resolveMcpHandoffLocale(props.locale || lang.value || 'ko'))
const prompt = computed(() => getMcpHandoffPrompt(resolvedLocale.value))
const label = computed(() => resolvedLocale.value === 'en' ? 'Connection prompt' : '연결 프롬프트')
const copyLabel = computed(() => {
  if (copied.value) return resolvedLocale.value === 'en' ? 'Copied' : '복사됨'
  return resolvedLocale.value === 'en' ? 'Copy prompt' : '프롬프트 복사'
})

async function copyPrompt() {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) return
  await navigator.clipboard.writeText(prompt.value)
  copied.value = true
  if (resetTimer) clearTimeout(resetTimer)
  resetTimer = setTimeout(() => { copied.value = false }, 1400)
}

onBeforeUnmount(() => {
  if (resetTimer) clearTimeout(resetTimer)
})
</script>

<template>
  <section
    class="mcp-handoff-prompt"
    :class="`mcp-handoff-prompt--${variant}`"
    :data-locale="resolvedLocale"
  >
    <div class="handoff-toolbar">
      <span>{{ label }}</span>
      <button type="button" @click="copyPrompt">{{ copyLabel }}</button>
    </div>
    <pre><code>{{ prompt }}</code></pre>
  </section>
</template>

<style scoped>
.mcp-handoff-prompt {
  overflow: hidden;
  margin: 16px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-code-block-bg);
}
.handoff-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 42px;
  padding: 0 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 700;
}
.handoff-toolbar button {
  padding: 5px 9px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.handoff-toolbar button:hover { color: var(--vp-c-text-1); }
pre {
  max-height: 520px;
  margin: 0;
  padding: 18px;
  overflow: auto;
  background: transparent;
}
code {
  display: block;
  color: var(--vp-c-text-1);
  font: 12px/1.72 var(--vp-font-family-mono);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.mcp-handoff-prompt--terminal {
  margin: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.mcp-handoff-prompt--terminal .handoff-toolbar {
  min-height: 34px;
  padding: 0 0 10px;
  border-color: rgba(255,255,255,.08);
  color: rgba(255,255,255,.42);
  font-size: 9px;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.mcp-handoff-prompt--terminal .handoff-toolbar button {
  border-color: rgba(255,255,255,.1);
  color: rgba(255,255,255,.62);
  background: rgba(255,255,255,.05);
  text-transform: none;
  letter-spacing: 0;
}
.mcp-handoff-prompt--terminal pre {
  max-height: 360px;
  padding: 14px 3px 2px 0;
}
.mcp-handoff-prompt--terminal code {
  color: rgba(255,255,255,.68);
  font-size: 10px;
  line-height: 1.72;
}
@media (max-width: 640px) {
  .mcp-handoff-prompt--terminal pre { max-height: 330px; }
  .mcp-handoff-prompt--terminal code { font-size: 9px; }
}
</style>
