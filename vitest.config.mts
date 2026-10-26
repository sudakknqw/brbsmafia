import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pure logic without a DOM: the node environment is enough; same alias as in tsconfig.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
