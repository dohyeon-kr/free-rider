function parseEnv(text) {
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/,
    );
    if (!m) continue;
    let v = m[2];
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, "");
    Object.defineProperty(result, m[1], {
      value: v,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return result;
}
function shareableEnvironments(environments) {
  return environments.map((e) => ({
    ...e,
    values: Object.fromEntries(
      Object.keys(e.values)
        .sort()
        .map((k) => [k, ""]),
    ),
  }));
}
class EnvironmentStore {
  #tokens = new Map();
  resolve(environment) {
    return { ...environment.values, ...this.#tokens.get(environment.id) };
  }
  capture(id, values) {
    this.#tokens.set(id, { ...this.#tokens.get(id), ...values });
  }
  clear() {
    this.#tokens.clear();
  }
}
module.exports = { parseEnv, shareableEnvironments, EnvironmentStore };
