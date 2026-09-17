// One-shot integration helper; removed before creating the feature PR.
const fs = require('node:fs');
const replacements = [
  ['src/ui/app.js', 'import { createGitRepositoryDialog } from "./git-create.js";', 'import { createGitRepositoryDialog } from "./git-create.js";\nimport { hasSyncChanges, offerSyncCommit } from "./git-sync-commit.mjs";'],
  ['src/ui/app.js', '  const n=result.counts;\n  next.lastSync=', '  const n=result.counts;\n  const changesApplied = hasSyncChanges(col, next);\n  next.lastSync='],
  ['src/ui/app.js', '  syncReviews.delete(col.id);render();status(col.lastSync);\n  const target = env(col);', `  syncReviews.delete(col.id);render();status(col.lastSync);
  const offerCommit = () => {
    const repository = gitInfo.get(col.id);
    if (!changesApplied || !repository?.root || !state.collections.includes(col)) return;
    offerSyncCommit({
      collection: col, repository, counts: n, api, modal, status,
      onCommitted(info) { gitInfo.set(col.id, info); render(); },
    });
  };
  const target = env(col);`],
  ['src/ui/app.js', '    }, "등록");\n  }\n}\nfunction endpointPicker(col)', `    }, "등록");
    // The baseUrl dialog must finish (confirm OR cancel) before offering Git.
    $("dialog").addEventListener("close", () => action(offerCommit), { once: true });
  } else {
    offerCommit();
  }
}
function endpointPicker(col)`],
  ['src/main.cjs', 'handle("git-commit", (id, message) => gitFor(id).commit(message));', 'handle("git-commit", (id, message) => gitFor(id).commit(message));\nrequire("./modules/git/sync-commit.cjs").registerGitSyncCommit(\n  handle, id => git.get(id), shareCollection,\n);'],
  ['src/preload.cjs', '  "git-commit",', '  "git-commit",\n  "git-sync-commit",'],
];
const sections = {
  'docs/site/guide/git.md': ['## 기본 흐름', `## 동기화 후 선택적으로 커밋하기

현재 컬렉션에 Git 저장소를 연결한 상태에서 OpenAPI 변경을 실제로 반영하면 **동기화 결과를 커밋할까요?** 창이 열립니다. URL과 로컬 명세 파일에서 시작한 동기화에 동일하게 적용됩니다. 미리보기 단계, 변경이 없는 반영, 동기화 저장 실패에는 커밋을 제안하지 않습니다.

창에서 저장소 경로·브랜치·추가/수정/삭제 건수를 확인하고 커밋 메시지를 수정할 수 있습니다. **저장 후 커밋**을 누르면 공유용 컬렉션을 저장한 뒤 \`open-api.collection.json\`만 커밋합니다. **건너뛰기** 또는 Escape로 닫으면 동기화 결과는 유지되며, 아직 승인하지 않은 Git 저장·커밋 작업은 실행하지 않습니다. 커밋은 입력창의 Enter로 자동 승인하지 않습니다.

\`baseUrl\` 등록 안내가 필요한 경우에는 그 창을 등록 또는 취소로 닫은 뒤 커밋을 제안합니다. Git 저장소가 연결되지 않은 다른 컬렉션에는 묻지 않습니다.

::: warning 컬렉션 전체가 커밋됩니다
동기화한 부분만이 아니라 현재 저장된 컬렉션 전체를 기록하므로 이전의 미커밋 컬렉션 변경도 포함될 수 있습니다. 환경변수 값은 기존 공유 규칙에 따라 제외하지만 요청에 직접 쓴 토큰·비밀번호는 포함될 수 있습니다. 다른 stage 파일과 원격 저장소는 변경하지 않습니다.
:::

Git 파일을 저장했지만 HEAD와 차이가 없으면 빈 커밋을 만들지 않습니다. 커밋이 실패해도 앱의 동기화 결과를 되돌리지 않으며, 오류를 확인한 뒤 같은 창에서 재시도할 수 있습니다. 실패 시 이미 저장되거나 stage된 컬렉션 파일은 보존합니다. 안내 후 저장소나 브랜치가 바뀌었다면 Git 화면에서 새로고침하고 직접 커밋하세요.

`],
  'docs/site/en/guide/git.md': ['## Basic flow', `## Optional commit after synchronization

After OpenAPI changes are actually applied to a collection with a connected Git repository, Free Rider asks whether to commit the result. Both URL and local-spec synchronization use this flow. Preview-only operations, unchanged results, and failed workspace saves do not trigger the offer.

The dialog shows the repository, branch, change counts, and an editable commit message. **저장 후 커밋** (Save and commit) exports the shareable collection and commits only \`open-api.collection.json\`. **건너뛰기** (Skip), or Escape, preserves the applied sync without running the unapproved Git save/commit. Enter in the message input does not automatically approve a commit.

When a \`baseUrl\` registration dialog is needed, it finishes first; either confirming or canceling it proceeds to the commit offer. Connections belonging to other collections do not trigger a prompt.

::: warning The whole saved collection is committed
This can include earlier uncommitted collection changes, not just the synchronization changes. Environment values are excluded using the existing sharing rules, but credentials written directly in requests can be included. Other staged files are preserved and no remote push is performed.
:::

If the saved file matches HEAD, no empty commit is created. A commit failure never rolls back the applied workspace synchronization. The dialog preserves the message and allows retry; any collection file already saved or staged remains intact. If the connected repository or branch changed after the prompt, refresh the Git view and commit there instead.

`],
};
for (const [file, [anchor, section]] of Object.entries(sections)) replacements.push([file, anchor, section + anchor]);
const output = new Map();
for (const [file, before, after] of replacements) {
  const source = output.get(file) ?? fs.readFileSync(file, 'utf8');
  if (source.split(before).length !== 2) throw Error('Expected exactly one source anchor: ' + file);
  output.set(file, source.replace(before, after));
}
for (const [file, source] of output) { fs.writeFileSync(file, source); console.log(file); }
