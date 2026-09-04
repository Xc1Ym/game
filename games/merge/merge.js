(function initMerge(root, factory) {
  const api = factory(root, root.document);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OrchardMerge = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMerge(root, document) {
  function slideLine(line) {
    const compact = line.filter((value) => value > 0);
    const merged = [];
    let scoreGain = 0;
    for (let index = 0; index < compact.length; index += 1) {
      if (compact[index] === compact[index + 1]) {
        const level = compact[index] + 1;
        merged.push(level);
        scoreGain += 2 ** level;
        index += 1;
      } else {
        merged.push(compact[index]);
      }
    }
    while (merged.length < line.length) merged.push(0);
    return { line: merged, scoreGain };
  }

  function lineIndexes(direction, lineIndex, size) {
    const indexes = [];
    for (let offset = 0; offset < size; offset += 1) {
      if (direction === "left") indexes.push(lineIndex * size + offset);
      if (direction === "right") indexes.push(lineIndex * size + (size - 1 - offset));
      if (direction === "up") indexes.push(offset * size + lineIndex);
      if (direction === "down") indexes.push((size - 1 - offset) * size + lineIndex);
    }
    return indexes;
  }

  function moveBoard(board, direction, size = 4) {
    const next = board.slice();
    let scoreGain = 0;
    for (let lineIndex = 0; lineIndex < size; lineIndex += 1) {
      const indexes = lineIndexes(direction, lineIndex, size);
      const result = slideLine(indexes.map((index) => board[index]));
      indexes.forEach((index, position) => { next[index] = result.line[position]; });
      scoreGain += result.scoreGain;
    }
    const moved = next.some((value, index) => value !== board[index]);
    return { board: next, scoreGain, moved };
  }

  function addRandomTile(board, random = Math.random) {
    const empty = board.map((value, index) => value === 0 ? index : -1).filter((index) => index >= 0);
    if (!empty.length) return board.slice();
    const next = board.slice();
    const target = empty[Math.floor(random() * empty.length)];
    next[target] = random() < 0.9 ? 1 : 2;
    return next;
  }

  function canMove(board, size = 4) {
    if (board.includes(0)) return true;
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const index = row * size + col;
        if (col + 1 < size && board[index] === board[index + 1]) return true;
        if (row + 1 < size && board[index] === board[index + size]) return true;
      }
    }
    return false;
  }

  function planTileMove(tiles, direction, size = 4, idFactory = () => "merged") {
    const byPosition = new Map(tiles.map((tile) => [tile.position, tile]));
    const nextTiles = [];
    const transitions = [];
    let scoreGain = 0;

    for (let lineIndex = 0; lineIndex < size; lineIndex += 1) {
      const indexes = lineIndexes(direction, lineIndex, size);
      const lineTiles = indexes.map((position) => byPosition.get(position)).filter(Boolean);
      let targetOffset = 0;

      for (let index = 0; index < lineTiles.length; index += 1) {
        const tile = lineTiles[index];
        const nextTile = lineTiles[index + 1];
        const targetPosition = indexes[targetOffset];
        if (nextTile && tile.level === nextTile.level) {
          const mergedLevel = tile.level + 1;
          transitions.push(
            { id: tile.id, fromPosition: tile.position, toPosition: targetPosition, removed: true },
            { id: nextTile.id, fromPosition: nextTile.position, toPosition: targetPosition, removed: true },
          );
          nextTiles.push({ id: idFactory(), level: mergedLevel, position: targetPosition, merged: true });
          scoreGain += 2 ** mergedLevel;
          targetOffset += 1;
          index += 1;
        } else {
          transitions.push({ id: tile.id, fromPosition: tile.position, toPosition: targetPosition, removed: false });
          nextTiles.push({ id: tile.id, level: tile.level, position: targetPosition });
          targetOffset += 1;
        }
      }
    }

    const moved = transitions.some((transition) => transition.removed || transition.fromPosition !== transition.toPosition);
    return { tiles: nextTiles, transitions, scoreGain, moved };
  }

  const api = { slideLine, moveBoard, addRandomTile, canMove, planTileMove };
  if (!document) return api;

  const FRUITS = [
    null,
    { name: "樱桃", file: "cherries.png" },
    { name: "草莓", file: "strawberry.png" },
    { name: "柠檬", file: "lemon.png" },
    { name: "橙子", file: "orange.png" },
    { name: "苹果", file: "apple.png" },
    { name: "梨", file: "pear.png" },
    { name: "桃子", file: "peach.png" },
    { name: "葡萄", file: "grapes.png" },
    { name: "菠萝", file: "pineapple.png" },
    { name: "火龙果", file: "dragonfruit.png" },
    { name: "西瓜", file: "watermelon.png" },
  ];
  const MOVE_DURATION = 170;

  const boardElement = document.getElementById("mergeBoard");
  const scoreElement = document.getElementById("score");
  const bestElement = document.getElementById("bestScore");
  const moveElement = document.getElementById("moveCount");
  const highestElement = document.getElementById("highestFruit");
  const resultOverlay = document.getElementById("resultOverlay");
  const resultTitle = document.getElementById("resultTitle");
  const resultMessage = document.getElementById("resultMessage");
  const resultImage = document.getElementById("resultImage");
  const resultButton = document.getElementById("resultButton");

  let tileLayer = null;
  let tiles = [];
  let tileElements = new Map();
  let score = 0;
  let moves = 0;
  let wonShown = false;
  let resultMode = "continue";
  let nextId = 1;
  let animating = false;
  let animationToken = 0;
  let settleTimer = null;
  let startX = 0;
  let startY = 0;
  let pointerId = null;

  function createId() {
    const id = "tile-" + nextId;
    nextId += 1;
    return id;
  }

  function readBest() {
    try { return Number(root.localStorage.getItem("orchard-merge-best")) || 0; } catch { return 0; }
  }

  function updateBest() {
    if (score > readBest()) {
      try { root.localStorage.setItem("orchard-merge-best", String(score)); } catch {}
    }
  }

  function boardValues() {
    const values = Array(16).fill(0);
    tiles.forEach((tile) => { values[tile.position] = tile.level; });
    return values;
  }

  function highestLevel() {
    return Math.max(1, ...tiles.map((tile) => tile.level));
  }

  function placeElement(element, position) {
    element.style.gridColumn = String(position % 4 + 1);
    element.style.gridRow = String(Math.floor(position / 4) + 1);
  }

  function updateTileContent(element, tile) {
    const fruit = FRUITS[Math.min(tile.level, FRUITS.length - 1)];
    element.dataset.level = String(tile.level);
    const image = element.querySelector("img");
    const value = element.querySelector("span");
    image.src = "../../assets/fruits/" + fruit.file;
    image.alt = fruit.name;
    value.textContent = String(2 ** tile.level);
  }

  function createTileElement(tile) {
    const element = document.createElement("div");
    element.className = "merge-tile";
    element.dataset.id = tile.id;
    element.setAttribute("role", "gridcell");
    const content = document.createElement("div");
    content.className = "merge-tile-content";
    const image = document.createElement("img");
    const value = document.createElement("span");
    content.append(image, value);
    element.appendChild(content);
    updateTileContent(element, tile);
    placeElement(element, tile.position);
    tileLayer.appendChild(element);
    tileElements.set(tile.id, element);
    return element;
  }

  function reconcileTiles() {
    const activeIds = new Set(tiles.map((tile) => tile.id));
    tileElements.forEach((element, id) => {
      if (!activeIds.has(id)) {
        element.remove();
        tileElements.delete(id);
      }
    });

    tiles.forEach((tile) => {
      const isNewElement = !tileElements.has(tile.id);
      const element = tileElements.get(tile.id) || createTileElement(tile);
      element.style.transition = "";
      element.style.transform = "";
      placeElement(element, tile.position);
      updateTileContent(element, tile);
      if (isNewElement) element.classList.add(tile.merged ? "is-merged" : "is-new");
      tile.merged = false;
    });
  }

  function addRandomGameTile() {
    const occupied = new Set(tiles.map((tile) => tile.position));
    const empty = Array.from({ length: 16 }, (_, index) => index).filter((position) => !occupied.has(position));
    if (!empty.length) return;
    const position = empty[Math.floor(Math.random() * empty.length)];
    tiles.push({ id: createId(), level: Math.random() < 0.9 ? 1 : 2, position });
  }

  function renderStatus() {
    scoreElement.textContent = String(score);
    bestElement.textContent = String(Math.max(score, readBest()));
    moveElement.textContent = String(moves);
    highestElement.textContent = FRUITS[Math.min(highestLevel(), FRUITS.length - 1)].name;
  }

  function showResult(mode) {
    resultMode = mode;
    if (mode === "continue") {
      resultTitle.textContent = "合成西瓜了！";
      resultMessage.textContent = "你已达到 2048，当前积分 " + score + "。还可以继续合成更高分。";
      resultImage.src = "../../assets/fruits/watermelon.png";
      resultButton.textContent = "继续挑战";
    } else {
      resultTitle.textContent = "果盘放满了";
      resultMessage.textContent = "本局得到 " + score + " 分，移动了 " + moves + " 次。";
      resultImage.src = "../../assets/fruits/dragonfruit.png";
      resultButton.textContent = "再玩一局";
    }
    resultOverlay.classList.remove("is-hidden");
  }

  function finishMove(plan, token) {
    if (token !== animationToken) return;
    tiles = plan.tiles;
    addRandomGameTile();
    score += plan.scoreGain;
    moves += 1;
    updateBest();
    reconcileTiles();
    renderStatus();
    animating = false;

    if (highestLevel() >= 11 && !wonShown) {
      wonShown = true;
      showResult("continue");
    } else if (!canMove(boardValues())) {
      showResult("restart");
    }
  }

  function animateMove(plan) {
    animating = true;
    const token = ++animationToken;
    const startRects = new Map();
    plan.transitions.forEach((transition) => {
      const element = tileElements.get(transition.id);
      if (element) startRects.set(transition.id, element.getBoundingClientRect());
    });

    plan.transitions.forEach((transition) => {
      const element = tileElements.get(transition.id);
      if (element) placeElement(element, transition.toPosition);
    });

    plan.transitions.forEach((transition) => {
      const element = tileElements.get(transition.id);
      const startRect = startRects.get(transition.id);
      if (!element || !startRect) return;
      const endRect = element.getBoundingClientRect();
      element.style.transition = "none";
      element.style.transform = "translate3d(" + (startRect.left - endRect.left) + "px, " + (startRect.top - endRect.top) + "px, 0)";
    });

    tileLayer.getBoundingClientRect();
    root.requestAnimationFrame(() => {
      if (token !== animationToken) return;
      plan.transitions.forEach((transition) => {
        const element = tileElements.get(transition.id);
        if (!element) return;
        element.style.transition = "transform " + MOVE_DURATION + "ms cubic-bezier(0.2, 0.82, 0.28, 1)";
        element.style.transform = "translate3d(0, 0, 0)";
      });
    });

    settleTimer = root.setTimeout(() => finishMove(plan, token), MOVE_DURATION + 20);
  }

  function handleMove(direction) {
    if (animating || !resultOverlay.classList.contains("is-hidden")) return;
    const plan = planTileMove(tiles, direction, 4, createId);
    if (!plan.moved) return;
    animateMove(plan);
  }

  function initializeBoard() {
    boardElement.replaceChildren();
    const background = document.createElement("div");
    background.className = "merge-grid-background";
    for (let index = 0; index < 16; index += 1) {
      const cell = document.createElement("div");
      cell.className = "merge-grid-cell";
      background.appendChild(cell);
    }
    tileLayer = document.createElement("div");
    tileLayer.className = "merge-tile-layer";
    boardElement.append(background, tileLayer);
  }

  function newGame() {
    animationToken += 1;
    root.clearTimeout(settleTimer);
    animating = false;
    nextId = 1;
    tiles = [];
    tileElements = new Map();
    resultOverlay.classList.add("is-hidden");
    initializeBoard();
    addRandomGameTile();
    addRandomGameTile();
    score = 0;
    moves = 0;
    wonShown = false;
    reconcileTiles();
    renderStatus();
  }

  document.querySelectorAll("[data-direction]").forEach((button) => {
    button.addEventListener("click", () => handleMove(button.dataset.direction));
  });
  document.addEventListener("keydown", (event) => {
    const directions = {
      ArrowUp: "up", w: "up", W: "up",
      ArrowDown: "down", s: "down", S: "down",
      ArrowLeft: "left", a: "left", A: "left",
      ArrowRight: "right", d: "right", D: "right",
    };
    if (directions[event.key]) {
      event.preventDefault();
      handleMove(directions[event.key]);
    }
  });

  boardElement.addEventListener("pointerdown", (event) => {
    pointerId = event.pointerId;
    startX = event.clientX;
    startY = event.clientY;
    boardElement.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  boardElement.addEventListener("pointerup", (event) => {
    if (event.pointerId !== pointerId) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    pointerId = null;
    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 24) return;
    if (Math.abs(deltaX) > Math.abs(deltaY)) handleMove(deltaX > 0 ? "right" : "left");
    else handleMove(deltaY > 0 ? "down" : "up");
  });
  boardElement.addEventListener("pointercancel", () => { pointerId = null; });

  document.getElementById("resetButton").addEventListener("click", newGame);
  resultButton.addEventListener("click", () => {
    if (resultMode === "restart") newGame();
    else resultOverlay.classList.add("is-hidden");
  });

  newGame();
  return api;
});
