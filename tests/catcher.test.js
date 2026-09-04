const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { clamp, overlaps, smoothPosition } = require("../games/catcher/catcher.js");

const catcherStyles = readFileSync(resolve(__dirname, "../games/catcher/catcher.css"), "utf8");

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

test("basket smoothing is frame-rate independent and never overshoots", () => {
  const oneFrame = smoothPosition(0, 100, 20, 1 / 60);
  const twoHalfFrames = smoothPosition(smoothPosition(0, 100, 20, 1 / 120), 100, 20, 1 / 120);
  assert.ok(oneFrame > 0 && oneFrame < 100);
  assert.ok(Math.abs(oneFrame - twoHalfFrames) < 0.000001);
});

test("catcher field shares one background color and fruit sprites have no tinted shadow", () => {
  assert.match(catcherStyles, /--catcher-background:\s*#dff1df/);
  assert.match(catcherStyles, /\.catch-field\s*\{[\s\S]*?background:\s*var\(--catcher-background\)/);
  assert.match(catcherStyles, /\.falling-item img\s*\{[\s\S]*?filter:\s*none/);
});
