const REVERSIBLE_CONFIRM_LABELS = new Set(["Create", "Save"]);
const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "file",
  "radio",
  "reset",
  "submit",
]);

export function shouldConfirmDialogOnEnter({
  key,
  isComposing = false,
  targetTagName = "",
  targetType = "text",
  confirmLabel = "",
}) {
  if (key !== "Enter" || isComposing) return false;
  if (targetTagName.toUpperCase() !== "INPUT") return false;
  if (NON_TEXT_INPUT_TYPES.has(targetType.toLowerCase())) return false;
  return REVERSIBLE_CONFIRM_LABELS.has(confirmLabel.trim());
}

export function installDialogEnterConfirm(documentRef = document) {
  const dialog = documentRef.getElementById("dialog");
  const confirmButton = documentRef.getElementById("dialogConfirm");
  if (!dialog || !confirmButton) return;

  dialog.addEventListener("keydown", (event) => {
    const target = event.target;
    if (event.key !== "Enter" || target?.tagName !== "INPUT") return;
    if (event.isComposing || event.keyCode === 229) return;

    // A dialog form currently uses method="dialog" and the cancel button is
    // the implicit submitter. Prevent that browser default for all input Enter
    // presses so Enter never closes an input modal by accident.
    event.preventDefault();

    if (
      shouldConfirmDialogOnEnter({
        key: event.key,
        isComposing: event.isComposing,
        targetTagName: target.tagName,
        targetType: target.type,
        confirmLabel: confirmButton.textContent || "",
      })
    ) {
      event.stopPropagation();
      confirmButton.click();
    }
  });
}

if (typeof document !== "undefined") installDialogEnterConfirm(document);
