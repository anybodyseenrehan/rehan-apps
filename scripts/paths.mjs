import { fileURLToPath } from 'node:url';
import { mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const stagingRoot = resolve(root, '.app-source');
// Keep existing public URLs independent of the source folder layout.
export const pages = {
  'index.html': 'index.html',
  'workout/index.html': 'apps/workout/index.html',
  'meditation/index.html': 'apps/meditation/index.html',
  'mobility/index.html': 'apps/mobility/index.html',
  'zuri.html': 'apps/zuri/index.html',
  'drone/index.html': 'apps/drone/index.html',
};
export const assets = {
  'app-theme.css': 'shared/theme.css',
  'hub.webmanifest': 'shared/hub.webmanifest',
  'hub-icon.png': 'shared/assets/hub-icon.png',
  'zuri-icon.png': 'apps/zuri/icon.png',
  'zuri.css': 'apps/zuri/styles.css',
  'zuri.js': 'apps/zuri/app.js',
  'zuri-training.js': 'apps/zuri/training.js',
  'zuri-trends.js': 'apps/zuri/trends.js',
  'meditation.css': 'apps/meditation/styles.css',
  'meditation.js': 'apps/meditation/app.js',
  'meditation-core.js': 'apps/meditation/core.js',
  'mobility.css': 'apps/mobility/styles.css',
  'mobility.js': 'apps/mobility/app.js',
  'mobility-videos.js': 'apps/mobility/videos.js',
  'workout/app.js': 'apps/workout/app.js',
  'workout/sw.js': 'apps/workout/sw.js',
  'workout/icon.svg': 'apps/workout/icon.svg',
  'workout/manifest.webmanifest': 'apps/workout/manifest.webmanifest',
};
export function prepareSource() {
  const copy = (from, to) => {
    const destination = resolve(stagingRoot, to);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(resolve(root, from), destination);
  };
  for (const [url, source] of Object.entries(pages)) copy(source, url);
  for (const [url, source] of Object.entries(assets)) copy(source, 'public/' + url);
  copy('apps/drone/app.js', 'drone/app.js');
  copy('apps/drone/styles.css', 'drone/styles.css');
}
