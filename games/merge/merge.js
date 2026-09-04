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

  function moveBoard(board, direction, size = 4) {
    const next = board.slice();
    let scoreGain = 0;
    for (let lineIndex = 0; lineIndex < size; lineIndex += 1) {
      const indexes = [];
      for (let offset = 0; offset < size; offset += 1) {
        if (direction === "left") indexes.push(lineIndex * size + offset);
        if (direction === "right") indexes.push(lineIndex * size + (size - 1 - offset));
        if (direction === "up") indexes.push(offset * size + lineIndex);
        if (direction === "down") indexes.push((size - 1 - offset) * size + lineIndex);
      }
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

  const api = { slideLine, moveBoard, addRandomTile, canMove };
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

  let board = [];
  let score = 0;
  let moves = 0;
  let wonShown = false;
  let resultMode = "continue";
  let startX = 0;
  let startY = 0;
  let pointerId = null;

  function readBest() {
    try { return Number(root.localStorage.getItem("orchard-merge-best")) || 0; } catch { return 0; }
  }

  function updateBest() {
    if (score > readBest()) {
      try { root.localStorage.setItem("orchard-merge-best", String(score)); } catch {}
    }
  }

  function highestLevel() {
    return Math.max(1, ...board);
  }

  function render() {
    boardElement.replaceChildren();
    board.forEach((level) => {
      const cell = document.createElement("div");
      cell.className = "merge-cell" + (level ? " has-fruit" : "");
      cell.setAttribute("role", "gridcell");
      if (level) {
        const fruit = FRUITS[Math.min(level, FRUITS.length - 1)];
        const image = document.createElement("img");
        image.src = "../../assets/fruits/" + fruit.file;
        image.alt = fruit.name;
        const value = document.createElement("span");
        value.textContent = String(2 ** level);
        cell.dataset.level = String(level);
        cell.append(image, value);
      } else {
        cell.setAttribute("aria-label", "空格");
      }
      boardElement.appendChild(cell);
    });
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

  function handleMove(direction) {
    if (!resultOverlay.classList.contains("is-hidden")) return;
    const result = moveBoard(board, direction);
    if (!result.moved) return;
    board = addRandomTile(result.board);
    score += result.scoreGain;
    moves += 1;
    updateBest();
    render();
    if (highestLevel() >= 11 && !wonShown) {
      wonShown = true;
      showResult("continue");
    } else if (!canMove(board)) {
      showResult("restart");
    }
  }

  function newGame() {
    board = addRandomTile(addRandomTile(Array(16).fill(0)));
    score = 0;
    moves = 0;
    wonShown = false;
    resultOverlay.classList.add("is-hidden");
    render();
  }

  document.querySelectorAll("[data-direction]").forEach((button) => {
    button.addEventListener("click", () => handleMove(button.dataset.direction));
  });
  document.addEventListener("keydown", (event) => {
    const directions = {
      ArrowUp: "up",
      w: "up",
      W: "up",
      ArrowDown: "down",
      s: "down",
      S: "down",
      ArrowLeft: "left",
      a: "left",
      A: "left",
      ArrowRight: "right",
      d: "right",
      D: "right",
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
