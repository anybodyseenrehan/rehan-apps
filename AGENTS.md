# Personal App

This is the active, independent repository for Rehan’s personal app hub.

- The homepage is `index.html`; each sub-app is self-contained under `apps/`.
- Shared appearance and hub assets live in `shared/`.
- Preserve the charcoal and sage appearance and simple, uncluttered interfaces.
- Public addresses and static asset mappings are in `scripts/paths.mjs`. Preserve those addresses, service-worker scope, and browser-storage keys when reorganizing source.
- Edit source files, not the generated `.app-source/` or `dist/` folders.
- Use `npm run build` and `npm test` for validation.
- Preserve existing saved records. Older working copies are archived outside the repository in `../archive/previous-workspaces/`.
- When the user will push through Terminal, include a complete copyable command block using this repository’s actual path. Do not push unless asked.
