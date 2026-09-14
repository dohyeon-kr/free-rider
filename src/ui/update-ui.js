const api = window.client;
const button = document.getElementById("updateButton");
const version = document.getElementById("appVersion");
let current = null;

function disabledLabel(reason) {
  return {
    development: "개발 빌드",
    "unsupported-platform": "업데이트 미지원",
    "unsupported-architecture": "업데이트 미지원",
    "developer-id-required": "자동 업데이트 · 서명 필요",
    initializing: "업데이트 준비 중",
  }[reason] || "자동 업데이트 꺼짐";
}

function render(state) {
  current = state;
  if (version && state?.currentVersion) version.textContent = `v${state.currentVersion}`;
  if (!button || !state) return;

  button.dataset.state = state.state;
  button.disabled = false;
  button.title = state.error || "";

  if (!state.enabled) {
    button.textContent = disabledLabel(state.reason);
    button.disabled = true;
    if (state.reason === "development") button.hidden = true;
    return;
  }

  button.hidden = false;
  if (state.state === "checking") {
    button.textContent = "업데이트 확인 중…";
    button.disabled = true;
  } else if (state.state === "downloading") {
    button.textContent = `${state.availableVersion || "새 버전"} 다운로드 중…`;
    button.disabled = true;
  } else if (state.state === "ready") {
    button.textContent = `${state.availableVersion || "새 버전"} 설치 및 재시작`;
  } else if (state.state === "installing") {
    button.textContent = "업데이트 설치 중…";
    button.disabled = true;
  } else if (state.state === "up-to-date") {
    button.textContent = "최신 버전";
  } else if (state.state === "error") {
    button.textContent = "업데이트 다시 확인";
  } else {
    button.textContent = "업데이트 확인";
  }
}

button?.addEventListener("click", async () => {
  try {
    if (current?.state === "ready") await api["update-install"]();
    else render(await api["update-check"]());
  } catch (error) {
    const status = document.getElementById("status");
    if (status) status.textContent = error.message;
  }
});

api.onUpdateStatus?.(render);
api["update-state"]().then(render).catch(() => {});
