const WIDTH = 960;
const HEIGHT = 600;
const PLAYER_SIZE = 30;
const PLAYER_SPEED = 280;
const DASH_DISTANCE = 120;
const SHIELD_DURATION = 2.2;
const COIN_INTERVAL = 3;
const ENEMY_INTERVAL = 0.8;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const chargesEl = document.getElementById("charges");
const statusEl = document.getElementById("status");
const playerNameEl = document.getElementById("player-name");
const bestScoreEl = document.getElementById("best-score");
const leaderboardModeEl = document.getElementById("leaderboard-mode");
const leaderboardListEl = document.getElementById("leaderboard-list");
const refreshBoardButton = document.getElementById("refresh-board");
const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const menuOverlay = document.getElementById("menu-overlay");
const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const LEADERBOARD_API_BASE = (window.COINSTORM_CONFIG?.leaderboardApiBase || "").replace(/\/$/, "");

const keys = new Set();
const STORAGE_KEYS = {
  currentUser: "coinstorm.currentUser",
  bestScores: "coinstorm.bestScores",
  leaderboard: "coinstorm.leaderboard",
};

let currentPlayer = "Guest Pilot";
let isStarted = false;
let isPaused = true;
let leaderboardMode = LEADERBOARD_API_BASE
  ? "shared online leaderboard"
  : "static local browser storage";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function createState() {
  return {
    score: 0,
    level: 1,
    charges: 0,
    chargeProgress: 0,
    enemies: [],
    coins: [],
    enemyTimer: 0,
    coinTimer: 0,
    gameOver: false,
    player: {
      x: WIDTH / 2 - PLAYER_SIZE / 2,
      y: HEIGHT - 96,
      width: PLAYER_SIZE,
      height: PLAYER_SIZE,
      shieldTimer: 0,
    },
  };
}

let state = createState();
let lastTime = performance.now();

function isTypingIntoField(event) {
  const target = event.target;
  return (
    document.activeElement === usernameInput ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable
  );
}

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    statusEl.textContent = "Local storage is unavailable in this browser.";
  }
}

function sanitizeName(name) {
  return name.replace(/\s+/g, " ").trim().slice(0, 18);
}

function getBestScores() {
  return readJson(STORAGE_KEYS.bestScores, {});
}

function getLocalLeaderboardEntries() {
  return readJson(STORAGE_KEYS.leaderboard, []);
}

function saveCurrentPlayer(name) {
  currentPlayer = sanitizeName(name) || "Guest Pilot";
  try {
    window.localStorage.setItem(STORAGE_KEYS.currentUser, currentPlayer);
  } catch {
    statusEl.textContent = "Could not persist the current player in this browser.";
  }
  playerNameEl.textContent = currentPlayer;
  renderBestScore();
}

function renderBestScore() {
  const bestScores = getBestScores();
  const bestScore = bestScores[currentPlayer] || 0;
  bestScoreEl.textContent = `Best ${bestScore}`;
}

function renderLeaderboard(entries = []) {
  leaderboardListEl.innerHTML = "";

  if (entries.length === 0) {
    const item = document.createElement("li");
    item.textContent = "No runs recorded yet.";
    leaderboardListEl.appendChild(item);
    return;
  }

  entries.slice(0, 8).forEach((entry, index) => {
    const item = document.createElement("li");
    item.innerHTML = `<strong>#${index + 1} ${entry.name}</strong> <span>- ${entry.score} pts</span>`;
    leaderboardListEl.appendChild(item);
  });
}

function persistRunLocally(score) {
  const bestScores = getBestScores();
  bestScores[currentPlayer] = Math.max(bestScores[currentPlayer] || 0, score);
  writeJson(STORAGE_KEYS.bestScores, bestScores);

  const entries = getLocalLeaderboardEntries();
  entries.push({
    name: currentPlayer,
    score,
    playedAt: new Date().toISOString(),
  });
  entries.sort((a, b) => b.score - a.score || a.playedAt.localeCompare(b.playedAt));
  writeJson(STORAGE_KEYS.leaderboard, entries.slice(0, 20));
  return entries.slice(0, 20);
}

