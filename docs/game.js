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

const keys = new Set();

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
    statusEl.textContent = "技能次数不足，先去拿分。";
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
  statusEl.textContent = "已释放冲刺。";
}

function useShield() {
  if (state.charges <= 0) {
    statusEl.textContent = "技能次数不足，先去拿分。";
    return;
  }
  if (state.player.shieldTimer > 0) {
    statusEl.textContent = "护盾已经在生效。";
    return;
  }

  state.player.shieldTimer = SHIELD_DURATION;
  state.charges -= 1;
  statusEl.textContent = "护盾已开启。";
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
  if (state.gameOver) {
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
      statusEl.textContent = "你被击中了，按 R 重新开始。";
    }

    return true;
  });

  state.coins = state.coins.filter((coin) => {
    if (rectsOverlap(state.player, coin)) {
      addPoints(coin.value);
      statusEl.textContent = "拾取金币，继续冲。";
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
    ctx.fillText(`最终分数 ${state.score}`, 420, 316);
    ctx.fillText("按 R 重新开始", 405, 348);
  }

  scoreEl.textContent = `分数 ${state.score}`;
  levelEl.textContent = `等级 ${state.level}`;
  chargesEl.textContent = `技能次数 ${state.charges}`;
}

function reset() {
  state = createState();
  statusEl.textContent = "方向键/WASD 移动";
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
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "f", "r", "w", "a", "s", "d"].includes(key)) {
    event.preventDefault();
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
    reset();
    return;
  }
  keys.add(key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

draw();
requestAnimationFrame(loop);
