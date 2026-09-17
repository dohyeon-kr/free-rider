<script setup>
import { onMounted, ref } from 'vue'
import { withBase } from 'vitepress'
import McpAgentRail from './McpAgentRail.vue'

const links = {
  start: withBase('/guide/getting-started'),
  openapi: withBase('/guide/openapi-sync'),
  git: withBase('/guide/git'),
  mcp: withBase('/guide/mcp'),
  github: 'https://github.com/dohyeon-kr/free-rider',
  releases: 'https://github.com/dohyeon-kr/free-rider/releases/latest'
}

const armDownload = ref(links.releases)
const intelDownload = ref(links.releases)

onMounted(async () => {
  try {
    const response = await fetch('https://api.github.com/repos/dohyeon-kr/free-rider/releases/latest')
    if (!response.ok) return
    const release = await response.json()
    const assets = Array.isArray(release.assets) ? release.assets : []
    const arm = assets.find((asset) => /mac-arm64\.dmg$/i.test(asset.name))
    const intel = assets.find((asset) => /mac-x64\.dmg$/i.test(asset.name))
    if (arm?.browser_download_url) armDownload.value = arm.browser_download_url
    if (intel?.browser_download_url) intelDownload.value = intel.browser_download_url
  } catch {
    // The release page remains the fallback when the GitHub API is unavailable.
  }
})
</script>

