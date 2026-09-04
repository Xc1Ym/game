(function initBubbles(root, factory) {
  const api = factory(root, root.document);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OrchardBubbles = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBubbles(root, document) {
  function neighborCells(row, column, columns, rows) {
    const offset = row % 2;
    const candidates = [
      [row, column - 1], [row, column + 1],
      [row - 1, column - 1 + offset], [row - 1, column + offset],
      [row + 1, column - 1 + offset], [row + 1, column + offset],
    ];
    return candidates
      .filter(([nextRow, nextColumn]) => nextRow >= 0 && nextRow < rows && nextColumn >= 0 && nextColumn < columns)
      .map(([nextRow, nextColumn]) => ({ row: nextRow, column: nextColumn }));
  }

  function findCluster(grid, startRow, startColumn) {
    const target = grid[startRow]?.[startColumn];
    if (!target) return [];
    const rows = grid.length;
    const columns = grid[0].length;
    const queue = [{ row: startRow, column: startColumn }];
    const found = [];
    const visited = new Set();
    while (queue.length) {
      const cell = queue.shift();
      const key = `${cell.row}:${cell.column}`;
      if (visited.has(key) || grid[cell.row][cell.column] !== target) continue;
      visited.add(key);
      found.push(cell);
      neighborCells(cell.row, cell.column, columns, rows).forEach((neighbor) => queue.push(neighbor));
    }
    return found;
  }

  function findFloating(grid) {
    const rows = grid.length;
    const columns = grid[0].length;
    const queue = [];
    const connected = new Set();
    for (let column = 0; column < columns; column += 1) {
      if (grid[0][column]) queue.push({ row: 0, column });
    }
    while (queue.length) {
      const cell = queue.shift();
      const key = `${cell.row}:${cell.column}`;
      if (connected.has(key) || !grid[cell.row][cell.column]) continue;
      connected.add(key);
      neighborCells(cell.row, cell.column, columns, rows).forEach((neighbor) => {
        if (grid[neighbor.row][neighbor.column]) queue.push(neighbor);
      });
    }
    const floating = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (grid[row][column] && !connected.has(`${row}:${column}`)) floating.push({ row, column });
      }
    }
    return floating;
  }

  const api = { neighborCells, findCluster, findFloating };
  if (!document) return api;

  const LEVELS = {
    easy: { colors: 4, initialRows: 4, misses: 6 },
    normal: { colors: 5, initialRows: 5, misses: 5 },
    hard: { colors: 6, initialRows: 6, misses: 4 },
  };
  const FRUITS = [
    { type: "apple", color: "#ef5650" },
    { type: "lemon", color: "#f4c742" },
    { type: "blueberries", color: "#6174cf" },
    { type: "grapes", color: "#9b62bd" },
    { type: "orange", color: "#f08a3c" },
    { type: "pear", color: "#8fbd4f" },
  ];
  const ROWS = 12;
  const COLUMNS = 9;
  const RADIUS = 27;
  const X_START = 50;
  const X_STEP = 60;
  const Y_START = 38;
  const Y_STEP = 52;
  const LAUNCHER = { x: 320, y: 700 };

  const canvas = document.getElementById("bubbleCanvas");
  const context = canvas.getContext("2d");
  const scoreElement = document.getElementById("score");
  const comboElement = document.getElementById("combo");
  const missesElement = document.getElementById("misses");
  const bestElement = document.getElementById("bestScore");
  const pauseButton = document.getElementById("pauseButton");
  const resultOverlay = document.getElementById("resultOverlay");
  const resultTitle = document.getElementById("resultTitle");
  const resultMessage = document.getElementById("resultMessage");
  const resultImage = document.getElementById("resultImage");
  const overlayButton = document.getElementById("overlayButton");
  const difficultyButtons = Array.from(document.querySelectorAll(".difficulty-button"));
  const images = new Map();
  const bubbleSprites = new Map();

  FRUITS.forEach((fruit) => {
    const image = new Image();
    image.addEventListener("load", () => cacheFruitBubble(fruit));
    image.src = "../../assets/fruits/" + fruit.type + ".png";
    images.set(fruit.type, image);
  });

  const backgroundCanvas = document.createElement("canvas");
  backgroundCanvas.width = canvas.width;
  backgroundCanvas.height = canvas.height;
  const backgroundContext = backgroundCanvas.getContext("2d");
  backgroundContext.fillStyle = "#dff1df";
  backgroundContext.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
  backgroundContext.fillStyle = "rgba(76,154,89,0.08)";
  for (let x = 20; x < backgroundCanvas.width; x += 56) {
    backgroundContext.beginPath();
    backgroundContext.arc(x, 120 + Math.sin(x) * 16, 38, 0, Math.PI * 2);
    backgroundContext.fill();
  }
  backgroundContext.strokeStyle = "rgba(47,111,77,0.18)";
  backgroundContext.lineWidth = 3;
  backgroundContext.setLineDash([8, 8]);
  backgroundContext.beginPath();
  backgroundContext.moveTo(0, Y_START + (ROWS - 2) * Y_STEP + RADIUS);
  backgroundContext.lineTo(backgroundCanvas.width, Y_START + (ROWS - 2) * Y_STEP + RADIUS);
  backgroundContext.stroke();

  let level = "normal";
  let config = LEVELS[level];
  let grid = [];
  let currentType = "apple";
  let nextType = "lemon";
  let projectile = null;
  let angle = -Math.PI / 2;
  let targetAngle = angle;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let missesLeft = config.misses;
  let active = false;
  let paused = false;
  let lastTime = 0;
  let frameId = null;
  let pops = [];
  let drops = [];
  let recoil = 0;
  let projectileTrail = [];

  function cacheFruitBubble(fruit) {
    const sprite = document.createElement("canvas");
    const size = 72;
    const center = size / 2;
    const spriteContext = sprite.getContext("2d");
    sprite.width = size;
    sprite.height = size;
    const gradient = spriteContext.createRadialGradient(center - 10, center - 12, 2, center, center, 32);
    gradient.addColorStop(0, "#fffbe9");
    gradient.addColorStop(0.2, fruit.color);
    gradient.addColorStop(1, "#315f48");
    spriteContext.fillStyle = gradient;
    spriteContext.shadowColor = "rgba(33, 72, 49, 0.24)";
    spriteContext.shadowBlur = 8;
    spriteContext.shadowOffsetY = 4;
    spriteContext.beginPath();
    spriteContext.arc(center, center - 2, RADIUS, 0, Math.PI * 2);
    spriteContext.fill();
    spriteContext.shadowBlur = 0;
    spriteContext.strokeStyle = "rgba(255,255,255,0.65)";
    spriteContext.lineWidth = 2;
    spriteContext.stroke();
    const image = images.get(fruit.type);
    if (image?.complete && image.naturalWidth) spriteContext.drawImage(image, center - 20, center - 22, 40, 40);
    bubbleSprites.set(fruit.type, sprite);
  }

  FRUITS.forEach(cacheFruitBubble);

  function makeGrid() {
    return Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null));
  }

  function activeFruits() {
    return FRUITS.slice(0, config.colors);
  }

  function randomType() {
    const candidates = activeFruits();
    return candidates[Math.floor(Math.random() * candidates.length)].type;
  }

  function cellPosition(row, column) {
    return { x: X_START + column * X_STEP + (row % 2) * X_STEP / 2, y: Y_START + row * Y_STEP };
  }

  function readBest() {
    try { return Number(root.localStorage.getItem("orchard-bubbles-best-" + level)) || 0; } catch { return 0; }
  }

  function saveBest() {
    if (score > readBest()) {
      try { root.localStorage.setItem("orchard-bubbles-best-" + level, String(score)); } catch {}
    }
  }

  function updateStatus() {
    scoreElement.textContent = String(score);
    comboElement.textContent = String(combo);
    missesElement.textContent = String(missesLeft);
    bestElement.textContent = String(Math.max(score, readBest()));
  }

  function seedGrid() {
    grid = makeGrid();
    for (let row = 0; row < config.initialRows; row += 1) {
      for (let column = 0; column < COLUMNS; column += 1) {
        if (row === config.initialRows - 1 && Math.random() < 0.18) continue;
        grid[row][column] = randomType();
      }
    }
  }

  function spawnPop(row, column, type, falling = false) {
    const position = cellPosition(row, column);
    if (falling) {
      drops.push({ ...position, type, vy: 80 + Math.random() * 90, vx: -35 + Math.random() * 70, rotation: 0, life: 1 });
      return;
    }
    pops.push({ ...position, type, life: 1 });
  }

  function addRow() {
    for (let row = ROWS - 1; row > 0; row -= 1) grid[row] = grid[row - 1].slice();
    grid[0] = Array.from({ length: COLUMNS }, () => Math.random() < 0.1 ? null : randomType());
    missesLeft = config.misses;
  }

  function gridIsEmpty() {
    return grid.every((row) => row.every((cell) => !cell));
  }

  function hasReachedBottom() {
    return grid[ROWS - 2].some(Boolean) || grid[ROWS - 1].some(Boolean);
  }

  function nearestOpenCell(x, y) {
    let best = null;
    let bestDistance = Infinity;
    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLUMNS; column += 1) {
        if (grid[row][column]) continue;
        const position = cellPosition(row, column);
        const distance = (position.x - x) ** 2 + (position.y - y) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = { row, column };
        }
      }
    }
    return best;
  }

  function resolveShot() {
    if (!projectile) return;
    const target = nearestOpenCell(projectile.x, projectile.y);
    const type = projectile.type;
    projectile = null;
    if (!target) { finishGame(false); return; }
    grid[target.row][target.column] = type;
    const cluster = findCluster(grid, target.row, target.column);
    if (cluster.length >= 3) {
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      cluster.forEach((cell) => {
        spawnPop(cell.row, cell.column, grid[cell.row][cell.column]);
        grid[cell.row][cell.column] = null;
      });
      const floating = findFloating(grid);
      floating.forEach((cell) => {
        spawnPop(cell.row, cell.column, grid[cell.row][cell.column], true);
        grid[cell.row][cell.column] = null;
      });
      score += cluster.length * 20 * combo + floating.length * 35;
    } else {
      combo = 0;
      missesLeft -= 1;
      if (missesLeft <= 0) addRow();
    }
    saveBest();
    updateStatus();
    if (gridIsEmpty()) finishGame(true);
    else if (hasReachedBottom()) finishGame(false);
  }

  function shoot() {
    if (!active || paused || projectile) return;
    const speed = 700;
    projectile = { x: LAUNCHER.x, y: LAUNCHER.y - 18, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, type: currentType, rotation: 0 };
    projectileTrail = [];
    currentType = nextType;
    nextType = randomType();
    recoil = 1;
  }

  function updateProjectile(deltaSeconds) {
    if (!projectile) return;
    projectileTrail.push({ x: projectile.x, y: projectile.y, type: projectile.type, rotation: projectile.rotation, life: 1 });
    if (projectileTrail.length > 6) projectileTrail.shift();
    let remaining = deltaSeconds;
    while (remaining > 0 && projectile) {
      const step = Math.min(remaining, 1 / 120);
      projectile.x += projectile.vx * step;
      projectile.y += projectile.vy * step;
      projectile.rotation += step * 3;
      if (projectile.x <= RADIUS) { projectile.x = RADIUS; projectile.vx = Math.abs(projectile.vx); }
      if (projectile.x >= canvas.width - RADIUS) { projectile.x = canvas.width - RADIUS; projectile.vx = -Math.abs(projectile.vx); }
      let collided = projectile.y <= RADIUS;
      if (!collided) {
        for (let row = 0; row < ROWS && !collided; row += 1) {
          for (let column = 0; column < COLUMNS; column += 1) {
            if (!grid[row][column]) continue;
            const position = cellPosition(row, column);
            if ((position.x - projectile.x) ** 2 + (position.y - projectile.y) ** 2 <= (RADIUS * 1.85) ** 2) {
              collided = true;
              break;
            }
          }
        }
      }
      if (collided) resolveShot();
      remaining -= step;
    }
  }

  function drawFruitBubble(x, y, type, size = RADIUS * 2, alpha = 1, rotation = 0) {
    const sprite = bubbleSprites.get(type) || bubbleSprites.get(FRUITS[0].type);
    context.save();
    context.globalAlpha = alpha;
    context.translate(x, y);
    context.rotate(rotation);
    const drawSize = size * 72 / (RADIUS * 2);
    if (sprite) context.drawImage(sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
    context.restore();
  }

  function drawAimGuide() {
    if (projectile) return;
    let x = LAUNCHER.x;
    let y = LAUNCHER.y - 28 - recoil * 8;
    let vx = Math.cos(angle);
    const vy = Math.sin(angle);
    context.fillStyle = "rgba(47, 111, 77, 0.32)";
    for (let index = 0; index < 14; index += 1) {
      x += vx * 31;
      y += vy * 31;
      if (x < 18 || x > canvas.width - 18) vx *= -1;
      context.beginPath();
      context.arc(x, y, Math.max(2, 5 - index * 0.18), 0, Math.PI * 2);
      context.fill();
      if (y < 50) break;
    }
  }

  function render(timestamp) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(backgroundCanvas, 0, 0);

    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLUMNS; column += 1) {
        if (!grid[row]?.[column]) continue;
        const position = cellPosition(row, column);
        const bob = Math.sin(timestamp / 500 + row * 0.7 + column) * 0.7;
        drawFruitBubble(position.x, position.y + bob, grid[row][column]);
      }
    }
    drawAimGuide();
    projectileTrail.forEach((item, index) => {
      const trailAlpha = item.life * (index + 1) / projectileTrail.length * 0.16;
      drawFruitBubble(item.x, item.y, item.type, RADIUS * 1.55, trailAlpha, item.rotation);
    });
    if (projectile) drawFruitBubble(projectile.x, projectile.y, projectile.type, RADIUS * 2, 1, projectile.rotation);

    pops.forEach((item) => drawFruitBubble(item.x, item.y, item.type, RADIUS * 2 * (1 + (1 - item.life) * 0.65), item.life));
    drops.forEach((item) => drawFruitBubble(item.x, item.y, item.type, RADIUS * 2, item.life, item.rotation));

    context.save();
    context.translate(0, recoil * 7);
    context.fillStyle = "#2f6f4d";
    context.beginPath(); context.roundRect(LAUNCHER.x - 76, LAUNCHER.y + 20, 152, 42, 14); context.fill();
    context.fillStyle = "rgba(255,255,255,0.18)";
    context.fillRect(LAUNCHER.x - 58, LAUNCHER.y + 26, 116, 4);
    if (!projectile) drawFruitBubble(LAUNCHER.x, LAUNCHER.y - 8, currentType, 62);
    context.restore();
    context.fillStyle = "#6d7d73";
    context.font = "700 15px sans-serif";
    context.textAlign = "center";
    context.fillText("下一个", 565, 690);
    drawFruitBubble(565, 722, nextType, 46);
  }

  function loop(timestamp) {
    if (!active || paused) return;
    if (!lastTime) lastTime = timestamp;
    const delta = Math.min(50, timestamp - lastTime);
    lastTime = timestamp;
    const seconds = delta / 1000;
    angle += (targetAngle - angle) * (1 - Math.exp(-18 * seconds));
    recoil *= Math.exp(-11 * seconds);
    updateProjectile(seconds);
    projectileTrail.forEach((item) => { item.life -= seconds * 4.5; });
    projectileTrail = projectileTrail.filter((item) => item.life > 0);
    pops.forEach((item) => { item.life -= seconds * 3.4; });
    pops = pops.filter((item) => item.life > 0);
    drops.forEach((item) => {
      item.x += item.vx * seconds;
      item.y += item.vy * seconds;
      item.vy += 620 * seconds;
      item.rotation += seconds * 3;
      item.life -= seconds * 0.75;
    });
    drops = drops.filter((item) => item.life > 0 && item.y < canvas.height + 80);
    render(timestamp);
    if (active) frameId = root.requestAnimationFrame(loop);
  }

  function startGame() {
    root.cancelAnimationFrame(frameId);
    config = LEVELS[level];
    seedGrid();
    currentType = randomType();
    nextType = randomType();
    projectile = null;
    pops = [];
    drops = [];
    score = 0;
    combo = 0;
    maxCombo = 0;
    missesLeft = config.misses;
    angle = -Math.PI / 2;
    targetAngle = angle;
    projectileTrail = [];
    active = true;
    paused = false;
    lastTime = 0;
    resultOverlay.classList.add("is-hidden");
    pauseButton.disabled = false;
    pauseButton.textContent = "暂停";
    updateStatus();
    frameId = root.requestAnimationFrame(loop);
  }

  function finishGame(won) {
    active = false;
    root.cancelAnimationFrame(frameId);
    saveBest();
    pauseButton.disabled = true;
    resultTitle.textContent = won ? "果串清空！" : "果串压线了";
    resultMessage.textContent = "本局得到 " + score + " 分，最高连续消除 " + maxCombo + " 次。";
    resultImage.src = won ? "../../assets/fruits/pineapple.png" : "../../assets/fruits/grapes.png";
    overlayButton.textContent = "再玩一局";
    resultOverlay.classList.remove("is-hidden");
  }

  function togglePause() {
    if (!active) return;
    paused = !paused;
    pauseButton.textContent = paused ? "继续" : "暂停";
    if (paused) root.cancelAnimationFrame(frameId);
    else { lastTime = 0; frameId = root.requestAnimationFrame(loop); }
  }

  function aimFromPointer(event) {
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left) * canvas.width / bounds.width;
    const y = (event.clientY - bounds.top) * canvas.height / bounds.height;
    targetAngle = Math.max(-Math.PI + 0.24, Math.min(-0.24, Math.atan2(y - LAUNCHER.y, x - LAUNCHER.x)));
  }

  difficultyButtons.forEach((button) => button.addEventListener("click", () => {
    level = button.dataset.level;
    difficultyButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    if (active) startGame();
    else { config = LEVELS[level]; missesLeft = config.misses; updateStatus(); }
  }));
  document.querySelectorAll("[data-aim]").forEach((button) => button.addEventListener("click", () => {
    targetAngle = Math.max(-Math.PI + 0.24, Math.min(-0.24, targetAngle + Number(button.dataset.aim) * 0.12));
  }));
  document.getElementById("shootButton").addEventListener("click", shoot);
  document.getElementById("newGameButton").addEventListener("click", startGame);
  overlayButton.addEventListener("click", startGame);
  pauseButton.addEventListener("click", togglePause);
  canvas.addEventListener("pointermove", aimFromPointer);
  canvas.addEventListener("pointerdown", (event) => { aimFromPointer(event); event.preventDefault(); });
  canvas.addEventListener("pointerup", (event) => { aimFromPointer(event); angle = targetAngle; shoot(); });
  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") { event.preventDefault(); targetAngle = Math.max(-Math.PI + 0.24, targetAngle - 0.08); }
    else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") { event.preventDefault(); targetAngle = Math.min(-0.24, targetAngle + 0.08); }
    else if (event.key === " " || event.key === "ArrowUp") { event.preventDefault(); shoot(); }
    else if (event.key === "p" || event.key === "P") togglePause();
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && active && !paused) togglePause(); });

  config = LEVELS[level];
  grid = makeGrid();
  seedGrid();
  updateStatus();
  render(0);
  return api;
});
