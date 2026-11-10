# Personal App

One repository for the homepage and all four sub-apps.

## Where to edit

| Folder | Purpose |
| --- | --- |
| `index.html` | Homepage and app launcher |
| `apps/workout/` | Workout page, logic, icon, manifest, and offline worker |
| `apps/mobility/` | Mobility page, completion calendar, video helpers, and styles |
| `apps/zuri/` | Zuri’s Training page, potty logging, trends, icon, and styles |
| `apps/drone/` | Drone page, map logic, and styles |
| `shared/` | Common theme, hub manifest, and shared assets |
| `tests/` | Workout and mobility behavior tests |
| `docs/` | Workout reference and visual design references |
| `scripts/` | Local development and build support |

Each sub-app keeps its own `index.html`, `app.js`, and app-specific assets together. Edit shared colours and appearance in `shared/theme.css`.

## Commands

Run from this folder:

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

Vercel continues using `npm run build` and the `dist` output directory. The GitHub repository remains `anybodyseenrehan/rehan-apps`.

## Existing addresses stay the same

| App | Public address |
| --- | --- |
| Homepage | `/` |
| Workout | `/workout/` |
| Mobility | `/mobility/` |
| Zuri’s Training | `/zuri.html` |
| Drone Tracker | `/drone/` |

`scripts/paths.mjs` maps the organized source files to these existing addresses. Development and builds recreate `.app-source/` automatically; it is generated, ignored by Git, and should not be edited. Vite then produces `dist/` for deployment. The dev command watches the actual source folders and updates the preview automatically.

The existing JavaScript addresses, manifest paths, workout service-worker scope, and browser-storage keys are preserved. Saved records remain on their existing device and origin; no data migration is needed.

## Older working copies

Older projects are preserved outside this repository at `../archive/previous-workspaces/`. They include their Git history and any unfinished edits. The original `rehan-apps` checkout contains unfinished changes to its homepage and Zuri files; these have been retained without replacing the current app. Archived worktree paths have been repaired. Use this `app` folder for ongoing work and terminal pushes.
