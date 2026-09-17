const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseAnnouncementsAtom,
  isAllowedAnnouncementUrl,
} = require("../src/modules/announcements.cjs");

test("parses GitHub announcement Atom entries as plain text", () => {
  const xml = `<?xml version="1.0"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>tag:github.com,2008:Discussion/42</id>
        <published>2026-09-17T04:00:00Z</published>
        <title type="html">Free &amp; Rider 0.6</title>
        <link rel="alternate" href="https://github.com/dohyeon-kr/free-rider/discussions/42" />
        <content type="html">&lt;p&gt;새 기능 &lt;strong&gt;출시&lt;/strong&gt;&lt;/p&gt;&lt;script&gt;bad()&lt;/script&gt;</content>
      </entry>
    </feed>`;

  assert.deepEqual(parseAnnouncementsAtom(xml), [
    {
      id: "tag:github.com,2008:Discussion/42",
      title: "Free & Rider 0.6",
      excerpt: "새 기능 출시",
      url: "https://github.com/dohyeon-kr/free-rider/discussions/42",
      publishedAt: "2026-09-17T04:00:00Z",
    },
  ]);
});

test("rejects links outside the Free Rider discussions", () => {
  assert.equal(
    isAllowedAnnouncementUrl(
      "https://github.com/dohyeon-kr/free-rider/discussions/categories/announcements",
    ),
    true,
  );
  assert.equal(
    isAllowedAnnouncementUrl("https://github.com/dohyeon-kr/free-rider/discussions/123"),
    true,
  );
  assert.equal(isAllowedAnnouncementUrl("https://example.com/discussions/123"), false);
  assert.equal(
    isAllowedAnnouncementUrl("https://github.com/other/repo/discussions/123"),
    false,
  );
});
