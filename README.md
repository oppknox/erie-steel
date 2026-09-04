# Erie Steel

**Open-source live multiplayer railroad game.** Two to five players auction charters, float companies, lay track from Cleveland to New York, take loans, and run trains — in the browser, with friends or bots.

Inspired by the 18xx family (loans, 5-share companies, Northeast map). MIT licensed. Play, fork, and contribute.

| | |
|---|---|
| **Play** | [erie-steel.seanknox.workers.dev](https://erie-steel.seanknox.workers.dev) |
| **Source** | [github.com/oppknox/erie-steel](https://github.com/oppknox/erie-steel) |
| **License** | [MIT](LICENSE) |

## Modes

From the landing screen:

- **Open a table** — get a 4-letter code; friends **Join** with that code. Two seats can start. Optional Discord webhook for turn notifications.
- **Practice hotseat** — play every seat in one browser.
- **Watch bots (Potato)** — 2–4 AI seats play with a plain-English play-by-play feed. **Take control** / **Release** any seat anytime. In-app only (no CLI flag).

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

## Code map

| Path | Role |
|------|------|
| `src/engine/` | Rules, legal moves, reduce |
| `src/room.ts` / `src/worker.ts` | Durable Object rooms + Worker entry |
| `src/client/` | UI, bots, narrator, tutorial |
| `src/discord.ts` | Optional Discord turn notifications |
| `src/client/bot.ts` | Potato bots (`legalCommands` / `legalLaysAt`) |
| `src/client/narrator.ts` | Play-by-play narration |

## Contributing

Issues, PRs, and forks are welcome. Clone the repo, run the commands above, and open a pull request against `main`.
