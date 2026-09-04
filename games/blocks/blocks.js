(function initBlocks(root, factory) {
  const api = factory(root, root.document);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OrchardBlocks = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createBlocks(root, document) {
  const SHAPES = {
    I: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
    O: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
    T: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
    S: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
    Z: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
    J: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
    L: [{ x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  };

  function rotateCells(cells) {
    const rotated = cells.map((cell) => ({ x: -cell.y, y: cell.x }));
    const minimumX = Math.min(...rotated.map((cell) => cell.x));
    const minimumY = Math.min(...rotated.map((cell) => cell.y));
    return rotated.map((cell) => ({ x: cell.x - minimumX, y: cell.y - minimumY }));
  }

  function collides(board, cells, offsetX, offsetY) {
    const rows = board.length;
    const columns = board[0].length;
    return cells.some((cell) => {
      const x = offsetX + cell.x;
      const y = offsetY + cell.y;
      return x < 0 || x >= columns || y >= rows || (y >= 0 && board[y][x]);
    });
  }

  function completeRows(board) {
    const rows = [];
    board.forEach((row, index) => { if (row.every(Boolean)) rows.push(index); });
    return rows;
  }

  function clearCompletedRows(board) {
    const rows = completeRows(board);
    const next = board.filter((_, index) => !rows.includes(index)).map((row) => row.slice());
    while (next.length < board.length) next.unshift(Array(board[0].length).fill(null));
    return { board: next, cleared: rows.length, rows };
  }

  const api = { SHAPES, rotateCells, collides, completeRows, clearCompletedRows };
  if (!document) return api;

  const LEVELS = {
    easy: { drop: 820 },
    normal: { drop: 570 },
    hard: { drop: 360 },
  };
  const PIECES = {
    I: { color: "#69aeca", fruit: "blueberries" },
    O: { color: "#efc84b", fruit: "lemon" },
    T: { color: "#9b68ba", fruit: "grapes" },
    S: { color: "#70a94d", fruit: "pear" },
    Z: { color: "#e85c50", fruit: "apple" },
    J: { color: "#5476bd", fruit: "plum" },
    L: { color: "#ed8b42", fruit: "orange" },
  };
  const ROWS = 20;
  const COLUMNS = 10;
  const CELL = 36;
  const BOARD_X = 28;
  const BOARD_Y = 40;

  const canvas = document.getElementById("blocksCanvas");
  const context = canvas.getContext("2d");
  const scoreElement = document.getElementById("score");
  const linesElement = document.getElementById("lines");
  const levelElement = document.getElementById("gameLevel");
  const bestElement = document.getElementById("bestScore");
  const pauseButton = document.getElementById("pauseButton");
  const resultOverlay = document.getElementById("resultOverlay");
  const resultTitle = document.getElementById("resultTitle");
  const resultMessage = document.getElementById("resultMessage");
  const resultImage = document.getElementById("resultImage");
  const overlayButton = document.getElementById("overlayButton");
  const difficultyButtons = Array.from(document.querySelectorAll(".difficulty-button"));
  const images = new Map();

  Object.values(PIECES).forEach((definition) => {
    if (images.has(definition.fruit)) return;
    const image = new Image();
    image.src = "../../assets/fruits/" + definition.fruit + ".png";
    images.set(definition.fruit, image);
  });

  let levelMode = "normal";
  let board = [];
  let piece = null;
  let nextType = "T";
  let bag = [];
  let score = 0;
  let lines = 0;
  let active = false;
  let paused = false;
  let accumulator = 0;
  let lastTime = 0;
  let frameId = null;
  let displayX = 0;
  let clearAnimation = null;
  let particles = [];
  let dropTrails = [];
  let rotationPulse = 0;
  let touchStart = null;

  function makeBoard() {
    return Array.from({ length: ROWS }, () => Array(COLUMNS).fill(null));
  }

  function shuffledBag() {
    const types = Object.keys(SHAPES);
    for (let index = types.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [types[index], types[target]] = [types[target], types[index]];
    }
    return types;
  }

  function takeType() {
    if (!bag.length) bag = shuffledBag();
    return bag.pop();
  }

  function gameLevel() {
    return 1 + Math.floor(lines / 8);
  }

  function dropInterval() {
    return Math.max(90, LEVELS[levelMode].drop - (gameLevel() - 1) * 46);
  }

  function readBest() {
    try { return Number(root.localStorage.getItem("orchard-blocks-best-" + levelMode)) || 0; } catch { return 0; }
  }

  function saveBest() {
    if (score > readBest()) {
      try { root.localStorage.setItem("orchard-blocks-best-" + levelMode, String(score)); } catch {}
    }
  }

  function updateStatus() {
    scoreElement.textContent = String(score);
    linesElement.textContent = String(lines);
    levelElement.textContent = String(gameLevel());
    bestElement.textContent = String(Math.max(score, readBest()));
  }

  function spawnPiece() {
    const type = nextType;
    nextType = takeType();
    piece = { type, cells: SHAPES[type].map((cell) => ({ ...cell })), x: 3, y: -1 };
    displayX = piece.x;
    rotationPulse = 1;
    if (collides(board, piece.cells, piece.x, piece.y)) finishGame();
  }

  function movePiece(amount) {
    if (!active || paused || !piece || clearAnimation) return false;
    const nextX = piece.x + amount;
    if (collides(board, piece.cells, nextX, piece.y)) return false;
    piece.x = nextX;
    return true;
  }

  function rotatePiece() {
    if (!active || paused || !piece || clearAnimation) return;
    if (piece.type === "O") { rotationPulse = 1; return; }
    const rotated = rotateCells(piece.cells);
    const kicks = [0, -1, 1, -2, 2];
    const kick = kicks.find((amount) => !collides(board, rotated, piece.x + amount, piece.y));
    if (kick === undefined) return;
    piece.cells = rotated;
    piece.x += kick;
    rotationPulse = 1;
  }

  function addLockParticles(lockedPiece) {
    lockedPiece.cells.forEach((cell) => {
      const x = BOARD_X + (lockedPiece.x + cell.x + 0.5) * CELL;
      const y = BOARD_Y + (lockedPiece.y + cell.y + 0.5) * CELL;
      for (let index = 0; index < 3; index += 1) {
        particles.push({ x, y, vx: -45 + Math.random() * 90, vy: -80 - Math.random() * 90, life: 1, color: PIECES[lockedPiece.type].color });
      }
    });
  }

  function lockPiece() {
    if (!piece) return;
    const locked = piece;
    const aboveTop = locked.cells.some((cell) => locked.y + cell.y < 0);
    if (aboveTop) { finishGame(); return; }
    locked.cells.forEach((cell) => { board[locked.y + cell.y][locked.x + cell.x] = locked.type; });
    addLockParticles(locked);
    piece = null;
    const rows = completeRows(board);
    if (rows.length) clearAnimation = { rows, elapsed: 0 };
    else spawnPiece();
  }

  function stepDown(manual = false) {
    if (!piece || clearAnimation) return false;
    if (!collides(board, piece.cells, piece.x, piece.y + 1)) {
      piece.y += 1;
      accumulator = 0;
      if (manual) score += 1;
      updateStatus();
      return true;
    }
    lockPiece();
    return false;
  }

  function hardDrop() {
    if (!active || paused || !piece || clearAnimation) return;
    const fromY = piece.y;
    while (!collides(board, piece.cells, piece.x, piece.y + 1)) piece.y += 1;
    const distance = piece.y - fromY;
    if (distance > 0) {
      dropTrails.push({ type: piece.type, cells: piece.cells.map((cell) => ({ ...cell })), x: piece.x, fromY, toY: piece.y, life: 1 });
      score += distance * 2;
    }
    accumulator = 0;
    lockPiece();
    updateStatus();
  }

  function finishClear() {
    const result = clearCompletedRows(board);
    const cleared = result.cleared;
    board = result.board;
    lines += cleared;
    score += [0, 100, 300, 500, 800][cleared] * gameLevel();
    clearAnimation = null;
    saveBest();
    updateStatus();
    spawnPiece();
  }

  function ghostY() {
    if (!piece) return 0;
    let y = piece.y;
    while (!collides(board, piece.cells, piece.x, y + 1)) y += 1;
    return y;
  }

  function roundedCell(x, y, size, radius) {
    context.beginPath();
    context.roundRect(x, y, size, size, radius);
  }

  function drawCell(column, row, type, alpha = 1, scale = 1) {
    if (row < 0) return;
    const definition = PIECES[type];
    const x = BOARD_X + column * CELL;
    const y = BOARD_Y + row * CELL;
    const inset = 2.5 + (1 - scale) * CELL / 2;
    const size = CELL - inset * 2;
    context.save();
    context.globalAlpha = alpha;
    const gradient = context.createLinearGradient(x, y, x + CELL, y + CELL);
    gradient.addColorStop(0, "#fff8cf");
    gradient.addColorStop(0.2, definition.color);
    gradient.addColorStop(1, "#285f46");
    context.fillStyle = gradient;
    context.shadowColor = "rgba(36,75,50,0.2)";
    context.shadowBlur = 5;
    roundedCell(x + inset, y + inset, size, Math.max(4, size * 0.2));
    context.fill();
    context.shadowBlur = 0;
    context.strokeStyle = "rgba(255,255,255,0.55)";
    context.lineWidth = 1.5;
    context.stroke();
    const image = images.get(definition.fruit);
    if (image?.complete && alpha > 0.3) context.drawImage(image, x + CELL * 0.17, y + CELL * 0.17, CELL * 0.66, CELL * 0.66);
    context.restore();
  }

  function drawPiece(activePiece, x, y, alpha = 1, scale = 1) {
    activePiece.cells.forEach((cell) => drawCell(x + cell.x, y + cell.y, activePiece.type, alpha, scale));
  }

  function render(timestamp) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#dff1df";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#b9d5b5";
    context.beginPath(); context.roundRect(BOARD_X - 7, BOARD_Y - 7, COLUMNS * CELL + 14, ROWS * CELL + 14, 16); context.fill();
    context.fillStyle = "#eff8e9";
    context.fillRect(BOARD_X, BOARD_Y, COLUMNS * CELL, ROWS * CELL);
    context.strokeStyle = "rgba(52,100,64,0.09)";
    context.lineWidth = 1;
    for (let column = 0; column <= COLUMNS; column += 1) {
      context.beginPath(); context.moveTo(BOARD_X + column * CELL, BOARD_Y); context.lineTo(BOARD_X + column * CELL, BOARD_Y + ROWS * CELL); context.stroke();
    }
    for (let row = 0; row <= ROWS; row += 1) {
      context.beginPath(); context.moveTo(BOARD_X, BOARD_Y + row * CELL); context.lineTo(BOARD_X + COLUMNS * CELL, BOARD_Y + row * CELL); context.stroke();
    }

    for (let row = 0; row < ROWS; row += 1) {
      for (let column = 0; column < COLUMNS; column += 1) {
        if (!board[row][column]) continue;
        let alpha = 1;
        let scale = 1;
        if (clearAnimation?.rows.includes(row)) {
          const pulse = Math.sin(clearAnimation.elapsed / 34) * 0.5 + 0.5;
          alpha = 0.35 + pulse * 0.65;
          scale = 0.82 + pulse * 0.18;
        }
        drawCell(column, row, board[row][column], alpha, scale);
      }
    }

    if (piece) {
      const interval = dropInterval();
      const canFall = !collides(board, piece.cells, piece.x, piece.y + 1);
      const visualY = piece.y + (canFall ? Math.min(1, accumulator / interval) : 0);
      const pulseScale = 1 + rotationPulse * 0.08;
      drawPiece(piece, piece.x, ghostY(), 0.18, 0.94);
      drawPiece(piece, displayX, visualY, 1, pulseScale);
    }

    dropTrails.forEach((trail) => {
      const y = trail.toY + (trail.fromY - trail.toY) * trail.life;
      drawPiece(trail, trail.x, y, trail.life * 0.32, 0.9);
    });
    particles.forEach((particle) => {
      context.globalAlpha = Math.max(0, particle.life);
      context.fillStyle = particle.color;
      context.beginPath(); context.arc(particle.x, particle.y, 3 + particle.life * 3, 0, Math.PI * 2); context.fill();
    });
    context.globalAlpha = 1;

    context.fillStyle = "#567166";
    context.font = "800 14px sans-serif";
    context.textAlign = "center";
    context.fillText("NEXT", 450, 92);
    const preview = { type: nextType, cells: SHAPES[nextType] };
    preview.cells.forEach((cell) => drawCell(10.7 + cell.x * 0.7, 2.5 + cell.y * 0.7, preview.type, 1, 0.88));
  }

  function loop(timestamp) {
    if (!active || paused) return;
    if (!lastTime) lastTime = timestamp;
    const delta = Math.min(50, timestamp - lastTime);
    lastTime = timestamp;
    const seconds = delta / 1000;
    rotationPulse = Math.max(0, rotationPulse - seconds * 7);
    displayX += (piece ? piece.x - displayX : 0) * (1 - Math.exp(-22 * seconds));
    particles.forEach((particle) => {
      particle.x += particle.vx * seconds;
      particle.y += particle.vy * seconds;
      particle.vy += 350 * seconds;
      particle.life -= seconds * 2.4;
    });
    particles = particles.filter((particle) => particle.life > 0);
    dropTrails.forEach((trail) => { trail.life -= seconds * 4.5; });
    dropTrails = dropTrails.filter((trail) => trail.life > 0);

    if (clearAnimation) {
      clearAnimation.elapsed += delta;
      if (clearAnimation.elapsed >= 300) finishClear();
    } else if (piece) {
      accumulator += delta;
      const interval = dropInterval();
      while (accumulator >= interval && piece && !clearAnimation) {
        accumulator -= interval;
        if (!collides(board, piece.cells, piece.x, piece.y + 1)) piece.y += 1;
        else lockPiece();
      }
    }
    render(timestamp);
    if (active) frameId = root.requestAnimationFrame(loop);
  }

  function startGame() {
    root.cancelAnimationFrame(frameId);
    board = makeBoard();
    bag = [];
    nextType = takeType();
    score = 0;
    lines = 0;
    accumulator = 0;
    clearAnimation = null;
    particles = [];
    dropTrails = [];
    active = true;
    paused = false;
    lastTime = 0;
    resultOverlay.classList.add("is-hidden");
    pauseButton.disabled = false;
    pauseButton.textContent = "暂停";
    spawnPiece();
    updateStatus();
    frameId = root.requestAnimationFrame(loop);
  }

  function finishGame() {
    active = false;
    root.cancelAnimationFrame(frameId);
    saveBest();
    pauseButton.disabled = true;
    resultTitle.textContent = lines >= 20 ? "果盘高手！" : "果盘装满了";
    resultMessage.textContent = "本局得到 " + score + " 分，共消除 " + lines + " 行。";
    resultImage.src = lines >= 20 ? "../../assets/fruits/watermelon.png" : "../../assets/fruits/starfruit.png";
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

  function handleAction(action) {
    if (action === "left") movePiece(-1);
    else if (action === "right") movePiece(1);
    else if (action === "rotate") rotatePiece();
    else if (action === "down") stepDown(true);
    else if (action === "drop") hardDrop();
  }

  difficultyButtons.forEach((button) => button.addEventListener("click", () => {
    levelMode = button.dataset.level;
    difficultyButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    if (active) startGame();
    else updateStatus();
  }));
  document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => handleAction(button.dataset.action)));
  document.getElementById("newGameButton").addEventListener("click", startGame);
  overlayButton.addEventListener("click", startGame);
  pauseButton.addEventListener("click", togglePause);
  document.addEventListener("keydown", (event) => {
    const action = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", ArrowUp: "rotate", w: "rotate", W: "rotate", ArrowDown: "down", s: "down", S: "down", " ": "drop" }[event.key];
    if (action) { event.preventDefault(); handleAction(action); }
    else if (event.key === "p" || event.key === "P") togglePause();
  });
  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture(event.pointerId);
    touchStart = { x: event.clientX, y: event.clientY };
    event.preventDefault();
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!touchStart) return;
    const dx = event.clientX - touchStart.x;
    const dy = event.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) rotatePiece();
    else if (Math.abs(dx) > Math.abs(dy)) {
      const amount = Math.max(1, Math.min(3, Math.round(Math.abs(dx) / 45)));
      for (let index = 0; index < amount; index += 1) movePiece(dx > 0 ? 1 : -1);
    } else if (dy > 80) hardDrop();
    else if (dy > 18) stepDown(true);
  });
  canvas.addEventListener("pointercancel", () => { touchStart = null; });
  document.addEventListener("visibilitychange", () => { if (document.hidden && active && !paused) togglePause(); });

  board = makeBoard();
  nextType = "T";
  updateStatus();
  render(0);
  return api;
});
