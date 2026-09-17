const { randomUUID } = require("node:crypto");

const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const MAX_EVENT_BYTES = 1024 * 1024;
const MAX_MESSAGE_BYTES = 1024 * 1024;
const DEFAULT_RETRY_MS = 3000;

function normalizeRealtimeUrl(kind, value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw Error("실시간 연결 URL이 올바르지 않습니다.");
  }
  if (url.username || url.password)
    throw Error("URL 대신 헤더나 쿼리 파라미터로 인증하세요.");
  if (kind === "sse") {
    if (!["http:", "https:"].includes(url.protocol))
      throw Error("SSE는 HTTP/HTTPS URL만 지원합니다.");
  } else if (kind === "websocket") {
    if (url.protocol === "http:") url.protocol = "ws:";
    else if (url.protocol === "https:") url.protocol = "wss:";
    if (!["ws:", "wss:"].includes(url.protocol))
      throw Error("WebSocket은 WS/WSS URL만 지원합니다.");
  } else {
    throw Error("지원하지 않는 실시간 연결 방식입니다.");
  }
  return url.toString();
}

function normalizeHeaders(value) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value))
    throw Error("헤더 형식이 올바르지 않습니다.");
  const entries = Object.entries(value);
  if (entries.length > 100) throw Error("헤더는 100개까지 사용할 수 있습니다.");
  const headers = {};
  for (const [key, raw] of entries) {
    const name = String(key).trim();
    const headerValue = String(raw ?? "");
    if (!name || !HEADER_NAME.test(name)) throw Error(`올바르지 않은 헤더 이름입니다: ${name || "(빈 값)"}`);
    if (/\r|\n/.test(headerValue)) throw Error(`${name} 헤더 값에 줄바꿈을 사용할 수 없습니다.`);
    headers[name] = headerValue;
  }
  return headers;
}

function normalizeProtocols(value) {
  if (value == null || value === "") return [];
  const list = Array.isArray(value) ? value : String(value).split(",");
  const protocols = list.map((item) => String(item).trim()).filter(Boolean);
  if (protocols.length > 10) throw Error("WebSocket 서브프로토콜은 10개까지 사용할 수 있습니다.");
  if (new Set(protocols).size !== protocols.length) throw Error("WebSocket 서브프로토콜이 중복되었습니다.");
  for (const protocol of protocols) {
    if (!HEADER_NAME.test(protocol)) throw Error(`올바르지 않은 WebSocket 서브프로토콜입니다: ${protocol}`);
  }
  return protocols;
}

class SseParser {
  constructor() {
    this.buffer = "";
    this.data = [];
    this.eventName = "";
    this.lastEventId = "";
    this.retry = DEFAULT_RETRY_MS;
  }

  feed(chunk) {
    this.buffer += String(chunk || "");
    const events = [];
    while (true) {
      const next = this.#takeLine();
      if (next === null) break;
      const event = this.#line(next);
      if (event) events.push(event);
    }
    if (Buffer.byteLength(this.buffer, "utf8") > MAX_EVENT_BYTES)
      throw Error("SSE 한 줄이 1MB 제한을 넘었습니다.");
    return events;
  }

  end() {
    const events = [];
    if (this.buffer) {
      const line = this.buffer;
      this.buffer = "";
      const event = this.#line(line);
      if (event) events.push(event);
    }
    const final = this.#dispatch();
    if (final) events.push(final);
    return events;
  }

  #takeLine() {
    for (let i = 0; i < this.buffer.length; i += 1) {
      const char = this.buffer[i];
      if (char !== "\n" && char !== "\r") continue;
      if (char === "\r" && i === this.buffer.length - 1) return null;
      const line = this.buffer.slice(0, i);
      const width = char === "\r" && this.buffer[i + 1] === "\n" ? 2 : 1;
      this.buffer = this.buffer.slice(i + width);
      return line;
    }
    return null;
  }

  #line(line) {
    if (line === "") return this.#dispatch();
    if (line.startsWith(":")) return null;
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "data") {
      this.data.push(value);
      if (Buffer.byteLength(this.data.join("\n"), "utf8") > MAX_EVENT_BYTES)
        throw Error("SSE 이벤트가 1MB 제한을 넘었습니다.");
    } else if (field === "event") this.eventName = value;
    else if (field === "id" && !value.includes("\0")) this.lastEventId = value;
    else if (field === "retry" && /^\d+$/.test(value))
      this.retry = Math.min(30000, Math.max(500, Number(value)));
    return null;
  }

  #dispatch() {
    if (!this.data.length) {
      this.eventName = "";
      return null;
    }
    const event = {
      event: this.eventName || "message",
      data: this.data.join("\n"),
      id: this.lastEventId,
      retry: this.retry,
    };
    if (Buffer.byteLength(event.data, "utf8") > MAX_EVENT_BYTES)
      throw Error("SSE 이벤트가 1MB 제한을 넘었습니다.");
    this.data = [];
    this.eventName = "";
    return event;
  }
}

