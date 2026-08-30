const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createBoard,
  findPath,
  findAvailablePair,
  shuffleRemaining,
  countRemaining,
  updateRanking,
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

test("updateRanking sorts by fastest time and uses score as the tie breaker", () => {
  const result = updateRanking([
    { name: "小林", elapsed: 80, score: 900, completedAt: 1 },
    { name: "阿明", elapsed: 70, score: 800, completedAt: 2 },
  ], { name: "小雨", elapsed: 70, score: 950, completedAt: 3 });

  assert.deepEqual(result.records.map((record) => record.name), ["小雨", "阿明", "小林"]);
  assert.equal(result.rank, 1);
  assert.equal(result.isPersonalBest, true);
});

test("updateRanking keeps only a player's best result", () => {
  const records = [{ name: "Alice", elapsed: 60, score: 700, completedAt: 1 }];
  const slower = updateRanking(records, { name: "alice", elapsed: 75, score: 900, completedAt: 2 });
  assert.equal(slower.records.length, 1);
  assert.equal(slower.records[0].elapsed, 60);
  assert.equal(slower.isPersonalBest, false);

  const faster = updateRanking(records, { name: "ALICE", elapsed: 55, score: 650, completedAt: 3 });
  assert.equal(faster.records[0].elapsed, 55);
  assert.equal(faster.isPersonalBest, true);
});
