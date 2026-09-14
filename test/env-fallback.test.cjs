const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mergeVariableScopes } = require("../src/modules/env/index.cjs");

test("empty environment values fall back to collection or folder vars", () => {
  assert.deepEqual(
    mergeVariableScopes(
      { baseUrl: "https://vars.example.com", token: "vars-token" },
      { baseUrl: "", token: "", region: "kr" },
      {},
    ),
    {
      baseUrl: "https://vars.example.com",
      token: "vars-token",
      region: "kr",
    },
  );
});

test("non-empty environment values override vars and request vars remain highest precedence", () => {
  assert.deepEqual(
    mergeVariableScopes(
      { baseUrl: "https://vars.example.com", token: "vars-token" },
      { baseUrl: "https://env.example.com", token: "env-token" },
      { token: "request-token" },
    ),
    {
      baseUrl: "https://env.example.com",
      token: "request-token",
    },
  );
});

test("an explicitly empty environment value is preserved when there is no fallback var", () => {
  assert.deepEqual(
    mergeVariableScopes({}, { optional: "" }, {}),
    { optional: "" },
  );
});
