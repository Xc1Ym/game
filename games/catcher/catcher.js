(function initCatcher(root, factory) {
  const api = factory(root, root.document);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OrchardCatcher = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createCatcher(root, document) {
  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function overlaps(first, second) {
    return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
  }

  const api = { clamp, overlaps };
  if (!document) return api;

  const LEVELS = {
    easy: { spawnEvery: 880, speedMin: 125, speedMax: 185, badChance: 0.12 },
    normal: { spawnEvery: 690, speedMin: 165, speedMax: 245, badChance: 0.17 },
    hard: { spawnEvery: 520, speedMin: 220, speedMax: 330, badChance: 0.22 },
  };
  const DURATION = 60;
  const FRUITS = ["apple", "banana", "blueberries", "cherries", "grapes", "kiwi", "lemon", "mango", "orange", "peach", "pear", "pineapple", "strawberry", "watermelon"];

  const field = document.getElementById("catchField");
  const catcher = document.getElementById("catcher");
  const scoreElement = document.getElementById("score");
  const timeElement = document.getElementById("timeLeft");
  const comboElement = document.getElementById("combo");
  const bestElement = document.getElementById("bestScore");
  const resultOverlay = document.getElementById("resultOverlay");
  const resultTitle = document.getElementById("resultTitle");
  const resultMessage = document.getElementById("resultMessage");
  const resultImage = document.getElementById("resultImage");
  const overlayButton = document.getElementById("overlayButton");
  const pauseButton = document.getElementById("pauseButton");
  const difficultyButtons = Array.from(document.querySelectorAll(".difficulty-button"));

  let level = "easy";
  let config = LEVELS[level];
  let items = [];
  let basketPercent = 50;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let elapsed = 0;
  let spawnElapsed = 0;
  let lastTime = 0;
  let frameId = null;
  let active = false;
  let paused = false;
  let dragging = false;

  function formatTime(seconds) {
    const safeSeconds = Math.max(0, seconds);
    return String(Math.floor(safeSeconds / 60)).padStart(2, "0") + ":" + String(safeSeconds % 60).padStart(2, "0");
  }

  function storageKey() {
    return "orchard-catcher-best-" + level;
  }

  function readBest() {
    try { return Number(root.localStorage.getItem(storageKey())) || 0; } catch { return 0; }
  }

  function saveBest() {
    if (score > readBest()) {
      try { root.localStorage.setItem(storageKey(), String(score)); } catch {}
    }
  }

  function updateStatus() {
    scoreElement.textContent = String(score);
    comboElement.textContent = String(combo);
    timeElement.textContent = formatTime(Math.ceil(DURATION - elapsed / 1000));
    bestElement.textContent = String(readBest());
  }

  function setBasket(percent) {
    basketPercent = clamp(percent, 7, 93);
    catcher.style.left = basketPercent + "%";
  }

  function moveBasket(step) {
    setBasket(basketPercent + step * 9);
  }

  function clearItems() {
    items.forEach((item) => item.element.remove());
    items = [];
    field.querySelectorAll(".catch-pop").forEach((element) => element.remove());
  }

  function spawnItem() {
    const bad = Math.random() < config.badChance;
    const element = document.createElement("div");
    element.className = "falling-item" + (bad ? " is-bad" : "");
    const image = document.createElement("img");
    image.src = bad
      ? "../../assets/fruits/pomegranate.png"
      : "../../assets/fruits/" + FRUITS[Math.floor(Math.random() * FRUITS.length)] + ".png";
    image.alt = "";
    element.appendChild(image);
    field.appendChild(element);

    const size = element.offsetWidth || 60;
    const width = field.clientWidth;
    const item = {
      element,
      bad,
      size,
      x: Math.random() * Math.max(1, width - size),
      y: -size,
      speed: config.speedMin + Math.random() * (config.speedMax - config.speedMin),
      rotation: -12 + Math.random() * 24,
    };
    items.push(item);
  }

  function showPop(text, x, y, penalty) {
    const pop = document.createElement("span");
    pop.className = "catch-pop" + (penalty ? " is-penalty" : "");
    pop.textContent = text;
    pop.style.left = x + "px";
    pop.style.top = y + "px";
    field.appendChild(pop);
    root.setTimeout(() => pop.remove(), 650);
  }

  function catchItem(item) {
    if (item.bad) {
      score = Math.max(0, score - 20);
      combo = 0;
      showPop("-20", item.x + item.size / 2, item.y, true);
    } else {
      combo += 1;
      maxCombo = Math.max(maxCombo, combo);
      const points = 10 + Math.min(20, Math.max(0, combo - 1) * 2);
      score += points;
      showPop("+" + points, item.x + item.size / 2, item.y, false);
    }
    item.element.remove();
    updateStatus();
  }

  function updateItems(deltaSeconds) {
    const fieldHeight = field.clientHeight;
    const fieldWidth = field.clientWidth;
    const basketWidth = catcher.offsetWidth;
    const basketHeight = catcher.offsetHeight;
    const basketLeft = fieldWidth * basketPercent / 100 - basketWidth / 2;
    const basketTop = catcher.offsetTop;
    const basketRect = {
      left: basketLeft,
      right: basketLeft + basketWidth,
      top: basketTop,
      bottom: basketTop + basketHeight,
    };

    const remaining = [];
    items.forEach((item) => {
      item.x = clamp(item.x, 0, Math.max(0, fieldWidth - item.size));
      item.y += item.speed * deltaSeconds;
      item.element.style.transform = "translate(" + item.x + "px, " + item.y + "px) rotate(" + item.rotation + "deg)";
      const itemRect = { left: item.x, right: item.x + item.size, top: item.y, bottom: item.y + item.size };
      if (overlaps(itemRect, basketRect)) {
        catchItem(item);
      } else if (item.y > fieldHeight + item.size) {
        item.element.remove();
        if (!item.bad) combo = 0;
      } else {
        remaining.push(item);
      }
    });
    items = remaining;
  }

  function finishGame() {
    active = false;
    paused = false;
    root.cancelAnimationFrame(frameId);
    pauseButton.disabled = true;
    pauseButton.textContent = "暂停";
    saveBest();
    updateStatus();
    resultTitle.textContent = score >= 500 ? "接果高手！" : "本局完成";
    resultMessage.textContent = "本局得到 " + score + " 分，最高连续接住 " + maxCombo + " 个。";
    resultImage.src = score >= 500 ? "../../assets/fruits/pineapple.png" : "../../assets/fruits/pear.png";
    overlayButton.textContent = "再玩一局";
    resultOverlay.classList.remove("is-hidden");
  }

  function gameLoop(timestamp) {
    if (!active || paused) return;
    if (!lastTime) lastTime = timestamp;
    const deltaMs = Math.min(60, timestamp - lastTime);
    lastTime = timestamp;
    elapsed += deltaMs;
    spawnElapsed += deltaMs;

    while (spawnElapsed >= config.spawnEvery) {
      spawnElapsed -= config.spawnEvery;
      spawnItem();
    }
    updateItems(deltaMs / 1000);
    updateStatus();

    if (elapsed >= DURATION * 1000) finishGame();
    else frameId = root.requestAnimationFrame(gameLoop);
  }

  function startGame() {
    root.cancelAnimationFrame(frameId);
    clearItems();
    config = LEVELS[level];
    score = 0;
    combo = 0;
    maxCombo = 0;
    elapsed = 0;
    spawnElapsed = config.spawnEvery * 0.45;
    lastTime = 0;
    active = true;
    paused = false;
    setBasket(50);
    pauseButton.disabled = false;
    pauseButton.textContent = "暂停";
    resultOverlay.classList.add("is-hidden");
    updateStatus();
    frameId = root.requestAnimationFrame(gameLoop);
  }

  function togglePause() {
    if (!active) return;
    paused = !paused;
    pauseButton.textContent = paused ? "继续" : "暂停";
    if (!paused) {
      lastTime = 0;
      frameId = root.requestAnimationFrame(gameLoop);
    } else {
      root.cancelAnimationFrame(frameId);
    }
  }

  function moveFromPointer(event) {
    const bounds = field.getBoundingClientRect();
    setBasket((event.clientX - bounds.left) / bounds.width * 100);
  }

  field.addEventListener("pointerdown", (event) => {
    dragging = true;
    field.setPointerCapture(event.pointerId);
    moveFromPointer(event);
    event.preventDefault();
  });
  field.addEventListener("pointermove", (event) => {
    if (dragging) moveFromPointer(event);
  });
  field.addEventListener("pointerup", () => { dragging = false; });
  field.addEventListener("pointercancel", () => { dragging = false; });

  document.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("click", () => moveBasket(Number(button.dataset.move)));
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
      event.preventDefault();
      moveBasket(-1);
    } else if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
      event.preventDefault();
      moveBasket(1);
    } else if (event.key === " " && active) {
      event.preventDefault();
      togglePause();
    }
  });

  difficultyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      level = button.dataset.level;
      difficultyButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      if (active) startGame();
      else updateStatus();
    });
  });
  document.getElementById("newGameButton").addEventListener("click", startGame);
  overlayButton.addEventListener("click", startGame);
  pauseButton.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && active && !paused) togglePause();
  });

  updateStatus();
  return api;
});
