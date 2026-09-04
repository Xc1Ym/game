const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const homepage = readFileSync(join(root, "index.html"), "utf8");
const game = readFileSync(join(root, "games/link-link/index.html"), "utf8");
const { directionForKey, wrapIndex } = require("../home.js");

test("arcade homepage exposes all seven playable games", () => {
  ["水果连连看", "果园扫雷", "接水果", "水果合成", "水果贪吃蛇", "水果泡泡龙", "水果方块"].forEach((name) => assert.match(homepage, new RegExp(name)));
  assert.equal((homepage.match(/role="option"/g) || []).length, 7);
  assert.equal((homepage.match(/<a\s+class="arcade-game/g) || []).length, 7);
  assert.equal((homepage.match(/class="menu-state is-live"/g) || []).length, 7);
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
  assert.equal(wrapIndex(-1, 7), 6);
  assert.equal(wrapIndex(7, 7), 0);
  assert.equal(directionForKey("ArrowUp"), -1);
  assert.equal(directionForKey("W"), -1);
  assert.equal(directionForKey("ArrowDown"), 1);
  assert.equal(directionForKey("s"), 1);
});

test("every arcade route resolves to a complete game page", () => {
  const routes = [...homepage.matchAll(/data-href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(routes, ["games/link-link/", "games/mines/", "games/catcher/", "games/merge/", "games/snake/", "games/bubbles/", "games/blocks/"]);
  routes.forEach((route) => {
    const gameDirectory = join(root, route);
    const gamePage = join(gameDirectory, "index.html");
    assert.equal(existsSync(gamePage), true, route);
    const html = readFileSync(gamePage, "utf8");
    const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
    references.filter((reference) => !reference.startsWith("#") && !reference.includes(":"))
      .forEach((reference) => assert.equal(existsSync(join(gameDirectory, reference)), true, route + reference));
  });
});

test("every PLAY item is a native one-click link", () => {
  const links = [...homepage.matchAll(/href="(games\/[^"]+\/)"[\s\S]*?data-href="\1"/g)].map((match) => match[1]);
  assert.deepEqual(links, ["games/link-link/", "games/mines/", "games/catcher/", "games/merge/", "games/snake/", "games/bubbles/", "games/blocks/"]);
});

test("arcade START button receives the browser root used for navigation", () => {
  const script = readFileSync(join(root, "home.js"), "utf8");
  assert.match(script, /factory\(root, root\.document\)/);
  assert.match(script, /function createArcade\(root, document\)/);
  assert.match(script, /root\.location\.assign\(selected\.dataset\.href\)/);
});
