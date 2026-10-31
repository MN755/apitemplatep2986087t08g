import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { templateApp as app } from "../templateWorker";

describe("Chanfana 3 / Zod 4 component migration", () => {
  it("validates and serializes the retained dummy endpoint", async () => {
    const response = await app.request("http://local.test/dummy/migration", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Migration" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, result: { slug: "migration", name: "Migration" } });
  });

  it("rejects invalid dummy input", async () => {
    const response = await app.request("http://local.test/dummy/migration", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: 42 }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false });
  });

  it("creates, reads and deletes a D1 task with boolean serialization", async () => {
    const input = { name: "Schema migration", slug: "schema-migration", description: "Compatibility regression", completed: false, due_date: "2025-12-31T23:59:59.000Z" };
    const created = await app.request("http://local.test/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    }, env);
    expect(created.status).toBe(201);
    const body = await created.json<{ result: { id: number; completed: boolean } }>();
    const id = body.result.id;
    try {
      expect(body.result.completed).toBe(false);
      const updatedInput = { ...input, name: "Updated", completed: true };
      const updated = await app.request(`http://local.test/tasks/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updatedInput, id: id + 1000 }),
      }, env);
      expect(updated.status).toBe(200);
      expect(await updated.json()).toMatchObject({ success: true, result: { ...updatedInput, id } });
      const read = await app.request(`http://local.test/tasks/${id}`, {}, env);
      expect(read.status).toBe(200);
      expect(await read.json()).toMatchObject({ success: true, result: { ...updatedInput, id } });
    } finally {
      const removed = await app.request(`http://local.test/tasks/${id}`, { method: "DELETE" }, env);
      expect(removed.status).toBe(200);
    }
  });
});
