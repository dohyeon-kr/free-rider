const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const path = require("node:path");
const run = promisify(execFile);
// No shell, no network operations, no arbitrary paths supplied by the renderer.
class GitWorkspace {
  #root;
  async open(directory) {
    const { stdout } = await run(
      "git",
      ["-C", directory, "rev-parse", "--show-toplevel"],
      { timeout: 10000 },
    );
    this.#root = stdout.trim();
    return this.status();
  }
  async command(args) {
    if (!this.#root) throw Error("Git 저장소 폴더를 먼저 선택하세요.");
    return (
      await run("git", ["-C", this.#root, ...args], {
        timeout: 15000,
        maxBuffer: 1024 * 1024,
      })
    ).stdout;
  }
  async status() {
    return {
      root: this.#root,
      status: await this.command(["status", "--short"]),
      branch: (await this.command(["branch", "--show-current"])).trim(),
      commits: await this.history(),
    };
  }
  async save(collection) {
    if (!this.#root) throw Error("Git 저장소 폴더를 먼저 선택하세요.");
    const target = path.join(this.#root, "open-api.collection.json");
    try {
      const stat = await fs.lstat(target);
      if (stat.isSymbolicLink())
        throw Error("컬렉션 파일이 심볼릭 링크입니다.");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    await fs.writeFile(target, JSON.stringify(collection, null, 2) + "\n");
    return this.status();
  }
  async history() {
    try { await this.command(["rev-parse", "--verify", "HEAD"]); }
    catch { return []; }
    const text = await this.command(["log", "-10", "--format=%h%x09%s", "--", "open-api.collection.json"]);
    return text.trim().split("\n").filter(Boolean).map(line => {
      const split = line.indexOf("\t");
      return {hash:line.slice(0,split), message:line.slice(split+1)};
    });
  }
  async diff() {
    let tracked = false;
    try { await this.command(["ls-files", "--error-unmatch", "--", "open-api.collection.json"]); tracked=true; } catch {}
    let head = false;
    try { await this.command(["rev-parse", "--verify", "HEAD"]); head=true; } catch {}
    if (head && tracked) return this.command(["diff", "HEAD", "--", "open-api.collection.json"]);
    const target = path.join(this.#root, "open-api.collection.json");
    try {
      if ((await fs.lstat(target)).isSymbolicLink()) throw Error("컬렉션 파일이 심볼릭 링크입니다.");
      const content = await fs.readFile(target, "utf8");
      return "--- /dev/null\n+++ open-api.collection.json\n" + content.split("\n").map(line=>"+"+line).join("\n");
    } catch (error) { if(error.code==="ENOENT") return ""; throw error; }
  }
  async commit(message) {
    if (!message?.trim()) throw Error("커밋 메시지를 입력하세요.");
    // --only ensures existing staged changes in other files never enter this commit.
    await this.command(["add", "--", "open-api.collection.json"]);
    await this.command([
      "commit",
      "--only",
      "-m",
      message,
      "--",
      "open-api.collection.json",
    ]);
    return this.status();
  }
}
module.exports = { GitWorkspace };
