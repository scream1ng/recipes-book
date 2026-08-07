import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // "server-only" is resolved by Next's webpack build via its own
      // bundled copy (next/dist/compiled/server-only) — plain Node/vitest
      // resolution can't see it. Stub it out so files that import it (for
      // the app's server-boundary safety, irrelevant in a test run) are
      // testable.
      "server-only": path.resolve(__dirname, "./src/lib/__test-stubs__/server-only.ts"),
    },
  },
});
