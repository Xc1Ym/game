(function attachFruitLinkLogic(globalScope) {
  "use strict";

  const DIRECTIONS = [
    [-1, 0],
    [0, 1],
    [1, 0],
    [0, -1],
  ];

  function shuffled(items, random = Math.random) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function createBoard(rows, columns, fruitTypes, random = Math.random) {
    const total = rows * columns;
    if (total % 2 !== 0) throw new Error("The board must contain an even number of cells.");
    if (!fruitTypes.length) throw new Error("At least one fruit type is required.");

    const tiles = [];
    for (let pair = 0; pair < total / 2; pair += 1) {
      const fruit = fruitTypes[pair % fruitTypes.length];
      tiles.push(fruit, fruit);
    }
    const mixed = shuffled(tiles, random);
    return Array.from({ length: rows }, (_, row) =>
      mixed.slice(row * columns, (row + 1) * columns),
    );
  }

  function samePosition(first, second) {
    return first.row === second.row && first.col === second.col;
  }

  function isInside(board, row, col) {
    return row >= 0 && col >= 0 && row < board.length && col < board[0].length;
  }

  function compressPath(path) {
    if (path.length <= 2) return path;
    const result = [path[0]];
    for (let index = 1; index < path.length - 1; index += 1) {
      const before = path[index - 1];
      const current = path[index];
      const after = path[index + 1];
      const directionBefore = [current.row - before.row, current.col - before.col];
      const directionAfter = [after.row - current.row, after.col - current.col];
      if (directionBefore[0] !== directionAfter[0] || directionBefore[1] !== directionAfter[1]) {
        result.push(current);
      }
    }
    result.push(path[path.length - 1]);
    return result;
  }

  function findPath(board, start, end) {
    if (!board.length || !board[0].length || samePosition(start, end)) return null;
    if (!isInside(board, start.row, start.col) || !isInside(board, end.row, end.col)) return null;
    if (board[start.row][start.col] == null || board[start.row][start.col] !== board[end.row][end.col]) return null;

    const rows = board.length + 2;
    const columns = board[0].length + 2;
    const source = { row: start.row + 1, col: start.col + 1 };
    const target = { row: end.row + 1, col: end.col + 1 };
    const queue = [];
    const best = Array.from({ length: rows }, () =>
      Array.from({ length: columns }, () => [Infinity, Infinity, Infinity, Infinity]),
    );

    const canEnter = (row, col) => {
      if (row < 0 || col < 0 || row >= rows || col >= columns) return false;
      if (row === target.row && col === target.col) return true;
      if (row === 0 || col === 0 || row === rows - 1 || col === columns - 1) return true;
      return board[row - 1][col - 1] == null;
    };

    DIRECTIONS.forEach(([rowStep, colStep], direction) => {
      const row = source.row + rowStep;
      const col = source.col + colStep;
      if (!canEnter(row, col)) return;
      best[row][col][direction] = 0;
      queue.push({ row, col, direction, turns: 0, path: [source, { row, col }] });
    });

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      if (current.row === target.row && current.col === target.col) {
        return compressPath(current.path).map((point) => ({
          row: point.row - 1,
          col: point.col - 1,
        }));
      }

      DIRECTIONS.forEach(([rowStep, colStep], direction) => {
        const turns = current.turns + (direction === current.direction ? 0 : 1);
        if (turns > 2) return;
        const row = current.row + rowStep;
        const col = current.col + colStep;
        if (!canEnter(row, col) || best[row][col][direction] <= turns) return;
        best[row][col][direction] = turns;
        queue.push({
          row,
          col,
          direction,
          turns,
          path: [...current.path, { row, col }],
        });
      });
    }
    return null;
  }

  function findAvailablePair(board) {
    const positions = new Map();
    board.forEach((row, rowIndex) => {
      row.forEach((fruit, colIndex) => {
        if (fruit == null) return;
        if (!positions.has(fruit)) positions.set(fruit, []);
        positions.get(fruit).push({ row: rowIndex, col: colIndex });
      });
    });

    for (const candidates of positions.values()) {
      for (let first = 0; first < candidates.length; first += 1) {
        for (let second = first + 1; second < candidates.length; second += 1) {
          const path = findPath(board, candidates[first], candidates[second]);
          if (path) return { first: candidates[first], second: candidates[second], path };
        }
      }
    }
    return null;
  }

  function shuffleRemaining(board, random = Math.random) {
    const values = [];
    const positions = [];
    board.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        if (value != null) {
          values.push(value);
          positions.push({ row: rowIndex, col: colIndex });
        }
      });
    });
    const mixed = shuffled(values, random);
    const copy = board.map((row) => [...row]);
    positions.forEach((position, index) => {
      copy[position.row][position.col] = mixed[index];
    });
    return copy;
  }

  function countRemaining(board) {
    return board.reduce(
      (total, row) => total + row.filter((value) => value != null).length,
      0,
    );
  }

  function updateRanking(records, entry, limit = 10) {
    const playerKey = entry.name.trim().toLocaleLowerCase("zh-CN");
    const normalizedEntry = { ...entry, name: entry.name.trim() };
    const existing = records.find(
      (record) => record.name.trim().toLocaleLowerCase("zh-CN") === playerKey,
    );
    const isBetter = !existing
      || normalizedEntry.elapsed < existing.elapsed
      || (normalizedEntry.elapsed === existing.elapsed && normalizedEntry.score > existing.score);
    const candidate = isBetter ? normalizedEntry : existing;
    const updated = records.filter(
      (record) => record.name.trim().toLocaleLowerCase("zh-CN") !== playerKey,
    );
    updated.push(candidate);
    updated.sort((first, second) =>
      first.elapsed - second.elapsed
      || second.score - first.score
      || first.completedAt - second.completedAt,
    );
    const limited = updated.slice(0, limit);
    const rankIndex = limited.findIndex(
      (record) => record.name.trim().toLocaleLowerCase("zh-CN") === playerKey,
    );
    return {
      records: limited,
      rank: rankIndex >= 0 ? rankIndex + 1 : null,
      isPersonalBest: isBetter,
    };
  }

  const api = {
    createBoard,
    findPath,
    findAvailablePair,
    shuffleRemaining,
    countRemaining,
    shuffled,
    updateRanking,
  };
  globalScope.FruitLinkLogic = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
