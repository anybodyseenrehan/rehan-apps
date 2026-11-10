import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { root, stagingRoot, pages } from './scripts/paths.mjs';
export default defineConfig({
  root: stagingRoot,
  publicDir: resolve(stagingRoot, 'public'),
  build: {
    outDir: resolve(root, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(Object.keys(pages).map(path =>
        [path === 'index.html' ? 'home' : path.split('/')[0].replace('.html', ''), resolve(stagingRoot, path)])),
    },
  },
});
