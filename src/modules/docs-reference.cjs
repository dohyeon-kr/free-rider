const SCRIPT_REFERENCE_SOURCE =
  "https://raw.githubusercontent.com/dohyeon-kr/free-rider/main/docs/site/reference/script-api.md";
const SCRIPT_REFERENCE_PAGE =
  "https://dohyeon-kr.github.io/free-rider/reference/script-api";
const APP_REFERENCE_START = "<!-- free-rider-app-reference:start -->";
const APP_REFERENCE_END = "<!-- free-rider-app-reference:end -->";

function extractScriptReference(markdown = "") {
  const source = String(markdown);
  const start = source.indexOf(APP_REFERENCE_START);
  const end = source.indexOf(APP_REFERENCE_END);
  if (start < 0 || end < 0 || end <= start)
    throw Error("문서에서 앱용 Script API 레퍼런스를 찾지 못했습니다.");

  let block = source
    .slice(start + APP_REFERENCE_START.length, end)
    .trim();
  const fenced = block.match(/^```(?:text|txt)?\s*\n([\s\S]*?)\n```$/i);
  if (fenced) block = fenced[1].trim();
  if (!block) throw Error("Script API 레퍼런스가 비어 있습니다.");
  return block;
}

async function loadScriptReference(fetcher) {
  if (typeof fetcher !== "function") throw Error("문서 fetcher가 필요합니다.");
  const response = await fetcher(SCRIPT_REFERENCE_SOURCE, {
    method: "GET",
    headers: {
      accept: "text/markdown, text/plain;q=0.9, */*;q=0.1",
    },
  });
  if (!response?.ok)
    throw Error(
      `Script API 문서를 불러오지 못했습니다. (${response?.status || "network"})`,
    );
  return {
    text: extractScriptReference(await response.text()),
    sourceUrl: SCRIPT_REFERENCE_SOURCE,
    referenceUrl: SCRIPT_REFERENCE_PAGE,
  };
}

module.exports = {
  SCRIPT_REFERENCE_SOURCE,
  SCRIPT_REFERENCE_PAGE,
  APP_REFERENCE_START,
  APP_REFERENCE_END,
  extractScriptReference,
  loadScriptReference,
};
