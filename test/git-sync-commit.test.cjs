const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { existsSync } = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { GitWorkspace } = require("../src/modules/git/index.cjs");

async function fixture(t, sanitize = value => value) {
  assert.ok(existsSync(path.join(__dirname, "../src/modules/git/sync-commit.cjs")), "sync-commit handler must exist");
  const { registerGitSyncCommit } = require("../src/modules/git/sync-commit.cjs");
  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "free-rider-sync-commit-"));
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const git = new GitWorkspace();
  const info = await git.create(parent, "api");
  await git.command(["config", "user.name", "Sync Test"]);
  await git.command(["config", "user.email", "sync@example.invalid"]);
  await git.command(["config", "commit.gpgSign", "false"]);
  await git.command(["config", "core.hooksPath", path.join(info.root, ".git/hooks")]);
  let invoke;
  const connections = new Map([["c1", git]]);
  registerGitSyncCommit((name, fn) => {
    assert.equal(name, "git-sync-commit"); invoke = fn;
  }, id => connections.get(id), sanitize);
  const collection = { id: "c1", title: "API", requests: [{ id: "one", method: "GET", url: "/updated" }] };
  const expected = { root: info.root, branch: info.branch };
  return { git, invoke, collection, expected, connections,
    target: path.join(info.root, "open-api.collection.json"), root: info.root };
}

test("sync approval saves the latest collection and makes the first commit", async t => {
  const f = await fixture(t);
  const result = await f.invoke(f.collection, "  Sync OpenAPI +1  ", f.expected);
  assert.equal(result.committed, true);
  assert.equal(result.info.branch, "main");
  assert.equal(result.info.commits[0].message, "Sync OpenAPI +1");
  assert.deepEqual(JSON.parse(await f.git.command(["show", "HEAD:open-api.collection.json"])), f.collection);
});

test("commits only the collection and preserves other staged files", async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.root, "notes.txt"), "do not commit");
  await f.git.command(["add", "--", "notes.txt"]);
  await f.invoke(f.collection, "Sync OpenAPI", f.expected);
  assert.equal((await f.git.command(["diff", "--cached", "--name-only"])).trim(), "notes.txt");
  assert.equal((await f.git.command(["ls-tree", "--name-only", "HEAD"])).trim(), "open-api.collection.json");
});

test("an unchanged saved file does not create an empty commit", async t => {
  const f = await fixture(t);
  await f.invoke(f.collection, "Initial", f.expected);
  const head = await f.git.command(["rev-parse", "HEAD"]);
  const result = await f.invoke(f.collection, "No changes", f.expected);
  assert.equal(result.committed, false);
  assert.equal(await f.git.command(["rev-parse", "HEAD"]), head);
});

test("approval uses the existing sharing sanitizer before writing to Git", async t => {
  let sanitized = 0;
  const f = await fixture(t, value => {
    sanitized++;
    const { syncUndo, sourceFile, ...shared } = value;
    return { ...shared, environments: value.environments.map(e => ({ ...e, values: {} })) };
  });
  f.collection.environments = [{ id: "dev", values: { TOKEN: "not-for-git" } }];
  f.collection.sourceFile = "/private/spec.json";
  f.collection.syncUndo = { requests: [] };
  await f.invoke(f.collection, "Sync", f.expected);
  assert.equal(sanitized, 1);
  const saved = JSON.parse(await fs.readFile(f.target, "utf8"));
  assert.deepEqual(saved.environments[0].values, {});
  assert.equal(saved.syncUndo, undefined);
  assert.equal(saved.sourceFile, undefined);
  assert.equal(f.collection.environments[0].values.TOKEN, "not-for-git");
});

test("missing connections, invalid messages and changed repositories never save a file", async t => {
  const f = await fixture(t);
  await assert.rejects(f.invoke({ ...f.collection, id: "other" }, "Sync", f.expected), /저장소/);
  await assert.rejects(f.invoke(f.collection, " ", f.expected), /메시지/);
  await assert.rejects(f.invoke(f.collection, null, f.expected), /메시지/);
  await assert.rejects(f.invoke(f.collection, "Sync", { ...f.expected, root: "/untrusted" }), /저장소/);
  await assert.rejects(f.invoke(f.collection, "Sync", null), /저장소/);
  await assert.rejects(f.invoke(null, "Sync", f.expected), /컬렉션/);
  await assert.rejects(fs.stat(f.target), { code: "ENOENT" });
});

test("a branch changed after the prompt is rejected before saving", async t => {
  const f = await fixture(t);
  await f.git.command(["symbolic-ref", "HEAD", "refs/heads/other"]);
  await assert.rejects(f.invoke(f.collection, "Sync", f.expected), /브랜치/);
  await assert.rejects(fs.stat(f.target), { code: "ENOENT" });
});

test("a failed commit leaves the synchronized file intact and supports retry", async t => {
  const f = await fixture(t);
  const hook = path.join(f.root, ".git/hooks/pre-commit");
  await fs.writeFile(hook, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  const original = structuredClone(f.collection);
  await assert.rejects(f.invoke(f.collection, "Sync", f.expected));
  assert.deepEqual(JSON.parse(await fs.readFile(f.target, "utf8")), original);
  assert.deepEqual(f.collection, original);
  assert.deepEqual((await f.git.status()).commits, []);
  await fs.unlink(hook);
  assert.equal((await f.invoke(f.collection, "Retry", f.expected)).committed, true);
});

test("a symlinked collection file cannot be replaced or committed", async t => {
  const f = await fixture(t);
  const outside = path.join(f.root, "outside.txt");
  await fs.writeFile(outside, "keep");
  await fs.symlink(outside, f.target);
  await assert.rejects(f.invoke(f.collection, "Sync", f.expected), /심볼릭/);
  assert.equal(await fs.readFile(outside, "utf8"), "keep");
  assert.deepEqual((await f.git.status()).commits, []);
});

test("parallel approvals for the same collection are rejected", async t => {
  const f = await fixture(t);
  const first = f.invoke(f.collection, "Sync", f.expected);
  await assert.rejects(f.invoke(f.collection, "Duplicate", f.expected), /진행 중/);
  assert.equal((await first).committed, true);
  assert.equal((await f.git.status()).commits.length, 1);
});
