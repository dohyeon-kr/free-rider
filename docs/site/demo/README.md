# Renderer playground

The landing progressively replaces its static product preview with a sandboxed iframe. The SSR preview remains available without JavaScript. The original `LandingHome.vue`, desktop renderer, dark landing styles, hero copy, and download buttons are not duplicated or rewritten.

## Source of truth

`npm run --prefix docs/site build` first runs `demo/build.mjs`. It reads `src/index.html`, copies its stylesheet dependencies and the real request renderer's transitive ESM imports into generated `public/demo/`, and adds only a browser adapter, bootstrap, and presentation overrides. A SHA-256 manifest makes the copied assets auditable. Generated output is not committed. Documentation CI also watches `src/**` so app UI changes rebuild the demo.

`bootstrap.mjs` installs `window.client` before loading the real `ui/app.js`. Only request-editor, dialog-enter, and password-visibility scripts run; Electron integrations are not initialized. `window.appReady` gates the ready message. The parent and iframe validate message source/origin and accept only the three sample selections. No request bodies, credentials, or response bodies are sent to the parent.

## Supported flow

1. Open Login / Body, change the fictional email, and press Send.
2. Login captures `{{authToken}}`; Profile reuses it. Sending Profile before Login returns a sample 401.
3. In Orders / Params, change `limit` (1–100) or add `status` (`paid`, `shipped`, or `pending`). Responses reflect edits.

JSON errors, validation errors, unsupported methods/URLs, cancellation, and reset are intentional demo states. Reset replaces the iframe and clears both request drafts and captured tokens. Save affects memory only. No localStorage, Electron IPC, filesystem, cookies, backend, or external API is used by the adapter. The existing `connect-src 'none'` CSP remains in place. Only `https://api.freerider.example` is simulated. Interceptors/assertion expressions are not evaluated; native-only methods fail with an explicit desktop-app message. Timings include an artificial delay and are labeled as simulated, not a performance benchmark.

## Local verification

```sh
npm install --prefix docs/site --no-package-lock
npm run --prefix docs/site test:demo
npm run --prefix docs/site build
(cd docs/site && npx playwright install chromium)
npm run --prefix docs/site smoke:demo
```

The smoke test serves the built site under `/free-rider/`, exercises the actual iframe, and captures desktop/mobile/English previews in `.vitepress/demo-artifacts/`. CI uploads them as `renderer-demo-preview` and blocks Pages deployment on a failing smoke test. After editing renderer source during `vitepress` development, run `node docs/site/demo/build.mjs` again to refresh generated assets.
