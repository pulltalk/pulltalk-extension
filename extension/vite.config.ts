import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

const copyManifest = () => ({
  name: 'copy-manifest',
  writeBundle() {
    fs.copyFileSync('manifest.json', 'dist/manifest.json');
  },
});

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content.ts'), // entry point
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
  plugins: [copyManifest()],
});
