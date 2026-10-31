import { env } from "cloudflare:test";
import { fromHono } from "chanfana";
import { Hono } from "hono";
import { DummyEndpoint } from "../src/endpoints/dummyEndpoint";
import { tasksRouter } from "../src/endpoints/tasks/router";

// Retained template components have their own fixture. Deployed feed behavior
// is exercised separately through cloudflare:test SELF in feed.test.ts.
export const templateApp = new Hono();
const router = fromHono(templateApp);
router.post("/dummy/:slug", DummyEndpoint);
router.route("/tasks", tasksRouter);
export const templateWorker = {
  fetch: (input: string, init?: RequestInit) => templateApp.request(input, init, env),
};
