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
let audioContext;
let bgmTimer;
let bgmStep = 0;
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

function getAudioContext() {
  if (!audioContext && (window.AudioContext || window.webkitAudioContext)) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext = new AudioContext();
  }
  if (audioContext?.state === "suspended") audioContext.resume();
  return audioContext;
}

function playSound(type) {
  const audio = getAudioContext();
  if (!audio) return;
  const sounds = {
    jump: { frequency: 420, endFrequency: 680, duration: .12, wave: "square", volume: .035 },
    coin: { frequency: 760, endFrequency: 1180, duration: .1, wave: "sine", volume: .045 },
    defeat: { frequency: 220, endFrequency: 90, duration: .2, wave: "sawtooth", volume: .04 },
    hit: { frequency: 110, endFrequency: 55, duration: .22, wave: "sawtooth", volume: .05 },
    win: { frequency: 520, endFrequency: 1040, duration: .35, wave: "sine", volume: .045 },
    fall: { frequency: 180, endFrequency: 55, duration: .3, wave: "triangle", volume: .04 },
    restart: { frequency: 300, endFrequency: 520, duration: .12, wave: "triangle", volume: .03 }
  };
  const sound = sounds[type];
  if (!sound) return;
  const now = audio.currentTime;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = sound.wave;
  oscillator.frequency.setValueAtTime(sound.frequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(sound.endFrequency, now + sound.duration);
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(sound.volume, now + .01);
  gain.gain.exponentialRampToValueAtTime(.0001, now + sound.duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + sound.duration + .02);
}

function playBgmNote(frequency, duration, volume, wave = "triangle") {
  const audio = getAudioContext();
  if (!audio) return;
  const now = audio.currentTime;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + .015);
  gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + .02);
}

function startBgm() {
  if (bgmTimer || !getAudioContext()) return;
  const melody = [220, 277.18, 329.63, 415.3, 329.63, 277.18, 246.94, 329.63];
  bgmStep = 0;
  bgmTimer = window.setInterval(() => {
    const note = melody[bgmStep % melody.length];
    playBgmNote(note, .2, .012);
    if (bgmStep % 2 === 0) playBgmNote(note / 2, .22, .018, "sine");
    bgmStep++;
  }, 240);
}

