function serverUrl(server, source) {
  if (!server?.url) return "";
  const value = server.url.replace(/\{([^{}]+)\}/g, (match, name) => server.variables?.[name]?.default ?? match);
  if (/\{[^{}]+\}/.test(value)) return "";
  try {
    const url = source ? new URL(value, source) : new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href.replace(/\/$/, "") : "";
  } catch { return ""; }
}
module.exports = { serverUrl };
