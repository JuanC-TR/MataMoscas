// ===== 🪰 Mata Moscas — lógica del juego =====

// Definición de niveles. Cada nivel tiene insectos distintos.
// Regla del enunciado: los insectos van de MÁS CHICOS a MÁS GRANDES conforme avanzan los niveles.
const LEVELS = [
  { bug: "🦟", name: "Mosquitos",  size: 30, points: 10, speed: 2200, target: 8  }, // más chico
  { bug: "🪰", name: "Moscas",     size: 42, points: 15, speed: 1900, target: 10 },
  { bug: "🐜", name: "Hormigas",   size: 52, points: 20, speed: 1600, target: 12 },
  { bug: "🐝", name: "Abejas",     size: 64, points: 25, speed: 1400, target: 14 },
  { bug: "🕷️", name: "Arañas",     size: 78, points: 30, speed: 1200, target: 16 },
  { bug: "🪲", name: "Escarabajos", size: 92, points: 40, speed: 1000, target: 18 }, // más grande
];

// Estado
const state = {
  score: 0,
  lives: 3,
  levelIndex: 0,
  squashedThisLevel: 0,
  bugs: new Map(),       // id -> {el, timer, x, y}
  spawnTimer: null,
  running: false,
  bugId: 0,
};

// Elementos del DOM
const board = document.getElementById("board");
const scoreEl = document.getElementById("score");
const levelEl = document.getElementById("level");
const livesEl = document.getElementById("lives");
const progressFill = document.getElementById("progress-fill");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");

// Matamoscas que sigue al puntero
let swatter = null;

function createSwatter() {
  swatter = document.createElement("div");
  swatter.id = "swatter";
  swatter.textContent = "🪰"; // placeholder; usamos un emoji de matamoscas abajo
  swatter.textContent = "🧹"; // matamoscas simbólico
  board.appendChild(swatter);
}

// ===== HUD =====
function updateHUD() {
  scoreEl.textContent = state.score;
  levelEl.textContent = state.levelIndex + 1;
  livesEl.textContent = "❤️".repeat(state.lives) || "💀";
  const level = LEVELS[state.levelIndex];
  const pct = Math.min(100, (state.squashedThisLevel / level.target) * 100);
  progressFill.style.width = pct + "%";
}

// ===== Movimiento del matamoscas =====
function onPointerMove(e) {
  if (!swatter) return;
  const rect = board.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  swatter.style.left = x + "px";
  swatter.style.top = y + "px";
}

// ===== Golpe (aplaste) =====
// Cada click es un intento de aplaste. Si golpea un insecto -> punto.
// Si golpea el tablero SIN acertar a un insecto -> "golpe fallido" -> pierde una vida.
function onBoardClick(e) {
  if (!state.running) return;

  // Animación del matamoscas
  if (swatter) {
    swatter.classList.add("smack");
    setTimeout(() => swatter && swatter.classList.remove("smack"), 120);
  }

  const rect = board.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const clickY = e.clientY - rect.top;

  // Buscar si el golpe cayó sobre algún insecto
  let hitId = null;
  for (const [id, bug] of state.bugs) {
    const half = bug.size / 2 + 8; // margen de acierto
    if (Math.abs(clickX - bug.x) <= half && Math.abs(clickY - bug.y) <= half) {
      hitId = id;
      break;
    }
  }

  if (hitId !== null) {
    squashBug(hitId, clickX, clickY);
  } else {
    // Golpe fallido: golpeó pero no mató insecto -> pierde vida
    missHit(clickX, clickY);
  }
}

function squashBug(id, x, y) {
  const bug = state.bugs.get(id);
  if (!bug) return;

  const level = LEVELS[state.levelIndex];
  state.score += level.points;
  state.squashedThisLevel++;

  clearTimeout(bug.timer);
  bug.el.remove();
  state.bugs.delete(id);

  showSplat(x, y);
  showFloating(`+${level.points}`, x, y, "plus");
  updateHUD();

  if (state.squashedThisLevel >= level.target) {
    nextLevel();
  }
}

function missHit(x, y) {
  state.lives--;
  showFloating("¡Fallaste! -1 ❤️", x, y, "minus");
  updateHUD();
  if (state.lives <= 0) {
    gameOver();
  }
}

