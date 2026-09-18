import test from "node:test";
import assert from "node:assert/strict";
import { collection, request, normalize, requestTypeLabel } from "../src/ui/model.js";

test("new collections persist request type schema version", () => {
  const col = collection("Typed API");
  assert.equal(col.version, 3);
  assert.equal(request("", "http").type, "http");
  assert.equal(request("", "sse").type, "sse");
  assert.equal(request("", "websocket").type, "websocket");
});

test("normalizing legacy requests migrates them to HTTP", () => {
  const col = {
    version: 2,
    title: "Legacy",
    requests: [{ id: "r1", method: "POST", url: "https://example.com", vars: [] }],
    environments: [{ id: "e1", name: "Local", values: {} }],
  };
  normalize(col);
  assert.equal(col.version, 3);
  assert.equal(col.requests[0].type, "http");
  assert.deepEqual(col.requests[0].sse, { autoReconnect: true });
  assert.deepEqual(col.requests[0].websocket, {
    protocols: [],
    autoReconnect: true,
    messages: [],
  });
});

test("request type labels keep HTTP methods and name realtime transports", () => {
  assert.equal(requestTypeLabel({type:"http",method:"PATCH"}), "PATCH");
  assert.equal(requestTypeLabel({type:"sse"}), "SSE");
  assert.equal(requestTypeLabel({type:"websocket"}), "WS");
});


test("normalizing WebSocket messages gives presets stable editable fields", () => {
  const col = collection("Sockets");
  const ws = request("", "websocket");
  ws.websocket.messages = [{ name: "Subscribe", body: '{"type":"subscribe"}' }];
  col.requests.push(ws);
  normalize(col);
  assert.equal(ws.websocket.messages.length, 1);
  assert.ok(ws.websocket.messages[0].id);
  assert.equal(ws.websocket.messages[0].name, "Subscribe");
  assert.equal(ws.websocket.messages[0].format, "json");
  assert.equal(ws.websocket.messages[0].body, '{"type":"subscribe"}');
});
