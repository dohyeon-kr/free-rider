const ANNOUNCEMENTS_FEED =
  "https://github.com/dohyeon-kr/free-rider/discussions/categories/announcements.atom";
const ANNOUNCEMENTS_PAGE =
  "https://github.com/dohyeon-kr/free-rider/discussions/categories/announcements";
const DISCUSSION_PATH = /^\/dohyeon-kr\/free-rider\/discussions\/\d+\/?$/;

function decodeEntities(value = "") {
  return String(value).replace(
    /&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi,
    (match, entity) => {
      const key = entity.toLowerCase();
      if (key === "amp") return "&";
      if (key === "lt") return "<";
      if (key === "gt") return ">";
      if (key === "quot") return '"';
      if (key === "apos") return "'";
      if (key.startsWith("#x")) {
        const code = Number.parseInt(key.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      if (key.startsWith("#")) {
        const code = Number.parseInt(key.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return match;
    },
  );
}

function tagValue(entry, tag) {
  const match = entry.match(
    new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
  );
  return match?.[1] || "";
}

function plainText(value = "") {
  let text = String(value).replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/i, "$1");
  text = decodeEntities(decodeEntities(text));
  text = text
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text).replace(/\s+/g, " ").trim();
}

function entryLink(entry) {
  const alternate = entry.match(
    /<link\b(?=[^>]*\brel=["']alternate["'])[^>]*\bhref=["']([^"']+)["'][^>]*>/i,
  );
  const any = entry.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i);
  return decodeEntities(alternate?.[1] || any?.[1] || "");
}

function parseAnnouncementsAtom(xml, limit = 5) {
  const count = Math.max(1, Math.min(Number(limit) || 5, 20));
  return [...String(xml).matchAll(/<entry\b[\s\S]*?<\/entry>/gi)]
    .slice(0, count)
    .map(([entry]) => {
      const url = entryLink(entry);
      const id = plainText(tagValue(entry, "id")) || url;
      const title = plainText(tagValue(entry, "title")) || "공지";
      const body = plainText(
        tagValue(entry, "content") || tagValue(entry, "summary"),
      );
      return {
        id,
        title,
        excerpt: body.length > 220 ? `${body.slice(0, 217).trimEnd()}…` : body,
        url,
        publishedAt:
          plainText(tagValue(entry, "published")) ||
          plainText(tagValue(entry, "updated")),
      };
    })
    .filter((item) => item.id && isAllowedAnnouncementUrl(item.url));
}

async function loadAnnouncements(fetcher, limit = 5) {
  if (typeof fetcher !== "function") throw Error("공지 fetcher가 필요합니다.");
  const response = await fetcher(ANNOUNCEMENTS_FEED, {
    headers: {
      accept: "application/atom+xml, application/xml;q=0.9, text/xml;q=0.8",
    },
  });
  if (!response?.ok)
    throw Error(`공지 피드를 불러오지 못했습니다. (${response?.status || "network"})`);
  return parseAnnouncementsAtom(await response.text(), limit);
}

function isAllowedAnnouncementUrl(value) {
  try {
    const url = new URL(String(value));
    if (url.origin !== "https://github.com") return false;
    return (
      url.pathname === "/dohyeon-kr/free-rider/discussions/categories/announcements" ||
      DISCUSSION_PATH.test(url.pathname)
    );
  } catch {
    return false;
  }
}

module.exports = {
  ANNOUNCEMENTS_FEED,
  ANNOUNCEMENTS_PAGE,
  parseAnnouncementsAtom,
  loadAnnouncements,
  isAllowedAnnouncementUrl,
};
