const MAX_NAME_LENGTH = 18;
const MAX_LEADERBOARD_SIZE = 50;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      ...extraHeaders,
    },
  });
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function sanitizeName(name) {
  if (typeof name !== "string") {
    return "";
  }
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME_LENGTH);
}

function normalizeScore(score) {
  const parsed = Number(score);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.floor(parsed);
}

async function readEntries(env) {
  const stored = await env.LEADERBOARD.get("entries", "json");
  return Array.isArray(stored) ? stored : [];
}

async function writeEntries(env, entries) {
  await env.LEADERBOARD.put("entries", JSON.stringify(entries.slice(0, MAX_LEADERBOARD_SIZE)));
}

function rankEntries(entries) {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return String(a.playedAt).localeCompare(String(b.playedAt));
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "*";
    const headers = corsHeaders(origin);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (request.method === "GET" && url.pathname === "/leaderboard") {
      const limit = Math.min(Number(url.searchParams.get("limit")) || 8, 20);
      const entries = rankEntries(await readEntries(env)).slice(0, limit);
      return json({ entries }, 200, headers);
    }

    if (request.method === "POST" && url.pathname === "/scores") {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return json({ error: "Invalid JSON body." }, 400, headers);
      }

      const name = sanitizeName(payload?.name);
      const score = normalizeScore(payload?.score);

      if (!name) {
        return json({ error: "A valid player name is required." }, 400, headers);
      }
      if (score === null) {
        return json({ error: "A valid non-negative score is required." }, 400, headers);
      }

      const entries = await readEntries(env);
      entries.push({
        name,
        score,
        playedAt: new Date().toISOString(),
      });
      const ranked = rankEntries(entries).slice(0, MAX_LEADERBOARD_SIZE);
      await writeEntries(env, ranked);
      return json({ ok: true, entries: ranked.slice(0, 8) }, 201, headers);
    }

    return json({ error: "Not found." }, 404, headers);
  },
};
