const api = window.client;
const button = document.getElementById("mcpButton");
const status = document.getElementById("status");

function render(state) {
  if (!button) return;
  if (state.enabled) {
    button.textContent = `MCP :${state.port}`;
    button.title = `${state.url} · 클릭해서 끄기`;
    button.setAttribute("aria-pressed", "true");
  } else {
    button.textContent = "MCP 꺼짐";
    button.title = "로컬 MCP 서버 켜기";
    button.setAttribute("aria-pressed", "false");
  }
}

async function refresh() {
  try {
    render(await api["mcp-state"]());
  } catch (error) {
    if (status) status.textContent = `MCP 상태 확인 실패: ${error.message}`;
  }
}

if (button) {
  button.onclick = async () => {
    button.disabled = true;
    try {
      const current = await api["mcp-state"]();
      const next = await api["mcp-toggle"](!current.enabled);
      render(next);
      if (status)
        status.textContent = next.enabled
          ? `MCP 서버 켜짐 · ${next.url} · 저장된 워크스페이스 기준`
          : "MCP 서버 꺼짐";
    } catch (error) {
      if (status) status.textContent = `MCP 전환 실패: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  };
}

Promise.resolve(window.appReady).then(refresh);
