function rows(value) {
  return Array.isArray(value)
    ? value
        .filter((r) => r.enabled !== false && r.key)
        .map((r) => [r.key, String(r.value ?? "")])
    : Object.entries(value || {});
}
function effectiveRequest(collection, request) {
  const folders = (collection.folders || [])
    .filter(
      (f) =>
        request.group === f.path || request.group?.startsWith(f.path + "/"),
    )
    .sort((a, b) => a.path.length - b.path.length);
  const scopes = [collection, ...folders, request];
  const headers = new Map(),
    vars = {};
  let authConfig = { type: "none" };
  for (const scope of scopes) {
    for (const [key, value] of rows(scope.headers))
      headers.set(key.toLowerCase(), [key, value]);
    if(scope!==request) Object.assign(vars, Object.fromEntries(rows(scope.vars)));
    let auth = scope.authConfig;
    if (!auth && scope === request && request.auth === true)
      auth = { type: "bearer", token: "{{token}}" };
    if (auth && auth.type !== "inherit") authConfig = auth;
  }
  return {
    request: {
      ...request,
      headers: Object.fromEntries(headers.values()),
      authConfig,
      auth: false,
    },
    vars,
    scopedVars: Object.assign(
      {},
      Object.fromEntries(rows(request.vars)),
    ),
  };
}
module.exports = { rows, effectiveRequest };
