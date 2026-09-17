const api = window.client;
const root = document.getElementById("view");
const CACHE_MS = 5 * 60 * 1000;
let cached = null;
let cachedAt = 0;
let pending = null;

function fresh() {
  return cached && Date.now() - cachedAt < CACHE_MS;
}

async function getReference() {
  if (fresh()) return cached;
  if (pending) return pending;
  pending = api["docs-reference-get"]()
    .then((value) => {
      cached = value;
      cachedAt = Date.now();
      return value;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

function enhance(view) {
  if (view.dataset.scriptReferenceEnhanced === "true") return;
  const code = view.querySelector(".code-block");
  if (!code) return;
  view.dataset.scriptReferenceEnhanced = "true";

  const fallback = code.textContent;
  const toolbar = document.createElement("div");
  toolbar.className = "script-reference-toolbar";

  const label = document.createElement("strong");
  label.textContent = "Script API 레퍼런스";

  const status = document.createElement("span");
  status.className = "script-reference-status";
  status.textContent = fresh() ? "docs 최신 내용" : "docs 불러오는 중…";

  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "text-button";
  openButton.textContent = "레퍼런스 바로가기 ↗";
  openButton.title = "브라우저에서 Script API Reference 열기";
  openButton.addEventListener("click", async () => {
    try {
      await api["docs-reference-open"]();
    } catch (error) {
      status.textContent = `레퍼런스를 열지 못했습니다 · ${error.message}`;
    }
  });

  toolbar.append(label, status, openButton);
  code.before(toolbar);

  const apply = (value) => {
    if (!view.isConnected) return;
    code.textContent = value.text;
    status.textContent = "docs에서 GET으로 불러온 최신 내용";
    status.title = value.sourceUrl || "";
  };

  if (fresh()) {
    apply(cached);
    return;
  }

  getReference()
    .then(apply)
    .catch((error) => {
      if (!view.isConnected) return;
      code.textContent = fallback;
      status.textContent = "docs를 불러오지 못해 내장 요약을 표시 중";
      status.title = error.message;
    });
}

function scan() {
  const view = root?.querySelector('[data-view="scripts"]');
  if (view) enhance(view);
}

if (root) {
  new MutationObserver(scan).observe(root, { childList: true, subtree: true });
  scan();
}
