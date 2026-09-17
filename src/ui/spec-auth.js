import { el, field, input, secretInput, select } from "./dom.js";

export function specAuthEditor(initial = { type: "none" }, onChange = () => {}) {
  let auth = initial.type === "basic"
    ? { type: "basic", username: initial.username || "", password: initial.password || "" }
    : { type: "none" };
  const notify = () => onChange(structuredClone(auth));
  const details = el("div");
  const type = select(auth.type, [["none", "No Auth"], ["basic", "Basic Auth"]], value => {
    auth = value === "basic" ? { type: "basic", username: "", password: "" } : { type: "none" };
    draw();
    notify();
  }, { "aria-label": "Specification authentication", "data-spec-auth-type": "" });

  function draw() {
    details.hidden = auth.type !== "basic";
    details.replaceChildren();
    if (auth.type !== "basic") return;
    details.append(
      field("Username", input(auth.username, value => {
        auth.username = value;
        notify();
      }, { "aria-label": "Specification username", "data-spec-auth-username": "", autocomplete: "off", spellcheck: false })),
      field("Password", secretInput(auth.password, value => {
        auth.password = value;
        notify();
      }, { "aria-label": "Specification password", "data-spec-auth-password": "", autocomplete: "off", spellcheck: false })),
      el("p", { class: "hint", text: "명세 다운로드 전용 인증입니다. 앱을 종료하면 삭제되며 컬렉션 저장·Export·Git에 포함되지 않습니다. URL을 바꾸면 초기화됩니다. HTTPS 사용을 권장합니다." }),
    );
  }

  draw();
  return {
    element: el("div", { "data-spec-auth": "" }, field("Specification authentication", type), details),
    value: () => structuredClone(auth),
    reset() {
      auth = { type: "none" };
      type.value = "none";
      draw();
      notify();
    },
  };
}