async function loadLeaderboardEntries() {
  if (!LEADERBOARD_API_BASE) {
    return getLocalLeaderboardEntries();
  }

  try {
    const response = await fetch(`${LEADERBOARD_API_BASE}/leaderboard?limit=8`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }
    const payload = await response.json();
    const entries = Array.isArray(payload) ? payload : payload.entries;
    if (!Array.isArray(entries)) {
      throw new Error("Malformed leaderboard payload.");
    }
    leaderboardMode = "shared online leaderboard";
    leaderboardModeEl.textContent = `Leaderboard mode: ${leaderboardMode}`;
    return entries;
  } catch {
    leaderboardMode = "fallback local browser storage";
    leaderboardModeEl.textContent = `Leaderboard mode: ${leaderboardMode}`;
    statusEl.textContent = "Online leaderboard unavailable. Using local fallback.";
    return getLocalLeaderboardEntries();
  }
}

async function refreshLeaderboard() {
  const entries = await loadLeaderboardEntries();
  renderLeaderboard(entries);
}

async function persistRun(score) {
  const localEntries = persistRunLocally(score);

  if (!LEADERBOARD_API_BASE) {
    renderBestScore();
    renderLeaderboard(localEntries);
    return;
  }

  try {
    const response = await fetch(`${LEADERBOARD_API_BASE}/scores`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name: currentPlayer,
        score,
      }),
    });
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }
    leaderboardMode = "shared online leaderboard";
    leaderboardModeEl.textContent = `Leaderboard mode: ${leaderboardMode}`;
    await refreshLeaderboard();
  } catch {
    leaderboardMode = "fallback local browser storage";
    leaderboardModeEl.textContent = `Leaderboard mode: ${leaderboardMode}`;
    renderLeaderboard(localEntries);
    statusEl.textContent = "Score saved locally. Shared leaderboard is not reachable yet.";
  }

  renderBestScore();
}

function enterStartMenu() {
  isStarted = false;
  isPaused = true;
  keys.clear();
  pauseButton.textContent = "Pause";
  menuOverlay.classList.add("visible");
}

function closeStartMenu() {
  menuOverlay.classList.remove("visible");
}

function startRun() {
  reset();
  isStarted = true;
  isPaused = false;
  closeStartMenu();
  pauseButton.textContent = "Pause";
  statusEl.textContent = "Move with WASD or arrow keys";
}

function togglePause() {
  if (!isStarted || state.gameOver) {
    return;
  }

  isPaused = !isPaused;
  pauseButton.textContent = isPaused ? "Resume" : "Pause";
  statusEl.textContent = isPaused ? "Paused." : "Back in action.";
}

function addPoints(points) {
  state.score += points;
  state.chargeProgress += points;
  while (state.chargeProgress >= 10) {
    state.chargeProgress -= 10;
    state.charges += 1;
  }
  state.level = Math.floor(state.score / 15) + 1;
}

function spawnCoin() {
  if (state.coins.length >= 4) {
    return;
  }

  state.coins.push({
    x: 24 + Math.random() * (WIDTH - 48),
    y: 24 + Math.random() * (HEIGHT - 48),
    width: 16,
    height: 16,
    value: 1,
  });
}

function spawnEnemy() {
  const templates = [
    { kind: "scout", size: [18, 26], speed: [280, 380], color: "#60a5fa", value: 2 },
    { kind: "brute", size: [42, 62], speed: [150, 220], color: "#ef4444", value: 3 },
    { kind: "drifter", size: [26, 38], speed: [210, 300], color: "#f97316", value: 1 },
  ];
  const template = templates[Math.floor(Math.random() * templates.length)];
  const size = template.size[0] + Math.random() * (template.size[1] - template.size[0]);
  const speedBase =
    template.speed[0] + Math.random() * (template.speed[1] - template.speed[0]);
  const speed = speedBase * (1 + (state.level - 1) * 0.12);
  const direction = ["top", "bottom", "left", "right"][
    Math.floor(Math.random() * 4)
  ];
  let x;
  let y;
  let vx;
  let vy;

  if (direction === "top") {
    x = Math.random() * (WIDTH - size);
    y = -size;
    vx = (Math.random() - 0.5) * 120;
    vy = speed;
  } else if (direction === "bottom") {
    x = Math.random() * (WIDTH - size);
    y = HEIGHT + size;
    vx = (Math.random() - 0.5) * 120;
    vy = -speed;
  } else if (direction === "left") {
    x = -size;
    y = Math.random() * (HEIGHT - size);
    vx = speed;
    vy = (Math.random() - 0.5) * 120;
  } else {
    x = WIDTH + size;
    y = Math.random() * (HEIGHT - size);
    vx = -speed;
    vy = (Math.random() - 0.5) * 120;
  }

  state.enemies.push({
    x,
    y,
    width: size,
    height: size,
    vx,
    vy,
    color: template.color,
    kind: template.kind,
    value: template.value,
  });
}

