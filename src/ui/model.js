export function collection(title = "Untitled Collection") {
  return {
    id: crypto.randomUUID(),
    version: 2,
    title,
    source: "",
    description: "",
    requests: [],
    folders: [],
    vars: [],
    headers: [],
    authConfig: { type: "none" },
    environments: [
      {
        id: crypto.randomUUID(),
        name: "Local",
        values: { baseUrl: "http://localhost:3000" },
      },
    ],
  };
}
export function request(group = "") {
  return {
    id: crypto.randomUUID(),
    name: "Untitled Request",
    group,
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
    manual: true,
  };
}
export function normalize(c) {
  c.version=2;
  c.id ||= crypto.randomUUID();
  c.folders ||= [];
  c.vars ||= [];
  c.headers ||= [];
  c.authConfig ||= { type: "none" };
  c.environments?.forEach((e) => {
    e.id ||= crypto.randomUUID();
  });
  c.environments = c.environments?.length
    ? c.environments
    : collection().environments;
  for (const r of c.requests) {
    r.assertions ||= [];
    r.vars ||= [];
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
