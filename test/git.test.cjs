const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { GitWorkspace } = require("../src/modules/git/index.cjs");
test("Git commits only collection while preserving unrelated staged work", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "api-git-"));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" });
  git("init", "-q");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.com");
  await fs.writeFile(path.join(dir, "README.md"), "base");
  git("add", ".");
  git("commit", "-qm", "init");
  await fs.writeFile(path.join(dir, "other.txt"), "unrelated");
  git("add", "other.txt");
  const w = new GitWorkspace();
  await w.open(dir);
  await w.save({ version: 1, requests: [] });
  await w.commit("API collection");
  assert.equal(
    git("show", "--format=", "--name-only", "HEAD").trim(),
    "open-api.collection.json",
  );
  assert.match(git("status", "--short"), /A  other.txt/);
});

test("Git supports an unborn repository, new-file diff and collection history", async t => {
  const fs = require("node:fs/promises"), os=require("node:os"), path=require("node:path");
  const {execFileSync}=require("node:child_process");
  const {GitWorkspace}=require("../src/modules/git/index.cjs");
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),"fr-git-new-"));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const git=(...args)=>execFileSync("git",["-C",dir,...args],{encoding:"utf8"});
  git("init","-q");git("config","user.name","Test");git("config","user.email","test@example.com");
  const w=new GitWorkspace();assert.deepEqual((await w.open(dir)).commits,[]);
  await w.save({id:"one"});assert.match(await w.diff(),/\+.*one/);
  await w.commit("first collection");
  assert.equal((await w.status()).commits[0].message,"first collection");
  assert.equal(await w.diff(),"");
});
