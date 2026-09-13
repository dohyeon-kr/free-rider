const fs=require("node:fs/promises");
const {createHash}=require("node:crypto");
const revision=text=>createHash("sha256").update(text).digest("hex");
class EnvironmentFiles {
  allowed=new Set();
  allow(path) {this.allowed.add(path);}
  async read(path) {
    if(!this.allowed.has(path)) throw Error("환경 파일을 먼저 연결하세요.");
    const stat=await fs.lstat(path);
    if(!stat.isFile() || stat.size>1024*1024) throw Error("1MB 이하 일반 파일만 연결할 수 있습니다.");
    const text=await fs.readFile(path,"utf8");
    return {path,text,revision:revision(text)};
  }
  async save(path,text,expected) {
    const current=await this.read(path);
    if(current.revision!==expected) throw Error("환경 파일이 외부에서 변경되었습니다. 다시 읽기로 확인한 후 저장하세요.");
    if(Buffer.byteLength(text)>1024*1024) throw Error("환경 파일은 1MB 이하여야 합니다.");
    await fs.writeFile(path,text,{mode:0o600});
    return this.read(path);
  }
}
module.exports={EnvironmentFiles};