<template>
  <main class="landing">
    <section class="hero">
      <div class="hero-grid" aria-hidden="true" />
      <div class="orb orb-lime" aria-hidden="true" />
      <div class="orb orb-violet" aria-hidden="true" />

      <div class="shell hero-inner">
        <div class="eyebrow"><i /> All-free · Open source · Local-first</div>
        <h1>API work should live<br><span>next to your code.</span></h1>
        <p class="hero-copy">
          Free Rider는 계정, 유료 플랜, 클라우드 워크스페이스 없이 시작하는 오픈소스 API 클라이언트입니다.
          요청부터 OpenAPI, Git, MCP까지 전부 무료로 사용하세요.
        </p>

        <div class="actions">
          <a class="button primary" :href="armDownload">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.29-.07 2.19.71 2.95.77 1.13-.23 2.21-.89 3.42-.8 1.46.12 2.56.69 3.29 1.73-3.01 1.8-2.29 5.77.47 6.88-.55 1.45-1.26 2.89-2.13 4.39ZM12.03 7.25C11.88 5.1 13.63 3.33 15.64 3.16c.28 2.49-2.26 4.35-3.61 4.09Z"/></svg>
            Apple Silicon
          </a>
          <a class="button secondary" :href="intelDownload"><b>x64</b> Intel Mac</a>
          <a class="button ghost" :href="links.start">문서 보기 →</a>
        </div>
        <p class="hero-meta">No trial · No account · No feature gate · <a :href="links.github">Source on GitHub ↗</a></p>

        <div class="product-stage">
          <div class="stage-glow" aria-hidden="true" />
          <div class="app-window">
            <div class="window-bar">
              <span class="traffic"><i /><i /><i /></span>
              <b>Free Rider</b>
              <span class="local"><i /> Local workspace</span>
            </div>
            <div class="app-layout">
              <aside class="sidebar">
                <strong><span>F</span> Store API</strong>
                <small>COLLECTION</small>
                <p>⌄ Authentication</p>
                <p class="active"><em>POST</em> Login</p>
                <p><em class="get">GET</em> Profile</p>
                <p><em class="get">GET</em> Orders</p>
                <small>ENVIRONMENT</small>
                <div class="env"><i /> local</div>
              </aside>
              <div class="request-pane">
                <div class="request-bar">
                  <strong>POST</strong>
                  <code><span>&#123;&#123;</span>baseUrl<span>&#125;&#125;</span>/auth/login</code>
                  <button>Send ↵</button>
                </div>
                <nav class="tabs"><span>Params</span><span>Headers</span><span class="selected">Body</span><span>Auth</span><span>Vars</span><span>Tests</span><span>Docs</span></nav>
                <div class="code-block">
                  <p><b>1</b><code>{</code></p>
                  <p><b>2</b><code>&nbsp;&nbsp;<i>"email"</i>: <em>"dev@freerider.local"</em>,</code></p>
                  <p><b>3</b><code>&nbsp;&nbsp;<i>"password"</i>: <em>"••••••••"</em></code></p>
                  <p><b>4</b><code>}</code></p>
                </div>
                <div class="response-head"><span><b>200 OK</b> · 184 ms · 1.2 KB</span><span>Pretty · JSON</span></div>
                <div class="code-block response">
                  <p><b>1</b><code>{</code></p>
                  <p><b>2</b><code>&nbsp;&nbsp;<i>"token"</i>: <em>"eyJhbGciOi..."</em>,</code></p>
                  <p><b>3</b><code>&nbsp;&nbsp;<i>"user"</i>: { <i>"name"</i>: <em>"Dohyeon"</em> }</code></p>
                  <p><b>4</b><code>}</code></p>
                </div>
              </div>
            </div>
          </div>
          <div class="float-card float-left"><span>✓</span><div><b>Saved locally</b><small>Ready to commit</small></div></div>
          <div class="float-card float-right"><span class="violet">✦</span><div><b>No account</b><small>Just open and ride</small></div></div>
        </div>
      </div>
    </section>

    <section class="rail">
      <div class="shell rail-inner">
        <small>One client. The whole API workflow.</small>
        <div><span>REQUESTS</span><i /><span>OPENAPI</span><i /><span>GIT</span><i /><span>INTERCEPTORS</span><i /><span>MCP</span><i /><span>RUNNER</span></div>
      </div>
    </section>

    <section class="section light">
      <div class="shell">
        <header class="section-head">
          <div><small>01 · OpenAPI</small><h2>명세를 읽는 데서 끝내지 말고,<br><span>바로 작업 가능한 요청으로.</span></h2></div>
          <p>OpenAPI를 가져오면 request type, required field, request/response schema까지 보존합니다. 변경은 바로 덮어쓰지 않고 검토한 뒤 선택적으로 반영합니다.</p>
        </header>

        <div class="openapi-demo">
          <article class="glass yaml-card">
            <header><span class="file-dot" /> openapi.yaml <small>3.1.0</small></header>
            <pre><b>/users/{id}:</b>
  get:
    parameters:
      - name: id
        in: path
        <mark>required: true</mark>
    responses:
      '200':
        schema:
          $ref: '#/User'</pre>
          </article>
          <div class="transfer"><span /><i>→</i><small>Import</small></div>
          <article class="glass schema-card">
            <header><b>GET</b> /users/:id <small>OpenAPI</small></header>
            <div class="schema-row"><span>Path</span><strong>id</strong><em>required</em></div>
            <div class="schema-box"><p><span>Response · 200</span><strong>User</strong></p><code>id&nbsp;&nbsp;&nbsp;&nbsp; string</code><code>name&nbsp;&nbsp; string</code><code>email&nbsp; string</code></div>
            <footer><span>✓</span> Schema metadata preserved</footer>
          </article>
        </div>
        <a class="text-link" :href="links.openapi">OpenAPI 동기화 살펴보기 →</a>
      </div>
    </section>

    <section class="section dark">
      <div class="shell">
        <header class="section-head on-dark">
          <div><small>02 · Git-native</small><h2>Your API collections<br><span>are just files.</span></h2></div>
          <p>컬렉션은 로컬 파일로 저장됩니다. 공유할 설정과 로컬 비밀값을 분리하고, 바뀐 내용만 diff로 확인해 그대로 커밋하세요.</p>
        </header>

        <div class="git-demo">
          <article class="diff-card">
            <header><span>request.json</span><small>2 changes</small></header>
            <p><b>12</b><code>"query": {</code></p>
            <p class="minus"><b>13</b><code>- &nbsp;"limit": 10,</code></p>
            <p class="plus"><b>13</b><code>+ &nbsp;"limit": 50,</code></p>
            <p><b>14</b><code>&nbsp;&nbsp;&nbsp;"sort": "recent"</code></p>
            <p><b>15</b><code>}</code></p>
            <footer><span><i /> collections/users</span><button>Commit changes</button></footer>
          </article>
          <div class="git-features">
            <article><span>⌘</span><div><b>Review before commit</b><small>See exactly what changed.</small></div></article>
            <article><span>⌁</span><div><b>Local secrets stay local</b><small>Share collections, not credentials.</small></div></article>
            <article><span>↗</span><div><b>Works with your Git</b><small>No proprietary sync layer.</small></div></article>
          </div>
        </div>
        <a class="text-link on-dark-link" :href="links.git">Git 연동 살펴보기 →</a>
      </div>
    </section>

    <section class="section lavender">
      <div class="shell">
        <header class="section-head">
          <div><small>03 · MCP</small><h2>AI에게 API를 설명하지 말고,<br><span>실제로 실행하게.</span></h2></div>
          <p>MCP를 통해 AI 에이전트가 Free Rider의 저장된 요청과 컬렉션을 사용할 수 있습니다. 사람이 만든 API 작업 공간을 그대로 에이전트에게 넘겨주세요.</p>
        </header>

        <div class="mcp-demo">
          <McpAgentRail />
          <article class="terminal">
            <header><span class="traffic"><i /><i /><i /></span><b>MCP handoff</b><small>connected</small></header>
            <div>
              <p><span>›</span> Run the login request and inspect the response</p>
              <p class="success"><span>✓</span> POST /auth/login <b>200 OK</b></p>
              <p><span>›</span> Save the token as <em>&#123;&#123;authToken&#125;&#125;</em></p>
              <p class="success"><span>✓</span> Runtime variable created</p>
              <p><span>›</span> Call my profile with that token</p>
              <p class="success"><span>✓</span> GET /users/me <b>200 OK</b><i class="cursor" /></p>
            </div>
          </article>
        </div>
        <a class="text-link" :href="links.mcp">MCP 연결하기 →</a>
      </div>
    </section>

    <section class="section features">
      <div class="shell">
        <header class="feature-head"><small>Everything included</small><h2>작은 기능까지도<br><span>유료 벽 뒤에 두지 않습니다.</span></h2><p>Free Rider의 기능은 전부 무료이며, 소스도 공개합니다.</p></header>
        <div class="bento">
          <article class="bento-card wide"><span class="soft-icon">↺</span><h3>Request History</h3><p>저장하지 않고 실행한 요청도 다시 열고 컬렉션으로 보낼 수 있습니다.</p><div class="history"><p><b>GET</b><span>/products</span><small>200 · 124ms</small></p><p><b class="post">POST</b><span>/orders</span><small>201 · 203ms</small></p><p><b>GET</b><span>/users/me</span><small>200 · 89ms</small></p></div></article>
          <article class="bento-card"><span class="soft-icon">◎</span><h3>Cookie Jar</h3><p>Set-Cookie를 다음 요청에 자동으로 이어갑니다.</p><div class="cookie"><b>session</b><span>••••••••••</span><em>Secure</em></div></article>
          <article class="bento-card"><span class="soft-icon">⚡</span><h3>Interceptors</h3><p>컬렉션별 전후처리를 한 곳에서 관리합니다.</p><div class="flow"><span>req</span><i>→</i><b>auth</b><i>→</i><b>log</b><i>→</i><span>res</span></div></article>
          <article class="bento-card"><span class="soft-icon">▶</span><h3>Collection Runner</h3><p>여러 요청을 순서대로 실행하고 결과를 한눈에 봅니다.</p><div class="runner"><i class="done" /><i class="done" /><i class="now" /><i /><small>3 / 4</small></div></article>
          <article class="bento-card wide"><span class="soft-icon">{ }</span><h3>Vars & Environments</h3><p>환경값, 요청별 Vars, 실행 중 캡처 값을 계층적으로 조합합니다.</p><div class="vars"><code><b>baseUrl</b> https://api.local</code><code><b>authToken</b> ••••••••••••</code><code><b>userId</b> usr_9f82a</code></div></article>
        </div>
      </div>
    </section>

    <section class="open-source">
      <div class="shell open-source-inner">
        <div class="os-mark"><span>F</span></div>
        <small>Why “Free Rider”?</small>
        <h2>All free.<br><span>Open source.</span></h2>
        <p>무료 플랜이 있는 제품이 아니라, 제품 전체를 무료로 공개합니다.<br>계정 없이 시작하고, 데이터는 내 컴퓨터에 두고, 필요하면 소스까지 직접 바꾸세요.</p>
        <div class="pills"><span>✓ All features free</span><span>✓ Open source</span><span>✓ Local-first</span><span>✓ No account</span></div>
        <div class="actions center"><a class="button primary" :href="links.github">View source on GitHub ↗</a><a class="button light-button" :href="links.start">Get started</a></div>
      </div>
    </section>

    <section class="final-section">
      <div class="shell">
        <div class="final-card">
          <div class="final-glow" aria-hidden="true" />
          <small>Ride free.</small>
          <h2>Your APIs.<br>Your files. <span>Your rules.</span></h2>
          <p>Free Rider를 내려받고 첫 요청을 보내보세요.</p>
          <div class="actions center"><a class="button primary" :href="armDownload">Apple Silicon</a><a class="button secondary" :href="intelDownload">Intel Mac</a><a class="button ghost" :href="links.releases">All releases ↗</a></div>
        </div>
      </div>
    </section>
  </main>
