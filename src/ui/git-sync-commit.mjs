import { $, el, field, input } from "./dom.js";

// A new timestamp, or choosing to keep every local value in a conflict, is not
// an applied OpenAPI change. Preview/failure paths never call the offer.
export function hasSyncChanges(before, after) {
  return before.title !== after.title ||
    JSON.stringify(before.requests) !== JSON.stringify(after.requests);
}

export function offerSyncCommit({ collection, repository, counts = {}, api, modal, onCommitted, status }) {
  const dialog = $("dialog");
  if (!repository?.root || dialog.open) return false;
  const snapshot = structuredClone(collection);
  const expected = { root: repository.root, branch: repository.branch || "" };
  const added = counts.added || 0, updated = counts.updated || 0, removed = counts.removed || 0;
  let message = `Sync OpenAPI: +${added} ~${updated} -${removed}`;
  let busy = false, finished = false, restoreControls = () => {};
  const error = el("p", { id: "syncCommitError", class: "error", role: "alert", "aria-live": "polite" });
  const messageInput = input(message, value => { message = value; error.textContent = ""; }, {
    id: "syncCommitMessage", required: true, autocomplete: "off", spellcheck: false,
  });
  function setBusy(value) {
    busy = value;
    if (value) {
      const controls = [...dialog.querySelectorAll("button, input")];
      const states = controls.map(control => control.disabled);
      controls.forEach(control => { control.disabled = true; });
      restoreControls = () => controls.forEach((control, i) => { control.disabled = states[i]; });
    } else restoreControls();
  }
  modal("동기화 결과를 커밋할까요?", el("div", { class: "git-create-form", "data-view": "sync-commit" },
    el("p", { text: `${snapshot.title}의 동기화 변경이 반영되었습니다.` }),
    el("p", { id: "syncCommitSummary", text: `${added} 추가 · ${updated} 수정 · ${removed} 삭제` }),
    el("div", { class: "git-create-path" },
      el("span", { text: "커밋 대상 저장소 / 브랜치" }),
      el("code", { id: "syncCommitRepository", text: `${expected.root} / ${expected.branch || "detached HEAD"}` })),
    field("커밋 메시지", messageInput),
    el("p", { class: "hint", text: "저장된 컬렉션 전체를 open-api.collection.json에 기록합니다. 이전에 커밋하지 않은 컬렉션 변경도 포함되며, 다른 파일은 커밋하지 않습니다." }),
    el("p", { class: "hint", text: "환경변수 값은 제외됩니다. 요청 URL·Header·Body에 직접 쓴 비밀값은 포함될 수 있으므로 공유 전 {{변수}}로 바꿔주세요." }),
    el("p", { class: "hint", text: "건너뛰어도 동기화 결과는 유지됩니다. 원격 저장소로 Push하지 않습니다." }),
    error,
  ), async () => {
    if (busy) return false;
    if (!message.trim()) {
      error.textContent = "커밋 메시지를 입력하세요."; messageInput.focus(); return false;
    }
    error.textContent = "";
    setBusy(true);
    try {
      const result = await api["git-sync-commit"](snapshot, message.trim(), expected);
      finished = true;
      onCommitted(result.info);
      status(result.committed ? "동기화 결과를 Git에 커밋했습니다." : "동기화 결과를 저장했습니다. Git에 커밋할 변경이 없습니다.");
      return true;
    } catch (e) {
      error.textContent = "동기화는 이미 반영되었습니다. Git 커밋에 실패했습니다: " + e.message;
      status("동기화는 반영되었지만 Git 커밋에 실패했습니다.");
      return false;
    } finally { setBusy(false); }
  }, "저장 후 커밋"); // Deliberately not an implicit Enter-to-confirm action.
  const cancel = $("dialogCancel");
  const previousLabel = cancel.textContent;
  cancel.textContent = "건너뛰기";
  const lifecycle = new AbortController();
  dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); }, { signal: lifecycle.signal });
  dialog.addEventListener("close", () => {
    lifecycle.abort();
    cancel.textContent = previousLabel;
    if (!finished) status("Git 커밋을 건너뛰었습니다. 동기화 결과는 유지됩니다.");
  }, { once: true });
  return true;
}
