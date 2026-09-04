const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const homepage = readFileSync(join(root, "index.html"), "utf8");
const game = readFileSync(join(root, "games/link-link/index.html"), "utf8");

test("homepage exposes the playable game and planned collection", () => {
  assert.match(homepage, /href="games\/link-link\/"/);
  ["水果连连看", "果园扫雷", "接水果", "水果合成"].forEach((name) => assert.match(homepage, new RegExp(name)));
  assert.equal((homepage.match(/status-live/g) || []).length, 1);
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
