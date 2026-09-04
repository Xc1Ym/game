(function initMines(root, factory) {
  const api = factory(root, root.document);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OrchardMines = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createMines(root, document) {
  function getNeighbors(index, rows, cols) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const result = [];
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
        if (rowOffset === 0 && colOffset === 0) continue;
        const nextRow = row + rowOffset;
        const nextCol = col + colOffset;
        if (nextRow >= 0 && nextRow < rows && nextCol >= 0 && nextCol < cols) {
          result.push(nextRow * cols + nextCol);
        }
      }
    }
    return result;
  }

  function buildMineSet(rows, cols, count, safeIndex, random = Math.random) {
    const excluded = new Set([safeIndex, ...getNeighbors(safeIndex, rows, cols)]);
    const candidates = Array.from({ length: rows * cols }, (_, index) => index)
      .filter((index) => !excluded.has(index));
    const mineCount = Math.min(count, candidates.length);
    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
    }
    return new Set(candidates.slice(0, mineCount));
  }

  function countAdjacentMines(index, rows, cols, mines) {
    return getNeighbors(index, rows, cols).filter((neighbor) => mines.has(neighbor)).length;
  }

  const api = { getNeighbors, buildMineSet, countAdjacentMines };
  if (!document) return api;

  const LEVELS = {
    easy: { rows: 8, cols: 8, mines: 10 },
    normal: { rows: 10, cols: 12, mines: 20 },
    hard: { rows: 12, cols: 16, mines: 40 },
  };

  const boardElement = document.getElementById("mineBoard");
  const minesLeftElement = document.getElementById("minesLeft");
  const timerElement = document.getElementById("timer");
  const revealedElement = document.getElementById("revealedCount");
  const bestElement = document.getElementById("bestTime");
  const resultOverlay = document.getElementById("resultOverlay");
  const resultTitle = document.getElementById("resultTitle");
  const resultMessage = document.getElementById("resultMessage");
  const resultImage = document.getElementById("resultImage");
  const difficultyButtons = Array.from(document.querySelectorAll(".difficulty-button"));
  const modeButtons = Array.from(document.querySelectorAll(".mode-button"));

  let level = "easy";
  let config = LEVELS[level];
  let cells = [];
  let mines = new Set();
  let firstMove = true;
  let playing = true;
  let mode = "reveal";
  let seconds = 0;
  let timerId = null;

  function formatTime(value) {
    return String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
  }

  function storageKey() {
    return "orchard-mines-best-" + level;
  }

  function readBest() {
    try {
      const value = Number(root.localStorage.getItem(storageKey()));
      return value > 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  function saveBest(value) {
    const current = readBest();
    if (!current || value < current) {
      try { root.localStorage.setItem(storageKey(), String(value)); } catch {}
    }
  }

  function updateStatus() {
    const flagged = cells.filter((cell) => cell.flagged).length;
    const revealed = cells.filter((cell) => cell.revealed && !cell.mine).length;
    minesLeftElement.textContent = String(Math.max(0, config.mines - flagged));
    revealedElement.textContent = String(revealed);
    timerElement.textContent = formatTime(seconds);
    const best = readBest();
    bestElement.textContent = best ? formatTime(best) : "--:--";
  }

  function startTimer() {
    if (timerId) return;
    timerId = root.setInterval(() => {
      seconds += 1;
      timerElement.textContent = formatTime(seconds);
    }, 1000);
  }

  function stopTimer() {
    root.clearInterval(timerId);
    timerId = null;
  }

  function placeMines(safeIndex) {
    mines = buildMineSet(config.rows, config.cols, config.mines, safeIndex);
    cells.forEach((cell, index) => {
      cell.mine = mines.has(index);
      cell.count = countAdjacentMines(index, config.rows, config.cols, mines);
    });
  }

  function revealArea(startIndex) {
    const queue = [startIndex];
    const visited = new Set();
    while (queue.length) {
      const index = queue.shift();
      if (visited.has(index)) continue;
      visited.add(index);
      const cell = cells[index];
      if (!cell || cell.flagged || cell.revealed) continue;
      cell.revealed = true;
      if (cell.count === 0 && !cell.mine) {
        getNeighbors(index, config.rows, config.cols).forEach((neighbor) => queue.push(neighbor));
      }
    }
  }

  function endGame(won) {
    playing = false;
    stopTimer();
    if (won) {
      saveBest(Math.max(1, seconds));
      resultTitle.textContent = "果园安全了！";
      resultMessage.textContent = "你在 " + formatTime(seconds) + " 内找出了全部害虫。";
      resultImage.src = "../../assets/fruits/kiwi.png";
    } else {
      cells.forEach((cell) => { if (cell.mine) cell.revealed = true; });
      resultTitle.textContent = "踩到害虫了";
      resultMessage.textContent = "换条路线，再检查一次数字线索。";
      resultImage.src = "../../assets/fruits/pomegranate.png";
    }
    renderBoard();
    updateStatus();
    resultOverlay.classList.remove("is-hidden");
  }

  function checkWin() {
    const safeCells = config.rows * config.cols - config.mines;
    if (cells.filter((cell) => cell.revealed && !cell.mine).length === safeCells) endGame(true);
  }

  function revealCell(index) {
    if (!playing || cells[index].flagged || cells[index].revealed) return;
    if (firstMove) {
      placeMines(index);
      firstMove = false;
      startTimer();
    }
    if (cells[index].mine) {
      cells[index].revealed = true;
      endGame(false);
      return;
    }
    revealArea(index);
    renderBoard();
    updateStatus();
    checkWin();
  }

  function toggleFlag(index) {
    if (!playing || cells[index].revealed) return;
    const flagged = cells.filter((cell) => cell.flagged).length;
    if (!cells[index].flagged && flagged >= config.mines) return;
    cells[index].flagged = !cells[index].flagged;
    renderBoard();
    updateStatus();
  }

  function handleCell(index) {
    if (mode === "flag") toggleFlag(index);
    else revealCell(index);
  }

  function renderBoard() {
    boardElement.replaceChildren();
    boardElement.style.setProperty("--rows", config.rows);
    boardElement.style.setProperty("--cols", config.cols);
    cells.forEach((cell, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "mine-cell";
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-label", cell.revealed ? (cell.mine ? "害虫" : "周围 " + cell.count + " 个害虫") : (cell.flagged ? "已插旗" : "未翻开"));
      if (cell.revealed) {
        button.classList.add("is-revealed");
        if (cell.mine) button.classList.add("is-mine");
        else if (cell.count > 0) {
          button.dataset.count = String(cell.count);
          button.textContent = String(cell.count);
        }
      } else if (cell.flagged) {
        button.classList.add("is-flagged");
      }
      button.addEventListener("click", () => handleCell(index));
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        toggleFlag(index);
      });
      boardElement.appendChild(button);
    });
  }

  function newGame() {
    stopTimer();
    config = LEVELS[level];
    cells = Array.from({ length: config.rows * config.cols }, () => ({
      mine: false,
      count: 0,
      revealed: false,
      flagged: false,
    }));
    mines = new Set();
    firstMove = true;
    playing = true;
    seconds = 0;
    resultOverlay.classList.add("is-hidden");
    renderBoard();
    updateStatus();
  }

  difficultyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      level = button.dataset.level;
      difficultyButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      newGame();
    });
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      mode = button.dataset.mode;
      modeButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    });
  });

  document.getElementById("resetButton").addEventListener("click", newGame);
  document.getElementById("playAgainButton").addEventListener("click", newGame);
  newGame();
  return api;
});
