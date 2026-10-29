import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

const migrationsPath = path.join(__dirname, "..", "migrations");
const migrations = await readD1Migrations(migrationsPath);

export default defineConfig({
	esbuild: {
		target: "esnext",
	},
	plugins: [cloudflareTest({
		wrangler: { configPath: path.join(__dirname, "..", "wrangler.jsonc") },
		miniflare: {
			compatibilityFlags: ["experimental", "nodejs_compat"],
			bindings: { MIGRATIONS: migrations },
		},
	})],
	test: { setupFiles: ["./tests/apply-migrations.ts"] },
});
