# Coinstorm Arena

A simple 2D Python arcade survival game built with `tkinter`.

## Play Online

- Live demo: https://eigenoperator.github.io/Coinstorm-Arena/
- Web source: [`docs/`](/home/xincheng/code/test/docs)

## Browser Features

- Start menu with pilot-name sign-in for each browser session
- Pause and resume support in the web build
- Persistent best score tracking per player in browser storage
- Static leaderboard stored in local browser storage for GitHub Pages deployments
- Optional shared leaderboard mode when a remote API is configured for the static site

## Shared Leaderboard Deployment

The repository includes a Cloudflare Worker backend for a real shared leaderboard:

- Worker source: [`cloudflare/worker/src/index.js`](/home/xincheng/code/test/cloudflare/worker/src/index.js)
- Worker config: [`cloudflare/worker/wrangler.jsonc`](/home/xincheng/code/test/cloudflare/worker/wrangler.jsonc)
- Frontend config: [`docs/config.js`](/home/xincheng/code/test/docs/config.js)
- API contract: [`docs/leaderboard-api.md`](/home/xincheng/code/test/docs/leaderboard-api.md)

To enable the shared leaderboard:

1. Create a Cloudflare KV namespace.
2. Put the namespace ID into [`cloudflare/worker/wrangler.jsonc`](/home/xincheng/code/test/cloudflare/worker/wrangler.jsonc).
3. Deploy the worker with Wrangler.
4. Set `leaderboardApiBase` in [`docs/config.js`](/home/xincheng/code/test/docs/config.js) to your Worker URL.
5. Push the updated static site so the browser build uses the live API.

## How to play

- Move with `WASD` or the arrow keys.
- Dodge enemies entering from all sides.
- Collect yellow coins to gain points.
- Every 10 points gives you 1 skill charge.
- Press `Space` to dash and `F` to activate a shield. Each skill use costs 1 charge.

## Run

```bash
python3 main.py
```

## Test

```bash
python3 -m unittest discover -s tests -v
```
