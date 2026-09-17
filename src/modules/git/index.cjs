const { execFile } = require("node:child_process");
const { createHash, randomUUID } = require("node:crypto");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const path = require("node:path");
const run = promisify(execFile);
function gitEnvironment() {
  // A GUI launched from a Git hook must not inherit another repository's paths.
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
}
function validateFolderName(name) {
  if (
    typeof name !== "string" || !name || name !== name.trim() ||
    name === "." || name === ".." || name.toLowerCase() === ".git" ||
    /[\\/<>:"|?*\u0000-\u001f\u007f]/.test(name) || /[. ]$/.test(name) ||
    /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name) ||
    Buffer.byteLength(name, "utf8") > 255
  ) throw Error("폴더명이 올바르지 않습니다. 경로 구분자, 예약 이름, 앞뒤 공백 없이 새 폴더명을 입력하세요.");
  return name;
}
function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}
function samePosition(left, right) {
  return left.branch === right.branch && left.head === right.head;
}
// No shell, no network operations, no arbitrary paths supplied by the renderer.
class GitWorkspace {
  #root;
  #reviewed = null;
  async create(parent, folderName) {
    const name = validateFolderName(folderName);
    let directory;
    try {
      const root = await fs.realpath(parent);
      if (!(await fs.stat(root)).isDirectory()) throw Error("Not a directory");
      directory = path.join(root, name);
    } catch {
      throw Error("상위 폴더를 다시 선택하세요.");
    }
    // Exclusive mkdir rejects existing folders, files and even dangling symlinks.
    // Never use recursive mkdir or reinitialize an existing path here.
    try { await fs.mkdir(directory); }
    catch (error) {
      if (error.code === "EEXIST") throw Error("같은 이름의 파일 또는 폴더가 이미 존재합니다.");
      throw Error("폴더를 만들 수 없습니다. 상위 폴더의 접근 권한을 확인하세요.", { cause: error });
    }
    try {
      await run("git", ["-C", directory, "init", "--initial-branch=main"], {
        timeout: 15000, env: gitEnvironment(),
      });
      // Only replace the live connection after initialization AND status succeed.
      const next = new GitWorkspace();
      const info = await next.open(directory);
      this.#root = info.root;
      this.#reviewed = null;
      return info;
    } catch (error) {
      // Do not recursively delete: another process may have added user files.
      let removed = false;
      try { await fs.rmdir(directory); removed = true; } catch {}
      const detail = removed ? "" : " 생성된 폴더는 보존했습니다: " + directory;
      throw Error("Git 저장소를 만들지 못했습니다. Git 설치와 폴더 권한을 확인하세요." + detail, { cause: error });
    }
  }
  async open(directory) {
    const { stdout } = await run(
      "git",
      ["-C", directory, "rev-parse", "--show-toplevel"],
      { timeout: 10000, env: gitEnvironment() },
    );
    this.#root = stdout.trim();
    this.#reviewed = null;
    return this.status();
  }
  async command(args) {
    if (!this.#root) throw Error("Git 저장소 폴더를 먼저 선택하세요.");
    return (
      await run("git", ["-C", this.#root, ...args], {
        timeout: 15000,
        env: gitEnvironment(),
        maxBuffer: 1024 * 1024,
      })
    ).stdout;
  }
  async #branch() {
    return (await this.command(["branch", "--show-current"])).trim();
  }
  async #head() {
    try { return (await this.command(["rev-parse", "--verify", "HEAD"])).trim(); }
    catch { return ""; }
  }
  async #position() {
    return { branch: await this.#branch(), head: await this.#head() };
  }
  async #collectionDigest() {
    const target = path.join(this.#root, "open-api.collection.json");
    try {
      const stat = await fs.lstat(target);
      if (stat.isSymbolicLink()) throw Error("컬렉션 파일이 심볼릭 링크입니다.");
      if (!stat.isFile()) throw Error("컬렉션 경로가 파일이 아닙니다.");
      return digest(await fs.readFile(target));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }
  async status() {
    return {
      root: this.#root,
      status: await this.command(["status", "--short"]),
      branch: await this.#branch(),
      commits: await this.history(),
    };
  }
  async save(collection) {
    if (!this.#root) throw Error("Git 저장소 폴더를 먼저 선택하세요.");
    const target = path.join(this.#root, "open-api.collection.json");
    const temporary = path.join(
      this.#root,
      `.open-api.collection.json.${process.pid}.${randomUUID()}.tmp`,
    );
    try {
      await fs.writeFile(
        temporary,
        JSON.stringify(collection, null, 2) + "\n",
        { flag: "wx" },
      );
      try {
        const stat = await fs.lstat(target);
        if (stat.isSymbolicLink()) throw Error("컬렉션 파일이 심볼릭 링크입니다.");
        if (!stat.isFile()) throw Error("컬렉션 경로가 파일이 아닙니다.");
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      // Same-directory rename makes the replacement atomic and never follows a
      // symlink that appears between the lstat above and this operation.
      await fs.rename(temporary, target);
      this.#reviewed = null;
    } finally {
      await fs.rm(temporary, { force: true }).catch(() => {});
    }
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
  async #diffText() {
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
  async diff() {
    const beforePosition = await this.#position();
    const beforeDigest = await this.#collectionDigest();
    const text = await this.#diffText();
    const afterDigest = await this.#collectionDigest();
    const afterPosition = await this.#position();
    if (!samePosition(beforePosition, afterPosition) || beforeDigest !== afterDigest) {
      this.#reviewed = null;
      throw Error("Diff를 확인하는 동안 Git 상태가 변경되었습니다. 다시 확인하세요.");
    }
    this.#reviewed = {
      root: this.#root,
      branch: afterPosition.branch,
      head: afterPosition.head,
      collection: afterDigest,
    };
    return text;
  }
  async commit(message) {
    if (!message?.trim()) throw Error("커밋 메시지를 입력하세요.");
    const beforePosition = await this.#position();
    const beforeDigest = await this.#collectionDigest();
    const text = await this.#diffText();
    const afterDigest = await this.#collectionDigest();
    const afterPosition = await this.#position();
    if (!text.trim()) throw Error("커밋할 컬렉션 변경이 없습니다.");
    const reviewed = this.#reviewed;
    const changedDuringCheck =
      !samePosition(beforePosition, afterPosition) || beforeDigest !== afterDigest;
    const reviewIsCurrent = reviewed &&
      reviewed.root === this.#root &&
      reviewed.branch === afterPosition.branch &&
      reviewed.head === afterPosition.head &&
      reviewed.collection === afterDigest;
    if (changedDuringCheck || !reviewIsCurrent)
      throw Error("커밋 전에 View Diff에서 현재 컬렉션 변경 내용을 확인하세요.");
    // --only ensures existing staged changes in other files never enter this commit.
    await this.command(["add", "--", "open-api.collection.json"]);
    const stagedPosition = await this.#position();
    const stagedDigest = await this.#collectionDigest();
    if (!samePosition(afterPosition, stagedPosition) || stagedDigest !== afterDigest)
      throw Error("Diff 검토 후 Git 상태가 변경되었습니다. 다시 View Diff를 확인하세요.");
    await this.command([
      "commit",
      "--only",
      "-m",
      message.trim(),
      "--",
      "open-api.collection.json",
    ]);
    this.#reviewed = null;
    return this.status();
  }
}
module.exports = { GitWorkspace, validateFolderName };
