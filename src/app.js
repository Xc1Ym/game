(function startFruitLink() {
  "use strict";

  const { createBoard, findPath, findAvailablePair, shuffleRemaining, countRemaining } = window.FruitLinkLogic;
  const FRUITS = [
    "apple", "orange", "lemon", "pear", "peach", "cherries", "strawberry", "blueberries",
    "kiwi", "watermelon", "grapes", "pineapple", "mango", "banana", "coconut", "avocado",
    "lime", "plum", "pomegranate", "dragonfruit", "papaya", "starfruit", "fig", "passionfruit",
  ];
  const FRUIT_NAMES = {
    apple: "苹果",
    orange: "橙子",
    lemon: "柠檬",
    pear: "梨",
    peach: "桃子",
    cherries: "樱桃",
    strawberry: "草莓",
    blueberries: "蓝莓",
    kiwi: "猕猴桃",
    watermelon: "西瓜",
    grapes: "葡萄",
    pineapple: "菠萝",
    mango: "芒果",
    banana: "香蕉",
    coconut: "椰子",
    avocado: "牛油果",
    lime: "青柠",
    plum: "李子",
    pomegranate: "石榴",
    dragonfruit: "火龙果",
    papaya: "木瓜",
    starfruit: "杨桃",
    fig: "无花果",
    passionfruit: "百香果",
  };
  const LEVELS = {
    easy: { rows: 6, cols: 8, types: 10, time: 240, hints: 4, shuffles: 2, label: "悠闲" },
    normal: { rows: 8, cols: 10, types: 16, time: 300, hints: 2, shuffles: 1, label: "进阶" },
    hard: { rows: 10, cols: 12, types: 24, time: 360, hints: 1, shuffles: 1, label: "挑战" },
  };

  const elements = {
    board: document.querySelector("#board"),
    boardWrap: document.querySelector("#boardWrap"),
    score: document.querySelector("#score"),
    remaining: document.querySelector("#remaining"),
    timeText: document.querySelector("#timeText"),
    timerFill: document.querySelector("#timerFill"),
    hintCount: document.querySelector("#hintCount"),
    shuffleCount: document.querySelector("#shuffleCount"),
    hintButton: document.querySelector("#hintButton"),
    shuffleButton: document.querySelector("#shuffleButton"),
    newGameButton: document.querySelector("#newGameButton"),
    soundButton: document.querySelector("#soundButton"),
    pathLayer: document.querySelector("#pathLayer"),
    comboBadge: document.querySelector("#comboBadge"),
    modal: document.querySelector("#resultModal"),
    resultFruit: document.querySelector("#resultFruit"),
    resultEyebrow: document.querySelector("#resultEyebrow"),
    resultTitle: document.querySelector("#resultTitle"),
    resultMessage: document.querySelector("#resultMessage"),
    finalScore: document.querySelector("#finalScore"),
    playAgainButton: document.querySelector("#playAgainButton"),
  };

  const state = {
    level: "easy",
    board: [],
    selected: null,
    score: 0,
    remainingTime: 0,
    hints: 0,
    shuffles: 0,
    combo: 0,
    lastMatchAt: 0,
    timer: null,
    locked: false,
    sound: true,
    audioContext: null,
  };

  function formatTime(seconds) {
    const safe = Math.max(0, seconds);
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  }

  function playTone(frequency, duration = 0.08, delay = 0) {
    if (!state.sound) return;
    try {
      state.audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const context = state.audioContext;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + duration + 0.02);
    } catch {
      state.sound = false;
    }
  }

  function updateStatus() {
    const config = LEVELS[state.level];
    const remaining = countRemaining(state.board);
    elements.score.textContent = state.score.toLocaleString("zh-CN");
    elements.remaining.textContent = remaining;
    elements.timeText.textContent = formatTime(state.remainingTime);
    elements.hintCount.textContent = state.hints;
    elements.shuffleCount.textContent = state.shuffles;
    elements.timerFill.style.width = `${Math.max(0, (state.remainingTime / config.time) * 100)}%`;
    elements.timerFill.classList.toggle("urgent", state.remainingTime <= 30);
    elements.hintButton.disabled = state.hints <= 0 || remaining === 0;
    elements.shuffleButton.disabled = state.shuffles <= 0 || remaining <= 2;
  }

  function tileAt(position) {
    return elements.board.querySelector(`[data-row="${position.row}"][data-col="${position.col}"]`);
  }

  function renderBoard() {
    const config = LEVELS[state.level];
    elements.board.style.setProperty("--columns", config.cols);
    elements.board.style.setProperty("--rows", config.rows);
    elements.board.innerHTML = "";
    state.board.forEach((row, rowIndex) => {
      row.forEach((fruit, colIndex) => {
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = fruit == null ? "tile removed" : "tile";
        tile.dataset.row = rowIndex;
        tile.dataset.col = colIndex;
        tile.setAttribute("role", "gridcell");
        tile.setAttribute("aria-label", fruit == null ? "已消除" : FRUIT_NAMES[fruit]);
        tile.disabled = fruit == null;
        if (fruit != null) {
          const image = document.createElement("img");
          image.src = `assets/fruits/${fruit}.png`;
          image.alt = "";
          image.draggable = false;
          tile.appendChild(image);
        }
        tile.addEventListener("click", () => chooseTile({ row: rowIndex, col: colIndex }));
        elements.board.appendChild(tile);
      });
    });
    if (state.selected) tileAt(state.selected)?.classList.add("selected");
    updateStatus();
  }

  function positionToPoint(position) {
    const gridRect = elements.board.getBoundingClientRect();
    const first = elements.board.querySelector(".tile");
    const secondColumn = elements.board.querySelector('[data-row="0"][data-col="1"]');
    const secondRow = elements.board.querySelector('[data-row="1"][data-col="0"]');
    if (!first) return { x: 0, y: 0 };
    const firstRect = first.getBoundingClientRect();
    const stepX = secondColumn ? secondColumn.getBoundingClientRect().left - firstRect.left : firstRect.width;
    const stepY = secondRow ? secondRow.getBoundingClientRect().top - firstRect.top : firstRect.height;
    return {
      x: firstRect.left - gridRect.left + firstRect.width / 2 + position.col * stepX,
      y: firstRect.top - gridRect.top + firstRect.height / 2 + position.row * stepY,
    };
  }

  function showPath(path) {
    const width = elements.board.clientWidth;
    const height = elements.board.clientHeight;
    elements.pathLayer.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const points = path.map(positionToPoint).map(({ x, y }) => `${x},${y}`).join(" ");
    elements.pathLayer.innerHTML = `<polyline points="${points}" />`;
    elements.pathLayer.classList.add("visible");
    window.setTimeout(() => {
      elements.pathLayer.classList.remove("visible");
      elements.pathLayer.innerHTML = "";
    }, 280);
  }

  function flashInvalid(first, second) {
    [tileAt(first), tileAt(second)].forEach((tile) => {
      tile?.classList.add("invalid");
      window.setTimeout(() => tile?.classList.remove("invalid"), 330);
    });
  }

  function showCombo() {
    if (state.combo < 2) return;
    elements.comboBadge.textContent = `${state.combo} 连击  +${state.combo * 5}`;
    elements.comboBadge.classList.remove("show");
    void elements.comboBadge.offsetWidth;
    elements.comboBadge.classList.add("show");
  }

  function ensureMoveAvailable() {
    if (countRemaining(state.board) === 0 || findAvailablePair(state.board)) return;
    let attempts = 0;
    do {
      state.board = shuffleRemaining(state.board);
      attempts += 1;
    } while (!findAvailablePair(state.board) && attempts < 100);
    renderBoard();
    elements.boardWrap.classList.add("auto-shuffled");
    window.setTimeout(() => elements.boardWrap.classList.remove("auto-shuffled"), 550);
  }

  function chooseTile(position) {
    if (state.locked || state.remainingTime <= 0 || state.board[position.row][position.col] == null) return;
    playTone(340, 0.05);

    if (!state.selected) {
      state.selected = position;
      tileAt(position)?.classList.add("selected");
      return;
    }
    if (state.selected.row === position.row && state.selected.col === position.col) {
      tileAt(position)?.classList.remove("selected");
      state.selected = null;
      return;
    }

    const first = state.selected;
    const path = findPath(state.board, first, position);
    tileAt(first)?.classList.remove("selected");
    state.selected = null;

    if (!path) {
      flashInvalid(first, position);
      state.combo = 0;
      playTone(150, 0.12);
      return;
    }

    state.locked = true;
    const now = Date.now();
    state.combo = now - state.lastMatchAt < 3000 ? state.combo + 1 : 1;
    state.lastMatchAt = now;
    state.score += 20 + Math.max(0, state.combo - 1) * 5;
    state.board[first.row][first.col] = null;
    state.board[position.row][position.col] = null;
    tileAt(first)?.classList.add("matched");
    tileAt(position)?.classList.add("matched");
    showPath(path);
    showCombo();
    playTone(620, 0.08);
    playTone(820, 0.1, 0.06);
    updateStatus();

    window.setTimeout(() => {
      renderBoard();
      state.locked = false;
      if (countRemaining(state.board) === 0) finishGame(true);
      else ensureMoveAvailable();
    }, 290);
  }

  function showHint() {
    if (state.locked || state.hints <= 0) return;
    const pair = findAvailablePair(state.board);
    if (!pair) {
      ensureMoveAvailable();
      return;
    }
    state.hints -= 1;
    state.selected = null;
    elements.board.querySelectorAll(".selected").forEach((tile) => tile.classList.remove("selected"));
    const tiles = [tileAt(pair.first), tileAt(pair.second)];
    tiles.forEach((tile) => tile?.classList.add("hinted"));
    showPath(pair.path);
    playTone(520, 0.08);
    window.setTimeout(() => tiles.forEach((tile) => tile?.classList.remove("hinted")), 900);
    updateStatus();
  }

  function shuffleBoard() {
    if (state.locked || state.shuffles <= 0 || countRemaining(state.board) <= 2) return;
    state.shuffles -= 1;
    state.selected = null;
    do state.board = shuffleRemaining(state.board);
    while (!findAvailablePair(state.board));
    renderBoard();
    elements.boardWrap.classList.add("auto-shuffled");
    window.setTimeout(() => elements.boardWrap.classList.remove("auto-shuffled"), 550);
    playTone(440, 0.06);
    playTone(660, 0.08, 0.07);
  }

  function finishGame(won) {
    window.clearInterval(state.timer);
    state.timer = null;
    state.locked = true;
    if (won) {
      const timeBonus = state.remainingTime * 2;
      state.score += timeBonus;
      elements.resultFruit.textContent = "🏆";
      elements.resultEyebrow.textContent = "丰收时刻";
      elements.resultTitle.textContent = "果园大丰收！";
      elements.resultMessage.textContent = `清空棋盘，另获 ${timeBonus} 分时间奖励。`;
      playTone(523, 0.14);
      playTone(659, 0.14, 0.13);
      playTone(784, 0.24, 0.26);
    } else {
      elements.resultFruit.textContent = "⏳";
      elements.resultEyebrow.textContent = "时间到";
      elements.resultTitle.textContent = "差一点就丰收了";
      elements.resultMessage.textContent = "换个节奏，再来挑战一次吧。";
      playTone(220, 0.2);
    }
    elements.finalScore.textContent = state.score.toLocaleString("zh-CN");
    updateStatus();
    window.setTimeout(() => elements.modal.classList.remove("hidden"), 250);
  }

  function startTimer() {
    window.clearInterval(state.timer);
    state.timer = window.setInterval(() => {
      state.remainingTime -= 1;
      updateStatus();
      if (state.remainingTime <= 0) finishGame(false);
    }, 1000);
  }

  function newGame() {
    const config = LEVELS[state.level];
    state.board = createBoard(config.rows, config.cols, FRUITS.slice(0, config.types));
    state.selected = null;
    state.score = 0;
    state.remainingTime = config.time;
    state.hints = config.hints;
    state.shuffles = config.shuffles;
    state.combo = 0;
    state.lastMatchAt = 0;
    state.locked = false;
    elements.modal.classList.add("hidden");
    renderBoard();
    ensureMoveAvailable();
    startTimer();
  }

  document.querySelectorAll(".difficulty").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.level === state.level) return;
      state.level = button.dataset.level;
      document.querySelectorAll(".difficulty").forEach((item) => item.classList.toggle("active", item === button));
      newGame();
    });
  });
  elements.hintButton.addEventListener("click", showHint);
  elements.shuffleButton.addEventListener("click", shuffleBoard);
  elements.newGameButton.addEventListener("click", newGame);
  elements.playAgainButton.addEventListener("click", newGame);
  elements.soundButton.addEventListener("click", () => {
    state.sound = !state.sound;
    elements.soundButton.classList.toggle("muted", !state.sound);
    elements.soundButton.textContent = state.sound ? "♪" : "×";
    elements.soundButton.setAttribute("aria-label", state.sound ? "关闭音效" : "开启音效");
    if (state.sound) playTone(600, 0.08);
  });
  window.addEventListener("resize", () => {
    elements.pathLayer.classList.remove("visible");
    elements.pathLayer.innerHTML = "";
  });

  newGame();
})();
