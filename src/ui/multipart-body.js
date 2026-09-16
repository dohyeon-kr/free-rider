const api = window.client;
const MARKER = "__freeRiderMultipart";
const enhanced = new WeakSet();
const availability = new Map();

function parseConfig(value) {
  try {
    const parsed = JSON.parse(value || "");
    return parsed?.[MARKER] === 1 && Array.isArray(parsed.parts) ? parsed : null;
  } catch {
    return null;
  }
}

function writeConfig(textarea, config) {
  textarea.value = JSON.stringify(config, null, 2);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function makeButton(text, title, onClick, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.title = title;
  if (className) button.className = className;
  button.addEventListener("click", onClick);
  return button;
}

function makeInput(value, placeholder, onInput) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value ?? "";
  input.placeholder = placeholder;
  input.addEventListener("input", () => onInput(input.value));
  return input;
}

function normalizePart(part) {
  part.id ||= crypto.randomUUID();
  part.kind = part.kind === "file" ? "file" : "text";
  part.key ??= "";
  part.enabled ??= true;
  if (part.kind === "text") part.value ??= "";
  return part;
}

function renderEditor(root, textarea, config) {
  config.parts = config.parts.map(normalizePart);
  root.replaceChildren();

  const note = document.createElement("p");
  note.className = "hint multipart-hint";
  note.textContent =
    "multipart/form-data · Content-Type과 boundary는 전송할 때 자동으로 설정됩니다. 파일 자체는 워크스페이스나 컬렉션 JSON에 저장되지 않습니다.";
  root.append(note);

  const rows = document.createElement("div");
  rows.className = "multipart-rows";
  root.append(rows);

  const save = () => writeConfig(textarea, config);

  const drawRows = () => {
    rows.replaceChildren();
    for (const part of config.parts) {
      const row = document.createElement("div");
      row.className = "multipart-row";

      const enabled = document.createElement("input");
      enabled.type = "checkbox";
      enabled.checked = part.enabled !== false;
      enabled.title = "필드 사용";
      enabled.setAttribute("aria-label", "필드 사용");
      enabled.addEventListener("change", () => {
        part.enabled = enabled.checked;
        save();
      });

      const kind = document.createElement("select");
      kind.setAttribute("aria-label", "multipart 필드 유형");
      for (const [value, label] of [
        ["text", "Text"],
        ["file", "File"],
      ]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        kind.append(option);
      }
      kind.value = part.kind;
      kind.addEventListener("change", async () => {
        if (part.kind === "file" && kind.value !== "file") {
          availability.delete(part.id);
          api["request-file-release"](part.id).catch(() => {});
          delete part.file;
        }
        part.kind = kind.value;
        if (part.kind === "text") part.value ??= "";
        save();
        drawRows();
      });

      const key = makeInput(part.key, "Field name", (value) => {
        part.key = value;
        save();
      });
      key.setAttribute("aria-label", "multipart 필드 이름");

      const valueCell = document.createElement("div");
      valueCell.className = "multipart-value";
      if (part.kind === "file") {
        const selected = availability.get(part.id);
        const choose = makeButton(
          part.file?.name ? "다시 선택" : "파일 선택",
          "업로드할 파일 선택",
          async () => {
            const file = await api["request-file-select"](part.id);
            if (!file) return;
            part.file = file;
            availability.set(part.id, true);
            save();
            drawRows();
          },
          "multipart-file-button",
        );
        const meta = document.createElement("span");
        meta.className = "multipart-file-meta";
        if (!part.file?.name) {
          meta.textContent = "선택된 파일 없음";
        } else {
          meta.textContent = `${part.file.name} · ${formatBytes(part.file.size)}${
            selected === false ? " · 다시 선택 필요" : selected === true ? "" : " · 확인 중"
          }`;
          if (selected === false) meta.classList.add("missing");
        }
        valueCell.append(choose, meta);
      } else {
        const value = makeInput(part.value, "Value", (next) => {
          part.value = next;
          save();
        });
        value.setAttribute("aria-label", "multipart 필드 값");
        valueCell.append(value);
      }

      const remove = makeButton("×", "필드 삭제", () => {
        if (part.kind === "file") {
          availability.delete(part.id);
          api["request-file-release"](part.id).catch(() => {});
        }
        config.parts = config.parts.filter((candidate) => candidate !== part);
        save();
        drawRows();
      }, "multipart-remove");
      remove.setAttribute("aria-label", "multipart 필드 삭제");

      row.append(enabled, kind, key, valueCell, remove);
      rows.append(row);
    }
  };

  const actions = document.createElement("div");
  actions.className = "multipart-actions";
  actions.append(
    makeButton("+ Text", "텍스트 필드 추가", () => {
      config.parts.push({
        id: crypto.randomUUID(),
        kind: "text",
        key: "",
        value: "",
        enabled: true,
      });
      save();
      drawRows();
    }, "text-button"),
    makeButton("+ File", "파일 필드 추가", () => {
      config.parts.push({
        id: crypto.randomUUID(),
        kind: "file",
        key: "file",
        enabled: true,
      });
      save();
      drawRows();
    }, "text-button"),
  );
  root.append(actions);
  drawRows();

  const fileIds = config.parts
    .filter((part) => part.kind === "file" && part.file?.name)
    .map((part) => part.id);
  if (fileIds.length) {
    api["request-file-status"](fileIds)
      .then((status) => {
        for (const id of fileIds) availability.set(id, status?.[id] === true);
        if (root.isConnected) drawRows();
      })
      .catch(() => {
        for (const id of fileIds) availability.set(id, false);
        if (root.isConnected) drawRows();
      });
  }
}

