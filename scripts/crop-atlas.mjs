import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(projectRoot, "assets/fruits");
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
    execFileSync("ffmpeg", [
      "-loglevel", "error",
      "-y",
      "-i", atlasPath,
      "-vf", `crop=iw/${atlas.columns}:ih/${atlas.rows}:${column}*iw/${atlas.columns}:${row}*ih/${atlas.rows}`,
      "-frames:v", "1",
      resolve(outputDirectory, `${name}.png`),
    ]);
  });
});

const total = atlases.reduce((sum, atlas) => sum + atlas.names.length, 0);
console.log(`Created ${total} fruit images in ${outputDirectory}`);
