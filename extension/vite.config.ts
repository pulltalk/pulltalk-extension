import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';
import path from 'path';

export default defineConfig({
    build: {
        sourcemap: true,
        outDir: 'dist',
        emptyOutDir: true,
    },
    plugins: [
        webExtension({
            manifest: path.resolve(__dirname, 'manifest.json'),
            // Provide additional configuration if needed later
            watchFilePaths: [path.resolve(__dirname, 'src')],
            browser: 'chrome'
        })
    ]
});
