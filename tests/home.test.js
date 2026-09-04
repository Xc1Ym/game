const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const homepage = readFileSync(join(root, "index.html"), "utf8");
const game = readFileSync(join(root, "games/link-link/index.html"), "utf8");
const { directionForKey, wrapIndex } = require("../home.js");

test("arcade homepage exposes the playable game and planned collection", () => {
  assert.match(homepage, /data-href="games\/link-link\/"/);
  ["水果连连看", "果园扫雷", "接水果", "水果合成"].forEach((name) => assert.match(homepage, new RegExp(name)));
  assert.equal((homepage.match(/role="option"/g) || []).length, 4);
  assert.match(homepage, /id="joystick"/);
  assert.match(homepage, /id="startButton"/);
});

test("all local homepage links and images resolve", () => {
  const references = [...homepage.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  references.filter((reference) => !reference.startsWith("#") && !reference.includes(":"))
    .forEach((reference) => assert.equal(existsSync(join(root, reference)), true, reference));
});

test("relocated link-link game resolves its local assets and returns home", () => {
  const gameDirectory = join(root, "games/link-link");
  const references = [...game.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  references.filter((reference) => !reference.startsWith("#") && !reference.includes(":"))
    .forEach((reference) => assert.equal(existsSync(join(gameDirectory, reference)), true, reference));
  assert.match(game, /href="\.\.\/\.\.\/"/);
  assert.match(readFileSync(join(root, "src/app.js"), "utf8"), /\.\.\/\.\.\/assets\/fruits/);
});

test("arcade selection wraps and supports arrow or WASD controls", () => {
  assert.equal(wrapIndex(-1, 4), 3);
  assert.equal(wrapIndex(4, 4), 0);
  assert.equal(directionForKey("ArrowUp"), -1);
  assert.equal(directionForKey("W"), -1);
  assert.equal(directionForKey("ArrowDown"), 1);
  assert.equal(directionForKey("s"), 1);
});
