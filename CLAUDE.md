# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Grimoire of Chance: dice roller, card decks and random tables for tabletop RPGs, as an offline PWA. There is no build step and there are no dependencies; plain ES modules load straight from `index.html`. `README.md` has the file-by-file structure and dice notation.

(The parent `../CLAUDE.md` describes the shoryuken.me workspace; the one above that is an unrelated Rust project.)

## Commands

```bash
npm test                              # node --test tests/*.test.mjs
node --test tests/dice.test.mjs       # single file
npm run serve                         # python3 -m http.server 8080
```

## Shared-origin rules

Deployed at `/dice/` next to other apps on shoryuken.me:

- Cache names are `grimoire-v<version>`; `activate` deletes only caches with the `grimoire-` prefix.
- `sw.js` handles only requests inside `self.registration.scope` and reads only its own cache, never `caches.match()`.
- localStorage holds only `grimoire.v1`. Never call `localStorage.clear()`.
- Manifest `id` is `/grimoire-of-chance`. Never change it once released.
- `navigator.storage.persist()` applies to the whole origin; that's fine, but don't add anything that clears origin-wide storage.

## Releasing

`sw.js` is stale-while-revalidate: installed copies serve the cached file and refresh it in the background. When shipping a change, bump the version in both `package.json` and `CACHE_NAME` in `sw.js`, and add any new file to `ASSETS`. Precaching uses `cache: 'reload'` and background fetches use `cache: 'no-cache'`, so Cloudflare's 4 h max-age on JS/CSS can't pin an old file; keep both.

## Deployment

Live at https://shoryuken.me/dice/ (`/var/www/shoryuken.me/dice/`; server conventions are in `../CLAUDE.md`). Ship only the served files:

```bash
rsync -a --delete --chmod=D755,F644 index.html manifest.webmanifest sw.js css js icons root@185.163.204.17:/var/www/shoryuken.me/dice/
```
