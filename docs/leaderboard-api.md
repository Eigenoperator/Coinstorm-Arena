# Leaderboard API Contract

The web build supports an optional shared leaderboard backend through:

```js
window.COINSTORM_CONFIG = {
  leaderboardApiBase: "https://your-api.example.com",
};
```

## Endpoints

### `GET /leaderboard?limit=8`

Returns either:

```json
[
  { "name": "SkyRunner", "score": 42 },
  { "name": "NebulaFox", "score": 35 }
]
```

or:

```json
{
  "entries": [
    { "name": "SkyRunner", "score": 42 },
    { "name": "NebulaFox", "score": 35 }
  ]
}
```

### `POST /scores`

Request body:

```json
{
  "name": "SkyRunner",
  "score": 42
}
```

Expected response:

```json
{
  "ok": true
}
```

If the remote API is unavailable, the site automatically falls back to browser-local
storage for leaderboard display and score persistence.
