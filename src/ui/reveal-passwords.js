function enhance(input) {
  if (!(input instanceof HTMLInputElement)) return;
  if (input.type !== "password" || input.dataset.revealControl === "true") return;
  if (input.closest(".secret-input")) return;

  input.dataset.revealControl = "true";
  const wrap = document.createElement("div");
  wrap.className = "secret-input";
  input.parentNode.insertBefore(wrap, input);
  wrap.append(input);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "secret-toggle";
  toggle.textContent = "👁";
  toggle.title = "값 보기";
  toggle.setAttribute("aria-label", "값 보기");
  toggle.setAttribute("aria-pressed", "false");
  toggle.addEventListener("click", () => {
    const revealing = input.type === "password";
    input.type = revealing ? "text" : "password";
    toggle.title = revealing ? "값 가리기" : "값 보기";
    toggle.setAttribute("aria-label", revealing ? "값 가리기" : "값 보기");
    toggle.setAttribute("aria-pressed", String(revealing));
    input.focus();
  });
  wrap.append(toggle);
}

function scan(root = document) {
  if (root instanceof HTMLInputElement) enhance(root);
  root.querySelectorAll?.('input[type="password"]').forEach(enhance);
}

scan();
new MutationObserver((records) => {
  for (const record of records)
    for (const node of record.addedNodes)
      if (node instanceof Element) scan(node);
}).observe(document.body, { childList: true, subtree: true });
