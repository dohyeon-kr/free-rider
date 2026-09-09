const fs = require("node:fs/promises");
class WorkspaceStore {
  constructor(filename, codec) {
    this.filename = filename;
    this.codec = codec;
    this.queue = Promise.resolve();
  }
  async load() {
    try {
      return JSON.parse(
        this.codec.decryptString(await fs.readFile(this.filename)),
      );
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw Error("저장된 워크스페이스를 읽지 못했습니다: " + e.message);
    }
  }
  save(value) {
    const task = this.queue.then(async () => {
      if (!this.codec.isEncryptionAvailable())
        throw Error("운영체제의 암호화 저장소를 사용할 수 없습니다.");
      const bytes = this.codec.encryptString(JSON.stringify(value));
      await fs.writeFile(this.filename + ".tmp", bytes, { mode: 0o600 });
      await fs.rename(this.filename + ".tmp", this.filename);
    });
    this.queue = task.catch(() => {});
    return task;
  }
}
module.exports = { WorkspaceStore };
