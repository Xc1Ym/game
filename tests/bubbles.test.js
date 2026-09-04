const test = require("node:test");
const assert = require("node:assert/strict");
const { neighborCells, findCluster, findFloating } = require("../games/bubbles/bubbles.js");

test("bubble hex neighbors respect edges and row offsets", () => {
  assert.equal(neighborCells(0, 0, 5, 5).length, 2);
  assert.deepEqual(neighborCells(1, 2, 5, 5), [
    { row: 1, column: 1 }, { row: 1, column: 3 },
    { row: 0, column: 2 }, { row: 0, column: 3 },
    { row: 2, column: 2 }, { row: 2, column: 3 },
  ]);
});

test("bubble clusters include only connected matching fruit", () => {
  const grid = [
    ["apple", "apple", null, null],
    [null, "apple", "pear", null],
    [null, null, "pear", null],
  ];
  assert.equal(findCluster(grid, 0, 0).length, 3);
  assert.equal(findCluster(grid, 1, 2).length, 2);
});

test("unsupported bubbles are detected as floating", () => {
  const grid = [
    ["apple", null, null, null],
    ["apple", null, null, null],
    [null, null, "pear", null],
  ];
  assert.deepEqual(findFloating(grid), [{ row: 2, column: 2 }]);
});
