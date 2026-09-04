const test = require("node:test");
const assert = require("node:assert/strict");
const { SHAPES, rotateCells, collides, completeRows, clearCompletedRows } = require("../games/blocks/blocks.js");

test("fruit blocks rotate into normalized coordinates", () => {
  const rotated = rotateCells(SHAPES.I);
  assert.deepEqual(rotated, [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }, { x: 0, y: 3 }]);
});

test("fruit blocks detect walls and occupied cells", () => {
  const board = Array.from({ length: 6 }, () => Array(6).fill(null));
  board[4][2] = "T";
  assert.equal(collides(board, SHAPES.O, 0, 0), false);
  assert.equal(collides(board, SHAPES.O, -2, 0), true);
  assert.equal(collides(board, SHAPES.O, 0, 3), true);
});

test("completed fruit rows clear and preserve board height", () => {
  const board = [
    [null, null, null, null],
    ["I", "I", "I", "I"],
    [null, "O", null, null],
    ["T", "T", "T", "T"],
  ];
  assert.deepEqual(completeRows(board), [1, 3]);
  const result = clearCompletedRows(board);
  assert.equal(result.cleared, 2);
  assert.equal(result.board.length, 4);
  assert.deepEqual(result.board[3], [null, "O", null, null]);
});
