import { watch } from 'node:fs';
import { resolve } from 'node:path';
import { build, createServer, preview } from 'vite';
import { root, prepareSource } from './paths.mjs';
const mode = process.argv[2] || 'dev';
const configFile = resolve(root, 'vite.config.js');
if (mode === 'build') {
  prepareSource();
  await build({ configFile });
} else if (mode === 'dev') {
  prepareSource();
  const server = await createServer({ configFile });
  let pending;
  const refresh = () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      try { prepareSource(); } catch (error) { console.error(error); }
    }, 80);
  };
  const watchers = ['apps', 'shared', 'index.html'].map(path =>
    watch(resolve(root, path), { recursive: path !== 'index.html' }, refresh));
  const close = async () => {
    clearTimeout(pending);
    watchers.forEach(watcher => watcher.close());
    await server.close();
    process.exit(0);
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
  await server.listen();
  server.printUrls();
} else if (mode === 'preview') {
  const server = await preview({ configFile });
  server.printUrls();
} else {
  throw new Error('Expected dev, build, or preview.');
}
