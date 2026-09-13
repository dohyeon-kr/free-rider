export const $ = (id) => document.getElementById(id);
export function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k === "list") n.setAttribute(k, v);
    else if (k in n) n[k] = v;
    else n.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child != null) n.append(child);
  }
  return n;
}
export function button(text, fn, attrs = {}) {
  return el("button", { type: "button", text, onClick: fn, ...attrs });
}
export function field(label, input) {
  return el("label", { class: "field" }, el("span", { text: label }), input);
}
export function input(value, onChange, attrs = {}) {
  return el("input", {
    value: value ?? "",
    onInput: (e) => onChange(e.target.value),
    ...attrs,
  });
}
export function select(value, options, onChange, attrs = {}) {
  const n = el(
    "select",
    { onChange: (e) => onChange(e.target.value), ...attrs },
    options.map((o) => el("option", { value: o[0], text: o[1] })),
  );
  n.value = value;
  return n;
}
export function textarea(value, onChange, attrs = {}) {
  return el("textarea", {
    value: value || "",
    spellcheck: false,
    onInput: (e) => onChange(e.target.value),
    ...attrs,
  });
}
export function table(rows, columns, onChange, { secrets = false } = {}) {
  const wrap = el("div", { class: "kv-wrap" }),
    body = el("tbody");
  function draw() {
    body.replaceChildren();
    rows.forEach((row, i) => {
      const tr = el("tr");
      tr.append(
        el(
          "td",
          { class: "checkcell" },
          el("input", {
            type: "checkbox",
            checked: row.enabled !== false,
            "aria-label": "Enable row",
            onChange: (e) => {
              row.enabled = e.target.checked;
              onChange(rows);
            },
          }),
        ),
      );
      for (const col of columns) {
        const cell = el("td");
        if (col.options)
          cell.append(
            select(row[col.key] || col.options[0][0], col.options, (v) => {
              row[col.key] = v;
              onChange(rows);
            }),
          );
        else
          cell.append(
            input(
              row[col.key],
              (v) => {
                row[col.key] = v;
                onChange(rows);
              },
              {
                placeholder: col.placeholder || col.label,
                "aria-label": col.label,
                type: secrets && col.key === "value" ? "password" : "text",
                spellcheck: false,
              },
            ),
          );
        tr.append(cell);
      }
      tr.append(
        el(
          "td",
          { class: "checkcell" },
          button(
            "×",
            () => {
              rows.splice(i, 1);
              onChange(rows);
              draw();
            },
            { title: "Delete row", "aria-label": "Delete row" },
          ),
        ),
      );
      body.append(tr);
    });
  }
  wrap.append(
    el(
      "table",
      {},
      el(
        "thead",
        {},
        el(
          "tr",
          {},
          el("th", {}),
          columns.map((c) => el("th", { text: c.label })),
          el("th", {}),
        ),
      ),
      body,
    ),
    button(
      "+ Add row",
      () => {
        rows.push(
          Object.fromEntries([
            ["enabled", true],
            ...columns.map((c) => [c.key, c.options?.[0][0] || ""]),
          ]),
        );
        onChange(rows);
        draw();
      },
      { class: "text-button add-row" },
    ),
  );
  draw();
  return wrap;
}
