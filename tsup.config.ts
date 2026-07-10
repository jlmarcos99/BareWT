import { defineConfig } from "tsup";

export default defineConfig({
  entry: { main: "src/cli/index.ts" },
  format: "esm",
  target: "node22",
  clean: true,
});
