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
    Object.assign(vars, Object.fromEntries(rows(scope.vars)));
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
      ...[...folders, request].map((s) => Object.fromEntries(rows(s.vars))),
    ),
  };
}
function assertions(response, rules = []) {
  let body;
  try {
    body = JSON.parse(response.body);
  } catch {
    body = response.body;
  }
  return rules
    .filter((r) => r.enabled !== false && r.expression)
    .map((rule) => {
      let actual;
      if (rule.expression === "res.status") actual = response.status;
      else if (rule.expression === "res.responseTime")
        actual = response.elapsed;
      else if (rule.expression.startsWith("res.body."))
        actual = rule.expression
          .slice(9)
          .split(".")
          .reduce((v, k) => v?.[k], body);
      else if (rule.expression.startsWith("res.headers."))
        actual = response.headers[rule.expression.slice(12).toLowerCase()];
      else if (rule.expression === "res.body") actual = body;
      let expected = rule.value;
      try {
        expected = JSON.parse(rule.value);
      } catch {}
      const passed =
        rule.operator === "exists"
          ? actual !== undefined
          : rule.operator === "contains"
            ? actual !== undefined && String(actual).includes(String(expected))
            : rule.operator === "lessThan"
              ? Number(actual) < Number(expected)
              : rule.operator === "notEquals"
                ? JSON.stringify(actual) !== JSON.stringify(expected)
                : JSON.stringify(actual) === JSON.stringify(expected);
      return { ...rule, actual, passed };
    });
}
module.exports = { rows, effectiveRequest, assertions };
