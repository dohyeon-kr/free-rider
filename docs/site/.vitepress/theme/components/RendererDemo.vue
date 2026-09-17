<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, withBase } from 'vitepress'

const { lang } = useData()
const english = computed(() => lang.value?.startsWith('en'))
const locale = computed(() => english.value ? 'en' : 'ko')
const copy = computed(() => english.value ? {
  eyebrow: 'THE REAL APP. RIGHT HERE.', title: 'Don’t just look. Send it.',
  description: 'Edit a request. Send it. See what comes back.',
  simulated: 'Sample responses', select: 'Choose a sample request',
  login: 'Login', profile: 'Profile', orders: 'Orders', reset: 'Reset demo', expand: 'Open in a new tab',
  loading: 'Loading the actual Free Rider interface…', failed: 'The demo could not load.', retry: 'Try again',
  ready: 'Start with Login. Open Body, edit the sample email, then press Send.',
  profileHint: 'The token from Login is already connected. Press Send to see your profile.',
  ordersHint: 'In Params, change limit to 1. Press Send to see the response change.',
  sending: 'Running the sample request…', loginDone: 'Token captured. Choose Profile to continue.',
  unauthorized: 'Send Login first. Its demo token will be reused by the next request.',
  success: 'Response received. Keep exploring, or edit the request and send again.',
  error: 'A simulated error response. Check the response body, edit the request, and try again.',
  cancelled: 'Request cancelled. Your edits are still here.', removed: 'A sample request was removed. Reset to restore the workspace.',
  step1: 'Choose', step2: 'Send', step3: 'Inspect',
  note: 'Real request UI · Fictional data · No external API calls',
  detail: 'Changes stay in this tab and reset when reloaded. Use sample values, never real credentials. File access, Git, MCP, and script execution require the desktop app.',
  frame: 'Interactive Free Rider sample workspace', sampleTime: 'Simulated timing',
} : {
  eyebrow: 'THE REAL APP. RIGHT HERE.', title: '보기만 하지 말고, 직접 보내보세요.',
  description: '요청을 바꾸고, 실행하고, 달라진 응답을 확인하세요.',
  simulated: '샘플 응답', select: '샘플 요청 선택',
  login: '로그인', profile: '내 프로필', orders: '주문 목록', reset: '초기화', expand: '새 탭에서 크게 보기',
  loading: '실제 Free Rider 화면을 불러오는 중입니다…', failed: '데모를 불러오지 못했습니다.', retry: '다시 시도',
  ready: '로그인부터 시작하세요. Body의 샘플 이메일을 바꾼 뒤 Send를 눌러보세요.',
  profileHint: '로그인에서 받은 토큰이 연결돼 있습니다. Send를 눌러 프로필을 확인하세요.',
  ordersHint: 'Params에서 limit을 1로 바꿔보세요. Send를 누르면 응답도 달라집니다.',
  sending: '샘플 요청을 실행하고 있습니다…', loginDone: '토큰을 저장했습니다. 내 프로필을 선택해 다음 요청으로 이어가세요.',
  unauthorized: '먼저 로그인 요청을 보내세요. 받은 데모 토큰을 다음 요청에서 재사용합니다.',
  success: '응답을 확인했습니다. 다른 요청을 선택하거나 값을 바꿔 다시 보내보세요.',
  error: '모의 오류 응답입니다. 응답 내용을 확인하고 요청을 수정해 다시 보내보세요.',
  cancelled: '요청을 취소했습니다. 입력한 내용은 그대로 남아 있습니다.', removed: '샘플 요청이 삭제됐습니다. 초기화하면 다시 체험할 수 있습니다.',
  step1: '선택', step2: '실행', step3: '응답 확인',
  note: '실제 요청 UI · 가상 데이터 · 외부 API 호출 없음',
  detail: '변경은 현재 탭에만 유지되며 새로고침하면 초기화됩니다. 실제 인증정보 대신 샘플 값을 사용하세요. 파일 접근·Git·MCP·스크립트 실행은 데스크톱 앱에서 지원합니다.',
  frame: 'Free Rider 인터랙티브 샘플 워크스페이스', sampleTime: '모의 실행 시간',
})
const scenarios = [
  { id: 'login', method: 'POST', path: '/auth/login' },
  { id: 'profile', method: 'GET', path: '/users/me' },
  { id: 'orders', method: 'GET', path: '/orders' },
]
const root = ref(null)
const frame = ref(null)
const active = ref(false)
const ready = ref(false)
const failed = ref(false)
const busy = ref(false)
const selected = ref('login')
const results = ref({})
const note = ref('')
const revision = ref(0)
const demoUrl = computed(() => `${withBase('/demo/index.html')}?lang=${locale.value}`)
const result = computed(() => results.value[selected.value])
const hint = computed(() => {
  if (failed.value) return copy.value.failed
  if (!ready.value) return copy.value.loading
  if (busy.value) return copy.value.sending
  if (note.value) return copy.value[note.value]
  if (result.value?.status === 401) return copy.value.unauthorized
  if (result.value?.status >= 400) return copy.value.error
  if (selected.value === 'login' && result.value) return copy.value.loginDone
  if (result.value) return copy.value.success
  if (selected.value === 'profile') return results.value.login?.status === 200 ? copy.value.profileHint : copy.value.unauthorized
  return selected.value === 'orders' ? copy.value.ordersHint : copy.value.ready
})
let observer
let timeout
const clearTimer = () => { if (timeout) window.clearTimeout(timeout); timeout = undefined }
function armTimeout() {
  clearTimer()
  timeout = window.setTimeout(() => { if (!ready.value) failed.value = true }, 15000)
}
function loadDemo() { active.value = true; armTimeout() }
function reset() {
  ready.value = false; failed.value = false; busy.value = false
  selected.value = 'login'; results.value = {}; note.value = ''; revision.value++
  loadDemo()
}
function select(id) {
  if (!ready.value || busy.value || !frame.value) return
  note.value = ''
  frame.value.contentWindow.postMessage({ channel: 'free-rider-demo', type: 'select', scenario: id }, window.location.origin)
}
function receive(event) {
  if (event.source !== frame.value?.contentWindow || event.origin !== window.location.origin) return
  const data = event.data
  if (!data || data.channel !== 'free-rider-demo') return
  const valid = scenarios.some(scenario => scenario.id === data.scenario)
  if (data.type === 'ready') {
    clearTimer(); ready.value = true; failed.value = false
    if (valid) selected.value = data.scenario
  } else if (data.type === 'selection') {
    if (valid) selected.value = data.scenario
    note.value = ''
  } else if (data.type === 'request-start') {
    busy.value = true; note.value = ''
  } else if (data.type === 'response') {
    busy.value = false
    if (valid && Number.isInteger(data.status) && Number.isFinite(data.elapsed) && Number.isFinite(data.bytes)) {
      results.value = { ...results.value, [data.scenario]: { status: data.status, elapsed: Math.max(0, data.elapsed), bytes: Math.max(0, data.bytes) } }
    }
  } else if (data.type === 'cancelled') {
    busy.value = false; note.value = 'cancelled'
  } else if (data.type === 'note' && data.code === 'reset-required') note.value = 'removed'
  else if (data.type === 'error') { clearTimer(); failed.value = true; busy.value = false }
}
onMounted(() => {
  window.addEventListener('message', receive)
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); loadDemo() }
    }, { rootMargin: '240px' })
    observer.observe(root.value)
  } else loadDemo()
})
watch(locale, async () => { if (active.value) { await nextTick(); reset() } })
onBeforeUnmount(() => { observer?.disconnect(); clearTimer(); window.removeEventListener('message', receive) })
</script>

