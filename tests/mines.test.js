const test = require("node:test");
const assert = require("node:assert/strict");
const { getNeighbors, buildMineSet, countAdjacentMines } = require("../games/mines/mines.js");

test("mine neighbors respect board edges", () => {
  assert.deepEqual(getNeighbors(0, 3, 3).sort((a, b) => a - b), [1, 3, 4]);
  assert.equal(getNeighbors(4, 3, 3).length, 8);
});

test("mine generation protects the first cell and its neighbors", () => {
  const mines = buildMineSet(8, 8, 10, 9, () => 0.42);
  const protectedCells = new Set([9, ...getNeighbors(9, 8, 8)]);
  assert.equal(mines.size, 10);
  mines.forEach((mine) => assert.equal(protectedCells.has(mine), false));
});

test("adjacent mine counts are calculated correctly", () => {
  const mines = new Set([0, 2, 8]);
  assert.equal(countAdjacentMines(4, 3, 3, mines), 3);
  assert.equal(countAdjacentMines(7, 3, 3, mines), 1);
});
