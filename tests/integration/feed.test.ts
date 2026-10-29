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
});