<template>
  <section ref="root" class="renderer-demo" data-testid="renderer-demo" :aria-label="copy.frame">
    <header class="demo-intro">
      <div><p class="demo-eyebrow"><span />{{ copy.eyebrow }}</p><h2>{{ copy.title }}</h2><p class="demo-description">{{ copy.description }}</p></div>
      <span class="demo-badge"><i />{{ copy.simulated }}</span>
    </header>
    <div class="demo-scenarios" role="group" :aria-label="copy.select">
      <button v-for="(scenario, index) in scenarios" :key="scenario.id" type="button"
        :data-testid="`demo-scenario-${scenario.id}`" :aria-pressed="selected === scenario.id"
        :disabled="!ready || busy" @click="select(scenario.id)">
        <span class="scenario-number">0{{ index + 1 }}</span>
        <span class="scenario-label"><strong>{{ copy[scenario.id] }}</strong><code>{{ scenario.path }}</code></span>
        <span class="scenario-method" :class="scenario.method.toLowerCase()">{{ scenario.method }}</span>
      </button>
    </div>
    <div class="demo-window">
      <div class="demo-windowbar">
        <span class="demo-traffic" aria-hidden="true"><i /><i /><i /></span>
        <span class="demo-address"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="3.5" y="7" width="9" height="7" rx="2"/><path d="M5.5 7V4a2.5 2.5 0 0 1 5 0v3"/></svg>sample-workspace <span>/</span> Store API</span>
        <div class="demo-windowactions">
          <button type="button" :title="copy.reset" :aria-label="copy.reset" data-testid="demo-reset" @click="reset"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.5 6.5a6 6 0 1 1-.4 6M4.5 2.5v4h4"/></svg></button>
          <a :href="demoUrl" target="_blank" rel="noopener noreferrer" :title="copy.expand" :aria-label="copy.expand"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M11 3h6v6M17 3l-8 8M8 3H3v14h14v-5"/></svg></a>
        </div>
      </div>
      <div class="demo-viewport" :aria-busy="!ready || busy">
        <iframe v-if="active" :key="`${locale}-${revision}`" ref="frame" data-demo-frame :src="demoUrl"
          :title="copy.frame" sandbox="allow-scripts allow-same-origin" allow="clipboard-write"
          referrerpolicy="no-referrer" :class="{ 'is-ready': ready && !failed }" />
        <div v-if="!ready || failed" class="demo-loading">
          <div class="demo-skeleton" aria-hidden="true"><span /><span /><span /><span /></div>
          <p>{{ failed ? copy.failed : copy.loading }}</p>
          <button v-if="failed" type="button" @click="reset">{{ copy.retry }} <span aria-hidden="true">↻</span></button>
        </div>
      </div>
      <div class="demo-guidance">
        <ol class="demo-steps" :aria-label="copy.select"><li class="is-done"><b>01</b>{{ copy.step1 }}</li><li :class="{ 'is-done': busy || result }"><b>02</b>{{ copy.step2 }}</li><li :class="{ 'is-done': result && !busy }"><b>03</b>{{ copy.step3 }}</li></ol>
        <span v-if="result && !busy" class="demo-result" :class="{ 'has-error': result.status >= 400 }" :title="copy.sampleTime"><i />{{ result.status }}<span>· {{ result.elapsed }} ms</span></span>
        <p role="status" aria-live="polite">{{ hint }}</p>
      </div>
    </div>
    <footer class="demo-caption"><p><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.5 13 4v4c0 3-5 6.5-5 6.5S3 11 3 8V4l5-2.5Z"/><path d="m5.5 8 1.7 1.5L10.5 6"/></svg>{{ copy.note }}</p><small>{{ copy.detail }}</small></footer>
  </section>
