// One-shot integration helper; excluded from the feature PR.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const updates = {
  "src/modules/git/create-ipc.cjs": `const path = require("node:path");
const { validateFolderName } = require("./index.cjs");

// Register through main's sender-validated handle, not directly on ipcMain.
function registerGitCreation(handle, chooseOpen, gitFor) {
  const parents = new Map();
  const pending = new Set();
  function check(id) {
    if (typeof id !== "string" || !id || id.length > 240)
      throw Error("올바른 컬렉션을 선택하세요.");
    if (pending.has(id)) throw Error("Git 저장소 생성 작업이 진행 중입니다.");
  }
  handle("git-create-parent", async (id) => {
    check(id);
    pending.add(id);
    try {
      const result = await chooseOpen({
        properties: ["openDirectory"],
        title: "새 Git 저장소를 만들 상위 폴더 선택",
        buttonLabel: "상위 폴더 선택",
      });
      if (result.canceled || !result.filePaths?.[0]) return null;
      parents.set(id, result.filePaths[0]);
      return { path: result.filePaths[0], separator: path.sep };
    } finally { pending.delete(id); }
  });
  handle("git-create", async (id, folderName) => {
    check(id);
    const parent = parents.get(id);
    if (!parent) throw Error("상위 폴더를 먼저 선택하세요.");
    validateFolderName(folderName);
    pending.add(id);
    try {
      const info = await gitFor(id).create(parent, folderName);
      parents.delete(id);
      return info;
    } finally { pending.delete(id); }
  });
}
module.exports = { registerGitCreation };
`,
  "src/ui/git-create.js": `import { $, el, button, field, input } from "./dom.js";

export function createGitRepositoryDialog({ collectionId, api, modal, onCreated, status }) {
  let parent = null, name = "", busy = false, restoreControls = () => {};
  const error = el("p", { id: "gitCreateError", class: "error", role: "alert" });
  const preview = el("code", { id: "gitCreatePreview", "aria-live": "polite" });
  const parentInput = input("", () => {}, {
    id: "gitCreateParent", readOnly: true, placeholder: "상위 폴더를 선택하세요",
  });
  function updatePreview() {
    preview.textContent = parent && name
      ? parent.path + (parent.path.endsWith(parent.separator) ? "" : parent.separator) + name
      : "상위 폴더와 폴더명을 입력하면 생성 경로가 표시됩니다.";
  }
  function setBusy(value) {
    busy = value;
    if (value) {
      const controls = [...$("dialog").querySelectorAll("button, input")];
      const states = controls.map(control => control.disabled);
      controls.forEach(control => { control.disabled = true; });
      restoreControls = () => controls.forEach((control, i) => { control.disabled = states[i]; });
    } else restoreControls();
  }
  const nameInput = input(name, value => {
    name = value;
    error.textContent = "";
    updatePreview();
  }, { id: "gitCreateFolderName", required: true, placeholder: "my-api", autocomplete: "off", spellcheck: false });
  const chooseParent = button("상위 폴더 선택…", async () => {
    if (busy) return;
    error.textContent = "";
    setBusy(true);
    try {
      const selected = await api["git-create-parent"](collectionId);
      if (!selected) return;
      parent = selected;
      parentInput.value = selected.path;
      parentInput.title = selected.path;
      updatePreview();
    } catch (e) { error.textContent = e.message; }
    finally { setBusy(false); nameInput.focus(); }
  }, { id: "gitCreateChooseParent" });
  const content = el("div", { class: "git-create-form" },
    el("p", { class: "muted", text: "지정한 이름의 새 폴더와 로컬 Git 저장소를 함께 만듭니다." }),
    field("상위 폴더", parentInput),
    el("div", { class: "actions" }, chooseParent),
    field("새 폴더명", nameInput),
    el("div", { class: "git-create-path" }, el("span", { text: "생성 경로" }), preview),
    el("p", { class: "hint", text: "main 브랜치로 생성합니다. 기존 폴더는 덮어쓰지 않으며, 컬렉션 저장과 커밋은 생성 후 직접 진행합니다." }),
    error,
  );
  updatePreview();
  modal("새 Git 저장소 만들기", content, async () => {
    if (busy) return false;
    if (!parent) { error.textContent = "상위 폴더를 먼저 선택하세요."; chooseParent.focus(); return false; }
    if (!name.trim()) { error.textContent = "새 폴더명을 입력하세요."; nameInput.focus(); return false; }
    error.textContent = "";
    setBusy(true);
    try {
      const info = await api["git-create"](collectionId, name);
      onCreated(info);
      status("새 Git 저장소를 생성하고 연결했습니다: " + info.root);
      return true;
    } catch (e) { error.textContent = e.message; return false; }
    finally { setBusy(false); }
  }, "Create"); // Existing reversible-dialog Enter handling recognizes this label.
  const lifecycle = new AbortController();
  $("dialog").addEventListener("cancel", event => {
    if (busy) event.preventDefault();
  }, { signal: lifecycle.signal });
  $("dialog").addEventListener("close", () => lifecycle.abort(), { once: true });
}
`,
};
const patches = [
  ["src/modules/git/index.cjs", "const run = promisify(execFile);", String.raw`const run = promisify(execFile);
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
}`],
  ["src/modules/git/index.cjs", "  async open(directory) {", `  async create(parent, folderName) {
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
      return info;
    } catch (error) {
      // Do not recursively delete: another process may have added user files.
      let removed = false;
      try { await fs.rmdir(directory); removed = true; } catch {}
      const detail = removed ? "" : " 생성된 폴더는 보존했습니다: " + directory;
      throw Error("Git 저장소를 만들지 못했습니다. Git 설치와 폴더 권한을 확인하세요." + detail, { cause: error });
    }
  }
  async open(directory) {`],
  ["src/modules/git/index.cjs", "{ timeout: 10000 },", "{ timeout: 10000, env: gitEnvironment() },"],
  ["src/modules/git/index.cjs", "        timeout: 15000,\n        maxBuffer:", "        timeout: 15000,\n        env: gitEnvironment(),\n        maxBuffer:"],
  ["src/modules/git/index.cjs", "module.exports = { GitWorkspace };", "module.exports = { GitWorkspace, validateFolderName };"],
  ["src/main.cjs", "handle(\"git-open\", async (id) => {", "require(\"./modules/git/create-ipc.cjs\").registerGitCreation(handle, chooseOpen, gitFor);\nhandle(\"git-open\", async (id) => {"],
  ["src/preload.cjs", "  \"git-open\",", "  \"git-open\",\n  \"git-create-parent\",\n  \"git-create\","],
  ["src/ui/app.js", "import { methodPicker } from \"./method-picker.js\";", "import { createGitRepositoryDialog } from \"./git-create.js\";\nimport { methodPicker } from \"./method-picker.js\";"],
  ["src/ui/app.js", `      el("h2", { text: "Git" }),
      button("Open repository folder", () =>
        action(async () => {
          const r = await api["git-open"](col.id);
          if (r) {
            gitInfo.set(col.id, r);
            render();
          }
        }),
      ),`, `      el("h2", { text: "Git" }),
      el("div", { class: "actions" },
        button("새 저장소 만들기", () => createGitRepositoryDialog({
          collectionId: col.id, api, modal, status,
          onCreated(info) { gitInfo.set(col.id, info); render(); },
        }), { id: "gitCreateRepository", class: "primary" }),
        button("Open repository folder", () =>
          action(async () => {
            const r = await api["git-open"](col.id);
            if (r) {
              gitInfo.set(col.id, r);
              render();
            }
          }),
        ),
      ),`],
  ["src/ui/app.js", "Select an existing local Git repository to share this collection.", "Open an existing local Git repository or create a new folder and repository to share this collection."],
];
const additions = {
  "src/style.css": `
.git-create-form {
  display: grid;
  gap: 12px;
  min-width: 0;
  word-break: keep-all;
  overflow-wrap: break-word;
}
.git-create-form p,
.git-create-form .field,
.git-create-form .actions { margin: 0; }
.git-create-form .field { min-width: 0; }
.git-create-path { display: grid; gap: 6px; min-width: 0; }
.git-create-path code { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-all; }
`,
};
const original = fs.readFileSync("src/modules/git/index.cjs");
const sha = crypto.createHash("sha1").update(`blob ${original.length}\0`).update(original).digest("hex");
if (sha !== "a24d1ef3c6e9303ebac44f22b1631918684059bc") throw Error("Git module changed; re-read before applying");
const output = new Map(Object.entries(updates));
for (const file of output.keys()) if (fs.existsSync(file)) throw Error("File already exists: " + file);
for (const [file, before, after] of patches) {
  const source = output.get(file) ?? fs.readFileSync(file, "utf8");
  if (source.split(before).length !== 2) throw Error("Expected exactly one anchor in " + file);
  output.set(file, source.replace(before, after));
}
for (const [file, addition] of Object.entries(additions)) output.set(file, (output.get(file) ?? fs.readFileSync(file, "utf8")) + addition);
for (const [file, source] of output) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, source);
  console.log(file);
}
