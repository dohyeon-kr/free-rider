export const REQUEST_TYPES = Object.freeze(["http", "sse", "websocket"]);

export function requestTypeLabel(value) {
  const type = typeof value === "string" ? value : value?.type;
  if (type === "sse") return "SSE";
  if (type === "websocket") return "WS";
  return String(value?.method || "HTTP").toUpperCase();
}

export function collection(title = "Untitled Collection") {
  return {
    id: crypto.randomUUID(),
    version: 3,
    title,
    source: "",
    description: "",
    requests: [],
    folders: [],
    vars: [],
    headers: [],
    authConfig: { type: "none" },
    interceptors: { enabled: false, before: "", after: "" },
    environments: [
      {
        id: crypto.randomUUID(),
        name: "Local",
        values: { baseUrl: "http://localhost:3000" },
      },
    ],
  };
}

export function request(group = "", type = "http") {
  const normalizedType = REQUEST_TYPES.includes(type) ? type : "http";
  return {
    id: crypto.randomUUID(),
    name: "Untitled Request",
    group,
    type: normalizedType,
    method: "GET",
    url: "{{baseUrl}}/",
    query: [],
    headers: [],
    vars: [],
    body: "",
    bodyType: "json",
    authConfig: { type: "inherit" },
    extract: {},
    assertions: [],
    sse: { autoReconnect: true },
    websocket: { protocols: [], autoReconnect: true, messages: [] },
    manual: true,
  };
}

export function normalize(c) {
  c.version = 3;
  c.id ||= crypto.randomUUID();
  c.folders ||= [];
  c.vars ||= [];
  c.headers ||= [];
  c.authConfig ||= { type: "none" };
  c.interceptors ||= { enabled: false, before: "", after: "" };
  c.interceptors.enabled = !!c.interceptors.enabled;
  c.interceptors.before ||= "";
  c.interceptors.after ||= "";
  c.environments?.forEach((e) => {
    e.id ||= crypto.randomUUID();
  });
  c.environments = c.environments?.length
    ? c.environments
    : collection().environments;
  for (const r of c.requests) {
    if (!REQUEST_TYPES.includes(r.type)) r.type = "http";
    r.assertions ||= [];
    r.vars ||= [];
    r.query ||= [];
    r.headers ||= [];
    r.authConfig ||= { type: "inherit" };
    r.sse ||= { autoReconnect: true };
    r.sse.autoReconnect = r.sse.autoReconnect !== false;
    r.websocket ||= { protocols: [], autoReconnect: true, messages: [] };
    r.websocket.protocols = Array.isArray(r.websocket.protocols)
      ? r.websocket.protocols
      : String(r.websocket.protocols || "").split(",").map((v) => v.trim()).filter(Boolean);
    r.websocket.autoReconnect = r.websocket.autoReconnect !== false;
    r.websocket.messages ||= [];
    r.websocket.messages = r.websocket.messages.map((message, index) => ({
      id: message?.id || crypto.randomUUID(),
      name: message?.name || "Message " + (index + 1),
      format: message?.format === "text" ? "text" : "json",
      body: String(message?.body ?? ""),
    }));
  }
  return c;
}

export function rowList(value) {
  return Array.isArray(value)
    ? value
    : Object.entries(value || {}).map(([key, value]) => ({
        key,
        value: String(value ?? ""),
        enabled: true,
      }));
}