// ===== Spawning de insectos =====
function spawnBug() {
  if (!state.running) return;
  const level = LEVELS[state.levelIndex];

  const id = state.bugId++;
  const el = document.createElement("div");
  el.className = "bug";
  el.textContent = level.bug;
  el.style.fontSize = level.size + "px";

  // posición aleatoria dentro del tablero (con margen)
  const margin = level.size;
  const x = margin + Math.random() * (board.clientWidth - margin * 2);
  const y = margin + Math.random() * (board.clientHeight - margin * 2);
  el.style.left = x + "px";
  el.style.top = y + "px";

  board.appendChild(el);

  // El insecto escapa si no lo aplastas a tiempo (no cuesta vida, solo se va)
  const timer = setTimeout(() => {
    if (state.bugs.has(id)) {
      el.remove();
      state.bugs.delete(id);
    }
  }, level.speed);

  state.bugs.set(id, { el, timer, x, y, size: level.size });

  // El insecto se reubica cada cierto tiempo para dar dinamismo
  const moveInterval = setInterval(() => {
    const b = state.bugs.get(id);
    if (!b || !state.running) {
      clearInterval(moveInterval);
      return;
    }
    const nx = margin + Math.random() * (board.clientWidth - margin * 2);
    const ny = margin + Math.random() * (board.clientHeight - margin * 2);
    b.x = nx;
    b.y = ny;
    b.el.style.left = nx + "px";
    b.el.style.top = ny + "px";
    b.el.style.transition = "left 0.4s ease, top 0.4s ease";
  }, Math.max(500, level.speed / 2));
}

function scheduleSpawns() {
  const level = LEVELS[state.levelIndex];
  // spawn más rápido en niveles avanzados
  const interval = Math.max(500, level.speed / 2.2);
  state.spawnTimer = setInterval(spawnBug, interval);
  spawnBug();
}

// ===== Niveles =====
function nextLevel() {
  clearAllBugs();
  clearInterval(state.spawnTimer);

  if (state.levelIndex >= LEVELS.length - 1) {
    winGame();
    return;
  }

  state.levelIndex++;
  state.squashedThisLevel = 0;
  updateHUD();
  showLevelBanner();

  setTimeout(() => {
    if (state.running) scheduleSpawns();
  }, 1400);
}

function showLevelBanner() {
  const level = LEVELS[state.levelIndex];
  const banner = document.createElement("div");
  banner.className = "level-banner";
  banner.textContent = `Nivel ${state.levelIndex + 1}: ${level.name}`;
  board.appendChild(banner);
  setTimeout(() => banner.remove(), 1400);
}

// ===== Efectos =====
function showSplat(x, y) {
  const s = document.createElement("div");
  s.className = "splat";
  s.textContent = "💥";
  s.style.left = x + "px";
  s.style.top = y + "px";
  board.appendChild(s);
  setTimeout(() => s.remove(), 500);
}

function showFloating(text, x, y, cls) {
  const f = document.createElement("div");
  f.className = "floating " + cls;
  f.textContent = text;
  f.style.left = x + "px";
  f.style.top = y + "px";
  board.appendChild(f);
  setTimeout(() => f.remove(), 800);
}

// ===== Limpieza =====
function clearAllBugs() {
  for (const [, bug] of state.bugs) {
    clearTimeout(bug.timer);
    bug.el.remove();
  }
  state.bugs.clear();
}

// ===== Flujo del juego =====
function startGame() {
  state.score = 0;
  state.lives = 3;
  state.levelIndex = 0;
  state.squashedThisLevel = 0;
  state.bugId = 0;
  state.running = true;

  clearAllBugs();
  overlay.classList.add("hidden");
  if (!swatter) createSwatter();

  updateHUD();
  showLevelBanner();
  setTimeout(() => {
    if (state.running) scheduleSpawns();
  }, 1400);
}

function endGame() {
  state.running = false;
  clearInterval(state.spawnTimer);
  clearAllBugs();
}

function gameOver() {
  endGame();
  overlayTitle.textContent = "💀 Game Over";
  overlayText.innerHTML = `Te quedaste sin vidas.<br />Puntuación final: <b>${state.score}</b><br />Llegaste al nivel <b>${state.levelIndex + 1}</b>.`;
  startBtn.textContent = "Reintentar";
  overlay.classList.remove("hidden");
}

function winGame() {
  endGame();
  overlayTitle.textContent = "🏆 ¡Ganaste!";
  overlayText.innerHTML = `¡Aplastaste a todos los insectos!<br />Puntuación final: <b>${state.score}</b>`;
  startBtn.textContent = "Jugar de nuevo";
  overlay.classList.remove("hidden");
}

// ===== Eventos =====
startBtn.addEventListener("click", startGame);
board.addEventListener("pointermove", onPointerMove);
board.addEventListener("pointerdown", onBoardClick);

// Reajustar posiciones si cambia el tamaño de la ventana (evita que insectos queden fuera)
window.addEventListener("resize", () => {
  for (const [, bug] of state.bugs) {
    bug.x = Math.min(bug.x, board.clientWidth - bug.size);
    bug.y = Math.min(bug.y, board.clientHeight - bug.size);
    bug.el.style.left = bug.x + "px";
    bug.el.style.top = bug.y + "px";
  }
});
