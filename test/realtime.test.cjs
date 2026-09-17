const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SseParser,
  normalizeRealtimeUrl,
  normalizeHeaders,
  normalizeProtocols,
  RealtimeManager,
} = require("../src/modules/realtime/index.cjs");

test("normalizes SSE and WebSocket URLs", () => {
  assert.equal(normalizeRealtimeUrl("sse", "https://example.com/events"), "https://example.com/events");
  assert.equal(normalizeRealtimeUrl("websocket", "https://example.com/socket"), "wss://example.com/socket");
  assert.throws(() => normalizeRealtimeUrl("sse", "file:///tmp/a"), /HTTP\/HTTPS/);
  assert.throws(() => normalizeRealtimeUrl("websocket", "ftp://example.com"), /WS\/WSS/);
});

test("validates realtime headers and protocols", () => {
  assert.deepEqual(normalizeHeaders({ Authorization: "Bearer x" }), { Authorization: "Bearer x" });
  assert.throws(() => normalizeHeaders({ "Bad Header": "x" }), /헤더 이름/);
  assert.throws(() => normalizeHeaders({ X: "a\nb" }), /줄바꿈/);
  assert.deepEqual(normalizeProtocols("graphql-ws, chat"), ["graphql-ws", "chat"]);
  assert.throws(() => normalizeProtocols("chat,chat"), /중복/);
});

test("parses SSE across chunk boundaries with multiline data", () => {
  const parser = new SseParser();
  assert.deepEqual(parser.feed("id: 7\r"), []);
  assert.deepEqual(parser.feed("\nevent: update\ndata: hello\n"), []);
  const events = parser.feed("data: world\nretry: 1200\n\n");
  assert.deepEqual(events, [{ event: "update", data: "hello\nworld", id: "7", retry: 1200 }]);
});

test("SSE comments and id-only frames do not dispatch messages", () => {
  const parser = new SseParser();
  assert.deepEqual(parser.feed(": heartbeat\nid: 8\n\n"), []);
  assert.deepEqual(parser.feed("data: ok\n\n"), [{ event: "message", data: "ok", id: "8", retry: 3000 }]);
});

test("WebSocket manager sends messages and emits lifecycle events", async () => {
  const emitted = [];
  class FakeSocket extends EventTarget {
    constructor(url, protocols) {
      super();
      this.url = url;
      this.protocols = protocols;
      this.readyState = 0;
      this.protocol = "chat";
      queueMicrotask(() => {
        this.readyState = 1;
        this.dispatchEvent(new Event("open"));
      });
    }
    send(value) { this.lastSent = value; }
    close() { this.readyState = 3; }
  }
  const manager = new RealtimeManager({ emit: (event) => emitted.push(event), WebSocketImpl: FakeSocket, sleep: async () => {} });
  const session = manager.open({ kind: "websocket", url: "ws://example.com", protocols: ["chat"], autoReconnect: false });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(emitted.some((event) => event.type === "open"), true);
  assert.equal(manager.send(session.id, "hello"), true);
  assert.equal(emitted.some((event) => event.type === "sent" && event.data === "hello"), true);
  assert.equal(manager.close(session.id), true);
  assert.equal(emitted.some((event) => event.type === "closed"), true);
});

test("WebSocket custom headers fail explicitly instead of being ignored", () => {
  const manager = new RealtimeManager({ emit() {}, WebSocketImpl: class {} });
  assert.throws(() => manager.open({ kind: "websocket", url: "ws://example.com", headers: { Authorization: "Bearer x" } }), /사용자 정의 헤더/);
});