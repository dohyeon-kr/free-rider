const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { GitWorkspace } = require("../src/modules/git/index.cjs");

async function repository(t, prefix = "api-git-") {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  git("init", "-q");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.com");
  return { dir, git };
}

async function initialCommit(dir, git) {
  await fs.writeFile(path.join(dir, "README.md"), "base\n");
  git("add", ".");
  git("commit", "-qm", "init");
}

test("Git commits only collection while preserving unrelated staged work", async (t) => {
  const { dir, git } = await repository(t);
  await initialCommit(dir, git);
  await fs.writeFile(path.join(dir, "other.txt"), "unrelated\n");
  git("add", "other.txt");
  const w = new GitWorkspace();
  await w.open(dir);
  await w.save({ version: 1, requests: [] });
  await w.diff();
  await w.commit("API collection");
  assert.equal(
    git("show", "--format=", "--name-only", "HEAD").trim(),
    "open-api.collection.json",
  );
  assert.match(git("status", "--short"), /A  other.txt/);
});

test("Git supports an unborn repository, new-file diff and collection history", async t => {
  const { dir, git } = await repository(t, "fr-git-new-");
  const w = new GitWorkspace();
  assert.deepEqual((await w.open(dir)).commits, []);
  await w.save({ id: "one" });
  assert.match(await w.diff(), /\+.*one/);
  await w.commit("first collection");
  assert.equal((await w.status()).commits[0].message, "first collection");
  assert.equal(await w.diff(), "");
});

test("Git requires a fresh diff review before commit", async t => {
  const { dir, git } = await repository(t, "fr-git-review-");
  await initialCommit(dir, git);
  const w = new GitWorkspace();
  await w.open(dir);
  await w.save({ version: 1, requests: [] });

  await assert.rejects(() => w.commit("unreviewed"), /View Diff/);
  await w.diff();

  await fs.writeFile(
    path.join(dir, "open-api.collection.json"),
    JSON.stringify({ version: 2, requests: [] }, null, 2) + "\n",
  );
  await assert.rejects(() => w.commit("changed after review"), /View Diff/);

  await w.diff();
  git("switch", "-qc", "review-branch");
  await assert.rejects(() => w.commit("wrong branch"), /View Diff/);

  await w.diff();
  await w.commit("reviewed collection");
  assert.equal(git("log", "-1", "--format=%s").trim(), "reviewed collection");
});

test("saving again invalidates an earlier diff review", async t => {
  const { dir, git } = await repository(t, "fr-git-save-review-");
  await initialCommit(dir, git);
  const w = new GitWorkspace();
  await w.open(dir);
  const collection = { version: 1, requests: [] };
  await w.save(collection);
  await w.diff();
  await w.save(collection);
  await assert.rejects(() => w.commit("stale review"), /View Diff/);
});

test("Git saves the collection atomically and refuses a symlink target", async t => {
  const { dir } = await repository(t, "fr-git-atomic-");
  const w = new GitWorkspace();
  await w.open(dir);
  const target = path.join(dir, "open-api.collection.json");

  await w.save({ id: "atomic" });
  assert.equal(
    await fs.readFile(target, "utf8"),
    JSON.stringify({ id: "atomic" }, null, 2) + "\n",
  );
  assert.equal(
    (await fs.readdir(dir)).some(name => name.includes("open-api.collection.json") && name.endsWith(".tmp")),
    false,
  );

  const protectedFile = path.join(dir, "protected.json");
  await fs.writeFile(protectedFile, "do not replace\n");
  await fs.rm(target);
  await fs.symlink(protectedFile, target);
  await assert.rejects(() => w.save({ id: "unsafe" }), /심볼릭 링크/);
  assert.equal(await fs.readFile(protectedFile, "utf8"), "do not replace\n");
  assert.equal(
    (await fs.readdir(dir)).some(name => name.includes("open-api.collection.json") && name.endsWith(".tmp")),
    false,
  );
});