function useDash() {
  if (state.charges <= 0) {
    statusEl.textContent = "You need one skill charge to dash.";
    return;
  }

  let dx = 0;
  let dy = 0;
  if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
  if (keys.has("arrowright") || keys.has("d")) dx += 1;
  if (keys.has("arrowup") || keys.has("w")) dy -= 1;
  if (keys.has("arrowdown") || keys.has("s")) dy += 1;
  if (dx === 0 && dy === 0) dy = -1;

  state.player.x = clamp(state.player.x + dx * DASH_DISTANCE, 0, WIDTH - PLAYER_SIZE);
  state.player.y = clamp(state.player.y + dy * DASH_DISTANCE, 0, HEIGHT - PLAYER_SIZE);
  state.charges -= 1;
  statusEl.textContent = "Dash activated.";
}

function useShield() {
  if (state.charges <= 0) {
    statusEl.textContent = "You need one skill charge to shield.";
    return;
  }
  if (state.player.shieldTimer > 0) {
    statusEl.textContent = "Shield is already active.";
    return;
  }

  state.player.shieldTimer = SHIELD_DURATION;
  state.charges -= 1;
  statusEl.textContent = "Shield activated.";
}

function outOfBounds(enemy) {
  return (
    enemy.x + enemy.width < -80 ||
    enemy.x > WIDTH + 80 ||
    enemy.y + enemy.height < -80 ||
    enemy.y > HEIGHT + 80
  );
}

