import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: [resolve(__dirname, "src/index.ts"), resolve(__dirname, "src/cli/index.ts")],
      formats: ["es"],
      fileName: (format, entryName) => {
        if (entryName === "index") return "index.js";
        return `${entryName}.js`;
      },
    },
    rollupOptions: {
      external: [/^node:/, "commander", "gray-matter", "@iarna/toml"],
      output: {
        preserveModules: true,
        preserveModulesRoot: "src",
      },
    },
    outDir: "dist",
    emptyOutDir: true,
    target: "node18",
  },
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  define: {
    global: "globalThis",
  },
});
