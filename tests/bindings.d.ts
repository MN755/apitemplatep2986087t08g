import type { D1Migration } from "cloudflare:test";

// Test-only binding supplied by the Cloudflare Vitest plugin configuration.
declare global {
  namespace Cloudflare {
    interface Env {
      MIGRATIONS: D1Migration[];
    }
  }
}
