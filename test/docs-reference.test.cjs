const assert = require("node:assert/strict");
const test = require("node:test");
const {
  SCRIPT_REFERENCE_SOURCE,
  SCRIPT_REFERENCE_PAGE,
  extractScriptReference,
  loadScriptReference,
} = require("../src/modules/docs-reference.cjs");

test("extractScriptReference reads the app marker block", () => {
  const markdown = `# Ref\n\n<!-- free-rider-app-reference:start -->\n\`\`\`text\nreq.url\nctx.log("x")\n\`\`\`\n<!-- free-rider-app-reference:end -->\n`;
  assert.equal(extractScriptReference(markdown), 'req.url\nctx.log("x")');
});

test("extractScriptReference rejects missing markers", () => {
  assert.throws(
    () => extractScriptReference("# Ref"),
    /앱용 Script API 레퍼런스/,
  );
});

test("loadScriptReference fetches the canonical docs source with GET", async () => {
  let call;
  const result = await loadScriptReference(async (url, options) => {
    call = { url, options };
    return {
      ok: true,
      status: 200,
      text: async () =>
        `<!-- free-rider-app-reference:start -->\n\`\`\`text\nreq.method\n\`\`\`\n<!-- free-rider-app-reference:end -->`,
    };
  });

  assert.equal(call.url, SCRIPT_REFERENCE_SOURCE);
  assert.equal(call.options.method, "GET");
  assert.match(call.options.headers.accept, /text\/markdown/);
  assert.deepEqual(result, {
    text: "req.method",
    sourceUrl: SCRIPT_REFERENCE_SOURCE,
    referenceUrl: SCRIPT_REFERENCE_PAGE,
  });
});

test("loadScriptReference reports HTTP failures", async () => {
  await assert.rejects(
    loadScriptReference(async () => ({ ok: false, status: 503 })),
    /503/,
  );
});
