import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(projectRoot, "assets/fruits");
const clearMargins = {
  blueberries: { top: 18, bottom: 40 },
  grapes: { top: 2, bottom: 16 },
  kiwi: { bottom: 22 },
  peach: { top: 16 },
  pineapple: { bottom: 18 },
  strawberry: { bottom: 22 },
  watermelon: { bottom: 30 },
};
const atlases = [
  {
    file: "fruit-atlas.png",
    rows: 4,
    columns: 4,
    names: [
      "apple", "orange", "lemon", "pear",
      "peach", "cherries", "strawberry", "blueberries",
      "kiwi", "watermelon", "grapes", "pineapple",
      "mango", "banana", "coconut", "avocado",
    ],
  },
  {
    file: "fruit-atlas-extra.png",
    rows: 2,
    columns: 4,
    names: [
      "lime", "plum", "pomegranate", "dragonfruit",
      "papaya", "starfruit", "fig", "passionfruit",
    ],
  },
];

mkdirSync(outputDirectory, { recursive: true });

atlases.forEach((atlas) => {
  const atlasPath = resolve(outputDirectory, atlas.file);
  atlas.names.forEach((name, index) => {
    const row = Math.floor(index / atlas.columns);
    const column = index % atlas.columns;
    const margin = clearMargins[name] || {};
    const top = margin.top || 0;
    const bottom = margin.bottom || 0;
    const baseCrop = `crop=iw/${atlas.columns}:ih/${atlas.rows}:${column}*iw/${atlas.columns}:${row}*ih/${atlas.rows}`;
    const edgeCleanup = top || bottom
      ? `,crop=iw:ih-${top + bottom}:0:${top},pad=iw:ih:0:${top}:color=black@0`
      : "";
    execFileSync("ffmpeg", [
      "-loglevel", "error",
      "-y",
      "-i", atlasPath,
      "-vf", baseCrop + edgeCleanup,
      "-frames:v", "1",
      "-pix_fmt", "rgba",
      resolve(outputDirectory, `${name}.png`),
    ]);
  });
});

const total = atlases.reduce((sum, atlas) => sum + atlas.names.length, 0);
console.log(`Created ${total} fruit images in ${outputDirectory}`);
