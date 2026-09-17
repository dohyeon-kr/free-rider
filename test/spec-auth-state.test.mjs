import test from "node:test";
import assert from "node:assert/strict";
import { SpecAuthSession } from "../src/ui/spec-auth-state.mjs";
const url = "https://example.test/openapi.json";
const auth = { type: "basic", username: "reader", password: "private-secret" };

test("credentials are reused only for the same collection and source URL", () => {
  const session = new SpecAuthSession();
  session.set("one", url, auth);
  assert.deepEqual(session.get("one", ` ${url} `), auth);
  assert.deepEqual(session.get("two", url), { type: "none" });
  assert.deepEqual(session.get("one", "https://other.test/openapi.json"), { type: "none" });
  assert.deepEqual(session.get("one", url), { type: "none" });
});
test("reading or mutating an input cannot silently change cached credentials", () => {
  const session = new SpecAuthSession();
  const input = { ...auth };
  session.set("one", url, input);
  input.password = "changed";
  const read = session.get("one", url);
  read.username = "changed";
  assert.deepEqual(session.get("one", url), auth);
});
test("No Auth, explicit clear, and a new app session forget credentials", () => {
  const session = new SpecAuthSession();
  session.set("one", url, auth);
  assert.deepEqual(new SpecAuthSession().get("one", url), { type: "none" });
  assert.equal(JSON.stringify(session), "{}");
  session.set("one", url, { type: "none" });
  assert.deepEqual(session.get("one", url), { type: "none" });
  session.set("one", url, auth);
  session.clear("one");
  assert.deepEqual(session.get("one", url), { type: "none" });
});
