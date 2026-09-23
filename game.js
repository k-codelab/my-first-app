const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const coinsEl = document.getElementById("coins");
const progressEl = document.getElementById("progress");
const message = document.getElementById("message");
const messageTitle = document.getElementById("messageTitle");
const messageBody = document.getElementById("messageBody");
const restartButton = document.getElementById("restartButton");

const WORLD_WIDTH = 4200;
const keys = {};
let game;

const levelPlatforms = [
  [0, 390, 670, 40], [780, 350, 420, 40], [1320, 410, 540, 40],
  [1980, 330, 470, 40], [2590, 390, 560, 40], [3270, 315, 420, 40], [3790, 400, 410, 40],
  [300, 285, 130, 16], [930, 245, 150, 16], [1500, 290, 155, 16],
  [2150, 225, 140, 16], [2780, 270, 150, 16], [3420, 215, 150, 16]
].map(([x, y, width, height]) => ({ x, y, width, height }));

function resetGame() {
  game = {
    player: { x: 80, y: 300, width: 28, height: 40, vx: 0, vy: 0, grounded: false, facing: 1 },
    camera: 0, score: 0, collected: 0, state: "playing", particles: [], time: 0,
    coins: [[470, 335], [865, 295], [1030, 190], [1450, 355], [1570, 235], [2180, 275], [2820, 220], [3470, 165]]
      .map(([x, y]) => ({ x, y, collected: false, phase: Math.random() * 7 })),
    enemies: [{ x: 540, y: 350, width: 34, height: 40, min: 430, max: 630, vx: 1.1 },
      { x: 1660, y: 370, width: 34, height: 40, min: 1400, max: 1810, vx: 1.25 },
      { x: 2330, y: 290, width: 34, height: 40, min: 2040, max: 2400, vx: 1.4 },
      { x: 3010, y: 350, width: 34, height: 40, min: 2670, max: 3080, vx: 1.3 }]
  };
  message.classList.add("hidden");
  updateHud();
}

