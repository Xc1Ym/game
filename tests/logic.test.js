const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createBoard,
  findPath,
  findAvailablePair,
  shuffleRemaining,
  countRemaining,
  sortRanking,
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

test("updateRanking prioritizes score over faster time", () => {
  const result = updateRanking([
    { name: "小林", elapsed: 80, score: 900, completedAt: 1 },
    { name: "阿明", elapsed: 70, score: 800, completedAt: 2 },
  ], { name: "小雨", elapsed: 70, score: 950, completedAt: 3 });

  assert.deepEqual(result.records.map((record) => record.name), ["小雨", "小林", "阿明"]);
  assert.equal(result.rank, 1);
});

test("updateRanking keeps multiple results from the same player", () => {
  const records = [{ name: "Alice", elapsed: 60, score: 700, completedAt: 1 }];
  const slower = updateRanking(records, { name: "Alice", elapsed: 75, score: 900, completedAt: 2 });
  assert.equal(slower.records.length, 2);
  assert.deepEqual(slower.records.map((record) => record.elapsed), [75, 60]);
  assert.equal(slower.rank, 1);
});

test("updateRanking retains only the highest-scoring ten results", () => {
  const records = Array.from({ length: 10 }, (_, index) => ({
    name: `玩家${index + 1}`,
    elapsed: 30 + index,
    score: 1000 - index,
    completedAt: index,
  }));
  const result = updateRanking(records, {
    name: "再来一局",
    elapsed: 90,
    score: 2000,
    completedAt: 20,
  });

  assert.equal(result.records.length, 10);
  assert.equal(result.records[0].name, "再来一局");
  assert.equal(result.records.some((record) => record.name === "玩家10"), false);
  assert.equal(result.rank, 1);
  assert.equal(records.length, 10);
  assert.equal(records[0].name, "玩家1");
});

test("updateRanking rejects a low-scoring run even if it is faster", () => {
  const records = Array.from({ length: 10 }, (_, index) => ({
    name: "同一玩家", elapsed: 60 + index, score: 1000 - index, completedAt: index,
  }));
  const result = updateRanking(records, {
    name: "同一玩家", elapsed: 20, score: 900, completedAt: 20,
  });
  assert.deepEqual(result.records, records);
  assert.equal(result.rank, null);
});

test("updateRanking breaks score ties by time, then completion date", () => {
  const result = updateRanking([
    { name: "同分慢速", elapsed: 80, score: 900, completedAt: 1 },
    { name: "较早完成", elapsed: 70, score: 900, completedAt: 2 },
  ], { name: "本局", elapsed: 70, score: 900, completedAt: 3 });
  assert.deepEqual(result.records.map((record) => record.name), ["较早完成", "本局", "同分慢速"]);
  assert.equal(result.rank, 2);
});

test("sortRanking reorders existing time-ranked records without mutating them", () => {
  const records = [
    { name: "速度最快", elapsed: 50, score: 700, completedAt: 1 },
    { name: "积分最高", elapsed: 80, score: 1000, completedAt: 2 },
  ];
  assert.deepEqual(sortRanking(records), [records[1], records[0]]);
  assert.deepEqual(sortRanking(records, 1), [records[1]]);
  assert.equal(records[0].name, "速度最快");
  assert.deepEqual(sortRanking([]), []);
});
