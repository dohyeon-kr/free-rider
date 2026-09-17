const { GitWorkspace } = require("./index.cjs");

// Register through main's sender-validated handler. The renderer can confirm a
// displayed repository, but cannot authorize a new filesystem path through IPC.
function registerGitSyncCommit(handle, getConnectedGit, shareCollection) {
  const pending = new Set();
  handle("git-sync-commit", async (collection, message, expected) => {
    const id = collection?.id;
    if (typeof id !== "string" || !id || id.length > 240)
      throw Error("올바른 컬렉션을 선택하세요.");
    if (typeof message !== "string" || !message.trim())
      throw Error("커밋 메시지를 입력하세요.");
    if (!expected || typeof expected.root !== "string" || !expected.root ||
        typeof expected.branch !== "string")
      throw Error("Git 저장소를 다시 확인하세요.");
    const connected = getConnectedGit(id);
    if (!connected) throw Error("이 컬렉션에 연결된 Git 저장소가 없습니다.");
    if (pending.has(id)) throw Error("Git 커밋이 진행 중입니다.");
    pending.add(id);
    try {
      const current = await connected.status();
      if (current.root !== expected.root)
        throw Error("연결된 Git 저장소가 변경되었습니다. Git 화면에서 확인한 뒤 다시 커밋하세요.");
      // Pin this operation to the authorized repository, even if another IPC
      // call reconnects the collection while this operation awaits Git.
      const git = new GitWorkspace();
      const opened = await git.open(current.root);
      if (opened.root !== expected.root || opened.branch !== expected.branch)
        throw Error("Git 저장소 또는 브랜치가 변경되었습니다. Git 화면에서 새로고침한 뒤 다시 커밋하세요.");
      const saved = await git.save(shareCollection(collection));
      if (!(await git.diff()).trim()) return { committed: false, info: saved };
      return { committed: true, info: await git.commit(message.trim()) };
    } finally {
      pending.delete(id);
    }
  });
}
module.exports = { registerGitSyncCommit };