function enhanceBodyToolbar(toolbar) {
  if (enhanced.has(toolbar)) return;
  const select = toolbar.querySelector("select");
  if (!select) return;
  enhanced.add(toolbar);

  const initialType = select.value || "none";
  const missingSelectedType = !select.value;
  if (!Array.from(select.options).some((option) => option.value === "multipart")) {
    const option = document.createElement("option");
    option.value = "multipart";
    option.textContent = "Multipart / File";
    select.append(option);
  }

  const content = toolbar.closest(".request-content");
  const textarea = content?.querySelector('textarea[aria-label="Request body"]');
  select.dataset.previousBodyType = initialType;
  if (!textarea) return;

  let config = parseConfig(textarea.value);
  if (!config && missingSelectedType) {
    config = {
      [MARKER]: 1,
      previous: { type: "none", body: textarea.value },
      parts: [],
    };
    writeConfig(textarea, config);
  }
  select.dataset.previousBodyType = config?.previous?.type || initialType;
  if (!config) return;

  select.value = "multipart";
  textarea.hidden = true;
  textarea.setAttribute("aria-hidden", "true");
  const formatButton = toolbar.querySelector("button");
  if (formatButton) formatButton.hidden = true;

  const editor = document.createElement("div");
  editor.className = "multipart-editor";
  textarea.after(editor);
  renderEditor(editor, textarea, config);
}

function enhance() {
  document
    .querySelectorAll(".request-content .body-toolbar")
    .forEach(enhanceBodyToolbar);
}

document.addEventListener(
  "change",
  (event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const toolbar = select.closest(".body-toolbar");
    const content = toolbar?.closest(".request-content");
    const textarea = content?.querySelector('textarea[aria-label="Request body"]');
    if (!toolbar || !textarea) return;
    if (!Array.from(select.options).some((option) => option.value === "multipart")) return;

    const config = parseConfig(textarea.value);
    if (select.value === "multipart" && !config) {
      writeConfig(textarea, {
        [MARKER]: 1,
        previous: {
          type: select.dataset.previousBodyType || "json",
          body: textarea.value,
        },
        parts: [],
      });
      return;
    }
    if (select.value !== "multipart" && config) {
      const previous = config.previous || {};
      textarea.hidden = false;
      textarea.removeAttribute("aria-hidden");
      textarea.value = select.value === previous.type ? previous.body || "" : "";
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }
  },
  true,
);

new MutationObserver(enhance).observe(document.body, {
  childList: true,
  subtree: true,
});
queueMicrotask(enhance);