function responseHeaders(headers) {
  try {
    return Object.fromEntries(headers || []);
  } catch {
    return {};
  }
}

function eventData(value) {
  if (typeof value === "string")
    return { data: value, binary: false, bytes: Buffer.byteLength(value, "utf8") };
  if (value instanceof ArrayBuffer)
    return { data: Buffer.from(value).toString("base64"), binary: true, bytes: value.byteLength };
  if (ArrayBuffer.isView(value)) {
    const bytes = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    return { data: bytes.toString("base64"), binary: true, bytes: bytes.byteLength };
  }
  return { data: String(value ?? ""), binary: false, bytes: Buffer.byteLength(String(value ?? ""), "utf8") };
}

class RealtimeManager {
  constructor({ emit, fetcher = fetch, WebSocketImpl = globalThis.WebSocket, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
    if (typeof emit !== "function") throw Error("RealtimeManager emit 함수가 필요합니다.");
    this.emit = emit;
    this.fetcher = fetcher;
    this.WebSocketImpl = WebSocketImpl;
    this.sleep = sleep;
    this.sessions = new Map();
  }

  open(config = {}) {
    const kind = String(config.kind || "").toLowerCase();
    const id = randomUUID();
    const state = {
      id,
      kind,
      url: normalizeRealtimeUrl(kind, config.url),
      headers: normalizeHeaders(config.headers),
      protocols: normalizeProtocols(config.protocols),
      autoReconnect: config.autoReconnect !== false,
      retry: DEFAULT_RETRY_MS,
      lastEventId: "",
      closed: false,
      manualClose: false,
      openedOnce: false,
      controller: null,
      socket: null,
      closedEmitted: false,
    };
    if (kind === "websocket" && Object.keys(state.headers).length)
      throw Error("WebSocket 사용자 정의 헤더는 현재 지원하지 않습니다. 쿼리 파라미터나 서브프로토콜을 사용하세요.");
    this.sessions.set(id, state);
    if (kind === "sse") this.#runSse(state).catch((error) => this.#fatal(state, error));
    else this.#connectWebSocket(state);
    return { id, kind, url: state.url };
  }

  send(id, data) {
    const state = this.sessions.get(String(id));
    if (!state || state.kind !== "websocket") throw Error("열린 WebSocket 연결을 찾을 수 없습니다.");
    if (!state.socket || state.socket.readyState !== 1) throw Error("WebSocket이 아직 연결되지 않았습니다.");
    const text = String(data ?? "");
    if (Buffer.byteLength(text, "utf8") > MAX_MESSAGE_BYTES) throw Error("WebSocket 메시지는 1MB 이하여야 합니다.");
    state.socket.send(text);
    this.#event(state, "sent", { data: text, bytes: Buffer.byteLength(text, "utf8") });
    return true;
  }

  close(id) {
    const state = this.sessions.get(String(id));
    if (!state) return false;
    state.manualClose = true;
    state.closed = true;
    state.controller?.abort();
    try {
      state.socket?.close(1000, "client close");
    } catch {}
    this.sessions.delete(state.id);
    this.#closed(state, { code: 1000, reason: "client close", clean: true });
    return true;
  }

  closeAll() {
    for (const id of [...this.sessions.keys()]) this.close(id);
  }

  #event(state, type, payload = {}) {
    this.emit({ id: state.id, kind: state.kind, type, at: Date.now(), ...payload });
  }

