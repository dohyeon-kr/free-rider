<script setup>
import { onMounted, ref } from 'vue'
import { withBase } from 'vitepress'

const guideHref = withBase('/guide/getting-started')
const openApiHref = withBase('/guide/openapi-sync')
const gitHref = withBase('/guide/git')
const mcpHref = withBase('/guide/mcp')
const releasesHref = 'https://github.com/dohyeon-kr/free-rider/releases/latest'
const githubHref = 'https://github.com/dohyeon-kr/free-rider'

const armDownload = ref(releasesHref)
const intelDownload = ref(releasesHref)

onMounted(async () => {
  try {
    const response = await fetch('https://api.github.com/repos/dohyeon-kr/free-rider/releases/latest')
    if (!response.ok) return

    const release = await response.json()
    const assets = Array.isArray(release.assets) ? release.assets : []
    const armAsset = assets.find((asset) => /mac-arm64\.dmg$/i.test(asset.name))
    const intelAsset = assets.find((asset) => /mac-x64\.dmg$/i.test(asset.name))

    if (armAsset?.browser_download_url) armDownload.value = armAsset.browser_download_url
    if (intelAsset?.browser_download_url) intelDownload.value = intelAsset.browser_download_url
  } catch {
    // Keep the releases page as a resilient fallback when GitHub API is unavailable.
  }
})
</script>

