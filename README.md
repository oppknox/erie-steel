# Erie Steel

A live multiplayer railroad game. Two to five players auction charters, float companies, lay track from Cleveland to New York, take loans, and run trains.

This is an original 18xx-inspired table. It is not a rules clone of 1817 or any licensed title. The 1817 game at [18xx.games/game/266422](https://18xx.games/game/266422) is the spark: loans, 5-share companies, and a Northeast map.

## Play

Live table: [erie-steel.seanknox.workers.dev](https://erie-steel.seanknox.workers.dev)

Source: [github.com/oppknox/erie-steel](https://github.com/oppknox/erie-steel)

Open that URL (or run locally). From the landing screen:

- **Open a table** — get a 4-letter code; friends **Join** with that code. Two seats can start.
- **Practice hotseat** — play every seat in one browser.
- **Watch bots (Potato)** — 2-4 AI seats play with a plain-English play-by-play feed. **Take control** / **Release** any seat anytime. In-app only (no CLI flag).

A short first-run tutorial (under ~90s) appears once; **Skip** is always available. Progress is stored in `localStorage` (`erie-tutorial-done`).

The HUD only lists **legal** actions for the acting seat, with hover tooltips for 18xx jargon (float, OR, withhold, loans, and so on).

## Run locally

```
npm install
npm test
npm run build
npm run dev
```

`npm run dev` builds the client and starts Wrangler against `wrangler.jsonc` (Durable Object rooms + static `public/` assets).

To publish to your own Cloudflare account:

```
npm run deploy
```

## Bots

Potato bots pick only from `legalCommands` / `legalLaysAt` (`src/client/bot.ts`). Narration lives in `src/client/narrator.ts`.
