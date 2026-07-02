import { describe, it, expect } from "vitest";
import { fetchPublicPageText, htmlToText, FetchBlockedError } from "@/lib/fetch-public";

describe("fetchPublicPageText SSRF guard", () => {
  const internalTargets = [
    "http://169.254.169.254/latest/meta-data/", // cloud metadata
    "http://127.0.0.1/",
    "http://10.0.0.1/",
    "http://192.168.1.1/",
    "http://172.16.0.1/",
    "http://[::1]/",
    "http://2130706433/", // decimal-encoded 127.0.0.1
    "http://localhost/",
  ];

  it.each(internalTargets)("blocks internal/private target %s", async (url) => {
    await expect(fetchPublicPageText(url)).rejects.toBeInstanceOf(FetchBlockedError);
  });

  it("rejects non-http(s) protocols", async () => {
    await expect(fetchPublicPageText("ftp://example.com/")).rejects.toBeInstanceOf(FetchBlockedError);
    await expect(fetchPublicPageText("file:///etc/passwd")).rejects.toBeInstanceOf(FetchBlockedError);
  });
});

describe("htmlToText", () => {
  it("strips scripts, styles and tags, leaving readable text", () => {
    const html =
      "<html><head><style>.x{color:red}</style></head><body><script>evil()</script><h1>Title</h1><p>Hello&nbsp;world</p></body></html>";
    const text = htmlToText(html);
    expect(text).toContain("Title");
    expect(text).toContain("Hello world");
    expect(text).not.toContain("evil()");
    expect(text).not.toContain("color:red");
    expect(text).not.toMatch(/<[^>]+>/);
  });

  it("decodes common HTML entities", () => {
    expect(htmlToText("<p>A &amp; B &lt;tag&gt;</p>")).toContain("A & B <tag>");
  });
});
