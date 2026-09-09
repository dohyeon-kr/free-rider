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
  async diff() {
    return this.command(["diff", "HEAD", "--", "open-api.collection.json"]);
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
