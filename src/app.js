(function startFruitLink() {
  "use strict";

  const {
    createBoard,
    findPath,
    findAvailablePair,
    shuffleRemaining,
    countRemaining,
    sortRanking,
    updateRanking,
  } = window.FruitLinkLogic;
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
    easy: { rows: 6, cols: 8, types: 8, time: 300, hints: 5, shuffles: 3, label: "悠闲" },
    normal: { rows: 8, cols: 10, types: 14, time: 360, hints: 3, shuffles: 2, label: "进阶" },
    hard: { rows: 10, cols: 12, types: 24, time: 240, hints: 0, shuffles: 0, label: "挑战" },
  };
  const STORAGE_KEYS = {
    leaderboard: "fruitLinkLeaderboardV1",
    playerName: "fruitLinkPlayerNameV1",
  };
  const INVALID_MATCH_PENALTY = 5;

  const elements = {
    board: document.querySelector("#board"),
    boardWrap: document.querySelector("#boardWrap"),
    score: document.querySelector("#score"),
    scoreDifficulty: document.querySelector("#scoreDifficulty"),
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
    resultDifficulty: document.querySelector("#resultDifficulty"),
    playAgainButton: document.querySelector("#playAgainButton"),
    playerName: document.querySelector("#playerName"),
    leaderboardButton: document.querySelector("#leaderboardButton"),
    leaderboardModal: document.querySelector("#leaderboardModal"),
    rankingList: document.querySelector("#rankingList"),
    rankingScoreLabel: document.querySelector("#rankingScoreLabel"),
    closeLeaderboardButton: document.querySelector("#closeLeaderboardButton"),
    rankingDoneButton: document.querySelector("#rankingDoneButton"),
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
    pathTimer: null,
    resultTimer: null,
    shuffleTimer: null,
    locked: false,
    sound: true,
    audioContext: null,
    rankingLevel: "easy",
  };

  function formatTime(seconds) {
    const safe = Math.max(0, seconds);
    return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
  }

  function emptyLeaderboard() {
    return { easy: [], normal: [], hard: [] };
  }

  function loadLeaderboard() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.leaderboard) || "null");
      if (!parsed || typeof parsed !== "object") return emptyLeaderboard();
      return Object.fromEntries(Object.keys(LEVELS).map((level) => [
        level,
        sortRanking(Array.isArray(parsed[level]) ? parsed[level].filter((record) =>
          record
          && typeof record.name === "string"
          && Number.isFinite(record.elapsed)
          && Number.isFinite(record.score)
          && Number.isFinite(record.completedAt),
        ) : []),
      ]));
    } catch {
      return emptyLeaderboard();
    }
  }

  function persistLeaderboard(leaderboard) {
    try {
      localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(leaderboard));
      return true;
    } catch {
      return false;
    }
  }

  function currentPlayerName() {
    const name = elements.playerName.value.trim().slice(0, 12) || "匿名玩家";
    elements.playerName.value = name;
    try {
      localStorage.setItem(STORAGE_KEYS.playerName, name);
    } catch {
      // The game remains playable when browser storage is unavailable.
    }
    return name;
  }

  function rememberPlayerName() {
    try {
      localStorage.setItem(STORAGE_KEYS.playerName, elements.playerName.value.slice(0, 12));
    } catch {
      // The game remains playable when browser storage is unavailable.
    }
  }

  function recordWin() {
    const leaderboard = loadLeaderboard();
    const config = LEVELS[state.level];
    const result = updateRanking(leaderboard[state.level], {
      name: currentPlayerName(),
      elapsed: config.time - state.remainingTime,
      score: state.score,
      completedAt: Date.now(),
    });
    leaderboard[state.level] = result.records;
    return persistLeaderboard(leaderboard) ? result : null;
  }

  function renderLeaderboard() {
    const leaderboard = loadLeaderboard();
    const records = leaderboard[state.rankingLevel];
    elements.rankingScoreLabel.textContent = `积分·${LEVELS[state.rankingLevel].label}`;
    document.querySelectorAll(".ranking-tab").forEach((button) => {
      button.classList.toggle("active", button.dataset.rankingLevel === state.rankingLevel);
    });
    elements.rankingList.innerHTML = "";
    if (!records.length) {
      const empty = document.createElement("p");
      empty.className = "ranking-empty";
      empty.textContent = "还没有通关纪录，等你来占据第一名！";
      elements.rankingList.appendChild(empty);
      return;
    }
    records.forEach((record, index) => {
      const row = document.createElement("div");
      row.className = `ranking-row${index < 3 ? ` top-${index + 1}` : ""}`;
      row.setAttribute("role", "listitem");
      [String(index + 1), record.name, record.score.toLocaleString("zh-CN"), formatTime(record.elapsed)]
        .forEach((value) => {
          const cell = document.createElement("span");
          cell.textContent = value;
          row.appendChild(cell);
        });
      elements.rankingList.appendChild(row);
    });
  }

  function openLeaderboard() {
    state.rankingLevel = state.level;
    renderLeaderboard();
    elements.leaderboardModal.classList.remove("hidden");
    elements.closeLeaderboardButton.focus();
  }

  function closeLeaderboard() {
    elements.leaderboardModal.classList.add("hidden");
    elements.leaderboardButton.focus();
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
    elements.scoreDifficulty.textContent = config.label;
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
    clearPath();
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
        tile.setAttribute("aria-selected", "false");
        tile.disabled = fruit == null;
        if (fruit != null) {
          const image = document.createElement("img");
          image.src = `../../assets/fruits/${fruit}.png`;
          image.alt = "";
          image.draggable = false;
          tile.appendChild(image);
        }
        tile.addEventListener("click", () => chooseTile({ row: rowIndex, col: colIndex }));
        elements.board.appendChild(tile);
      });
    });
    if (state.selected) {
      tileAt(state.selected)?.classList.add("selected");
      tileAt(state.selected)?.setAttribute("aria-selected", "true");
    }
    updateStatus();
  }

  function positionToPoint(position) {
    const first = elements.board.querySelector(".tile");
    const secondColumn = elements.board.querySelector('[data-row="0"][data-col="1"]');
    const secondRow = elements.board.querySelector('[data-row="1"][data-col="0"]');
    if (!first) return { x: 0, y: 0 };
    // Layout offsets ignore shrinking/selection transforms on other tiles.
    const stepX = secondColumn ? secondColumn.offsetLeft - first.offsetLeft : first.offsetWidth;
    const stepY = secondRow ? secondRow.offsetTop - first.offsetTop : first.offsetHeight;
    return {
      x: first.offsetLeft + first.offsetWidth / 2 + position.col * stepX,
      y: first.offsetTop + first.offsetHeight / 2 + position.row * stepY,
    };
  }

  function clearPath() {
    window.clearTimeout(state.pathTimer);
    state.pathTimer = null;
    elements.pathLayer.classList.remove("visible");
    elements.pathLayer.innerHTML = "";
  }

  function showPath(path) {
    clearPath();
    const width = elements.board.clientWidth;
    const height = elements.board.clientHeight;
    elements.pathLayer.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const points = path.map(positionToPoint).map(({ x, y }) => `${x},${y}`).join(" ");
    elements.pathLayer.innerHTML = `<polyline points="${points}" />`;
    elements.pathLayer.classList.add("visible");
    state.pathTimer = window.setTimeout(clearPath, 280);
  }

  function flashInvalid(first, second) {
    [tileAt(first), tileAt(second)].forEach((tile) => {
      tile?.classList.add("invalid");
      window.setTimeout(() => tile?.classList.remove("invalid"), 330);
    });
  }

  function showCombo() {
    if (state.combo < 2) return;
    const comboBonus = (state.combo - 1) * 5;
    elements.comboBadge.textContent = `${state.combo} 连击  加成 +${comboBonus}`;
    elements.comboBadge.classList.remove("penalty");
    elements.comboBadge.classList.remove("show");
    void elements.comboBadge.offsetWidth;
    elements.comboBadge.classList.add("show");
  }

  function showPenalty() {
    elements.comboBadge.textContent = `配对失败  -${INVALID_MATCH_PENALTY}`;
    elements.comboBadge.classList.add("penalty");
    elements.comboBadge.classList.remove("show");
    void elements.comboBadge.offsetWidth;
    elements.comboBadge.classList.add("show");
  }

  function animateShuffle() {
    window.clearTimeout(state.shuffleTimer);
    elements.boardWrap.classList.add("auto-shuffled");
    state.shuffleTimer = window.setTimeout(() => {
      elements.boardWrap.classList.remove("auto-shuffled");
      state.shuffleTimer = null;
    }, 550);
  }

  function ensureMoveAvailable() {
    if (countRemaining(state.board) === 0 || findAvailablePair(state.board)) return;
    state.selected = null;
    let attempts = 0;
    do {
      state.board = shuffleRemaining(state.board);
      attempts += 1;
    } while (!findAvailablePair(state.board) && attempts < 100);
    renderBoard();
    animateShuffle();
  }

  function chooseTile(position) {
    if (state.locked || state.remainingTime <= 0 || state.board[position.row][position.col] == null) return;
    playTone(340, 0.05);

    if (!state.selected) {
      state.selected = position;
      tileAt(position)?.classList.add("selected");
      tileAt(position)?.setAttribute("aria-selected", "true");
      return;
    }
    if (state.selected.row === position.row && state.selected.col === position.col) {
      tileAt(position)?.classList.remove("selected");
      tileAt(position)?.setAttribute("aria-selected", "false");
      state.selected = null;
      return;
    }

    const first = state.selected;
    const path = findPath(state.board, first, position);
    tileAt(first)?.classList.remove("selected");
    tileAt(first)?.setAttribute("aria-selected", "false");
    state.selected = null;

    if (!path) {
      flashInvalid(first, position);
      state.combo = 0;
      state.score -= INVALID_MATCH_PENALTY;
      updateStatus();
      showPenalty();
      playTone(150, 0.12);
      return;
    }

    const now = Date.now();
    state.combo = now - state.lastMatchAt < 3000 ? state.combo + 1 : 1;
    state.lastMatchAt = now;
    state.score += 20 + Math.max(0, state.combo - 1) * 5;
    state.board[first.row][first.col] = null;
    state.board[position.row][position.col] = null;
    const matchedTiles = [tileAt(first), tileAt(position)];
    matchedTiles.forEach((tile) => {
      tile.disabled = true;
      tile.classList.remove("hinted", "invalid");
      tile.classList.add("matched");
      tile.setAttribute("aria-label", "已消除");
    });
    showPath(path);
    showCombo();
    playTone(620, 0.08);
    playTone(820, 0.1, 0.06);
    updateStatus();

    window.setTimeout(() => {
      // Only retire these tiles: later clicks and newly rendered boards stay intact.
      matchedTiles.forEach((tile) => {
        tile.classList.remove("matched");
        tile.classList.add("removed");
        tile.innerHTML = "";
      });
    }, 290);
    if (countRemaining(state.board) === 0) finishGame(true);
    else ensureMoveAvailable();
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
    elements.board.querySelectorAll(".selected").forEach((tile) => {
      tile.classList.remove("selected");
      tile.setAttribute("aria-selected", "false");
    });
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
    animateShuffle();
    playTone(440, 0.06);
    playTone(660, 0.08, 0.07);
  }

  function finishGame(won) {
    if (state.locked) return;
    window.clearInterval(state.timer);
    state.timer = null;
    state.locked = true;
    if (won) {
      const config = LEVELS[state.level];
      const elapsed = config.time - state.remainingTime;
      const timeBonus = state.remainingTime * 2;
      state.score += timeBonus;
      const ranking = recordWin();
      const rankingText = ranking
        ? (ranking.rank ? `本局进入本机前 10，第 ${ranking.rank} 名` : "本局成绩暂未进入本机前 10")
        : "浏览器未允许保存本机成绩";
      elements.resultFruit.textContent = "🏆";
      elements.resultEyebrow.textContent = "丰收时刻";
      elements.resultTitle.textContent = "果园大丰收！";
      elements.resultMessage.textContent = `用时 ${formatTime(elapsed)}，${rankingText}。另获 ${timeBonus} 分时间奖励。`;
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
    elements.resultDifficulty.textContent = LEVELS[state.level].label;
    elements.finalScore.textContent = state.score.toLocaleString("zh-CN");
    updateStatus();
    state.resultTimer = window.setTimeout(() => {
      elements.modal.classList.remove("hidden");
      state.resultTimer = null;
    }, 290);
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
    window.clearTimeout(state.resultTimer);
    window.clearTimeout(state.shuffleTimer);
    state.resultTimer = null;
    state.shuffleTimer = null;
    elements.boardWrap.classList.remove("auto-shuffled");
    elements.comboBadge.classList.remove("show", "penalty");
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
  elements.leaderboardButton.addEventListener("click", openLeaderboard);
  elements.closeLeaderboardButton.addEventListener("click", closeLeaderboard);
  elements.rankingDoneButton.addEventListener("click", closeLeaderboard);
  elements.leaderboardModal.addEventListener("click", (event) => {
    if (event.target === elements.leaderboardModal) closeLeaderboard();
  });
  document.querySelectorAll(".ranking-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.rankingLevel = button.dataset.rankingLevel;
      renderLeaderboard();
    });
  });
  elements.playerName.addEventListener("input", rememberPlayerName);
  elements.playerName.addEventListener("blur", currentPlayerName);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.leaderboardModal.classList.contains("hidden")) {
      closeLeaderboard();
    }
  });
  elements.soundButton.addEventListener("click", () => {
    state.sound = !state.sound;
    elements.soundButton.classList.toggle("muted", !state.sound);
    elements.soundButton.textContent = state.sound ? "♪" : "×";
    elements.soundButton.setAttribute("aria-label", state.sound ? "关闭音效" : "开启音效");
    if (state.sound) playTone(600, 0.08);
  });
  window.addEventListener("resize", clearPath);

  try {
    elements.playerName.value = localStorage.getItem(STORAGE_KEYS.playerName) || "玩家1";
  } catch {
    elements.playerName.value = "玩家1";
  }
  newGame();
})();
