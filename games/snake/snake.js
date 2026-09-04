(function initSnake(root, factory) {
  const api = factory(root, root.document);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OrchardSnake = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSnake(root, document) {
  const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const LEVELS = {
    easy: { label: "悠闲", step: 245, minimumStep: 210, acceleration: 0 },
    normal: { label: "进阶", step: 180, minimumStep: 140, acceleration: 2 },
    hard: { label: "挑战", step: 82, minimumStep: 56, acceleration: 4 },
  };

  function sameCell(first, second) {
    return first.x === second.x && first.y === second.y;
  }

  function isOpposite(first, second) {
    return first.x + second.x === 0 && first.y + second.y === 0;
  }

  function sameDirection(first, second) {
    return first.x === second.x && first.y === second.y;
  }

  function queueDirection(queue, current, next, limit = 2) {
    if (!next || queue.length >= limit) return queue.slice();
    const previous = queue[queue.length - 1] || current;
    if (sameDirection(previous, next) || isOpposite(previous, next)) return queue.slice();
    return [...queue, next];
  }

  function snakeStep(level, length) {
    const config = LEVELS[level] || LEVELS.normal;
    const speedUp = Math.floor(Math.max(0, length - 4) / 5) * config.acceleration;
    return Math.max(config.minimumStep, config.step - speedUp);
  }

  function advanceSnake(snake, direction, food, columns, rows) {
    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
    const ate = sameCell(head, food);
    const collisionBody = ate ? snake : snake.slice(0, -1);
    const crashed = head.x < 0 || head.y < 0 || head.x >= columns || head.y >= rows
      || collisionBody.some((cell) => sameCell(cell, head));
    if (crashed) return { snake: snake.slice(), ate: false, crashed: true };
    const next = [head, ...snake];
    if (!ate) next.pop();
    return { snake: next, ate, crashed: false };
  }

  const api = { DIRECTIONS, LEVELS, sameCell, isOpposite, queueDirection, snakeStep, advanceSnake };
  if (!document) return api;
  const FRUITS = ["apple", "strawberry", "orange", "pear", "grapes", "cherries"];
  const COLUMNS = 18;
  const ROWS = 18;
  const canvas = document.getElementById("snakeCanvas");
  const context = canvas.getContext("2d");
  const scoreElement = document.getElementById("score");
  const lengthElement = document.getElementById("snakeLength");
  const speedElement = document.getElementById("speedLabel");
  const bestElement = document.getElementById("bestScore");
  const pauseButton = document.getElementById("pauseButton");
  const resultOverlay = document.getElementById("resultOverlay");
  const resultTitle = document.getElementById("resultTitle");
  const resultMessage = document.getElementById("resultMessage");
  const resultImage = document.getElementById("resultImage");
  const overlayButton = document.getElementById("overlayButton");
  const difficultyButtons = Array.from(document.querySelectorAll(".difficulty-button"));
  const fruitImages = new Map();

  FRUITS.forEach((name) => {
    const image = new Image();
    image.src = "../../assets/fruits/" + name + ".png";
    fruitImages.set(name, image);
  });

  let level = "easy";
  let snake = [];
  let previousSnake = [];
  let direction = DIRECTIONS.right;
  let directionQueue = [];
  let food = { x: 12, y: 9, type: "apple" };
  let score = 0;
  let active = false;
  let paused = false;
  let accumulator = 0;
  let lastTime = 0;
  let frameId = null;
  let particles = [];
  let eatPulse = 0;
  let touchStart = null;
  let countdown = 0;

  const backgroundCanvas = document.createElement("canvas");
  backgroundCanvas.width = canvas.width;
  backgroundCanvas.height = canvas.height;
  const backgroundContext = backgroundCanvas.getContext("2d");
  backgroundContext.fillStyle = "#dff1df";
  backgroundContext.fillRect(0, 0, backgroundCanvas.width, backgroundCanvas.height);
  backgroundContext.strokeStyle = "rgba(51, 105, 66, 0.09)";
  backgroundContext.lineWidth = 1;
  const backgroundCell = backgroundCanvas.width / COLUMNS;
  for (let index = 1; index < COLUMNS; index += 1) {
    backgroundContext.beginPath(); backgroundContext.moveTo(index * backgroundCell, 0); backgroundContext.lineTo(index * backgroundCell, backgroundCanvas.height); backgroundContext.stroke();
    backgroundContext.beginPath(); backgroundContext.moveTo(0, index * backgroundCell); backgroundContext.lineTo(backgroundCanvas.width, index * backgroundCell); backgroundContext.stroke();
  }

  function makeSegmentSprite(startColor, endColor, inset) {
    const sprite = document.createElement("canvas");
    sprite.width = backgroundCell;
    sprite.height = backgroundCell;
    const spriteContext = sprite.getContext("2d");
    const size = backgroundCell - inset * 2;
    const gradient = spriteContext.createLinearGradient(0, 0, backgroundCell, backgroundCell);
    gradient.addColorStop(0, startColor);
    gradient.addColorStop(1, endColor);
    spriteContext.fillStyle = gradient;
    spriteContext.beginPath();
    spriteContext.roundRect(inset, inset, size, size, backgroundCell * 0.3);
    spriteContext.fill();
    spriteContext.strokeStyle = "rgba(255,255,220,0.3)";
    spriteContext.lineWidth = 2;
    spriteContext.stroke();
    return sprite;
  }

  const segmentSprites = {
    head: makeSegmentSprite("#75bd59", "#2f7547", 2.4),
    light: makeSegmentSprite("#5aa852", "#286543", 4.2),
    dark: makeSegmentSprite("#4c9a59", "#286543", 4.2),
  };

  function readBest() {
    try { return Number(root.localStorage.getItem("orchard-snake-best-" + level)) || 0; } catch { return 0; }
  }

  function saveBest() {
    if (score > readBest()) {
      try { root.localStorage.setItem("orchard-snake-best-" + level, String(score)); } catch {}
    }
  }

  function updateStatus() {
    scoreElement.textContent = String(score);
    lengthElement.textContent = String(snake.length || 4);
    speedElement.textContent = LEVELS[level].label;
    bestElement.textContent = String(Math.max(score, readBest()));
  }

  function randomFood() {
    const open = [];
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLUMNS; x += 1) {
        if (!snake.some((cell) => cell.x === x && cell.y === y)) open.push({ x, y });
      }
    }
    const cell = open[Math.floor(Math.random() * open.length)] || { x: 2, y: 2 };
    return { ...cell, type: FRUITS[Math.floor(Math.random() * FRUITS.length)] };
  }

  function addEatParticles(cell) {
    const size = canvas.width / COLUMNS;
    const x = (cell.x + 0.5) * size;
    const y = (cell.y + 0.5) * size;
    for (let index = 0; index < 12; index += 1) {
      const angle = Math.PI * 2 * index / 12 + Math.random() * 0.22;
      const speed = 80 + Math.random() * 150;
      particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color: index % 2 ? "#f4b83f" : "#fff4a8" });
    }
  }

  function setDirection(name) {
    const next = DIRECTIONS[name];
    directionQueue = queueDirection(directionQueue, direction, next);
  }

  function stepGame() {
    if (directionQueue.length) direction = directionQueue.shift();
    previousSnake = snake.map((cell) => ({ ...cell }));
    const result = advanceSnake(snake, direction, food, COLUMNS, ROWS);
    if (result.crashed) {
      finishGame();
      return;
    }
    snake = result.snake;
    if (result.ate) {
      score += 10 + Math.max(0, snake.length - 5) * 2;
      addEatParticles(food);
      eatPulse = 1;
      food = randomFood();
      saveBest();
      updateStatus();
    }
  }

  function render(timestamp, interpolation) {
    const cell = canvas.width / COLUMNS;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(backgroundCanvas, 0, 0);

    const foodImage = fruitImages.get(food.type);
    const foodScale = 0.86 + Math.sin(timestamp / 150) * 0.055 + eatPulse * 0.08;
    const foodSize = cell * foodScale;
    context.save();
    context.shadowColor = "rgba(40, 89, 54, 0.22)";
    context.shadowBlur = 10;
    context.shadowOffsetY = 5;
    if (foodImage?.complete) context.drawImage(foodImage, (food.x + 0.5) * cell - foodSize / 2, (food.y + 0.5) * cell - foodSize / 2, foodSize, foodSize);
    context.restore();

    for (let index = snake.length - 1; index >= 0; index -= 1) {
      const current = snake[index];
      const previous = previousSnake[Math.min(index, previousSnake.length - 1)] || current;
      const x = (previous.x + (current.x - previous.x) * interpolation) * cell;
      const y = (previous.y + (current.y - previous.y) * interpolation) * cell;
      const sprite = index === 0 ? segmentSprites.head : index % 2 ? segmentSprites.dark : segmentSprites.light;
      context.drawImage(sprite, x, y, cell, cell);

      if (index === 0) {
        const centerX = x + cell / 2;
        const centerY = y + cell / 2;
        const sideX = direction.y !== 0 ? cell * 0.17 : 0;
        const sideY = direction.x !== 0 ? cell * 0.17 : 0;
        const frontX = direction.x * cell * 0.17;
        const frontY = direction.y * cell * 0.17;
        context.fillStyle = "#fffde6";
        [1, -1].forEach((side) => {
          context.beginPath();
          context.arc(centerX + frontX + sideX * side, centerY + frontY + sideY * side, cell * 0.075, 0, Math.PI * 2);
          context.fill();
        });
        context.fillStyle = "#173629";
        [1, -1].forEach((side) => {
          context.beginPath();
          context.arc(centerX + frontX * 1.22 + sideX * side, centerY + frontY * 1.22 + sideY * side, cell * 0.034, 0, Math.PI * 2);
          context.fill();
        });
      }
    }

    particles.forEach((particle) => {
      context.globalAlpha = Math.max(0, particle.life);
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, 4 + particle.life * 4, 0, Math.PI * 2);
      context.fill();
    });
    context.globalAlpha = 1;

    if (countdown > 0) {
      const count = Math.max(1, Math.ceil(countdown / 400));
      context.save();
      context.fillStyle = "rgba(23, 73, 54, 0.82)";
      context.beginPath();
      context.arc(canvas.width / 2, canvas.height / 2, 58, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#fff9dc";
      context.font = "900 54px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(count), canvas.width / 2, canvas.height / 2 + 2);
      context.restore();
    }
  }

  function loop(timestamp) {
    if (!active || paused) return;
    if (!lastTime) lastTime = timestamp;
    const delta = Math.min(50, timestamp - lastTime);
    lastTime = timestamp;
    accumulator += delta;
    eatPulse = Math.max(0, eatPulse - delta / 250);
    particles.forEach((particle) => {
      particle.x += particle.vx * delta / 1000;
      particle.y += particle.vy * delta / 1000;
      particle.vy += 280 * delta / 1000;
      particle.life -= delta / 520;
    });
    particles = particles.filter((particle) => particle.life > 0);

    if (countdown > 0) {
      countdown = Math.max(0, countdown - delta);
      accumulator = 0;
      render(timestamp, 0);
      frameId = root.requestAnimationFrame(loop);
      return;
    }

    const step = snakeStep(level, snake.length);
    while (accumulator >= step && active) {
      accumulator -= step;
      stepGame();
    }
    render(timestamp, Math.min(1, accumulator / step));
    if (active) frameId = root.requestAnimationFrame(loop);
  }

  function startGame() {
    root.cancelAnimationFrame(frameId);
    snake = [{ x: 7, y: 9 }, { x: 6, y: 9 }, { x: 5, y: 9 }, { x: 4, y: 9 }];
    previousSnake = snake.map((cell) => ({ ...cell }));
    direction = DIRECTIONS.right;
    directionQueue = [];
    food = randomFood();
    score = 0;
    particles = [];
    accumulator = 0;
    lastTime = 0;
    countdown = 1200;
    active = true;
    paused = false;
    resultOverlay.classList.add("is-hidden");
    pauseButton.disabled = false;
    pauseButton.textContent = "暂停";
    updateStatus();
    frameId = root.requestAnimationFrame(loop);
  }

  function finishGame() {
    active = false;
    saveBest();
    pauseButton.disabled = true;
    resultTitle.textContent = score >= 180 ? "果园长蛇！" : "撞到啦";
    resultMessage.textContent = "本局得到 " + score + " 分，最终长度 " + snake.length + "。";
    resultImage.src = score >= 180 ? "../../assets/fruits/pineapple.png" : "../../assets/fruits/apple.png";
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

  difficultyButtons.forEach((button) => {
    button.addEventListener("click", () => {
      level = button.dataset.level;
      difficultyButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      if (active) startGame();
      else updateStatus();
    });
  });
  document.querySelectorAll("[data-direction]").forEach((button) => button.addEventListener("click", () => setDirection(button.dataset.direction)));
  document.addEventListener("keydown", (event) => {
    const keyMap = { ArrowUp: "up", w: "up", W: "up", ArrowDown: "down", s: "down", S: "down", ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right" };
    if (keyMap[event.key]) { event.preventDefault(); setDirection(keyMap[event.key]); }
    else if (event.key === " " && active) { event.preventDefault(); togglePause(); }
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
    if (Math.max(Math.abs(dx), Math.abs(dy)) > 18) setDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
    touchStart = null;
  });
  canvas.addEventListener("pointercancel", () => { touchStart = null; });
  document.getElementById("newGameButton").addEventListener("click", startGame);
  overlayButton.addEventListener("click", startGame);
  pauseButton.addEventListener("click", togglePause);
  document.addEventListener("visibilitychange", () => { if (document.hidden && active && !paused) togglePause(); });

  updateStatus();
  render(0, 1);
  return api;
});
