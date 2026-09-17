const api = window.client;
const trigger = document.getElementById("realtimeButton");

if (trigger) {
  let sessionId = null;
  let sessionKind = "sse";
  let connected = false;
  let disconnecting = false;

  const dialog = document.createElement("dialog");
  dialog.id = "realtimeDialog";
  dialog.className = "realtime-dialog";
  dialog.innerHTML = `
    <div class="realtime-shell">
      <div class="realtime-heading">
        <div>
          <span class="eyebrow">REALTIME</span>
          <h2>SSE / WebSocket</h2>
          <p>스트림과 양방향 연결을 별도 콘솔에서 확인합니다.</p>
        </div>
        <button type="button" class="icon-button realtime-close" aria-label="실시간 콘솔 닫기">×</button>
      </div>
      <div class="realtime-controls">
        <div class="realtime-kind" role="group" aria-label="실시간 연결 방식">
          <button type="button" data-kind="sse" class="active">SSE</button>
          <button type="button" data-kind="websocket">WebSocket</button>
        </div>
        <label class="realtime-field realtime-url-field">
          <span>URL</span>
          <div class="realtime-url-row">
            <input id="realtimeUrl" type="url" spellcheck="false" autocomplete="off" placeholder="https://api.example.com/events" />
            <button type="button" id="realtimeUseCurrent">현재 URL</button>
          </div>
        </label>
        <label class="realtime-field" id="realtimeHeadersField">
          <span>Headers <small>한 줄에 Key: Value</small></span>
          <textarea id="realtimeHeaders" rows="4" spellcheck="false" placeholder="Authorization: Bearer token"></textarea>
        </label>
        <label class="realtime-field" id="realtimeProtocolsField" hidden>
          <span>Subprotocols <small>쉼표로 구분</small></span>
          <input id="realtimeProtocols" spellcheck="false" autocomplete="off" placeholder="graphql-ws, chat" />
        </label>
        <p class="realtime-note" id="realtimeWsNote" hidden>WebSocket 사용자 정의 헤더는 표준 WebSocket API 제약으로 지원하지 않습니다. 인증은 쿼리 파라미터 또는 서브프로토콜을 사용하세요.</p>
        <div class="realtime-connect-row">
          <label class="realtime-check"><input id="realtimeReconnect" type="checkbox" checked /> 자동 재연결</label>
          <span id="realtimeState" class="realtime-state idle">대기</span>
          <button type="button" id="realtimeConnect" class="primary">연결</button>
        </div>
      </div>
      <div class="realtime-stream-head">
        <strong>이벤트</strong>
        <button type="button" id="realtimeClear">비우기</button>
      </div>
      <ol id="realtimeLog" class="realtime-log" aria-live="polite"></ol>
      <div id="realtimeComposer" class="realtime-composer" hidden>
        <textarea id="realtimeMessage" rows="3" spellcheck="false" placeholder="WebSocket 메시지"></textarea>
        <button type="button" id="realtimeSend" class="primary" disabled>보내기</button>
      </div>
    </div>`;
  document.body.append(dialog);

  const $ = (id) => dialog.querySelector(`#${id}`);
  const url = $("realtimeUrl");
  const headers = $("realtimeHeaders");
  const protocols = $("realtimeProtocols");
  const reconnect = $("realtimeReconnect");
  const state = $("realtimeState");
  const connect = $("realtimeConnect");
  const log = $("realtimeLog");
  const composer = $("realtimeComposer");
  const message = $("realtimeMessage");
  const send = $("realtimeSend");
  const headersField = $("realtimeHeadersField");
  const protocolsField = $("realtimeProtocolsField");
  const wsNote = $("realtimeWsNote");

  function setState(label, tone = "idle") {
    state.textContent = label;
    state.className = `realtime-state ${tone}`;
  }

  function parseHeaders(text) {
    const result = {};
    for (const raw of String(text || "").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const colon = line.indexOf(":");
      if (colon <= 0) throw Error(`헤더 형식이 올바르지 않습니다: ${line}`);
      const key = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).trim();
      if (Object.hasOwn(result, key)) throw Error(`헤더가 중복되었습니다: ${key}`);
      result[key] = value;
    }
    return result;
  }

  function appendEvent(event) {
    const item = document.createElement("li");
    item.className = `realtime-event type-${event.type}`;
    const meta = document.createElement("div");
    meta.className = "realtime-event-meta";
    const time = document.createElement("time");
    time.textContent = new Date(event.at || Date.now()).toLocaleTimeString();
    const badge = document.createElement("span");
    badge.className = "realtime-event-type";
    badge.textContent = event.type === "message" && event.event ? event.event : event.type;
    meta.append(time, badge);
    const body = document.createElement("pre");
    if (event.type === "message" || event.type === "sent") {
      body.textContent = event.binary ? `[binary · ${event.bytes || 0} bytes · base64]\n${event.data || ""}` : String(event.data ?? "");
    } else if (event.type === "error") body.textContent = event.message || "연결 오류";
    else if (event.type === "open") {
      body.textContent = event.status ? `HTTP ${event.status}` : event.protocol ? `protocol ${event.protocol}` : "연결됨";
    } else if (event.type === "reconnecting") body.textContent = `${event.retry || 3000}ms 후 다시 연결합니다.`;
    else if (event.type === "closed") body.textContent = event.reason || "연결 종료";
    else body.textContent = event.url || "";
    if (body.textContent) item.append(meta, body);
    else item.append(meta);
    log.append(item);
    while (log.children.length > 300) log.firstElementChild?.remove();
    log.scrollTop = log.scrollHeight;
  }

  function applyKind(kind) {
    sessionKind = kind;
    dialog.querySelectorAll("[data-kind]").forEach((button) => button.classList.toggle("active", button.dataset.kind === kind));
    const websocket = kind === "websocket";
    headersField.hidden = websocket;
    protocolsField.hidden = !websocket;
    wsNote.hidden = !websocket;
    composer.hidden = !websocket;
    url.placeholder = websocket ? "wss://api.example.com/socket" : "https://api.example.com/events";
  }

  async function disconnect() {
    if (!sessionId || disconnecting) return;
    disconnecting = true;
    try {
      await api["realtime-close"](sessionId);
    } catch (error) {
      appendEvent({ type: "error", at: Date.now(), message: error.message });
    } finally {
      sessionId = null;
      connected = false;
      disconnecting = false;
      connect.textContent = "연결";
      send.disabled = true;
      setState("대기");
    }
  }

  async function openConnection() {
    if (sessionId) return disconnect();
    try {
      const target = url.value.trim();
      if (!target) throw Error("연결 URL을 입력하세요.");
      log.replaceChildren();
      setState("연결 중", "pending");
      connect.disabled = true;
      const result = await api["realtime-open"]({
        kind: sessionKind,
        url: target,
        headers: sessionKind === "sse" ? parseHeaders(headers.value) : {},
        protocols: sessionKind === "websocket" ? protocols.value : [],
        autoReconnect: reconnect.checked,
      });
      sessionId = result.id;
      connect.textContent = "연결 끊기";
    } catch (error) {
      setState("오류", "error");
      appendEvent({ type: "error", at: Date.now(), message: error.message });
    } finally {
      connect.disabled = false;
    }
  }

  function currentRequestUrl() {
    const requestView = document.querySelector(".request-view");
    const inputs = requestView ? [...requestView.querySelectorAll(".urlbar input")] : [];
    const candidate = inputs.find((input) => input.id !== "httpMethod") || inputs[1];
    return candidate?.value?.trim() || "";
  }

  trigger.addEventListener("click", () => {
    if (!dialog.open) dialog.showModal();
    const current = currentRequestUrl();
    if (!url.value && current) url.value = current;
    queueMicrotask(() => url.focus());
  });
  dialog.querySelector(".realtime-close").addEventListener("click", () => dialog.close());
  dialog.querySelectorAll("[data-kind]").forEach((button) => button.addEventListener("click", () => {
    if (sessionId) return;
    applyKind(button.dataset.kind);
  }));
  $("realtimeUseCurrent").addEventListener("click", () => {
    const current = currentRequestUrl();
    if (!current) return appendEvent({ type: "error", at: Date.now(), message: "열려 있는 HTTP 요청 URL을 찾지 못했습니다." });
    url.value = current;
  });
  connect.addEventListener("click", openConnection);
  $("realtimeClear").addEventListener("click", () => log.replaceChildren());
  send.addEventListener("click", async () => {
    if (!sessionId || !connected) return;
    try {
      await api["realtime-send"](sessionId, message.value);
      message.value = "";
      message.focus();
    } catch (error) {
      appendEvent({ type: "error", at: Date.now(), message: error.message });
    }
  });
  message.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") send.click();
  });
  dialog.addEventListener("close", () => disconnect());

  api.onRealtimeEvent((event) => {
    if (!sessionId || event.id !== sessionId) return;
    appendEvent(event);
    if (event.type === "open") {
      connected = true;
      setState("연결됨", "ok");
      send.disabled = sessionKind !== "websocket";
    } else if (event.type === "connecting" || event.type === "reconnecting") {
      connected = false;
      setState(event.type === "connecting" ? "연결 중" : "재연결 중", "pending");
      send.disabled = true;
    } else if (event.type === "error") {
      setState("오류", "error");
    } else if (event.type === "closed") {
      sessionId = null;
      connected = false;
      connect.textContent = "연결";
      send.disabled = true;
      setState("종료");
    }
  });

  applyKind("sse");
}
