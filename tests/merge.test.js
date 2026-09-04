const test = require("node:test");
const assert = require("node:assert/strict");
const { LEVELS, slideLine, moveBoard, addRandomTile, canMove, planTileMove } = require("../games/merge/merge.js");

test("fruit tiles slide and merge once per move", () => {
  assert.deepEqual(slideLine([1, 1, 1, 1]), { line: [2, 2, 0, 0], scoreGain: 8 });
  assert.deepEqual(slideLine([2, 2, 2, 0]), { line: [3, 2, 0, 0], scoreGain: 8 });
});

test("board movement works in horizontal and vertical directions", () => {
  const board = [
    1, 0, 1, 0,
    0, 2, 0, 0,
    0, 2, 0, 0,
    0, 0, 0, 0,
  ];
  const left = moveBoard(board, "left");
  assert.deepEqual(left.board.slice(0, 4), [2, 0, 0, 0]);
  const down = moveBoard(board, "down");
  assert.equal(down.board[13], 3);
});

test("random fruit is added only to an empty cell", () => {
  const board = Array(16).fill(0);
  board[0] = 5;
  const next = addRandomTile(board, () => 0);
  assert.equal(next[0], 5);
  assert.equal(next[1], 1);
});

test("full board without adjacent matches is game over", () => {
  const board = [
    1, 2, 1, 2,
    2, 1, 2, 1,
    1, 2, 1, 2,
    2, 1, 2, 1,
  ];
  assert.equal(canMove(board), false);
  board[15] = 0;
  assert.equal(canMove(board), true);
});

test("animation plan preserves moving tiles and replaces only merged pairs", () => {
  let mergedId = 0;
  const tiles = [
    { id: "a", level: 1, position: 0 },
    { id: "b", level: 1, position: 2 },
    { id: "c", level: 2, position: 7 },
  ];
  const plan = planTileMove(tiles, "left", 4, () => "m" + (++mergedId));
  assert.equal(plan.moved, true);
  assert.equal(plan.scoreGain, 4);
  assert.deepEqual(plan.tiles, [
    { id: "m1", level: 2, position: 0, merged: true },
    { id: "c", level: 2, position: 4 },
  ]);
  assert.deepEqual(plan.transitions.filter((transition) => transition.removed).map((transition) => transition.id), ["a", "b"]);
  assert.equal(plan.transitions.find((transition) => transition.id === "c").toPosition, 4);
});

test("merge difficulty adds space for relaxed play and pressure for challenge play", () => {
  assert.equal(LEVELS.easy.size, 5);
  assert.equal(LEVELS.normal.size, 4);
  assert.equal(LEVELS.hard.startTiles, 4);
  assert.ok(LEVELS.easy.fourChance < LEVELS.normal.fourChance);
  assert.ok(LEVELS.normal.fourChance < LEVELS.hard.fourChance);
  assert.ok(LEVELS.hard.extraChance > 0);
});

test("random tile generation obeys the configured four-fruit chance", () => {
  const randomValues = [0, 0.99];
  const next = addRandomTile(Array(16).fill(0), () => randomValues.shift(), 0.2);
  assert.equal(next[0], 2);
});