</template>

<style scoped>
.renderer-demo { --demo-lime: #d7ff66; position: relative; width: 100%; max-width: 1120px; margin: 0 auto; padding: clamp(12px, 2vw, 24px); border-radius: 22px; background: #0d1010; text-align: left; color: #ecf0eb; font-family: var(--vp-font-family-base, sans-serif); word-break: keep-all; overflow-wrap: anywhere; isolation: isolate; }
.renderer-demo *, .renderer-demo *::before, .renderer-demo *::after { box-sizing: border-box; }
.demo-intro { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 22px; }
.demo-eyebrow { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; color: #aab2aa; font-size: 10px; line-height: 1.5; font-weight: 650; letter-spacing: .16em; }
.demo-eyebrow > span { width: 5px; height: 5px; border-radius: 50%; background: var(--demo-lime); box-shadow: 0 0 12px #d7ff6640; }
.demo-intro h2 { border: 0; padding: 0; margin: 0; color: #edf0ea; font-size: clamp(21px, 2.5vw, 30px); font-weight: 650; line-height: 1.35; letter-spacing: -.055em; text-wrap: balance; }
.demo-description { margin: 8px 0 0; font-size: 13px; line-height: 1.7; color: #9da79f; }
.demo-badge { flex-shrink: 0; display: inline-flex; align-items: center; gap: 7px; padding: 7px 11px; border: 1px solid #d7ff661f; border-radius: 999px; background: #d7ff6606; color: #c2cdaf; font-size: 11px; }
.demo-badge i { width: 5px; height: 5px; border-radius: 50%; background: #b4ca91; }
.demo-scenarios { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px; }
.demo-scenarios button { appearance: none; display: flex; align-items: center; gap: 12px; min-height: 68px; padding: 12px 15px; border: 1px solid #ffffff0d; border-radius: 12px; background: linear-gradient(130deg, #212825c9, #161c19e0); color: #b5bcb5; text-align: left; cursor: pointer; transition: border-color .18s, background .18s; }
.demo-scenarios button:hover:not(:disabled) { border-color: #d7ff6644; }
.demo-scenarios button[aria-pressed="true"] { border-color: #d7ff6659; background: linear-gradient(130deg, #d7ff6614, #161c19ed); box-shadow: inset 0 1px #eaffc10a, 0 4px 24px #0002; }
.demo-scenarios button:disabled { cursor: default; }
.scenario-number { align-self: flex-start; margin-top: 3px; color: #73816c; font: 10px/1.5 var(--vp-font-family-mono, monospace); }
.scenario-label { flex: 1; min-width: 0; }
.scenario-label strong { display: block; color: #e0e7d9; font-size: 13px; font-weight: 600; line-height: 1.5; }
.scenario-label code { display: block; margin-top: 4px; padding: 0; border: 0; background: none; color: #8c998c; font: 10px/1.5 var(--vp-font-family-mono, monospace); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.scenario-method { font: 650 9px/1.5 var(--vp-font-family-mono, monospace); color: #94c7bf; }
.scenario-method.post { color: #d3e9a3; }
.demo-window { overflow: hidden; border: 1px solid #ffffff1c; border-radius: 17px; background: #14191a; box-shadow: 0 32px 90px #0006, 0 1px 0 #ffffff08 inset; }
.demo-windowbar { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 12px; min-height: 46px; padding: 0 15px; border-bottom: 1px solid #ffffff0c; background: linear-gradient(#ffffff05, #ffffff01); }
.demo-traffic { display: flex; align-items: center; gap: 6px; }
.demo-traffic i { width: 8px; height: 8px; border-radius: 50%; background: #4b5250; box-shadow: inset 0 1px #ffffff1a; }
.demo-traffic i:nth-child(2) { background: #414947; }.demo-traffic i:nth-child(3) { background: #38413d; }
.demo-address { display: flex; align-items: center; gap: 8px; color: #adb6ae; font: 10px/1.5 var(--vp-font-family-mono, monospace); }
.demo-address > span { color: #56605a; }
.demo-address svg { width: 12px; height: 12px; stroke: #73836f; stroke-width: 1.3; }
.demo-windowactions { display: flex; justify-self: end; align-items: center; gap: 5px; }
.demo-windowactions :is(a, button) { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: #a3ada4; cursor: pointer; }
.demo-windowactions :is(a, button):hover { color: #e1f0d3; background: #ffffff08; }
.demo-windowactions svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
.renderer-demo :is(button, a):focus-visible { outline: 2px solid var(--demo-lime); outline-offset: 3px; }
.demo-viewport { position: relative; height: 600px; background: #151818; }
.demo-viewport iframe { display: block; width: 100%; height: 100%; border: 0; opacity: 0; transition: opacity .22s; }
.demo-viewport iframe.is-ready { opacity: 1; }
.demo-loading { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 24px; color: #a1ada4; font-size: 13px; text-align: center; }
.demo-loading p { margin: 0; }
.demo-loading button { border: 1px solid #d7ff6640; border-radius: 8px; padding: 9px 14px; background: #d7ff660d; color: #d7ff66; cursor: pointer; }
.demo-skeleton { width: 190px; padding: 20px; border: 1px solid #ffffff0d; border-radius: 10px; background: #ffffff02; }
.demo-skeleton span { display: block; height: 5px; margin-bottom: 13px; border-radius: 3px; background: #d7ff661c; }.demo-skeleton span:nth-child(2) { width: 75%; background: #ffffff10; }.demo-skeleton span:nth-child(3) { width: 88%; background: #ffffff10; }.demo-skeleton span:last-child { width: 50%; margin: 0; }
.demo-guidance { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 10px 16px; min-height: 100px; padding: 16px 20px 18px; border-top: 1px solid #ffffff0d; background: linear-gradient(100deg, #1b231bcc, #121817); }
.demo-steps { display: flex; align-items: center; gap: 18px; list-style: none; padding: 0; margin: 0; }
.demo-steps li { display: flex; align-items: center; gap: 7px; margin: 0; color: #7d887d; font-size: 11px; line-height: 1.5; }.demo-steps b { font: 10px/1.5 var(--vp-font-family-mono, monospace); color: #707d67; }.demo-steps .is-done { color: #d1dcc7; }.demo-steps .is-done b { color: #cee6a3; }
.demo-guidance > p { grid-column: 1 / -1; margin: 0; color: #b4c0ae; font-size: 12px; line-height: 1.7; min-height: 21px; }
.demo-result { display: flex; align-items: center; gap: 6px; color: #c7e2a0; font: 11px/1.5 var(--vp-font-family-mono, monospace); }.demo-result i { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }.demo-result > span { color: #92a18a; }.demo-result.has-error { color: #ebb18d; }
.demo-caption { display: block; padding: 17px 12px 0; text-align: center; background: transparent; border: 0; }
.demo-caption p { display: flex; align-items: center; justify-content: center; gap: 7px; margin: 0; color: #a0afa0; font-size: 11px; line-height: 1.7; }
.demo-caption svg { flex-shrink: 0; width: 13px; height: 13px; stroke: #9bad89; stroke-width: 1.2; }
.demo-caption small { display: block; max-width: 740px; margin: 6px auto 0; color: #869286; font-size: 10px; line-height: 1.8; }
@media (max-width: 640px) {
  .demo-intro { align-items: flex-start; gap: 12px; }.demo-intro h2 { font-size: 22px; }.demo-description { font-size: 12px; }.demo-badge { display: none; }
  .demo-scenarios { gap: 6px; }.demo-scenarios button { gap: 6px; padding: 11px 9px; min-height: 65px; flex-wrap: wrap; }.scenario-number { display: none; }.scenario-label strong { font-size: 12px; }.scenario-label code { font-size: 9px; }.scenario-method { font-size: 8px; }
  .demo-window { border-radius: 12px; }.demo-windowbar { grid-template-columns: 1fr auto; padding-inline: 10px; }.demo-traffic { display: none; }.demo-address { font-size: 9px; gap: 5px; }
  .demo-viewport { height: 620px; }.demo-guidance { padding: 14px 12px; gap: 10px; }.demo-steps { gap: 12px; }.demo-steps li { gap: 5px; font-size: 10px; }.demo-result { font-size: 10px; }.demo-result > span { display: none; }
  .demo-caption { padding-inline: 0; }.demo-caption p { font-size: 10px; }.demo-caption small { font-size: 10px; }
}
@media (prefers-reduced-motion: reduce) { .renderer-demo *, .renderer-demo *::before, .renderer-demo *::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; } }
</style>
