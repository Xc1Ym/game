const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const logic = require("../../src/logic.js");

// A tiny DOM and controlled clock exercise the real app event handlers without
// browser dependencies or writing to a player's localStorage.
class Element {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.listeners = {};
    this.className = "";
    this.disabled = false;
    this.style = { setProperty() {} };
    this.clientWidth = this.clientHeight = 300;
    this.classList = {
      contains: (name) => this.className.split(/\s+/).includes(name),
      add: (...names) => {
        this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(" ");
      },
      remove: (...names) => {
        this.className = this.className.split(/\s+/).filter((name) => !names.includes(name)).join(" ");
      },
      toggle: (name, enabled) => {
        if (enabled ?? !this.classList.contains(name)) this.classList.add(name);
        else this.classList.remove(name);
      },
    };
  }
  set innerHTML(value) { this.html = value; this.children = []; }
  get innerHTML() { return this.html || ""; }
  appendChild(child) { this.children.push(child); return child; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  click() { if (!this.disabled) this.listeners.click?.({ target: this }); }
  focus() {}
  get offsetLeft() { return Number(this.dataset.col || 0) * 50; }
  get offsetTop() { return Number(this.dataset.row || 0) * 50; }
  get offsetWidth() { return 40; }
  get offsetHeight() { return 40; }
  getBoundingClientRect() {
    return { left: Number(this.dataset.col || 0) * 50, top: Number(this.dataset.row || 0) * 50, width: 40, height: 40 };
  }
  querySelectorAll(selector) {
    const matches = (child) => {
      if (selector.startsWith(".")) return child.classList.contains(selector.slice(1));
      const attrs = [...selector.matchAll(/\[data-(\w+)="([^"]+)"\]/g)];
      return attrs.length > 0 && attrs.every(([, key, value]) => String(child.dataset[key]) === value);
    };
    return this.children.flatMap((child) => [
      ...(matches(child) ? [child] : []), ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function createApp(board, overrides = {}) {
  const html = readFileSync(join(__dirname, "../../games/link-link/index.html"), "utf8");
  const nodes = Object.fromEntries([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, new Element()]));
  nodes.resultModal.classList.add("hidden");
  nodes.leaderboardModal.classList.add("hidden");
  const difficulties = ["easy", "normal", "hard"].map((level) => {
    const button = new Element();
    button.dataset.level = level;
    return button;
  });
  let now = 10000;
  let nextId = 0;
  const timers = new Map();
  const schedule = (fn, delay, repeat = false) => {
    const id = ++nextId;
    timers.set(id, { fn, due: now + delay, delay, repeat });
    return id;
  };
  const advance = (ms) => {
    const end = now + ms;
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.due <= end)
        .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
      if (!next) break;
      const [id, timer] = next;
      now = timer.due;
      if (timer.repeat) timer.due += timer.delay;
      else timers.delete(id);
      timer.fn();
    }
    now = end;
  };
  const storage = new Map();
  const writes = [];
  const window = {
    FruitLinkLogic: { ...logic, createBoard: () => structuredClone(board), ...overrides },
    setTimeout: (fn, delay) => schedule(fn, delay),
    clearTimeout: (id) => timers.delete(id),
    setInterval: (fn, delay) => schedule(fn, delay, true),
    clearInterval: (id) => timers.delete(id),
    addEventListener() {},
  };
  vm.runInNewContext(readFileSync(join(__dirname, "../../src/app.js"), "utf8"), {
    window,
    document: {
      querySelector: (selector) => nodes[selector.slice(1)],
      querySelectorAll: (selector) => selector === ".difficulty" ? difficulties : [],
      createElement: () => new Element(),
      addEventListener() {},
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => { storage.set(key, value); writes.push(key); },
    },
    Date: class extends Date { static now() { return now; } },
  }, { filename: "src/app.js" });
  const tile = (row, col) => nodes.board.querySelector(`[data-row="${row}"][data-col="${col}"]`);
  return { nodes, tile, advance, storage, writes, difficulties };
}

module.exports = { createApp };