function stopBgm() {
  if (!bgmTimer) return;
  window.clearInterval(bgmTimer);
  bgmTimer = undefined;
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
  stopBgm();
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
  if ((keys.ArrowUp || keys.w || keys[" "]) && p.grounded) {
    p.vy = -12;
    p.grounded = false;
    playSound("jump");
  }
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
    if (!coin.collected && overlap(p, c)) {
      coin.collected = true;
      game.collected++;
      game.score += 100;
      addBurst(c.x + 10, c.y + 10, "#ffd166");
      playSound("coin");
    }
  }
  for (const enemy of game.enemies) {
    enemy.x += enemy.vx;
    if (enemy.x < enemy.min || enemy.x > enemy.max) enemy.vx *= -1;
    if (overlap(p, enemy)) {
      if (p.vy > 0 && p.y + p.height < enemy.y + 18) {
        enemy.defeated = true;
        p.vy = -8;
        game.score += 250;
        addBurst(enemy.x + 17, enemy.y + 15, "#ff5c8d");
        playSound("defeat");
      } else if (!enemy.defeated) {
        playSound("hit");
        return endGame(false, "TRY AGAIN", "敵にぶつかってしまいました。");
      }
    }
  }
  game.enemies = game.enemies.filter((enemy) => !enemy.defeated);
  game.camera += (p.x - game.camera - canvas.clientWidth * .35) * .08;
  game.camera = Math.max(0, Math.min(WORLD_WIDTH - canvas.clientWidth, game.camera));
  if (p.y > 500) {
    playSound("fall");
    return endGame(false, "FALLEN", "足場を見失いました。");
  }
  if (p.x > WORLD_WIDTH - 150) {
    playSound("win");
    endGame(true, "GOAL REACHED", `${game.collected}枚のコインを集めてゴールしました。`);
  }
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
  ctx.save();
  ctx.translate(game.camera * .15, 0);

  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "#080d1d");
  sky.addColorStop(.5, "#101a36");
  sky.addColorStop(1, "#17294a");
  ctx.fillStyle = sky;
  ctx.fillRect(-400, 0, WORLD_WIDTH + 800, h);

  const glow = ctx.createRadialGradient(790, 120, 10, 790, 120, 220);
  glow.addColorStop(0, "#57e9e044");
  glow.addColorStop(1, "#57e9e000");
  ctx.fillStyle = glow;
  ctx.fillRect(520, -80, 540, 450);

  ctx.fillStyle = "#d8f7ff";
  for (let x = -180; x < WORLD_WIDTH + 400; x += 83) {
    const y = 42 + ((x * 17) % 175 + 175) % 175;
    const size = x % 5 === 0 ? 2 : 1;
    ctx.globalAlpha = .35 + ((x * 7) % 4) * .12;
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#18294a";
  for (let x = -300; x < WORLD_WIDTH + 500; x += 210) {
    ctx.beginPath();
    ctx.moveTo(x, 330);
    ctx.lineTo(x + 105, 130);
    ctx.lineTo(x + 250, 330);
    ctx.fill();
  }

  ctx.fillStyle = "#0a1226";
  for (let x = -120; x < WORLD_WIDTH + 500; x += 118) {
    const buildingHeight = 48 + ((x * 13) % 100 + 100) % 100;
    const y = 330 - buildingHeight;
    ctx.fillRect(x, y, 82, buildingHeight);
    ctx.fillStyle = "#57e9e033";
    for (let windowY = y + 14; windowY < 320; windowY += 19) {
      ctx.fillRect(x + 12, windowY, 4, 7);
      ctx.fillRect(x + 29, windowY, 4, 7);
      ctx.fillRect(x + 59, windowY, 4, 7);
    }
    ctx.fillStyle = "#0a1226";
  }

  ctx.strokeStyle = "#57e9e033";
  ctx.lineWidth = 1;
  for (let y = 70; y < 310; y += 48) {
    ctx.beginPath();
    ctx.moveTo(-100, y);
    ctx.lineTo(WORLD_WIDTH, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#57e9e044";
  for (let x = -300; x < WORLD_WIDTH + 500; x += 70) {
    ctx.beginPath();
    ctx.moveTo(x, 330);
    ctx.lineTo(x + 40, 215);
    ctx.stroke();
  }
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
  const moving = Math.abs(p.vx) > .25 && p.grounded;
  const lean = p.facing * Math.min(2, Math.abs(p.vx) * .25);
  ctx.save();
  ctx.translate(p.x + p.width / 2, p.y);
  ctx.rotate(lean * .025);
  ctx.shadowColor = "#57e9e0";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#57e9e033";
  ctx.fillRect(-17, 8, 34, 29);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#dcecff";
  ctx.fillRect(-14, 12, 28, 25);
  ctx.fillStyle = "#8aa6c9";
  ctx.fillRect(-12, 17, 24, 3);
  ctx.fillStyle = "#57e9e0";
  ctx.fillRect(-16, 4, 32, 11);
  ctx.fillStyle = "#101827";
  ctx.fillRect(p.facing > 0 ? 2 : -7, 7, 9, 5);
  ctx.fillStyle = "#b9ffff";
  ctx.fillRect(p.facing > 0 ? 4 : -6, 8, 4, 2);

  ctx.fillStyle = "#ff5c8d";
  ctx.fillRect(-12, 34 + step, 8, 5);
  ctx.fillRect(4, 34 - step, 8, 5);
  ctx.fillStyle = "#57e9e0";
  ctx.fillRect(-13, 39 + step, 10, 2);
  ctx.fillRect(3, 39 - step, 10, 2);

  if (moving || !p.grounded) {
    ctx.fillStyle = "#ffd166";
    ctx.globalAlpha = .8;
    ctx.fillRect(p.facing > 0 ? -18 : 14, 25, 4, 4);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

window.addEventListener("keydown", (event) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
  startBgm();
  keys[event.key] = true;
});
window.addEventListener("keyup", (event) => { keys[event.key] = false; });
restartButton.addEventListener("click", () => {
  playSound("restart");
  startBgm();
  resetGame();
});

resetGame();
resize();
function loop() { update(); draw(); requestAnimationFrame(loop); }
loop();