</template>

<style>
.VPHome { padding-bottom: 0 !important; }
.VPHome .vp-doc.container { max-width: none !important; padding: 0 !important; margin: 0 !important; }
.VPHome .VPHomeContent { padding: 0 !important; }
</style>

<style scoped>
.landing { --lime:#d7ff66; --violet:#9177ff; --ink:#101214; --muted:#6d7276; overflow:hidden; color:var(--ink); background:#f7f7f3; }
.shell { width:min(1180px, calc(100% - 48px)); margin:0 auto; }
.hero { position:relative; min-height:920px; padding:116px 0 92px; overflow:hidden; color:white; background:#0d0f10; }
.hero-grid { position:absolute; inset:0; opacity:.18; background-image:linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px); background-size:72px 72px; mask-image:linear-gradient(#000,transparent 78%); }
.orb { position:absolute; width:650px; height:650px; border-radius:50%; filter:blur(100px); opacity:.22; pointer-events:none; animation:drift 12s ease-in-out infinite alternate; }
.orb-lime { top:-320px; left:-190px; background:var(--lime); }
.orb-violet { top:-330px; right:-170px; background:linear-gradient(135deg,var(--violet),#71b8ff); animation-delay:-5s; }
.hero-inner { position:relative; z-index:1; text-align:center; }
.eyebrow { display:inline-flex; align-items:center; gap:9px; padding:8px 13px; border:1px solid rgba(255,255,255,.1); border-radius:999px; color:rgba(255,255,255,.68); background:rgba(255,255,255,.05); box-shadow:inset 0 1px rgba(255,255,255,.08); backdrop-filter:blur(14px); font-size:11px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
.eyebrow i { width:7px; height:7px; border-radius:50%; background:var(--lime); box-shadow:0 0 18px rgba(215,255,102,.6); }
.hero h1 { max-width:940px; margin:30px auto 0; color:#fff; font-size:clamp(54px,7vw,96px); line-height:.94; letter-spacing:-.07em; font-weight:800; }
.hero h1 span { color:transparent; background:linear-gradient(90deg,#fff,#cfc7ff 48%,var(--lime)); background-clip:text; -webkit-background-clip:text; }
.hero-copy { max-width:720px; margin:28px auto 0; color:rgba(255,255,255,.6); font-size:18px; line-height:1.72; letter-spacing:-.015em; }
.actions { display:flex; justify-content:center; flex-wrap:wrap; gap:10px; margin-top:34px; }
.button { display:inline-flex; align-items:center; justify-content:center; gap:9px; min-height:48px; padding:0 18px; border:1px solid transparent; border-radius:13px; font-size:14px; font-weight:800; text-decoration:none!important; transition:.2s ease; }
.button:hover { transform:translateY(-2px); }
.button svg { width:17px; fill:currentColor; }
.primary { color:#11140f!important; background:linear-gradient(#e7ffa1,var(--lime)); box-shadow:inset 0 1px #fff,0 12px 32px rgba(199,238,72,.17); }
.secondary { color:#f7f7f4!important; border-color:rgba(255,255,255,.12); background:linear-gradient(rgba(255,255,255,.1),rgba(255,255,255,.05)); box-shadow:inset 0 1px rgba(255,255,255,.08); }
.secondary b { padding:2px 5px; border-radius:5px; background:rgba(255,255,255,.08); font-size:10px; }
.ghost { color:rgba(255,255,255,.65)!important; }
.light-button { color:#343833!important; border-color:#dddfd7; background:linear-gradient(#fff,#eceee8); box-shadow:inset 0 1px #fff,0 10px 24px rgba(60,65,55,.08); }
.hero-meta { margin:16px 0 0; color:rgba(255,255,255,.34); font-size:12px; }
.hero-meta a { color:rgba(255,255,255,.56); text-decoration:none; }
.product-stage { position:relative; width:min(1050px,100%); margin:70px auto 0; perspective:1500px; }
.stage-glow { position:absolute; inset:12% 8% -12%; border-radius:80px; background:radial-gradient(circle at 35% 75%,rgba(145,119,255,.3),transparent 52%),radial-gradient(circle at 75% 15%,rgba(215,255,102,.18),transparent 42%); filter:blur(35px); }
.app-window { position:relative; overflow:hidden; border:1px solid rgba(255,255,255,.12); border-radius:22px; text-align:left; background:#17191b; box-shadow:0 70px 140px rgba(0,0,0,.55),inset 0 1px rgba(255,255,255,.06); transform:rotateX(2deg); }
.window-bar { height:44px; display:grid; grid-template-columns:1fr auto 1fr; align-items:center; padding:0 14px; border-bottom:1px solid rgba(255,255,255,.07); color:rgba(255,255,255,.42); font-size:10px; }
.window-bar>b { color:rgba(255,255,255,.7); font-size:11px; }
.traffic { display:flex; gap:6px; }
.traffic i { width:8px; height:8px; border-radius:50%; background:#3c4044; }
.local { justify-self:end; display:flex; align-items:center; gap:6px; }
.local i { width:6px; height:6px; border-radius:50%; background:var(--lime); box-shadow:0 0 12px rgba(215,255,102,.6); }
.app-layout { display:grid; grid-template-columns:210px 1fr; min-height:500px; }
.sidebar { padding:18px 12px; border-right:1px solid rgba(255,255,255,.065); background:#141618; }
.sidebar strong { display:flex; align-items:center; gap:9px; margin-bottom:24px; color:rgba(255,255,255,.8); font-size:12px; }
.sidebar strong span { display:grid; place-items:center; width:24px; height:24px; border-radius:7px; color:#171a14; background:var(--lime); font-weight:900; }
.sidebar>small { display:block; margin:22px 7px 8px; color:rgba(255,255,255,.24); font-size:9px; font-weight:900; letter-spacing:.11em; }
.sidebar p { display:flex; align-items:center; gap:8px; min-height:30px; margin:0; padding:0 7px; border-radius:7px; color:rgba(255,255,255,.46); font-size:10px; }
.sidebar p.active { color:#fff; background:rgba(255,255,255,.065); }
.sidebar em { min-width:31px; color:var(--lime); font-size:8px; font-style:normal; font-weight:900; }
.sidebar em.get { color:#76c5ff; }
.env { display:inline-flex; align-items:center; gap:7px; margin-left:7px; padding:6px 9px; border:1px solid rgba(255,255,255,.06); border-radius:8px; color:rgba(255,255,255,.56); font-size:10px; }
.env i { width:6px; height:6px; border-radius:50%; background:#67df93; }
.request-pane { min-width:0; padding:18px 20px 20px; }
.request-bar { display:grid; grid-template-columns:auto 1fr auto; align-items:center; overflow:hidden; height:42px; border:1px solid rgba(255,255,255,.09); border-radius:9px; background:#111315; }
.request-bar>strong { padding:0 12px; color:var(--lime); font-size:10px; }
.request-bar code { min-width:0; color:rgba(255,255,255,.7); font:11px var(--vp-font-family-mono); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.request-bar code span { color:#9c8cff; }
.request-bar button { align-self:stretch; padding:0 15px; border:0; color:#171a14; background:var(--lime); font-size:10px; font-weight:900; }
.tabs { display:flex; gap:22px; height:42px; align-items:end; border-bottom:1px solid rgba(255,255,255,.07); color:rgba(255,255,255,.32); font-size:10px; }
.tabs span { height:30px; }
.tabs .selected { color:rgba(255,255,255,.78); border-bottom:2px solid var(--lime); }
.code-block { margin-top:12px; padding:12px 0; border:1px solid rgba(255,255,255,.055); border-radius:9px; background:#121416; font:10px/1.7 var(--vp-font-family-mono); }
.code-block p { display:grid; grid-template-columns:34px 1fr; margin:0; }
.code-block p>b { padding-right:10px; color:rgba(255,255,255,.18); text-align:right; font-weight:500; }
.code-block code { color:rgba(255,255,255,.55); }
.code-block code i { color:#9bcdf1; font-style:normal; }
.code-block code em { color:#d4c7ff; font-style:normal; }
.response-head { display:flex; justify-content:space-between; margin-top:14px; color:rgba(255,255,255,.27); font-size:9px; }
.response-head b { color:#7ce2a1; }
.response { min-height:108px; }
.float-card { position:absolute; display:flex; align-items:center; gap:10px; padding:11px 14px; border:1px solid rgba(255,255,255,.13); border-radius:13px; text-align:left; background:rgba(35,38,40,.72); box-shadow:0 18px 45px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.08); backdrop-filter:blur(16px); animation:float 5s ease-in-out infinite; }
.float-left { left:-38px; bottom:72px; }
.float-right { right:-30px; top:95px; animation-delay:-2.3s; }
.float-card>span { display:grid; place-items:center; width:30px; height:30px; border-radius:9px; color:#182015; background:var(--lime); font-weight:900; }
.float-card>span.violet { color:#fff; background:linear-gradient(135deg,var(--violet),#6eaffc); }
.float-card b,.float-card small { display:block; }
.float-card b { color:rgba(255,255,255,.82); font-size:10px; }
.float-card small { margin-top:2px; color:rgba(255,255,255,.38); font-size:9px; }
.rail { padding:26px 0; border-bottom:1px solid rgba(20,22,22,.08); background:#f0f2ed; }
.rail-inner { display:flex; align-items:center; justify-content:space-between; gap:28px; }
.rail small { color:#878a85; font-size:10px; font-weight:750; }
.rail-inner>div { display:flex; align-items:center; gap:15px; color:#858883; font-size:9px; font-weight:900; letter-spacing:.08em; }
.rail-inner i { width:3px; height:3px; border-radius:50%; background:#b6b9b2; }
.section { padding:126px 0; }
.light { background:#f7f7f3; }
.dark { color:white; background:#101214; }
.lavender { background:radial-gradient(circle at 82% 18%,rgba(145,119,255,.18),transparent 34%),#f2f1f7; }
.features { background:#eceee8; }
.section-head { display:grid; grid-template-columns:1.3fr .7fr; gap:88px; align-items:end; }
.section-head small,.feature-head small,.open-source>div>small,.final-card>small { color:#6d725e; font-size:11px; font-weight:900; letter-spacing:.09em; text-transform:uppercase; }
.section-head h2,.feature-head h2,.open-source h2,.final-card h2 { margin:14px 0 0; color:var(--ink); font-size:clamp(42px,5.3vw,70px); line-height:1; letter-spacing:-.055em; font-weight:800; }
.section-head h2 span,.feature-head h2 span { color:#7a7e82; }
.section-head>p { margin:0 0 4px; color:#6d7176; font-size:15px; line-height:1.72; }
.on-dark small { color:var(--lime); }
.on-dark h2 { color:white; }
.on-dark h2 span { color:rgba(255,255,255,.42); }
.on-dark>p { color:rgba(255,255,255,.47); }
.openapi-demo { display:grid; grid-template-columns:1fr 120px 1fr; align-items:center; margin-top:62px; }
.glass { overflow:hidden; min-height:385px; border:1px solid rgba(20,22,24,.09); border-radius:24px; background:rgba(255,255,255,.63); box-shadow:inset 0 1px #fff,0 28px 80px rgba(50,49,42,.08); backdrop-filter:blur(20px); }
.glass header { display:flex; align-items:center; gap:9px; height:52px; padding:0 18px; border-bottom:1px solid rgba(20,22,24,.075); color:#555a60; font-size:11px; font-weight:800; }
.glass header small { margin-left:auto; color:#9b9d9f; }
.file-dot { width:8px; height:8px; border-radius:2px; background:var(--violet); box-shadow:0 0 0 3px rgba(145,119,255,.12); }
.yaml-card pre { margin:0; padding:28px 30px; color:#656b70; background:transparent; font:12px/1.8 var(--vp-font-family-mono); }
.yaml-card pre b { color:#7162c6; }
.yaml-card mark { padding:2px 4px; border-radius:4px; color:#4d582d; background:rgba(215,255,102,.55); }
.transfer { position:relative; display:flex; justify-content:center; align-items:center; height:80px; color:#737875; }
.transfer>span { position:absolute; left:25px; width:8px; height:8px; border-radius:50%; background:var(--violet); box-shadow:0 0 0 6px rgba(145,119,255,.11); animation:transfer 2.8s ease-in-out infinite; }
.transfer::after { content:""; width:62px; height:1px; background:linear-gradient(90deg,#c4c5c1,#8c80d7); }
.transfer>i { margin-left:-2px; font-size:18px; font-style:normal; }
.transfer small { position:absolute; top:56px; font-size:9px; font-weight:900; text-transform:uppercase; }
.schema-card header>b { color:#4b83b4; font-size:9px; }
.schema-row { display:grid; grid-template-columns:70px 1fr auto; align-items:center; margin:22px 22px 0; padding:14px; border:1px solid #e3e3df; border-radius:12px; color:#898c8c; background:rgba(255,255,255,.55); font-size:11px; }
.schema-row strong { color:#303438; }
.schema-row em { padding:3px 7px; border-radius:999px; color:#645a32; background:#eef7cd; font-size:9px; font-style:normal; font-weight:800; }
.schema-box { margin:12px 22px 0; padding:15px; border:1px solid #e3e3df; border-radius:12px; background:rgba(255,255,255,.55); }
.schema-box p { display:flex; justify-content:space-between; margin:0 0 12px; color:#7d8081; font-size:10px; }
.schema-box code { display:block; color:#787c7d; font:10px/1.8 var(--vp-font-family-mono); }
.schema-card footer { display:flex; align-items:center; gap:8px; margin:16px 22px 0; color:#737773; font-size:10px; }
.schema-card footer span { display:grid; place-items:center; width:20px; height:20px; border-radius:6px; color:#34401e; background:var(--lime); font-weight:900; }
.text-link { display:inline-flex; margin-top:32px; color:#303438!important; font-size:13px; font-weight:800; text-decoration:none!important; }
.on-dark-link { color:rgba(255,255,255,.8)!important; }
.git-demo { display:grid; grid-template-columns:1.2fr .8fr; gap:26px; margin-top:62px; }
.diff-card { overflow:hidden; border:1px solid rgba(255,255,255,.09); border-radius:23px; background:#17191b; box-shadow:0 30px 80px rgba(0,0,0,.27),inset 0 1px rgba(255,255,255,.04); }
.diff-card header { display:flex; justify-content:space-between; align-items:center; height:52px; padding:0 18px; border-bottom:1px solid rgba(255,255,255,.07); color:rgba(255,255,255,.6); font-size:11px; }
.diff-card header small { color:rgba(255,255,255,.27); }
.diff-card>p { display:grid; grid-template-columns:44px 1fr; min-height:38px; align-items:center; margin:0; font:11px var(--vp-font-family-mono); }
.diff-card>p>b { padding-right:13px; color:rgba(255,255,255,.18); text-align:right; font-weight:500; }
.diff-card code { color:rgba(255,255,255,.58); }
.diff-card p.minus { background:rgba(255,91,91,.09); }
.diff-card p.minus code { color:#ef9f9f; }
.diff-card p.plus { background:rgba(127,226,158,.09); }
.diff-card p.plus code { color:#a4e9ba; }
.diff-card footer { display:flex; justify-content:space-between; align-items:center; margin-top:42px; padding:14px 16px; border-top:1px solid rgba(255,255,255,.07); color:rgba(255,255,255,.36); font-size:10px; }
.diff-card footer span { display:flex; align-items:center; gap:7px; }
.diff-card footer i { width:6px; height:6px; border-radius:50%; background:var(--lime); }
.diff-card footer button { padding:8px 11px; border:0; border-radius:8px; color:#141613; background:var(--lime); font-size:9px; font-weight:900; }
.git-features { display:grid; gap:12px; }
.git-features article { display:flex; align-items:center; gap:16px; padding:19px; border:1px solid rgba(255,255,255,.075); border-radius:18px; background:linear-gradient(145deg,#1b1d1f,#141618); box-shadow:inset 0 1px rgba(255,255,255,.04),0 16px 38px rgba(0,0,0,.13); }
.git-features article>span { display:grid; place-items:center; flex:0 0 44px; width:44px; height:44px; border:1px solid rgba(255,255,255,.07); border-radius:13px; color:var(--lime); background:linear-gradient(145deg,#232628,#141618); box-shadow:6px 6px 14px rgba(0,0,0,.25),-3px -3px 10px rgba(255,255,255,.025); font-size:18px; }
.git-features b,.git-features small { display:block; }
.git-features b { color:rgba(255,255,255,.75); font-size:12px; }
.git-features small { margin-top:3px; color:rgba(255,255,255,.33); font-size:10px; }
.mcp-demo { display:grid; grid-template-columns:290px 1fr; gap:65px; align-items:center; margin-top:62px; }
.agent-flow { display:grid; justify-items:center; }
.agent-flow article { display:flex; align-items:center; gap:12px; width:220px; padding:15px; border:1px solid rgba(45,42,68,.09); border-radius:17px; background:rgba(255,255,255,.72); box-shadow:inset 0 1px #fff,0 14px 38px rgba(66,57,110,.09); }
.agent-flow article>span { display:grid; place-items:center; width:42px; height:42px; border-radius:12px; color:#fff; background:linear-gradient(135deg,#8975ff,#6bb5ff); font-size:11px; font-weight:900; }
.agent-flow article>span.rider { color:#1b2017; background:var(--lime); }
.agent-flow b,.agent-flow small { display:block; }
.agent-flow b { color:#303238; font-size:12px; }
.agent-flow small { color:#929399; font-size:9px; }
.agent-flow .dots { padding:8px 0; color:#a9a3c8; font-size:8px; font-style:normal; letter-spacing:3px; writing-mode:vertical-rl; }
.agent-flow>strong { padding:10px 16px; border-radius:999px; color:#62636a; background:rgba(255,255,255,.58); box-shadow:inset 0 1px #fff; font-size:10px; }
.terminal { overflow:hidden; border:1px solid rgba(35,33,50,.16); border-radius:23px; background:#17171c; box-shadow:0 35px 90px rgba(62,49,118,.22),inset 0 1px rgba(255,255,255,.07); }
.terminal header { display:grid; grid-template-columns:1fr auto 1fr; align-items:center; height:46px; padding:0 15px; border-bottom:1px solid rgba(255,255,255,.07); color:rgba(255,255,255,.43); font-size:10px; }
.terminal header>b { color:rgba(255,255,255,.68); }
.terminal header>small { justify-self:end; color:#8adb9f; }
.terminal>div { min-height:320px; padding:31px; font:11px/1.8 var(--vp-font-family-mono); }
.terminal p { margin:0 0 16px; color:rgba(255,255,255,.65); }
.terminal p>span { display:inline-block; width:18px; color:#8f7cff; }
.terminal p em { color:#c7b8ff; font-style:normal; }
.terminal p.success { margin-top:-10px; color:rgba(255,255,255,.38); }
.terminal p.success>span { color:var(--lime); }
.terminal p.success b { margin-left:8px; color:#82d99b; font-size:9px; }
.cursor { display:inline-block; width:6px; height:12px; margin-left:7px; vertical-align:-2px; background:var(--lime); animation:blink 1.1s steps(1) infinite; }
.feature-head { max-width:760px; }
.feature-head p { color:#747873; font-size:15px; }
.bento { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:54px; }
.bento-card { position:relative; overflow:hidden; min-height:270px; padding:25px; border:1px solid rgba(22,24,22,.08); border-radius:22px; background:rgba(255,255,255,.58); box-shadow:inset 0 1px rgba(255,255,255,.9),0 18px 50px rgba(45,48,40,.05); }
.bento-card.wide { grid-column:span 2; }
.soft-icon { display:grid; place-items:center; width:38px; height:38px; border:1px solid #e2e4dd; border-radius:11px; color:#5c6253; background:linear-gradient(145deg,#fff,#eceee8); box-shadow:5px 5px 12px rgba(77,82,67,.09),-3px -3px 8px #fff; font-size:12px; font-weight:900; }
.bento-card h3 { margin:17px 0 6px; color:#222522; font-size:17px; letter-spacing:-.03em; }
.bento-card>p { max-width:390px; margin:0; color:#7b7f78; font-size:12px; line-height:1.6; }
.history { position:absolute; right:24px; bottom:24px; width:50%; overflow:hidden; border:1px solid #e2e4de; border-radius:14px; background:rgba(248,249,246,.86); }
.history p { display:grid; grid-template-columns:44px 1fr auto; align-items:center; min-height:42px; margin:0; padding:0 12px; border-bottom:1px solid #e7e8e3; font-size:9px; }
.history p:last-child { border:0; }
.history b { color:#60a2cf; font-size:8px; }
.history b.post { color:#7f9a34; }
.history span { color:#5b605b; }
.history small { color:#a0a39d; }
.cookie { position:absolute; right:22px; bottom:22px; left:22px; display:grid; grid-template-columns:auto 1fr auto; gap:10px; padding:12px; border:1px solid #e1e3dc; border-radius:12px; color:#92958f; background:#f9faf7; font:9px var(--vp-font-family-mono); }
.cookie b { color:#5d625b; }
.cookie em { padding:3px 6px; border-radius:5px; color:#5f7241; background:#edf6d4; font-style:normal; font-size:8px; }
.flow { position:absolute; right:20px; bottom:27px; left:20px; display:flex; align-items:center; justify-content:space-between; color:#989b95; font-size:9px; }
.flow b,.flow span { padding:8px; border:1px solid #e1e3dd; border-radius:9px; background:#fafbf8; }
.flow b { color:#5d6847; box-shadow:inset 0 -2px #dff09f; }
.runner { position:absolute; right:25px; bottom:35px; left:25px; display:flex; align-items:center; }
.runner::before { content:""; position:absolute; right:45px; left:0; height:2px; background:#dfe1da; }
.runner i { position:relative; z-index:1; width:14px; height:14px; margin-right:26px; border:3px solid #f4f5f1; border-radius:50%; background:#ccd0c6; box-shadow:0 0 0 1px #d6d8d2; }
.runner i.done { background:#c8ef58; }
.runner i.now { background:#8d7aff; box-shadow:0 0 0 5px rgba(141,122,255,.11); }
.runner small { margin-left:auto; color:#8d908a; }
.vars { position:absolute; right:24px; bottom:24px; width:48%; padding:12px 0; border:1px solid #e2e4de; border-radius:13px; background:#f9faf7; }
.vars code { display:grid; grid-template-columns:90px 1fr; padding:7px 13px; color:#858983; font:9px var(--vp-font-family-mono); }
.vars b { color:#686d66; }
.open-source { position:relative; padding:136px 0; overflow:hidden; text-align:center; background:#f8f8f4; }
.open-source::before { content:""; position:absolute; width:720px; height:720px; top:-450px; left:calc(50% - 360px); border-radius:50%; background:radial-gradient(circle,rgba(215,255,102,.44),rgba(145,119,255,.12) 43%,transparent 70%); filter:blur(15px); }
.open-source-inner { position:relative; z-index:1; }
.os-mark { display:grid; place-items:center; width:76px; height:76px; margin:0 auto 27px; border:1px solid rgba(43,47,40,.08); border-radius:24px; background:linear-gradient(145deg,#f9f9f4,#e4e8da); box-shadow:14px 14px 30px rgba(82,89,65,.12),-14px -14px 30px #fff,inset 0 1px #fff; transform:rotate(-4deg); }
.os-mark span { display:grid; place-items:center; width:48px; height:48px; border-radius:15px; color:#181b15; background:var(--lime); font-size:24px; font-weight:950; }
.open-source h2 { font-size:clamp(58px,8vw,106px); }
.open-source h2 span { color:#8276cf; }
.open-source p { margin:28px auto 0; color:#6c706b; font-size:16px; line-height:1.75; }
.pills { display:flex; justify-content:center; flex-wrap:wrap; gap:8px; margin-top:28px; }
.pills span { padding:8px 11px; border:1px solid #e2e4dc; border-radius:999px; color:#6a6e66; background:rgba(255,255,255,.62); box-shadow:inset 0 1px #fff; font-size:10px; font-weight:800; }
.center { justify-content:center; }
.final-section { padding:24px 0 80px; background:#f8f8f4; }
.final-card { position:relative; overflow:hidden; padding:100px 28px; border-radius:30px; text-align:center; color:white; background:#101214; box-shadow:0 30px 80px rgba(31,33,30,.16); }
.final-card>small { position:relative; z-index:1; color:var(--lime); }
.final-card h2 { position:relative; z-index:1; color:white; font-size:clamp(52px,7vw,92px); }
.final-card h2 span { color:#b5a9ff; }
.final-card p { position:relative; z-index:1; color:rgba(255,255,255,.45); }
.final-card .actions { position:relative; z-index:1; }
.final-glow { position:absolute; width:650px; height:650px; top:-450px; left:calc(50% - 325px); border-radius:50%; background:conic-gradient(from 180deg,rgba(215,255,102,.7),rgba(145,119,255,.62),rgba(94,177,255,.55),rgba(215,255,102,.7)); filter:blur(80px); opacity:.45; }
@keyframes drift { to { transform:translate3d(50px,32px,0) scale(1.08); } }
@keyframes float { 50% { transform:translateY(-8px); } }
@keyframes transfer { 0%,15% { transform:translateX(0); opacity:0; } 28%,70% { opacity:1; } 90%,100% { transform:translateX(62px); opacity:0; } }
@keyframes blink { 50% { opacity:0; } }
@media (max-width:900px) {
  .shell { width:min(100% - 32px,720px); }
  .hero { min-height:auto; padding-top:94px; }
  .app-layout { grid-template-columns:150px 1fr; }
  .float-card { display:none; }
  .rail-inner { display:block; }
  .rail-inner>div { margin-top:12px; overflow-x:auto; padding-bottom:4px; }
  .section { padding:96px 0; }
  .section-head { grid-template-columns:1fr; gap:24px; }
  .openapi-demo { grid-template-columns:1fr; gap:18px; }
  .transfer { height:65px; transform:rotate(90deg); }
  .git-demo,.mcp-demo { grid-template-columns:1fr; }
  .agent-flow { grid-template-columns:1fr auto 1fr auto 1fr; align-items:center; }
  .agent-flow article { width:170px; }
  .agent-flow .dots { writing-mode:initial; padding:0 8px; }
  .bento { grid-template-columns:1fr 1fr; }
  .bento-card.wide { grid-column:span 2; }
}
@media (max-width:640px) {
  .shell { width:min(100% - 24px,540px); }
  .hero { padding:82px 0 68px; }
  .hero h1 { font-size:48px; }
  .hero-copy { font-size:14px; }
  .actions { display:grid; grid-template-columns:1fr 1fr; }
  .actions .ghost { grid-column:1/-1; }
  .hero-meta { line-height:1.7; }
  .product-stage { margin-top:46px; }
  .app-layout { grid-template-columns:1fr; min-height:430px; }
  .sidebar { display:none; }
  .request-pane { padding:12px; }
  .tabs { gap:13px; overflow:hidden; }
  .tabs span:nth-child(n+5) { display:none; }
  .local { display:none; }
  .section { padding:78px 0; }
  .section-head h2,.feature-head h2 { font-size:40px; }
  .yaml-card pre { padding:22px 18px; font-size:10px; }
  .agent-flow { grid-template-columns:1fr; }
  .agent-flow article { width:220px; }
  .agent-flow .dots { padding:6px 0; writing-mode:vertical-rl; }
  .terminal>div { min-height:290px; padding:21px 18px; font-size:9px; }
  .bento { grid-template-columns:1fr; }
  .bento-card.wide { grid-column:span 1; }
  .bento-card { min-height:300px; }
  .history,.vars { width:auto; left:22px; }
  .open-source { padding:100px 0; }
  .open-source h2,.final-card h2 { font-size:54px; }
  .open-source p br { display:none; }
  .final-section { padding-bottom:40px; }
  .final-card { padding:76px 18px; border-radius:22px; }
}
@media (prefers-reduced-motion:reduce) { .orb,.float-card,.transfer>span,.cursor { animation:none!important; } .button { transition:none!important; } }
</style>