const path = require("node:path");
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
