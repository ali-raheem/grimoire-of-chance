# Grimoire of Chance

An installable, offline-first swiss-army-knife of randomness for tabletop RPGs:
dice expressions, playing/tarot/Deck-of-Many-Things cards, generic random tools,
and homebrew-able random tables — themed for D&D, with a quick-access bar of
per-character roll sets.

No build step, no dependencies, no server-side code. Plain HTML/CSS/JS modules
plus a service worker, so it installs as a PWA and works with the network off.

## Run it locally

```bash
python3 -m http.server 8080   # or any static file server
```

Then open `http://localhost:8080/` and, on a phone or desktop browser, use
the **Install** button (or the browser's "Add to Home Screen"/"Install app"
menu item) to add it as a standalone app. After the first load, it works
fully offline.

## Structure

| File | Purpose |
|---|---|
| `index.html` | App shell, all five views (Dice, Cards, Random, Tables, Sets) |
| `css/style.css` | Parchment/obsidian theme, light & dark |
| `js/dice.js` | Dice-expression parser/roller engine (`2d6+3`, `d20adv`, `4d6dl1`, exploding, rerolls, etc.) |
| `js/rng.js` | CSPRNG-backed random source + optional deterministic seeded mode |
| `js/cards.js` | Standard deck, Deck of Many Things, Tarot Major Arcana |
| `js/data.js` | Default roll sets, built-in random tables, name/NPC generators |
| `js/store.js` | `localStorage` persistence, import/export |
| `js/app.js` | UI wiring |
| `sw.js`, `manifest.webmanifest` | Offline caching + install metadata |
| `tests/dice.test.mjs` | Unit tests for the dice engine (`node --test tests/`) |

## Dice notation

See the in-app help (`?` button) for the full cheat sheet: modifiers like
`kh`/`kl`/`dh`/`dl`, `adv`/`dis`, exploding (`!`, `!!`), rerolls (`r`, `ro`),
`min`/`max` clamps, parentheses, and `xN` repeats (e.g. `4d6dl1 x6` for a
full ability-score array).

## Tests

```bash
node --test tests/
```

## Content credit

The Deck of Many Things card list is adapted from the *System Reference
Document 5.1* by Wizards of the Coast LLC, available under the Creative
Commons Attribution 4.0 International License. Effects shown in-app are
paraphrased summaries, not full rules text. This project is unofficial fan
content and is not affiliated with or endorsed by Wizards of the Coast.