<template>
  <main class="fr-landing">
    <section class="fr-hero">
      <div class="fr-orb fr-orb--lime" aria-hidden="true" />
      <div class="fr-orb fr-orb--violet" aria-hidden="true" />
      <div class="fr-grid" aria-hidden="true" />

      <div class="fr-shell fr-hero__inner">
        <div class="fr-eyebrow">
          <span class="fr-eyebrow__dot" />
          All-free · Open source · Local-first
        </div>

        <h1>
          API work should live
          <span>next to your code.</span>
        </h1>

        <p class="fr-hero__lead">
          Free Rider는 계정, 유료 플랜, 클라우드 워크스페이스 없이 시작하는 오픈소스 API 클라이언트입니다.
          요청부터 OpenAPI, Git, MCP까지 전부 무료로 사용하세요.
        </p>

        <div class="fr-actions" aria-label="Free Rider 다운로드와 시작하기">
          <a class="fr-button fr-button--primary" :href="armDownload">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.29-.07 2.19.71 2.95.77 1.13-.23 2.21-.89 3.42-.8 1.46.12 2.56.69 3.29 1.73-3.01 1.8-2.29 5.77.47 6.88-.55 1.45-1.26 2.89-2.13 4.39ZM12.03 7.25C11.88 5.1 13.63 3.33 15.64 3.16c.28 2.49-2.26 4.35-3.61 4.09Z"/></svg>
            Apple Silicon
          </a>
          <a class="fr-button fr-button--secondary" :href="intelDownload">
            <span class="fr-chip">x64</span>
            Intel Mac
          </a>
          <a class="fr-button fr-button--ghost" :href="guideHref">문서 보기 →</a>
        </div>

        <p class="fr-hero__meta">
          No trial · No account · No feature gate
          <span>·</span>
          <a :href="githubHref">Source on GitHub ↗</a>
        </p>

        <div class="fr-product-stage" aria-label="Free Rider 요청 실행 예시">
          <div class="fr-stage-glow" aria-hidden="true" />
          <div class="fr-app-window">
            <div class="fr-window-bar">
              <div class="fr-window-dots"><i /><i /><i /></div>
              <div class="fr-window-title">Free Rider</div>
              <div class="fr-window-status"><span /> Local workspace</div>
            </div>

            <div class="fr-app-body">
              <aside class="fr-app-sidebar">
                <div class="fr-workspace-title"><span class="fr-logo-mini">F</span> Store API</div>
                <div class="fr-side-label">COLLECTION</div>
                <div class="fr-tree-item fr-tree-item--open"><span>⌄</span> Authentication</div>
                <div class="fr-tree-item fr-tree-item--active"><span class="fr-method fr-method--post">POST</span> Login</div>
                <div class="fr-tree-item"><span class="fr-method fr-method--get">GET</span> Profile</div>
                <div class="fr-tree-item"><span class="fr-method fr-method--get">GET</span> Orders</div>
                <div class="fr-side-label fr-side-label--space">ENVIRONMENT</div>
                <div class="fr-env-pill"><span /> local</div>
              </aside>

              <div class="fr-app-main">
                <div class="fr-request-row">
                  <span class="fr-request-method">POST</span>
                  <div class="fr-url"><span>{{</span>baseUrl<span>}}</span>/auth/login</div>
                  <button>Send <span>↵</span></button>
                </div>

                <div class="fr-tabs">
                  <span>Params</span><span>Headers</span><span class="is-active">Body</span><span>Auth</span><span>Vars</span><span>Tests</span><span>Docs</span>
                </div>

                <div class="fr-code-panel">
                  <div><b>1</b><code>{</code></div>
                  <div><b>2</b><code>&nbsp;&nbsp;<em>"email"</em>: <strong>"dev@freerider.local"</strong>,</code></div>
                  <div><b>3</b><code>&nbsp;&nbsp;<em>"password"</em>: <strong>"••••••••"</strong></code></div>
                  <div><b>4</b><code>}</code></div>
                </div>

                <div class="fr-response-head">
                  <div><span class="fr-status-ok">200 OK</span><span>184 ms</span><span>1.2 KB</span></div>
                  <span>Pretty · JSON</span>
                </div>
                <div class="fr-response-panel">
                  <div><b>1</b><code>{</code></div>
                  <div><b>2</b><code>&nbsp;&nbsp;<em>"token"</em>: <strong>"eyJhbGciOi..."</strong>,</code></div>
                  <div><b>3</b><code>&nbsp;&nbsp;<em>"user"</em>: { <em>"name"</em>: <strong>"Dohyeon"</strong> }</code></div>
                  <div><b>4</b><code>}</code></div>
                </div>
              </div>
            </div>
          </div>

          <div class="fr-floating-card fr-floating-card--left">
            <span class="fr-floating-icon">✓</span>
            <div><b>Saved locally</b><small>Ready to commit</small></div>
          </div>
          <div class="fr-floating-card fr-floating-card--right">
            <span class="fr-floating-icon fr-floating-icon--spark">✦</span>
            <div><b>No account</b><small>Just open and ride</small></div>
          </div>
        </div>
      </div>
    </section>

    <section class="fr-proof">
      <div class="fr-shell">
        <p>One client. The whole API workflow.</p>
        <div class="fr-proof-row">
          <span>REQUESTS</span><i />
          <span>OPENAPI</span><i />
          <span>GIT</span><i />
          <span>INTERCEPTORS</span><i />
          <span>MCP</span><i />
          <span>RUNNER</span>
        </div>
      </div>
    </section>

    <section class="fr-section fr-section--light">
      <div class="fr-shell">
        <div class="fr-section-heading">
          <div>
            <span class="fr-kicker">01 · OpenAPI</span>
            <h2>명세를 읽는 데서 끝내지 말고,<br><span>바로 작업 가능한 요청으로.</span></h2>
          </div>
          <p>
            OpenAPI 문서를 가져오면 request type, required field, request/response schema까지 보존합니다.
            변경은 바로 덮어쓰지 않고 검토한 뒤 선택적으로 반영합니다.
          </p>
        </div>

        <div class="fr-demo fr-demo--openapi">
          <div class="fr-source-card">
            <div class="fr-card-top"><span class="fr-file-dot" /> openapi.yaml <small>3.1.0</small></div>
            <pre><span>/users/{id}:</span>
  get:
    parameters:
      - name: id
        in: path
        <mark>required: true</mark>
    responses:
      '200':
        schema:
          $ref: '#/User'</pre>
          </div>

          <div class="fr-transfer" aria-hidden="true">
            <span class="fr-transfer-dot" /><span class="fr-transfer-line" /><span class="fr-transfer-arrow">→</span>
            <small>Import</small>
          </div>

          <div class="fr-request-card">
            <div class="fr-card-top"><span class="fr-method fr-method--get">GET</span> /users/:id <small>OpenAPI</small></div>
            <div class="fr-schema-row"><span>Path</span><b>id</b><em>required</em></div>
            <div class="fr-schema-box">
              <div><span>Response · 200</span><b>User</b></div>
              <code>id&nbsp;&nbsp;&nbsp;&nbsp; string</code>
              <code>name&nbsp;&nbsp; string</code>
              <code>email&nbsp; string</code>
            </div>
            <div class="fr-imported"><span>✓</span> Schema metadata preserved</div>
          </div>
        </div>

        <a class="fr-text-link" :href="openApiHref">OpenAPI 동기화 살펴보기 <span>→</span></a>
      </div>
    </section>

    <section class="fr-section fr-section--dark">
      <div class="fr-shell">
        <div class="fr-section-heading fr-section-heading--dark">
          <div>
            <span class="fr-kicker">02 · Git-native</span>
            <h2>Your API collections<br><span>are just files.</span></h2>
          </div>
          <p>
            컬렉션은 로컬 파일로 저장됩니다. 공유할 설정과 로컬 비밀값을 분리하고, 바뀐 내용만 diff로 확인해 그대로 커밋하세요.
          </p>
        </div>

        <div class="fr-git-stage">
          <div class="fr-commit-card">
            <div class="fr-card-top fr-card-top--dark"><span>request.json</span><small>2 changes</small></div>
            <div class="fr-diff-line fr-diff-line--muted"><b>12</b><code>"query": {</code></div>
            <div class="fr-diff-line fr-diff-line--minus"><b>13</b><code>- &nbsp;"limit": 10,</code></div>
            <div class="fr-diff-line fr-diff-line--plus"><b>13</b><code>+ &nbsp;"limit": 50,</code></div>
            <div class="fr-diff-line fr-diff-line--muted"><b>14</b><code>&nbsp;&nbsp;&nbsp;"sort": "recent"</code></div>
            <div class="fr-diff-line fr-diff-line--muted"><b>15</b><code>}</code></div>
            <div class="fr-commit-row"><span><i /> collections/users</span><button>Commit changes</button></div>
          </div>

          <div class="fr-git-side">
            <div class="fr-soft-tile">
              <span class="fr-tile-icon">⌘</span>
              <div><b>Review before commit</b><small>See exactly what changed.</small></div>
            </div>
            <div class="fr-soft-tile">
              <span class="fr-tile-icon">⌁</span>
              <div><b>Local secrets stay local</b><small>Share collections, not credentials.</small></div>
            </div>
            <div class="fr-soft-tile">
              <span class="fr-tile-icon">↗</span>
              <div><b>Works with your Git</b><small>No proprietary sync layer.</small></div>
            </div>
          </div>
        </div>

        <a class="fr-text-link fr-text-link--dark" :href="gitHref">Git 연동 살펴보기 <span>→</span></a>
      </div>
    </section>

    <section class="fr-section fr-section--lavender">
      <div class="fr-shell">
        <div class="fr-section-heading">
          <div>
            <span class="fr-kicker">03 · MCP</span>
            <h2>AI에게 API를 설명하지 말고,<br><span>실제로 실행하게.</span></h2>
          </div>
          <p>
            MCP를 통해 AI 에이전트가 Free Rider의 저장된 요청과 컬렉션을 사용할 수 있습니다. 사람이 만든 API 작업 공간을 그대로 에이전트에게 넘겨주세요.
          </p>
        </div>

        <div class="fr-mcp-stage">
          <div class="fr-agent-column">
            <div class="fr-agent-card"><span>AI</span><b>Agent</b><small>ChatGPT · Claude · Codex</small></div>
            <div class="fr-connector"><i /><i /><i /></div>
            <div class="fr-agent-card fr-agent-card--rider"><span>F</span><b>Free Rider</b><small>MCP server</small></div>
            <div class="fr-connector"><i /><i /><i /></div>
            <div class="fr-api-pill"><span>↯</span> Your API</div>
          </div>

          <div class="fr-terminal">
            <div class="fr-terminal-head"><div><i /><i /><i /></div><span>MCP handoff</span><small>connected</small></div>
            <div class="fr-terminal-body">
              <p><span>›</span> Run the login request and inspect the response</p>
              <p class="fr-term-success"><span>✓</span> POST /auth/login <b>200 OK</b></p>
              <p><span>›</span> Save the token as <em>{{authToken}}</em></p>
              <p class="fr-term-success"><span>✓</span> Runtime variable created</p>
              <p><span>›</span> Call my profile with that token</p>
              <p class="fr-term-success fr-term-last"><span>✓</span> GET /users/me <b>200 OK</b><i class="fr-cursor" /></p>
            </div>
          </div>
        </div>

        <a class="fr-text-link" :href="mcpHref">MCP 연결하기 <span>→</span></a>
      </div>
    </section>

    <section class="fr-section fr-section--features">
      <div class="fr-shell">
        <div class="fr-features-title">
          <span class="fr-kicker">Everything included</span>
          <h2>작은 기능까지도<br><span>유료 벽 뒤에 두지 않습니다.</span></h2>
          <p>Free Rider의 기능은 전부 무료이며, 소스도 공개합니다.</p>
        </div>

        <div class="fr-bento">
          <article class="fr-bento-card fr-bento-card--wide">
            <div class="fr-bento-copy"><span>↺</span><h3>Request History</h3><p>저장하지 않고 실행한 요청도 다시 열고 컬렉션으로 보낼 수 있습니다.</p></div>
            <div class="fr-history-visual">
              <div><span class="fr-method fr-method--get">GET</span><b>/products</b><small>200 · 124ms</small></div>
              <div><span class="fr-method fr-method--post">POST</span><b>/orders</b><small>201 · 203ms</small></div>
              <div><span class="fr-method fr-method--get">GET</span><b>/users/me</b><small>200 · 89ms</small></div>
            </div>
          </article>

          <article class="fr-bento-card">
            <div class="fr-bento-copy"><span>◎</span><h3>Cookie Jar</h3><p>Set-Cookie를 다음 요청에 자동으로 이어갑니다.</p></div>
            <div class="fr-cookie"><i>session</i><span>••••••••••••</span><b>Secure</b></div>
          </article>

          <article class="fr-bento-card">
            <div class="fr-bento-copy"><span>⚡</span><h3>Interceptors</h3><p>컬렉션별 전후처리를 한 곳에서 관리합니다.</p></div>
            <div class="fr-flow"><span>req</span><i>→</i><b>auth</b><i>→</i><b>log</b><i>→</i><span>res</span></div>
          </article>

          <article class="fr-bento-card">
            <div class="fr-bento-copy"><span>▶</span><h3>Collection Runner</h3><p>여러 요청을 순서대로 실행하고 결과를 한눈에 봅니다.</p></div>
            <div class="fr-runner"><i class="done" /><i class="done" /><i class="active" /><i /><span>3 / 4</span></div>
          </article>

          <article class="fr-bento-card fr-bento-card--wide">
            <div class="fr-bento-copy"><span>{ }</span><h3>Vars & Environments</h3><p>환경값, 요청별 Vars, 실행 중 캡처 값을 계층적으로 조합합니다.</p></div>
            <div class="fr-vars">
              <code><em>baseUrl</em> https://api.local</code>
              <code><em>authToken</em> ••••••••••••</code>
              <code><em>userId</em> usr_9f82a</code>
            </div>
          </article>
        </div>
      </div>
    </section>

    <section class="fr-open-source">
      <div class="fr-shell fr-open-source__inner">
        <div class="fr-os-mark" aria-hidden="true"><span>F</span></div>
        <span class="fr-kicker">Why “Free Rider”?</span>
        <h2>All free.<br><span>Open source.</span></h2>
        <p>
          무료 플랜이 있는 제품이 아니라, 제품 전체를 무료로 공개합니다.<br>
          계정 없이 시작하고, 데이터는 내 컴퓨터에 두고, 필요하면 소스까지 직접 바꾸세요.
        </p>
        <div class="fr-os-pills"><span>✓ All features free</span><span>✓ Open source</span><span>✓ Local-first</span><span>✓ No account</span></div>
        <div class="fr-actions fr-actions--center">
          <a class="fr-button fr-button--primary" :href="githubHref">View source on GitHub ↗</a>
          <a class="fr-button fr-button--secondary" :href="guideHref">Get started</a>
        </div>
      </div>
    </section>

    <section class="fr-final">
      <div class="fr-shell">
        <div class="fr-final-card">
          <div class="fr-final-glow" aria-hidden="true" />
          <span class="fr-kicker">Ride free.</span>
          <h2>Your APIs.<br>Your files. <span>Your rules.</span></h2>
          <p>Free Rider를 내려받고 첫 요청을 보내보세요.</p>
          <div class="fr-actions fr-actions--center">
            <a class="fr-button fr-button--primary" :href="armDownload">Apple Silicon</a>
            <a class="fr-button fr-button--secondary fr-button--on-dark" :href="intelDownload">Intel Mac</a>
            <a class="fr-button fr-button--ghost fr-button--on-dark" :href="releasesHref">All releases ↗</a>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style>
