import { readFile, writeFile } from "node:fs/promises";

const path = "src/smoke.cjs";
const before = await readFile(path, "utf8");
const from = `  await js(\`document.querySelector('#scriptsButton').click()\`);
  if(!(await js(\`document.querySelector('[data-view=scripts] input[type=checkbox]').checked && document.querySelector('[aria-label="전역 전처리"]').value.includes('X-Global')\`)))
    throw Error("Global scripts were not restored from disk");`;
const to = `  await js(\`document.querySelector('#collectionHome').click(); [...document.querySelectorAll('.overview-item button')].find(b=>b.textContent==='Configure interceptors').click()\`);
  if(!(await js(\`document.querySelector('[data-view=scripts] input[type=checkbox]').checked && document.querySelector('[aria-label="Before Request Interceptor"]').value.includes('X-Global')\`)))
    throw Error("Collection interceptors were not restored from disk");`;
if (!before.includes(from)) throw new Error("Missing persisted global scripts smoke check");
const after = before.replace(from, to);
await writeFile(path, after);
