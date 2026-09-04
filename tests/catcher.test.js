const test = require("node:test");
const assert = require("node:assert/strict");
const { clamp, overlaps } = require("../games/catcher/catcher.js");

test("catcher position stays inside the field", () => {
  assert.equal(clamp(-4, 7, 93), 7);
  assert.equal(clamp(54, 7, 93), 54);
  assert.equal(clamp(108, 7, 93), 93);
});

test("falling fruit collision detects overlap but not separated items", () => {
  const basket = { left: 40, right: 100, top: 80, bottom: 110 };
  assert.equal(overlaps({ left: 70, right: 90, top: 70, bottom: 95 }, basket), true);
  assert.equal(overlaps({ left: 1, right: 20, top: 70, bottom: 95 }, basket), false);
});