  #closed(state, payload = {}) {
    if (state.closedEmitted) return;
    state.closedEmitted = true;
    this.#event(state, "closed", payload);
  }

  #fatal(state, error) {
    if (state.closed) return;
    this.#event(state, "error", { message: error?.message || String(error) });
    state.closed = true;
    this.sessions.delete(state.id);
    this.#closed(state, { code: 0, reason: error?.message || "error", clean: false });
  }

  async #runSse(state) {
    while (!state.closed) {
      const reconnecting = state.openedOnce;
      this.#event(state, reconnecting ? "reconnecting" : "connecting", reconnecting ? { retry: state.retry } : {});
      if (reconnecting) await this.sleep(state.retry);
      if (state.closed) break;
      const controller = new AbortController();
      state.controller = controller;
      const headers = { Accept: "text/event-stream", "Cache-Control": "no-cache", ...state.headers };
      if (state.lastEventId && !Object.keys(headers).some((key) => key.toLowerCase() === "last-event-id"))
        headers["Last-Event-ID"] = state.lastEventId;
      try {
        const response = await this.fetcher(state.url, {
          method: "GET",
          headers,
          redirect: "error",
          signal: controller.signal,
        });
        if (!response.ok) throw Error(`SSE 연결 실패: HTTP ${response.status}`);
        const type = response.headers?.get?.("content-type") || "";
        if (!String(type).toLowerCase().includes("text/event-stream"))
          throw Error("SSE 응답 Content-Type이 text/event-stream이 아닙니다.");
        state.openedOnce = true;
        this.#event(state, "open", { status: response.status, headers: responseHeaders(response.headers) });
        const parser = new SseParser();
        const decoder = new TextDecoder();
        for await (const chunk of response.body || []) {
          if (state.closed) break;
          for (const event of parser.feed(decoder.decode(chunk, { stream: true }))) {
            state.lastEventId = event.id || state.lastEventId;
            state.retry = event.retry || state.retry;
            this.#event(state, "message", event);
          }
        }
        if (!state.closed) {
          const tail = decoder.decode();
          const finalEvents = [...parser.feed(tail), ...parser.end()];
          for (const event of finalEvents) {
            state.lastEventId = event.id || state.lastEventId;
            state.retry = event.retry || state.retry;
            this.#event(state, "message", event);
          }
        }
      } catch (error) {
        if (state.closed || error?.name === "AbortError") break;
        this.#event(state, "error", { message: error?.message || String(error) });
      } finally {
        state.controller = null;
      }
      if (!state.autoReconnect) break;
    }
    if (!state.closed) {
      state.closed = true;
      this.sessions.delete(state.id);
      this.#closed(state, { code: 0, reason: "stream ended", clean: true });
    }
  }

  #connectWebSocket(state) {
    if (state.closed) return;
    if (typeof this.WebSocketImpl !== "function") return this.#fatal(state, Error("현재 런타임에서 WebSocket을 사용할 수 없습니다."));
    this.#event(state, state.openedOnce ? "reconnecting" : "connecting", state.openedOnce ? { retry: state.retry } : {});
    let socket;
    try {
      socket = state.protocols.length ? new this.WebSocketImpl(state.url, state.protocols) : new this.WebSocketImpl(state.url);
    } catch (error) {
      return this.#fatal(state, error);
    }
    state.socket = socket;
    try { socket.binaryType = "arraybuffer"; } catch {}
    socket.addEventListener("open", () => {
      if (state.closed) return;
      state.openedOnce = true;
      this.#event(state, "open", { protocol: socket.protocol || "" });
    });
    socket.addEventListener("message", (event) => {
      if (state.closed) return;
      const payload = eventData(event.data);
      if (payload.bytes > MAX_MESSAGE_BYTES) {
        this.#event(state, "error", { message: "WebSocket 메시지가 1MB 제한을 넘었습니다." });
        return;
      }
      this.#event(state, "message", payload);
    });
    socket.addEventListener("error", (event) => {
      if (!state.closed) this.#event(state, "error", { message: event?.message || "WebSocket 연결 오류" });
    });
    socket.addEventListener("close", async (event) => {
      if (state.socket === socket) state.socket = null;
      if (state.closed || state.manualClose) return;
      if (state.autoReconnect) {
        await this.sleep(state.retry);
        if (!state.closed) this.#connectWebSocket(state);
        return;
      }
      state.closed = true;
      this.sessions.delete(state.id);
      this.#closed(state, { code: event.code || 0, reason: event.reason || "", clean: !!event.wasClean });
    });
  }
}

function createRealtimeManager(options) {
  return new RealtimeManager(options);
}

module.exports = {
  createRealtimeManager,
  RealtimeManager,
  SseParser,
  normalizeRealtimeUrl,
  normalizeHeaders,
  normalizeProtocols,
};