function resize() {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
window.addEventListener("resize", resize);

function overlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
function addBurst(x, y, color) {
  for (let i = 0; i < 8; i++) game.particles.push({ x, y, vx: (Math.random() - .5) * 4, vy: (Math.random() - .8) * 4, life: 1, color });
}
function endGame(won, title, body) {
  game.state = won ? "won" : "lost";
  messageTitle.textContent = title;
  messageBody.textContent = body;
  message.querySelector(".message-kicker").textContent = won ? "MISSION COMPLETE" : "RUN ENDED";
  message.classList.remove("hidden");
}

function update() {
  if (game.state !== "playing") return;
  game.time++;
  const p = game.player;
  const left = keys.ArrowLeft || keys.a;
  const right = keys.ArrowRight || keys.d;
  if (left) { p.vx -= .55; p.facing = -1; }
  if (right) { p.vx += .55; p.facing = 1; }
  if (!left && !right) p.vx *= .8;
  p.vx = Math.max(-5.5, Math.min(5.5, p.vx));
  if ((keys.ArrowUp || keys.w || keys[" "]) && p.grounded) { p.vy = -12; p.grounded = false; }
  keys[" "] = false;
  p.vy += .55;
  p.x += p.vx;
  p.y += p.vy;
  p.x = Math.max(0, Math.min(WORLD_WIDTH - p.width, p.x));
  p.grounded = false;
  for (const platform of levelPlatforms) {
    if (p.vy >= 0 && p.x + p.width > platform.x && p.x < platform.x + platform.width &&
      p.y + p.height >= platform.y && p.y + p.height - p.vy <= platform.y + 3) {
      p.y = platform.y - p.height; p.vy = 0; p.grounded = true;
    }
  }
  for (const coin of game.coins) {
    const c = { x: coin[0] ?? coin.x, y: coin[1] ?? coin.y, width: 20, height: 20 };
    if (!coin.collected && overlap(p, c)) { coin.collected = true; game.collected++; game.score += 100; addBurst(c.x + 10, c.y + 10, "#ffd166"); }
  }
  for (const enemy of game.enemies) {
    enemy.x += enemy.vx;
    if (enemy.x < enemy.min || enemy.x > enemy.max) enemy.vx *= -1;
    if (overlap(p, enemy)) {
      if (p.vy > 0 && p.y + p.height < enemy.y + 18) { enemy.defeated = true; p.vy = -8; game.score += 250; addBurst(enemy.x + 17, enemy.y + 15, "#ff5c8d"); }
      else if (!enemy.defeated) return endGame(false, "TRY AGAIN", "敵にぶつかってしまいました。");
    }
  }
  game.enemies = game.enemies.filter((enemy) => !enemy.defeated);
  game.camera += (p.x - game.camera - canvas.clientWidth * .35) * .08;
  game.camera = Math.max(0, Math.min(WORLD_WIDTH - canvas.clientWidth, game.camera));
  if (p.y > 500) return endGame(false, "FALLEN", "足場を見失いました。");
  if (p.x > WORLD_WIDTH - 150) endGame(true, "GOAL REACHED", `${game.collected}枚のコインを集めてゴールしました。`);
  game.particles.forEach((part) => { part.x += part.vx; part.y += part.vy; part.vy += .15; part.life -= .035; });
  game.particles = game.particles.filter((part) => part.life > 0);
  updateHud();
}

function updateHud() {
  scoreEl.textContent = String(game.score).padStart(6, "0");
  coinsEl.textContent = `${game.collected} / ${game.coins.length}`;
  progressEl.style.width = `${Math.min(100, (game.player.x / (WORLD_WIDTH - 150)) * 100)}%`;
}

function draw() {
  const width = canvas.clientWidth, height = canvas.clientHeight, scale = height / 430;
  ctx.clearRect(0, 0, width, height);
  ctx.save(); ctx.scale(scale, scale);
  const viewWidth = width / scale;
  const gradient = ctx.createLinearGradient(0, 0, 0, 430);
  gradient.addColorStop(0, "#152642"); gradient.addColorStop(1, "#0d1728");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, viewWidth, 430);
  drawBackdrop(viewWidth, 430);
  ctx.translate(-game.camera, 0);
  levelPlatforms.forEach(drawPlatform);
  game.coins.forEach((coin) => { if (!coin.collected) drawCoin(coin.x, coin.y, coin.phase); });
  game.enemies.forEach(drawEnemy);
  drawGoal();
  drawPlayer();
  game.particles.forEach((part) => { ctx.globalAlpha = part.life; ctx.fillStyle = part.color; ctx.fillRect(part.x, part.y, 4, 4); });
  ctx.globalAlpha = 1; ctx.restore();
}
function drawBackdrop(w, h) {
  ctx.save(); ctx.translate(game.camera * .15, 0);
  ctx.fillStyle = "#1c3050";
  for (let x = -300; x < WORLD_WIDTH + 500; x += 210) { ctx.beginPath(); ctx.moveTo(x, 330); ctx.lineTo(x + 105, 130); ctx.lineTo(x + 250, 330); ctx.fill(); }
  ctx.strokeStyle = "#294263"; ctx.lineWidth = 1;
  for (let y = 70; y < 310; y += 48) { ctx.beginPath(); ctx.moveTo(-100, y); ctx.lineTo(WORLD_WIDTH, y); ctx.stroke(); }
  ctx.restore();
}
function drawPlatform(p) {
  ctx.fillStyle = "#213858"; ctx.fillRect(p.x, p.y, p.width, p.height);
  ctx.fillStyle = "#57e9e0"; ctx.fillRect(p.x, p.y, p.width, 3);
  ctx.fillStyle = "#172941";
  for (let x = p.x + 12; x < p.x + p.width; x += 26) ctx.fillRect(x, p.y + 15, 12, 4);
}
function drawCoin(x, y, phase) {
  const bob = Math.sin(game.time * .06 + phase) * 4;
  ctx.fillStyle = "#ffd166"; ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.arc(x + 10, y + 10 + bob, 9, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = "#ad6d2e"; ctx.fillRect(x + 8, y + 5 + bob, 4, 10);
}
function drawEnemy(e) {
  ctx.fillStyle = "#ff5c8d"; ctx.fillRect(e.x, e.y + 8, e.width, e.height - 8);
  ctx.fillStyle = "#261832"; ctx.fillRect(e.x + 6, e.y + 15, 7, 7); ctx.fillRect(e.x + 21, e.y + 15, 7, 7);
  ctx.fillStyle = "#ff8eb0"; ctx.fillRect(e.x + 4, e.y + 3, 26, 5);
}
function drawGoal() {
  const x = WORLD_WIDTH - 125;
  ctx.fillStyle = "#57e9e0"; ctx.fillRect(x, 220, 4, 180);
  ctx.fillStyle = "#57e9e0"; ctx.beginPath(); ctx.moveTo(x + 4, 220); ctx.lineTo(x + 70, 238); ctx.lineTo(x + 4, 256); ctx.fill();
  ctx.font = "700 12px 'Barlow Condensed'"; ctx.fillText("EXIT", x + 14, 247);
}
function drawPlayer() {
  const p = game.player, step = p.grounded ? Math.sin(game.time * .25) * 2 : 0;
  ctx.fillStyle = "#f3f7ff"; ctx.fillRect(p.x, p.y + 8, p.width, p.height - 8);
  ctx.fillStyle = "#57e9e0"; ctx.fillRect(p.x - 2, p.y + 4, p.width + 4, 10);
  ctx.fillStyle = "#101827"; ctx.fillRect(p.x + (p.facing > 0 ? 17 : 4), p.y + 7, 5, 5);
  ctx.fillStyle = "#ff5c8d"; ctx.fillRect(p.x + 4, p.y + p.height - 4 + step, 7, 5); ctx.fillRect(p.x + 18, p.y + p.height - 4 - step, 7, 5);
}

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
  keys[event.key] = true;
});
window.addEventListener("keyup", (event) => { keys[event.key] = false; });
restartButton.addEventListener("click", resetGame);

resetGame();
resize();
function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();
