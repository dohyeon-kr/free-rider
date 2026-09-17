import { $, el, button, field, input } from "./dom.js";

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
