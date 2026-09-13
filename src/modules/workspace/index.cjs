const fs = require("node:fs/promises");
class WorkspaceStore {
  constructor(filename, codec) {
    this.filename = filename;
    this.codec = codec;
    this.queue = Promise.resolve();
  }
  async load() {
    try {
      const bytes=await fs.readFile(this.filename);
      const value=JSON.parse(this.codec.decryptString(bytes));
      if(!value.formatVersion) {
        try {await fs.writeFile(this.filename+".v1.bak",bytes,{flag:"wx",mode:0o600});}
        catch(error) {if(error.code!=="EEXIST")throw error;}
        value.formatVersion=2;
      }
      return value;
    } catch (e) {
      if (e.code === "ENOENT") return null;
      throw Error("저장된 워크스페이스를 읽지 못했습니다: " + e.message);
    }
  }
  save(value) {
    value = structuredClone(value);
    value.formatVersion=2;
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