.VPHome { padding-bottom: 0 !important; }
.VPHome .vp-doc.container { max-width: none !important; padding: 0 !important; margin: 0 !important; }
.VPHome .vp-doc > div { margin: 0 !important; }
.VPHome .VPHomeContent { padding: 0 !important; }
</style>

<style scoped>
.fr-landing {
  --ink: #0e1011;
  --muted: #60646b;
  --line: rgba(18, 20, 22, .1);
  --lime: #d7ff66;
  --lime-strong: #c8f24f;
  --violet: #9074ff;
  --blue: #72b7ff;
  --paper: #f7f7f4;
  --smoke: #111214;
  overflow: hidden;
  color: var(--ink);
  background: var(--paper);
  font-family: var(--vp-font-family-base);
}

.fr-shell { width: min(1180px, calc(100% - 48px)); margin: 0 auto; }
.fr-hero { position: relative; min-height: 920px; padding: 116px 0 96px; overflow: hidden; color: #f8f8f6; background: #0d0f10; }
.fr-hero::after { content: ""; position: absolute; inset: auto 0 0; height: 220px; background: linear-gradient(transparent, rgba(255,255,255,.025)); pointer-events: none; }
.fr-hero__inner { position: relative; z-index: 2; text-align: center; }
.fr-grid { position: absolute; inset: 0; opacity: .18; background-image: linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px); background-size: 72px 72px; mask-image: linear-gradient(to bottom, black, transparent 76%); }
.fr-orb { position: absolute; width: 680px; height: 680px; border-radius: 50%; filter: blur(100px); opacity: .22; pointer-events: none; }
.fr-orb--lime { top: -310px; left: -180px; background: var(--lime); animation: drift 12s ease-in-out infinite alternate; }
.fr-orb--violet { top: -320px; right: -170px; background: linear-gradient(135deg, var(--violet), var(--blue)); animation: drift 14s ease-in-out infinite alternate-reverse; }
.fr-eyebrow { display: inline-flex; align-items: center; gap: 9px; padding: 8px 13px; border: 1px solid rgba(255,255,255,.1); border-radius: 999px; color: rgba(255,255,255,.72); background: rgba(255,255,255,.055); box-shadow: inset 0 1px rgba(255,255,255,.08); backdrop-filter: blur(14px); font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.fr-eyebrow__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--lime); box-shadow: 0 0 18px rgba(215,255,102,.65); }
.fr-hero h1 { max-width: 900px; margin: 30px auto 0; color: white; font-size: clamp(54px, 7vw, 96px); line-height: .94; letter-spacing: -.07em; font-weight: 800; }
.fr-hero h1 span { display: block; color: transparent; background: linear-gradient(90deg, #fff 0%, #c9c4ff 46%, #d7ff66 100%); -webkit-background-clip: text; background-clip: text; }
.fr-hero__lead { max-width: 720px; margin: 28px auto 0; color: rgba(255,255,255,.62); font-size: 18px; line-height: 1.72; letter-spacing: -.015em; }
.fr-actions { display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; margin-top: 34px; }
.fr-actions--center { justify-content: center; }
.fr-button { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 48px; padding: 0 18px; border: 1px solid transparent; border-radius: 13px; font-size: 14px; font-weight: 760; text-decoration: none !important; transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease, background .2s ease; }
.fr-button:hover { transform: translateY(-2px); }
.fr-button svg { width: 17px; fill: currentColor; }
.fr-button--primary { color: #101210 !important; background: linear-gradient(180deg, #e4ff94, var(--lime)); box-shadow: inset 0 1px rgba(255,255,255,.8), 0 10px 32px rgba(197,238,71,.18); }
.fr-button--primary:hover { box-shadow: inset 0 1px rgba(255,255,255,.9), 0 14px 38px rgba(197,238,71,.25); }
.fr-button--secondary { color: #f6f6f2 !important; border-color: rgba(255,255,255,.13); background: linear-gradient(180deg, rgba(255,255,255,.1), rgba(255,255,255,.055)); box-shadow: inset 0 1px rgba(255,255,255,.09), 0 12px 30px rgba(0,0,0,.18); }
.fr-button--ghost { color: rgba(255,255,255,.68) !important; background: transparent; }
.fr-button--on-dark { color: white !important; }
.fr-chip { display: inline-flex; padding: 2px 5px; border-radius: 5px; color: rgba(255,255,255,.74); background: rgba(255,255,255,.08); font-size: 10px; }
.fr-hero__meta { display: flex; justify-content: center; gap: 9px; margin: 16px 0 0; color: rgba(255,255,255,.36); font-size: 12px; }
.fr-hero__meta a { color: rgba(255,255,255,.56); text-decoration: none; }

.fr-product-stage { position: relative; width: min(1050px, 100%); margin: 72px auto 0; padding: 1px; perspective: 1600px; }
.fr-stage-glow { position: absolute; inset: 10% 10% -12%; border-radius: 80px; background: radial-gradient(circle at 48% 70%, rgba(138,113,255,.28), transparent 50%), radial-gradient(circle at 70% 20%, rgba(215,255,102,.16), transparent 42%); filter: blur(35px); }
.fr-app-window { position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,.13); border-radius: 22px; text-align: left; background: #17191b; box-shadow: 0 70px 140px rgba(0,0,0,.55), inset 0 1px rgba(255,255,255,.07); transform: rotateX(2deg); }
.fr-window-bar { height: 44px; display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; padding: 0 14px; border-bottom: 1px solid rgba(255,255,255,.07); background: rgba(255,255,255,.025); color: rgba(255,255,255,.45); font-size: 11px; }
.fr-window-dots { display: flex; gap: 6px; }
.fr-window-dots i, .fr-terminal-head i { width: 8px; height: 8px; border-radius: 50%; background: #393d42; }
.fr-window-title { color: rgba(255,255,255,.72); font-weight: 700; }
.fr-window-status { justify-self: end; display: flex; align-items: center; gap: 6px; }
.fr-window-status span { width: 6px; height: 6px; border-radius: 50%; background: var(--lime); box-shadow: 0 0 12px rgba(215,255,102,.55); }
.fr-app-body { display: grid; grid-template-columns: 215px 1fr; min-height: 500px; }
.fr-app-sidebar { padding: 17px 12px; border-right: 1px solid rgba(255,255,255,.065); background: #141618; }
.fr-workspace-title { display: flex; align-items: center; gap: 9px; margin-bottom: 23px; color: rgba(255,255,255,.82); font-size: 12px; font-weight: 760; }
.fr-logo-mini { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 7px; color: #151713; background: var(--lime); font-weight: 900; }
.fr-side-label { padding: 0 7px 8px; color: rgba(255,255,255,.26); font-size: 9px; font-weight: 800; letter-spacing: .12em; }
.fr-side-label--space { margin-top: 28px; }
.fr-tree-item { display: flex; align-items: center; gap: 8px; min-height: 30px; padding: 0 7px; border-radius: 7px; color: rgba(255,255,255,.48); font-size: 11px; }
.fr-tree-item--active { color: white; background: rgba(255,255,255,.065); box-shadow: inset 0 1px rgba(255,255,255,.035); }
.fr-tree-item--open { color: rgba(255,255,255,.72); font-weight: 700; }
.fr-method { display: inline-flex; align-items: center; justify-content: center; min-width: 32px; font-size: 8px; font-weight: 900; letter-spacing: .04em; }
.fr-method--get { color: #79c7ff; }
.fr-method--post { color: #d7ff66; }
.fr-env-pill { display: inline-flex; align-items: center; gap: 7px; padding: 6px 9px; border: 1px solid rgba(255,255,255,.06); border-radius: 8px; color: rgba(255,255,255,.58); font-size: 10px; background: rgba(255,255,255,.025); }
.fr-env-pill span { width: 6px; height: 6px; border-radius: 50%; background: #67df93; }
.fr-app-main { min-width: 0; padding: 18px 20px 20px; }
.fr-request-row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; overflow: hidden; height: 42px; border: 1px solid rgba(255,255,255,.09); border-radius: 9px; background: #111315; }
.fr-request-method { padding: 0 12px; color: #d7ff66; font-size: 10px; font-weight: 900; }
.fr-url { min-width: 0; color: rgba(255,255,255,.72); font: 11px var(--vp-font-family-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fr-url span { color: #9b8cff; }
.fr-request-row button { align-self: stretch; padding: 0 15px; border: 0; color: #151713; background: var(--lime); font-size: 10px; font-weight: 900; }
.fr-request-row button span { margin-left: 6px; opacity: .55; }
.fr-tabs { display: flex; gap: 22px; height: 42px; align-items: end; border-bottom: 1px solid rgba(255,255,255,.07); color: rgba(255,255,255,.34); font-size: 10px; }
.fr-tabs span { height: 30px; }
.fr-tabs .is-active { color: rgba(255,255,255,.78); border-bottom: 2px solid var(--lime); }
.fr-code-panel, .fr-response-panel { margin-top: 12px; padding: 12px 0; border: 1px solid rgba(255,255,255,.055); border-radius: 9px; background: #121416; font: 10px/1.7 var(--vp-font-family-mono); }
.fr-code-panel div, .fr-response-panel div { display: grid; grid-template-columns: 34px 1fr; }
.fr-code-panel b, .fr-response-panel b { color: rgba(255,255,255,.18); text-align: right; padding-right: 10px; font-weight: 500; }
.fr-code-panel code, .fr-response-panel code { color: rgba(255,255,255,.56); }
.fr-code-panel em, .fr-response-panel em { color: #9ccdf1; font-style: normal; }
.fr-code-panel strong, .fr-response-panel strong { color: #d5c8ff; font-weight: 500; }
.fr-response-head { display: flex; justify-content: space-between; margin-top: 14px; color: rgba(255,255,255,.27); font-size: 9px; }
.fr-response-head > div { display: flex; gap: 10px; }
.fr-status-ok { color: #7ce2a1; font-weight: 800; }
.fr-response-panel { min-height: 108px; }
.fr-floating-card { position: absolute; display: flex; align-items: center; gap: 10px; padding: 11px 14px; border: 1px solid rgba(255,255,255,.14); border-radius: 13px; text-align: left; background: rgba(35,38,40,.72); box-shadow: 0 18px 45px rgba(0,0,0,.3), inset 0 1px rgba(255,255,255,.08); backdrop-filter: blur(16px); animation: float 5s ease-in-out infinite; }
.fr-floating-card--left { left: -38px; bottom: 76px; }
.fr-floating-card--right { right: -30px; top: 95px; animation-delay: -2.4s; }
.fr-floating-icon { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px; color: #172016; background: var(--lime); font-weight: 900; }
.fr-floating-icon--spark { color: white; background: linear-gradient(135deg, var(--violet), #6eaefc); }
.fr-floating-card b, .fr-floating-card small { display: block; }
.fr-floating-card b { color: rgba(255,255,255,.83); font-size: 10px; }
.fr-floating-card small { margin-top: 2px; color: rgba(255,255,255,.4); font-size: 9px; }

.fr-proof { padding: 26px 0; border-bottom: 1px solid var(--line); background: #f2f3ef; }
.fr-proof .fr-shell { display: flex; align-items: center; justify-content: space-between; gap: 30px; }
.fr-proof p { margin: 0; color: #81847f; font-size: 11px; font-weight: 720; }
.fr-proof-row { display: flex; align-items: center; gap: 16px; color: #8a8c88; font-size: 10px; font-weight: 850; letter-spacing: .08em; }
.fr-proof-row i { width: 3px; height: 3px; border-radius: 50%; background: #b7b9b4; }

.fr-section { padding: 126px 0; }
.fr-section--light { background: #f7f7f4; }
.fr-section--dark { color: #f7f7f4; background: #101214; }
.fr-section--lavender { background: radial-gradient(circle at 80% 20%, rgba(144,116,255,.17), transparent 33%), #f2f1f7; }
.fr-section--features { background: #eceee8; }
.fr-section-heading { display: grid; grid-template-columns: 1.3fr .7fr; gap: 90px; align-items: end; }
.fr-section-heading h2, .fr-features-title h2, .fr-open-source h2, .fr-final h2 { margin: 14px 0 0; color: var(--ink); font-size: clamp(42px, 5.3vw, 70px); line-height: 1; letter-spacing: -.055em; font-weight: 800; }
.fr-section-heading h2 span, .fr-features-title h2 span, .fr-open-source h2 span, .fr-final h2 span { color: #797d82; }
.fr-section-heading p { margin: 0 0 4px; color: #6d7176; font-size: 15px; line-height: 1.72; }
.fr-section-heading--dark h2 { color: white; }
.fr-section-heading--dark h2 span { color: rgba(255,255,255,.42); }
.fr-section-heading--dark p { color: rgba(255,255,255,.49); }
.fr-kicker { color: #6e725f; font-size: 11px; font-weight: 850; letter-spacing: .09em; text-transform: uppercase; }
.fr-section--dark .fr-kicker { color: var(--lime); }

.fr-demo { margin-top: 62px; }
.fr-demo--openapi { display: grid; grid-template-columns: 1fr 120px 1fr; align-items: center; }
.fr-source-card, .fr-request-card { overflow: hidden; min-height: 390px; border: 1px solid rgba(20,22,24,.09); border-radius: 24px; background: rgba(255,255,255,.62); box-shadow: inset 0 1px white, 0 28px 80px rgba(50,49,42,.08); backdrop-filter: blur(20px); }
.fr-card-top { display: flex; align-items: center; gap: 9px; height: 52px; padding: 0 18px; border-bottom: 1px solid rgba(20,22,24,.075); color: #555a60; font-size: 11px; font-weight: 780; }
.fr-card-top small { margin-left: auto; color: #9b9d9f; font-weight: 600; }
.fr-file-dot { width: 8px; height: 8px; border-radius: 2px; background: var(--violet); box-shadow: 0 0 0 3px rgba(144,116,255,.12); }
.fr-source-card pre { margin: 0; padding: 28px 30px; color: #656b70; background: transparent; font: 12px/1.8 var(--vp-font-family-mono); }
.fr-source-card pre span { color: #7162c6; font-weight: 700; }
.fr-source-card pre mark { padding: 2px 4px; border-radius: 4px; color: #4e5a2c; background: rgba(215,255,102,.55); }
.fr-transfer { position: relative; display: flex; align-items: center; justify-content: center; height: 80px; color: #747875; }
.fr-transfer-line { width: 62px; height: 1px; background: linear-gradient(90deg, #c5c6c1, #8f82df); }
.fr-transfer-dot { position: absolute; left: 25px; width: 8px; height: 8px; border-radius: 50%; background: var(--violet); box-shadow: 0 0 0 6px rgba(144,116,255,.1); animation: transfer 2.8s ease-in-out infinite; }
.fr-transfer-arrow { margin-left: -2px; font-size: 18px; }
.fr-transfer small { position: absolute; top: 56px; font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.fr-request-card { padding-bottom: 20px; }
.fr-schema-row { display: grid; grid-template-columns: 70px 1fr auto; align-items: center; margin: 22px 22px 0; padding: 14px; border: 1px solid #e3e3df; border-radius: 12px; color: #8a8c8d; background: rgba(255,255,255,.55); font-size: 11px; }
.fr-schema-row b { color: #303438; }
.fr-schema-row em { padding: 3px 7px; border-radius: 999px; color: #655b32; background: #eef7cd; font-size: 9px; font-style: normal; font-weight: 800; }
.fr-schema-box { margin: 12px 22px 0; padding: 15px; border: 1px solid #e3e3df; border-radius: 12px; background: rgba(255,255,255,.55); }
.fr-schema-box div { display: flex; justify-content: space-between; margin-bottom: 12px; color: #7d8081; font-size: 10px; }
.fr-schema-box div b { color: #363a3c; }
.fr-schema-box code { display: block; color: #787c7d; font: 10px/1.8 var(--vp-font-family-mono); }
.fr-imported { display: flex; align-items: center; gap: 8px; margin: 16px 22px 0; color: #727773; font-size: 10px; }
.fr-imported span { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 6px; color: #34401e; background: var(--lime); font-weight: 900; }
.fr-text-link { display: inline-flex; align-items: center; gap: 9px; margin-top: 32px; color: #303438 !important; font-size: 13px; font-weight: 800; text-decoration: none !important; }
.fr-text-link span { transition: transform .2s ease; }
.fr-text-link:hover span { transform: translateX(4px); }
.fr-text-link--dark { color: rgba(255,255,255,.8) !important; }

.fr-git-stage { display: grid; grid-template-columns: 1.2fr .8fr; gap: 26px; margin-top: 62px; }
.fr-commit-card { overflow: hidden; border: 1px solid rgba(255,255,255,.09); border-radius: 23px; background: #17191b; box-shadow: 0 30px 80px rgba(0,0,0,.28), inset 0 1px rgba(255,255,255,.04); }
.fr-card-top--dark { border-color: rgba(255,255,255,.07); color: rgba(255,255,255,.62); }
.fr-card-top--dark small { color: rgba(255,255,255,.28); }
.fr-diff-line { display: grid; grid-template-columns: 44px 1fr; min-height: 38px; align-items: center; font: 11px var(--vp-font-family-mono); }
.fr-diff-line b { padding-right: 13px; color: rgba(255,255,255,.18); text-align: right; font-weight: 500; }
.fr-diff-line code { color: rgba(255,255,255,.6); }
.fr-diff-line--minus { background: rgba(255,91,91,.09); }
.fr-diff-line--minus code { color: #ef9f9f; }
.fr-diff-line--plus { background: rgba(127,226,158,.09); }
.fr-diff-line--plus code { color: #a4e9ba; }
.fr-commit-row { display: flex; justify-content: space-between; align-items: center; margin-top: 42px; padding: 14px 16px; border-top: 1px solid rgba(255,255,255,.07); color: rgba(255,255,255,.37); font-size: 10px; }
.fr-commit-row span { display: flex; align-items: center; gap: 7px; }
.fr-commit-row i { width: 6px; height: 6px; border-radius: 50%; background: var(--lime); }
.fr-commit-row button { padding: 8px 11px; border: 0; border-radius: 8px; color: #141613; background: var(--lime); font-size: 9px; font-weight: 850; }
.fr-git-side { display: grid; gap: 12px; }
.fr-soft-tile { display: flex; align-items: center; gap: 16px; padding: 19px; border: 1px solid rgba(255,255,255,.075); border-radius: 18px; background: linear-gradient(145deg, #1b1d1f, #141618); box-shadow: inset 0 1px rgba(255,255,255,.04), 0 16px 38px rgba(0,0,0,.13); }
.fr-tile-icon { display: grid; place-items: center; flex: 0 0 44px; width: 44px; height: 44px; border: 1px solid rgba(255,255,255,.07); border-radius: 13px; color: var(--lime); background: linear-gradient(145deg, #232628, #141618); box-shadow: 6px 6px 14px rgba(0,0,0,.25), -3px -3px 10px rgba(255,255,255,.025); font-size: 18px; }
.fr-soft-tile b, .fr-soft-tile small { display: block; }
.fr-soft-tile b { color: rgba(255,255,255,.76); font-size: 12px; }
.fr-soft-tile small { margin-top: 3px; color: rgba(255,255,255,.34); font-size: 10px; }

.fr-mcp-stage { display: grid; grid-template-columns: 290px 1fr; gap: 65px; margin-top: 62px; align-items: center; }
.fr-agent-column { display: grid; justify-items: center; }
.fr-agent-card { display: grid; grid-template-columns: 42px 1fr; grid-template-rows: auto auto; column-gap: 12px; width: 220px; padding: 15px; border: 1px solid rgba(45,42,68,.09); border-radius: 17px; background: rgba(255,255,255,.7); box-shadow: inset 0 1px white, 0 14px 38px rgba(66,57,110,.09); backdrop-filter: blur(18px); }
.fr-agent-card > span { grid-row: 1 / 3; display: grid; place-items: center; width: 42px; height: 42px; border-radius: 12px; color: white; background: linear-gradient(135deg, #8975ff, #6bb5ff); font-size: 11px; font-weight: 900; }
.fr-agent-card b { align-self: end; color: #303238; font-size: 12px; }
.fr-agent-card small { color: #929399; font-size: 9px; }
.fr-agent-card--rider > span { color: #1b2017; background: var(--lime); }
.fr-connector { display: grid; justify-items: center; gap: 3px; padding: 8px 0; }
.fr-connector i { width: 3px; height: 3px; border-radius: 50%; background: #a9a3c8; }
.fr-api-pill { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; color: #62636a; background: rgba(255,255,255,.55); box-shadow: inset 0 1px white; font-size: 10px; font-weight: 800; }
.fr-api-pill span { color: #7460e9; }
.fr-terminal { overflow: hidden; border: 1px solid rgba(35,33,50,.16); border-radius: 23px; background: #17171c; box-shadow: 0 35px 90px rgba(62,49,118,.22), inset 0 1px rgba(255,255,255,.07); }
.fr-terminal-head { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; height: 46px; padding: 0 15px; border-bottom: 1px solid rgba(255,255,255,.07); color: rgba(255,255,255,.45); font-size: 10px; }
.fr-terminal-head > div { display: flex; gap: 6px; }
.fr-terminal-head span { color: rgba(255,255,255,.68); font-weight: 700; }
.fr-terminal-head small { justify-self: end; color: #8adb9f; }
.fr-terminal-body { min-height: 320px; padding: 31px; font: 11px/1.8 var(--vp-font-family-mono); }
.fr-terminal-body p { margin: 0 0 16px; color: rgba(255,255,255,.65); }
.fr-terminal-body p > span { display: inline-block; width: 18px; color: #8f7cff; }
.fr-terminal-body em { color: #c7b8ff; font-style: normal; }
.fr-terminal-body .fr-term-success { margin-top: -10px; color: rgba(255,255,255,.39); }
.fr-terminal-body .fr-term-success span { color: var(--lime); }
.fr-terminal-body .fr-term-success b { margin-left: 8px; color: #82d99b; font-size: 9px; }
.fr-term-last { position: relative; }
.fr-cursor { display: inline-block; width: 6px; height: 12px; margin-left: 7px; vertical-align: -2px; background: var(--lime); animation: blink 1.1s steps(1) infinite; }

.fr-features-title { max-width: 760px; }
.fr-features-title p { color: #747873; font-size: 15px; }
.fr-bento { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 54px; }
.fr-bento-card { position: relative; overflow: hidden; min-height: 270px; padding: 25px; border: 1px solid rgba(22,24,22,.08); border-radius: 22px; background: rgba(255,255,255,.58); box-shadow: inset 0 1px rgba(255,255,255,.9), 0 18px 50px rgba(45,48,40,.05); }
.fr-bento-card--wide { grid-column: span 2; }
.fr-bento-copy > span { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid #e2e4dd; border-radius: 11px; color: #5c6253; background: linear-gradient(145deg, #fff, #eceee8); box-shadow: 5px 5px 12px rgba(77,82,67,.09), -3px -3px 8px white; font-size: 12px; font-weight: 900; }
.fr-bento-copy h3 { margin: 17px 0 6px; color: #222522; font-size: 17px; letter-spacing: -.03em; }
.fr-bento-copy p { max-width: 390px; margin: 0; color: #7b7f78; font-size: 12px; line-height: 1.6; }
.fr-history-visual { position: absolute; right: 24px; bottom: 24px; width: 50%; overflow: hidden; border: 1px solid #e2e4de; border-radius: 14px; background: rgba(248,249,246,.85); }
.fr-history-visual div { display: grid; grid-template-columns: 44px 1fr auto; align-items: center; min-height: 42px; padding: 0 12px; border-bottom: 1px solid #e7e8e3; font-size: 9px; }
.fr-history-visual div:last-child { border: 0; }
.fr-history-visual b { color: #5b605b; font-weight: 650; }
.fr-history-visual small { color: #a0a39d; }
.fr-cookie { position: absolute; right: 22px; bottom: 22px; left: 22px; display: grid; grid-template-columns: auto 1fr auto; gap: 10px; align-items: center; padding: 12px; border: 1px solid #e1e3dc; border-radius: 12px; color: #92958f; background: #f9faf7; font: 9px var(--vp-font-family-mono); }
.fr-cookie i { color: #5d625b; font-style: normal; font-weight: 800; }
.fr-cookie b { padding: 3px 6px; border-radius: 5px; color: #5f7241; background: #edf6d4; font-size: 8px; }
.fr-flow { position: absolute; right: 20px; bottom: 27px; left: 20px; display: flex; align-items: center; justify-content: space-between; color: #989b95; font-size: 9px; }
.fr-flow b, .fr-flow span { padding: 8px; border: 1px solid #e1e3dd; border-radius: 9px; background: #fafbf8; }
.fr-flow b { color: #5d6847; box-shadow: inset 0 -2px #dff09f; }
.fr-runner { position: absolute; right: 25px; bottom: 35px; left: 25px; display: flex; align-items: center; }
.fr-runner::before { content: ""; position: absolute; right: 45px; left: 0; height: 2px; background: #dfe1da; }
.fr-runner i { position: relative; z-index: 1; width: 14px; height: 14px; margin-right: 26px; border: 3px solid #f4f5f1; border-radius: 50%; background: #ccd0c6; box-shadow: 0 0 0 1px #d6d8d2; }
.fr-runner i.done { background: var(--lime-strong); }
.fr-runner i.active { background: #8d7aff; box-shadow: 0 0 0 5px rgba(141,122,255,.11); }
.fr-runner span { margin-left: auto; color: #8d908a; font-size: 9px; }
.fr-vars { position: absolute; right: 24px; bottom: 24px; width: 48%; padding: 12px 0; border: 1px solid #e2e4de; border-radius: 13px; background: #f9faf7; }
.fr-vars code { display: grid; grid-template-columns: 90px 1fr; padding: 7px 13px; color: #858983; font: 9px var(--vp-font-family-mono); }
.fr-vars em { color: #686d66; font-style: normal; font-weight: 800; }

.fr-open-source { position: relative; padding: 136px 0; overflow: hidden; text-align: center; background: #f8f8f4; }
.fr-open-source::before { content: ""; position: absolute; width: 720px; height: 720px; top: -440px; left: calc(50% - 360px); border-radius: 50%; background: radial-gradient(circle, rgba(215,255,102,.42), rgba(144,116,255,.12) 42%, transparent 70%); filter: blur(15px); }
.fr-open-source__inner { position: relative; z-index: 1; }
.fr-os-mark { display: grid; place-items: center; width: 76px; height: 76px; margin: 0 auto 27px; border: 1px solid rgba(43,47,40,.08); border-radius: 24px; background: linear-gradient(145deg, #f9f9f4, #e4e8da); box-shadow: 14px 14px 30px rgba(82,89,65,.12), -14px -14px 30px white, inset 0 1px white; transform: rotate(-4deg); }
.fr-os-mark span { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 15px; color: #181b15; background: var(--lime); box-shadow: inset 0 1px rgba(255,255,255,.7), 0 7px 16px rgba(168,201,69,.2); font-size: 24px; font-weight: 950; }
.fr-open-source h2 { font-size: clamp(58px, 8vw, 106px); }
.fr-open-source h2 span { color: #8276cf; }
.fr-open-source p { margin: 28px auto 0; color: #6c706b; font-size: 16px; line-height: 1.75; }
.fr-os-pills { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: 28px; }
.fr-os-pills span { padding: 8px 11px; border: 1px solid #e2e4dc; border-radius: 999px; color: #6a6e66; background: rgba(255,255,255,.6); box-shadow: inset 0 1px white; font-size: 10px; font-weight: 760; }
.fr-open-source .fr-button--secondary { color: #383d36 !important; border-color: #dcded6; background: linear-gradient(180deg, #fff, #eceee8); box-shadow: inset 0 1px white, 0 10px 24px rgba(75,80,68,.08); }

.fr-final { padding: 24px 0 80px; background: #f8f8f4; }
.fr-final-card { position: relative; overflow: hidden; padding: 100px 28px; border-radius: 30px; text-align: center; color: white; background: #101214; box-shadow: 0 30px 80px rgba(31,33,30,.16); }
.fr-final-card .fr-kicker { color: var(--lime); }
.fr-final h2 { position: relative; z-index: 1; color: white; font-size: clamp(52px, 7vw, 92px); }
.fr-final h2 span { color: #b4a8ff; }
.fr-final p { position: relative; z-index: 1; color: rgba(255,255,255,.46); font-size: 14px; }
.fr-final .fr-actions { position: relative; z-index: 1; }
.fr-final-glow { position: absolute; width: 650px; height: 650px; top: -440px; left: calc(50% - 325px); border-radius: 50%; background: conic-gradient(from 180deg, rgba(215,255,102,.65), rgba(144,116,255,.62), rgba(94,177,255,.55), rgba(215,255,102,.65)); filter: blur(80px); opacity: .45; }

@keyframes drift { to { transform: translate3d(50px, 32px, 0) scale(1.08); } }
@keyframes float { 50% { transform: translateY(-8px); } }
@keyframes transfer { 0%, 15% { transform: translateX(0); opacity: 0; } 28% { opacity: 1; } 70% { opacity: 1; } 90%, 100% { transform: translateX(62px); opacity: 0; } }
@keyframes blink { 50% { opacity: 0; } }

@media (max-width: 900px) {
  .fr-shell { width: min(100% - 32px, 720px); }
  .fr-hero { min-height: auto; padding-top: 94px; }
  .fr-hero h1 { font-size: clamp(48px, 12vw, 72px); }
  .fr-app-body { grid-template-columns: 150px 1fr; }
  .fr-app-sidebar { padding-inline: 8px; }
  .fr-tree-item { font-size: 9px; }
  .fr-floating-card { display: none; }
  .fr-proof .fr-shell { display: block; }
  .fr-proof p { margin-bottom: 13px; }
  .fr-proof-row { overflow-x: auto; padding-bottom: 4px; }
  .fr-section { padding: 96px 0; }
  .fr-section-heading { grid-template-columns: 1fr; gap: 24px; }
  .fr-demo--openapi { grid-template-columns: 1fr; gap: 18px; }
  .fr-transfer { height: 65px; transform: rotate(90deg); }
  .fr-source-card, .fr-request-card { min-height: 330px; }
  .fr-git-stage, .fr-mcp-stage { grid-template-columns: 1fr; }
  .fr-agent-column { grid-template-columns: 1fr auto 1fr auto 1fr; align-items: center; }
  .fr-agent-card { width: 170px; }
  .fr-connector { grid-auto-flow: column; padding: 0 8px; }
  .fr-api-pill { white-space: nowrap; }
  .fr-bento { grid-template-columns: 1fr 1fr; }
  .fr-bento-card--wide { grid-column: span 2; }
}

@media (max-width: 640px) {
  .fr-shell { width: min(100% - 24px, 540px); }
  .fr-hero { padding: 82px 0 70px; }
  .fr-eyebrow { font-size: 9px; }
  .fr-hero h1 { margin-top: 23px; font-size: 48px; }
  .fr-hero__lead { font-size: 14px; }
  .fr-actions { display: grid; grid-template-columns: 1fr 1fr; }
  .fr-actions .fr-button--ghost { grid-column: 1 / -1; }
  .fr-hero__meta { display: block; line-height: 1.7; }
  .fr-hero__meta span { display: none; }
  .fr-hero__meta a { display: block; }
  .fr-product-stage { margin-top: 48px; }
  .fr-app-window { border-radius: 16px; }
  .fr-app-body { grid-template-columns: 1fr; min-height: 430px; }
  .fr-app-sidebar { display: none; }
  .fr-app-main { padding: 12px; }
  .fr-tabs { gap: 13px; overflow: hidden; }
  .fr-tabs span:nth-child(n+5) { display: none; }
  .fr-window-status { display: none; }
  .fr-section { padding: 78px 0; }
  .fr-section-heading h2, .fr-features-title h2 { font-size: 40px; }
  .fr-source-card pre { padding: 22px 18px; font-size: 10px; }
  .fr-git-stage { gap: 14px; }
  .fr-agent-column { display: grid; grid-template-columns: 1fr; }
  .fr-connector { grid-auto-flow: row; padding: 7px 0; }
  .fr-agent-card { width: 220px; }
  .fr-terminal-body { min-height: 290px; padding: 21px 18px; font-size: 9px; }
  .fr-bento { grid-template-columns: 1fr; }
  .fr-bento-card--wide { grid-column: span 1; }
  .fr-history-visual, .fr-vars { width: auto; left: 22px; }
  .fr-bento-card { min-height: 300px; }
  .fr-open-source { padding: 100px 0; }
  .fr-open-source h2, .fr-final h2 { font-size: 54px; }
  .fr-open-source p br { display: none; }
  .fr-final { padding-bottom: 40px; }
  .fr-final-card { padding: 76px 18px; border-radius: 22px; }
  .fr-final .fr-actions { grid-template-columns: 1fr 1fr; }
}

@media (prefers-reduced-motion: reduce) {
  .fr-orb, .fr-floating-card, .fr-transfer-dot, .fr-cursor { animation: none !important; }
  .fr-button, .fr-text-link span { transition: none !important; }
}
</style>
