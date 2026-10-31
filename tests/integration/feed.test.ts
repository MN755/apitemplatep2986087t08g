import { SELF } from "cloudflare:test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Feed Worker integration", () => {
	beforeEach(() => {
		vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Unexpected outbound request"));
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("serves health from the deployed entry point", async () => {
		const response = await SELF.fetch("https://local.test/health");
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true });
	});

	it("requires a feed URL", async () => {
		const response = await SELF.fetch("https://local.test/rss");
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "Missing ?url=" });
	});

	it.each([
		"invalid", "file:///etc/passwd", "http://localhost/feed",
		"http://127.0.0.1/feed", "http://10.0.0.1/feed",
		"http://172.16.0.1/feed", "http://192.168.1.1/feed",
		"http://169.254.169.254/feed",
	])("rejects prohibited URL %s without an outbound request", async (url) => {
		const response = await SELF.fetch(`https://local.test/rss?url=${encodeURIComponent(url)}`);
		expect(response.status).toBe(400);
		expect(await response.json()).toHaveProperty("error");
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});

	it("returns JSON feeds with the original source and cache policy", async () => {
		vi.mocked(globalThis.fetch).mockImplementation(async () => new Response(
			JSON.stringify({ items: [{ title: "Example" }] }),
			{ headers: { "content-type": "application/json" } },
		));
		const response = await SELF.fetch("https://local.test/rss?url=https%3A%2F%2Ffeeds.example.org%2Ffeed");
		expect(response.status).toBe(200);
		expect(globalThis.fetch).toHaveBeenCalledWith("https://feeds.example.org/feed", expect.any(Object));
		expect(response.headers.get("cache-control")).toBe("public, max-age=120");
		expect(await response.json()).toEqual({
			source: "https://feeds.example.org/feed", type: "json",
			data: { items: [{ title: "Example" }] },
		});
	});

	it("reports upstream failures", async () => {
		vi.mocked(globalThis.fetch).mockImplementation(async () => new Response(null, { status: 503 }));
		const response = await SELF.fetch("https://local.test/rss?url=https%3A%2F%2Ffeeds.example.org%2Funavailable");
		expect(response.status).toBe(502);
		expect(await response.json()).toEqual({ error: "Upstream error 503" });
	});

  it("parses RSS XML using the deployed Worker runtime", async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async () => new Response(
      '<rss version="2.0"><channel><title>RSS title</title><link>https://feeds.example.org/</link><item><title>Item</title><link>https://feeds.example.org/item</link><pubDate>Today</pubDate><description><![CDATA[Summary <b>text</b>]]></description></item></channel></rss>',
      { headers: { "content-type": "application/rss+xml" } },
    ));
    const response = await SELF.fetch("https://local.test/rss?url=https%3A%2F%2Ffeeds.example.org%2Ffeed");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=120");
    expect(await response.json()).toMatchObject({ type: "rss", feedTitle: "RSS title", feedLink: "https://feeds.example.org/", items: [{ title: "Item", link: "https://feeds.example.org/item", pubDate: "Today", summary: "Summary <b>text</b>" }] });
  });

  it("parses Atom XML and selects alternate links", async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async () => new Response(
      '<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom title</title><link href="https://feeds.example.org/"/><entry><title>Atom item</title><link rel="self" href="https://feeds.example.org/raw"/><link rel="alternate" href="https://feeds.example.org/item"/><updated>2026-10-31T00:00:00Z</updated><summary>Atom summary</summary></entry></feed>',
      { headers: { "content-type": "application/atom+xml" } },
    ));
    const response = await SELF.fetch("https://local.test/rss?url=https%3A%2F%2Ffeeds.example.org%2Ffeed");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ feedTitle: "Atom title", items: [{ title: "Atom item", link: "https://feeds.example.org/item", pubDate: "2026-10-31T00:00:00Z", summary: "Atom summary" }] });
  });

  it.each([
    '<rss><channel></rss>',
    '<html><title>Not a feed</title></html>',
    '<!DOCTYPE rss [<!ENTITY secret SYSTEM "http://127.0.0.1/private">]><rss><channel><title>&secret;</title></channel></rss>',
  ])("rejects invalid or entity-bearing XML without extra fetches", async (xml) => {
    vi.mocked(globalThis.fetch).mockImplementation(async () => new Response(xml, { headers: { "content-type": "application/xml" } }));
    const response = await SELF.fetch("https://local.test/rss?url=https%3A%2F%2Ffeeds.example.org%2Ffeed");
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: "Could not parse feed" });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("keeps template routes outside the deployed feed Worker", async () => {
    expect((await SELF.fetch("https://local.test/tasks")).status).toBe(404);
    expect((await SELF.fetch("https://local.test/dummy/example", { method: "POST" })).status).toBe(404);
  });
});
