const test = require("node:test");
const assert = require("node:assert/strict");
const { slideLine, moveBoard, addRandomTile, canMove } = require("../games/merge/merge.js");

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
