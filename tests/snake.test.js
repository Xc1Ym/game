const test = require("node:test");
const assert = require("node:assert/strict");
const { DIRECTIONS, isOpposite, queueDirection, snakeStep, advanceSnake } = require("../games/snake/snake.js");

test("snake advances, grows on fruit, and may move into its departing tail", () => {
  const snake = [{ x: 3, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }];
  const growth = advanceSnake(snake, DIRECTIONS.right, { x: 4, y: 2 }, 8, 8);
  assert.equal(growth.ate, true);
  assert.equal(growth.snake.length, 5);
  const tailMove = advanceSnake(snake, DIRECTIONS.down, { x: 7, y: 7 }, 8, 8);
  assert.equal(tailMove.crashed, false);
});

test("snake rejects wall and body collisions and identifies opposite turns", () => {
  const snake = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 0 }];
  assert.equal(advanceSnake(snake, DIRECTIONS.left, { x: 4, y: 4 }, 6, 6).crashed, true);
  assert.equal(advanceSnake(snake, DIRECTIONS.down, { x: 4, y: 4 }, 6, 6).crashed, true);
  assert.equal(isOpposite(DIRECTIONS.left, DIRECTIONS.right), true);
  assert.equal(isOpposite(DIRECTIONS.left, DIRECTIONS.up), false);
});

test("snake buffers valid quick turns and rejects reversals", () => {
  let queue = queueDirection([], DIRECTIONS.right, DIRECTIONS.up);
  queue = queueDirection(queue, DIRECTIONS.right, DIRECTIONS.left);
  assert.deepEqual(queue, [DIRECTIONS.up, DIRECTIONS.left]);
  assert.deepEqual(queueDirection([], DIRECTIONS.right, DIRECTIONS.left), []);
  assert.deepEqual(queueDirection(queue, DIRECTIONS.right, DIRECTIONS.down), queue);
});

test("snake difficulty has a gentler default speed curve", () => {
  assert.ok(snakeStep("easy", 4) > snakeStep("normal", 4));
  assert.ok(snakeStep("normal", 4) > snakeStep("hard", 4));
  assert.equal(snakeStep("easy", 40), 245);
  assert.ok(snakeStep("normal", 40) >= 140);
  assert.ok(snakeStep("hard", 4) < 88);
  assert.equal(snakeStep("hard", 54), 56);
});