function update(dt) {
  if (!isStarted || isPaused || state.gameOver) {
    return;
  }

  let dx = 0;
  let dy = 0;
  if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
  if (keys.has("arrowright") || keys.has("d")) dx += 1;
  if (keys.has("arrowup") || keys.has("w")) dy -= 1;
  if (keys.has("arrowdown") || keys.has("s")) dy += 1;

  state.player.x = clamp(state.player.x + dx * PLAYER_SPEED * dt, 0, WIDTH - PLAYER_SIZE);
  state.player.y = clamp(state.player.y + dy * PLAYER_SPEED * dt, 0, HEIGHT - PLAYER_SIZE);
  state.player.shieldTimer = Math.max(0, state.player.shieldTimer - dt);

  state.enemyTimer += dt;
  state.coinTimer += dt;

  const spawnRate = Math.max(0.28, ENEMY_INTERVAL - (state.level - 1) * 0.06);
  while (state.enemyTimer >= spawnRate) {
    state.enemyTimer -= spawnRate;
    spawnEnemy();
  }

  if (state.coinTimer >= COIN_INTERVAL) {
    state.coinTimer -= COIN_INTERVAL;
    spawnCoin();
  }

  state.enemies = state.enemies.filter((enemy) => {
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;

    if (outOfBounds(enemy)) {
      addPoints(enemy.value);
      return false;
    }

    if (
      rectsOverlap(
        state.player,
        enemy,
      )
    ) {
      if (state.player.shieldTimer > 0) {
        return false;
      }
      state.gameOver = true;
      statusEl.textContent = "You were hit. Press R to restart.";
      pauseButton.textContent = "Pause";
      void persistRun(state.score);
    }

    return true;
  });

  state.coins = state.coins.filter((coin) => {
    if (rectsOverlap(state.player, coin)) {
      addPoints(coin.value);
      statusEl.textContent = "Coin collected. Keep moving.";
      return false;
    }
    return true;
  });
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.04)";
  for (let x = 0; x < WIDTH; x += 32) {
    ctx.fillRect(x, 0, 1, HEIGHT);
  }
  for (let y = 0; y < HEIGHT; y += 32) {
    ctx.fillRect(0, y, WIDTH, 1);
  }

  state.coins.forEach((coin) => {
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(coin.x + coin.width / 2, coin.y + coin.height / 2, coin.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fde68a";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  state.enemies.forEach((enemy) => {
    ctx.fillStyle = enemy.color;
    ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    ctx.fillStyle = "#dbeafe";
    ctx.font = "11px Trebuchet MS";
    ctx.fillText(enemy.kind, enemy.x, enemy.y - 6);
  });

  ctx.fillStyle = state.player.shieldTimer > 0 ? "#fde68a" : "#34d399";
  ctx.fillRect(state.player.x, state.player.y, state.player.width, state.player.height);
  if (state.player.shieldTimer > 0) {
    ctx.strokeStyle = "#fef3c7";
    ctx.lineWidth = 3;
    ctx.strokeRect(state.player.x - 4, state.player.y - 4, state.player.width + 8, state.player.height + 8);
  }

  if (state.gameOver) {
    ctx.fillStyle = "rgba(3, 7, 18, 0.85)";
    ctx.fillRect(240, 210, 480, 170);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.strokeRect(240, 210, 480, 170);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 34px Trebuchet MS";
    ctx.fillText("Game Over", 380, 275);
    ctx.font = "18px Trebuchet MS";
    ctx.fillText(`Final score ${state.score}`, 406, 316);
    ctx.fillText("Press R to restart", 388, 348);
  }

  if (!isStarted) {
    ctx.fillStyle = "rgba(3, 7, 18, 0.55)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 34px Trebuchet MS";
    ctx.fillText("Ready for launch", 350, 270);
    ctx.font = "18px Trebuchet MS";
    ctx.fillText("Open the menu and start your run", 352, 308);
  } else if (isPaused && !state.gameOver) {
    ctx.fillStyle = "rgba(3, 7, 18, 0.52)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 32px Trebuchet MS";
    ctx.fillText("Paused", 430, 286);
  }

  scoreEl.textContent = `Score ${state.score}`;
  levelEl.textContent = `Level ${state.level}`;
  chargesEl.textContent = `Charges ${state.charges}`;
}

function reset() {
  state = createState();
  keys.clear();
  statusEl.textContent = "Move with WASD or arrow keys";
}

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (isTypingIntoField(event)) {
    return;
  }
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "f", "r", "p", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
  }
  if (menuOverlay.classList.contains("visible") && key !== "enter") {
    return;
  }
  if (key === " ") {
    useDash();
    return;
  }
  if (key === "f") {
    useShield();
    return;
  }
  if (key === "r") {
    startRun();
    return;
  }
  if (key === "p") {
    togglePause();
    return;
  }
  keys.add(key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = sanitizeName(usernameInput.value);
  if (!name) {
    usernameInput.focus();
    return;
  }
  saveCurrentPlayer(name);
  startRun();
});

startButton.addEventListener("click", () => {
  if (!currentPlayer || currentPlayer === "Guest Pilot") {
    enterStartMenu();
    usernameInput.focus();
    return;
  }
  startRun();
});

pauseButton.addEventListener("click", () => {
  togglePause();
});

refreshBoardButton.addEventListener("click", () => {
  void refreshLeaderboard();
  statusEl.textContent = "Leaderboard refreshed.";
});

function initializeProfile() {
  const savedPlayer = sanitizeName(window.localStorage.getItem(STORAGE_KEYS.currentUser) || "");
  if (savedPlayer) {
    saveCurrentPlayer(savedPlayer);
    usernameInput.value = savedPlayer;
  } else {
    playerNameEl.textContent = currentPlayer;
    renderBestScore();
  }
  leaderboardModeEl.textContent = `Leaderboard mode: ${leaderboardMode}`;
  void refreshLeaderboard();
}

initializeProfile();
draw();
requestAnimationFrame(loop);
