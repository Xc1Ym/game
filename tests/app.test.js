const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp } = require("./helpers/app-harness.js");

const board = [["apple", "apple", "orange", "orange", "lemon", "lemon"]];
const match = (app, col = 0) => { app.tile(0, col).click(); app.tile(0, col + 1).click(); };

test("rapid matches score immediately while previous tiles are still animating", () => {
  const app = createApp(board);
  match(app);
  assert.equal(app.tile(0, 0).disabled, true);
  assert.equal(app.tile(0, 2).disabled, false);
  assert.equal(app.tile(0, 0).classList.contains("matched"), true);
  match(app, 2);
  assert.equal(app.nodes.score.textContent, "45");
  assert.equal(app.nodes.remaining.textContent, 2);
  app.tile(0, 0).click();
  assert.equal(app.nodes.score.textContent, "45");
});

test("animation cleanup preserves the next selection and untouched DOM nodes", () => {
  const app = createApp(board);
  const nextTile = app.tile(0, 2);
  match(app);
  app.advance(100);
  nextTile.click();
  app.advance(200);
  assert.equal(app.tile(0, 2), nextTile);
  assert.equal(nextTile.getAttribute("aria-selected"), "true");
  assert.equal(app.tile(0, 0).classList.contains("removed"), true);
  app.tile(0, 3).click();
  assert.equal(app.nodes.score.textContent, "45");
});

test("older path timer does not clear a newer rapid match path", () => {
  const app = createApp(board);
  match(app);
  app.advance(150);
  match(app, 2);
  app.advance(150);
  assert.equal(app.nodes.pathLayer.classList.contains("visible"), true);
  app.advance(130);
  assert.equal(app.nodes.pathLayer.classList.contains("visible"), false);
});

test("new path positions ignore transforms on tiles still animating", () => {
  const app = createApp(board);
  match(app);
  app.tile(0, 0).getBoundingClientRect = () => ({ left: 15, top: 15, width: 10, height: 10 });
  match(app, 2);
  assert.equal(app.nodes.pathLayer.innerHTML, '<polyline points="120,20 170,20" />');
});

test("manual shuffle during an animation preserves the new board and selection", () => {
  const app = createApp(board, { shuffleRemaining: (current) => current.map((row) => [...row]) });
  match(app);
  app.nodes.shuffleButton.click();
  const nextTile = app.tile(0, 2);
  nextTile.click();
  app.advance(300);
  assert.equal(app.nodes.shuffleCount.textContent, 1);
  assert.equal(app.tile(0, 2), nextTile);
  assert.equal(nextTile.getAttribute("aria-selected"), "true");
  app.tile(0, 3).click();
  assert.equal(app.nodes.score.textContent, "45");
});

test("automatic shuffle runs immediately when a match leaves no moves", () => {
  const app = createApp([
    ["apple", "apple"], ["orange", "lemon"], ["lemon", "orange"],
  ], { shuffleRemaining: () => [[null, null], ["orange", "orange"], ["lemon", "lemon"]] });
  match(app);
  assert.equal(app.nodes.boardWrap.classList.contains("auto-shuffled"), true);
  assert.equal(app.nodes.shuffleCount.textContent, 2);
  const nextTile = app.tile(1, 0);
  nextTile.click();
  app.advance(300);
  assert.equal(app.tile(1, 0), nextTile);
  assert.equal(nextTile.getAttribute("aria-selected"), "true");
  app.tile(1, 1).click();
  assert.equal(app.nodes.score.textContent, "45");
});

test("new game during an animation is untouched by old callbacks", () => {
  const app = createApp(board);
  match(app);
  app.nodes.newGameButton.click();
  const firstTile = app.tile(0, 0);
  firstTile.click();
  app.advance(600);
  assert.equal(app.tile(0, 0), firstTile);
  assert.equal(firstTile.disabled, false);
  assert.equal(firstTile.getAttribute("aria-selected"), "true");
  assert.equal(app.nodes.score.textContent, "0");
  assert.equal(app.nodes.remaining.textContent, 6);
});

test("final match settles once immediately and cannot lose to the timer", () => {
  const app = createApp([["apple", "apple"]]);
  app.advance(239900);
  match(app);
  assert.equal(app.nodes.finalScore.textContent, "22");
  assert.equal(app.nodes.resultTitle.textContent, "果园大丰收！");
  app.advance(1500);
  assert.equal(app.nodes.resultTitle.textContent, "果园大丰收！");
  assert.equal(app.nodes.timeText.textContent, "00:01");
  assert.equal(app.writes.filter((key) => key === "fruitLinkLeaderboardV1").length, 1);
});

test("restarting after the final match cancels the pending results popup", () => {
  const app = createApp([["apple", "apple"]]);
  match(app);
  app.difficulties[1].click();
  const firstTile = app.tile(0, 0);
  app.advance(600);
  assert.equal(app.nodes.resultModal.classList.contains("hidden"), true);
  assert.equal(app.nodes.scoreDifficulty.textContent, "进阶");
  assert.equal(app.nodes.score.textContent, "0");
  assert.equal(app.tile(0, 0), firstTile);
  firstTile.click();
  assert.equal(firstTile.getAttribute("aria-selected"), "true");
});

test("animation finishing after timeout does not re-enable gameplay", () => {
  const app = createApp(board);
  app.advance(239900);
  match(app);
  app.advance(600);
  assert.equal(app.nodes.resultTitle.textContent, "差一点就丰收了");
  app.tile(0, 2).click();
  assert.equal(app.tile(0, 2).getAttribute("aria-selected"), "false");
  assert.equal(app.nodes.score.textContent, "20");
});

test("invalid matches still deduct points during another pair's animation", () => {
  const app = createApp(board);
  match(app);
  app.tile(0, 2).click();
  app.tile(0, 4).click();
  assert.equal(app.nodes.score.textContent, "15");
  match(app, 2);
  assert.equal(app.nodes.score.textContent, "35");
});
