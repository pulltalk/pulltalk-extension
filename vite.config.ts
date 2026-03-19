import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [
    webExtension({
      // Avoids HTTPS fetch to raw.githubusercontent.com (SchemaStore) during build.
      // Without this, builds can fail with ETIMEDOUT on restricted/slow networks.
      skipManifestValidation: true,
      manifest: "./manifest.json",
      additionalInputs: [
        "src/recorder/recorder.html",
        "src/editor/editor.html",
      ],
      watchFilePaths: ["src/**/*", "public/**/*", "manifest.json"],
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

