(function initArcade(root, factory) {
  const api = factory(root, root.document);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OrchardArcade = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createArcade(root, document) {
  function wrapIndex(index, length) {
    if (length <= 0) return 0;
    return ((index % length) + length) % length;
  }

  function directionForKey(key) {
    if (key === "ArrowUp" || key === "w" || key === "W") return -1;
    if (key === "ArrowDown" || key === "s" || key === "S") return 1;
    return 0;
  }

  const api = { wrapIndex, directionForKey };
  if (!document) return api;

  const menu = document.querySelector(".game-menu");
  const games = Array.from(document.querySelectorAll(".arcade-game"));
  const joystick = document.getElementById("joystick");
  const startButton = document.getElementById("startButton");
  const screenMessage = document.getElementById("screenMessage");
  const previewStatus = document.getElementById("previewStatus");
  const previewFruit = document.getElementById("previewFruit");
  const previewTitle = document.getElementById("previewTitle");
  const previewDescription = document.getElementById("previewDescription");
  const previewMeta = document.getElementById("previewMeta");

  if (!menu || games.length === 0) return api;

  let selectedIndex = Math.max(0, games.findIndex((game) => game.classList.contains("is-selected")));
  let warningTimer = null;

  function clearMessage() {
    clearTimeout(warningTimer);
    screenMessage.classList.remove("is-warning");
    screenMessage.textContent = "上下拨动摇杆选择游戏";
  }

  function selectGame(index, focusOption = false) {
    selectedIndex = wrapIndex(index, games.length);
    const selected = games[selectedIndex];
    const selectedImage = selected.querySelector("img");

    games.forEach((game, gameIndex) => {
      const isSelected = gameIndex === selectedIndex;
      game.classList.toggle("is-selected", isSelected);
      game.setAttribute("aria-selected", String(isSelected));
      game.tabIndex = isSelected ? 0 : -1;
    });

    menu.setAttribute("aria-activedescendant", selected.id);
    previewStatus.textContent = selected.dataset.status;
    previewStatus.classList.toggle("is-unavailable", !selected.dataset.href);
    previewFruit.src = selectedImage.src;
    previewTitle.textContent = selected.dataset.title;
    previewDescription.textContent = selected.dataset.description;
    previewMeta.textContent = selected.dataset.meta;
    clearMessage();

    if (focusOption) selected.focus();
  }

  function launchSelected() {
    const selected = games[selectedIndex];
    if (selected.dataset.href) {
      root.location.assign(selected.dataset.href);
      return;
    }

    clearTimeout(warningTimer);
    screenMessage.textContent = selected.dataset.title + "正在筹备中，先试试水果连连看吧";
    screenMessage.classList.add("is-warning");
    warningTimer = setTimeout(clearMessage, 2600);
  }

  games.forEach((game, gameIndex) => {
    game.addEventListener("click", () => {
      selectGame(gameIndex);
    });
  });

  document.querySelectorAll("[data-step]").forEach((button) => {
    button.addEventListener("click", () => selectGame(selectedIndex + Number(button.dataset.step)));
  });

  startButton.addEventListener("click", launchSelected);

  document.addEventListener("keydown", (event) => {
    const direction = directionForKey(event.key);
    if (direction !== 0) {
      event.preventDefault();
      selectGame(selectedIndex + direction, document.activeElement?.classList.contains("arcade-game"));
      return;
    }

    if ((event.key === "Enter" || event.key === " ") && !document.activeElement?.matches("button")) {
      event.preventDefault();
      launchSelected();
    }
  });

  let activePointer = null;
  let startY = 0;
  let currentDelta = 0;
  let ignoreClick = false;

  function resetJoystick() {
    joystick.style.setProperty("--joystick-shift", "0px");
    activePointer = null;
  }

  joystick.addEventListener("pointerdown", (event) => {
    activePointer = event.pointerId;
    startY = event.clientY;
    currentDelta = 0;
    joystick.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  joystick.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointer) return;
    currentDelta = Math.max(-35, Math.min(35, event.clientY - startY));
    joystick.style.setProperty("--joystick-shift", currentDelta * 0.32 + "px");
  });

  joystick.addEventListener("pointerup", (event) => {
    if (event.pointerId !== activePointer) return;
    ignoreClick = true;
    if (Math.abs(currentDelta) >= 16) selectGame(selectedIndex + (currentDelta > 0 ? 1 : -1));
    else selectGame(selectedIndex + 1);
    resetJoystick();
    setTimeout(() => { ignoreClick = false; }, 0);
  });

  joystick.addEventListener("pointercancel", resetJoystick);
  joystick.addEventListener("click", (event) => {
    if (ignoreClick) event.preventDefault();
  });

  selectGame(selectedIndex);
  return api;
});
