# Last Man Standing

A Mortal Kombat-inspired Last Man Standing pool tracker built with [Astro](https://astro.build).

Pick a team each round. If your team loses, you're eliminated. Last fighter standing wins.

## Pages

- **Submit Pick** (`/enter`) — Register (Round 1) or submit picks each round
- **Arena** (`/`) — Current round, survivors, and live matches
- **Standings** (`/standings`) — Alive vs eliminated fighters, round schedule
- **Picks** (`/picks`) — Full pick grid across all rounds

All times are shown in **UK time** (Europe/London).

## Development

```bash
pnpm install
pnpm dev
```

## Deploy to Netlify

1. Connect the repo in [Netlify](https://app.netlify.com)
2. Build settings are pre-configured in `netlify.toml`:
   - Build command: `pnpm run build`
   - Publish directory: `dist`
3. Enable **Netlify Blobs** on the site (required for shared pick storage)
4. Functions deploy automatically from `netlify/functions/`

Or deploy with the Netlify CLI:

```bash
pnpm build
pnpm dlx netlify deploy --prod --dir=dist
```

## Player registration

Fighters submit picks at `/enter`. Round 1: enter your name and choose a team. Later rounds: select a surviving player and an available team. Round 1 picks close at 20:00 UK on opening day; later rounds close 90 minutes before the first kick-off. Multiple players may pick the same team in a round; you cannot reuse a team from an earlier round.

Entries are stored in **Netlify Blobs** (a small key-value store bundled with Netlify — no separate database to run). The API lives at `/api/entries`.

```bash
# Local dev with shared storage API
pnpm dev:netlify
```

Plain `pnpm dev` falls back to browser localStorage (per-device only).

## Updating results

Edit `src/data/fixtures.ts` to set `winnerId` on matches as games finish. Eliminations are calculated automatically.
