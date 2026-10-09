import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Чистая логика без DOM — хватает node-окружения; алиас тот же, что в tsconfig.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
