import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Only reason this file exists: tests need the same `@/` alias tsconfig gives the app.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
