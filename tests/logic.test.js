const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createBoard,
  findPath,
  findAvailablePair,
  shuffleRemaining,
  countRemaining,
} = require("../src/logic.js");

test("createBoard produces pairs and the requested dimensions", () => {
  const board = createBoard(4, 6, ["A", "B", "C"], () => 0.5);
  assert.equal(board.length, 4);
  assert.equal(board[0].length, 6);
  const counts = board.flat().reduce((result, item) => {
    result[item] = (result[item] || 0) + 1;
    return result;
  }, {});
  Object.values(counts).forEach((count) => assert.equal(count % 2, 0));
});

test("findPath connects adjacent identical tiles", () => {
  const board = [["A", "A"], ["B", "B"]];
  const path = findPath(board, { row: 0, col: 0 }, { row: 0, col: 1 });
  assert.deepEqual(path, [{ row: 0, col: 0 }, { row: 0, col: 1 }]);
});

test("findPath can route around the outside border with two turns", () => {
  const board = [
    ["A", "X", "A"],
    ["X", "X", "X"],
  ];
  const path = findPath(board, { row: 0, col: 0 }, { row: 0, col: 2 });
  assert.ok(path);
  assert.ok(path.some((point) => point.row === -1));
  assert.ok(path.length <= 4);
});

test("findPath rejects a route requiring more than two turns", () => {
  const board = [
    ["A", "X", null, null],
    [null, null, null, "X"],
    ["X", null, "X", "A"],
    [null, null, null, "X"],
  ];
  assert.equal(findPath(board, { row: 0, col: 0 }, { row: 2, col: 3 }), null);
});

test("findAvailablePair locates a playable match", () => {
  const board = [["A", "B"], ["A", "B"]];
  const pair = findAvailablePair(board);
  assert.ok(pair);
  assert.equal(board[pair.first.row][pair.first.col], board[pair.second.row][pair.second.col]);
});

test("shuffleRemaining preserves empty cells and tile counts", () => {
  const board = [["A", null, "B"], ["A", null, "B"]];
  const shuffled = shuffleRemaining(board, () => 0.25);
  assert.equal(shuffled[0][1], null);
  assert.equal(shuffled[1][1], null);
  assert.deepEqual(shuffled.flat().filter(Boolean).sort(), ["A", "A", "B", "B"]);
  assert.equal(countRemaining(shuffled), 4);
});
