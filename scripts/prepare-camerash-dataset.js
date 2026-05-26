const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const { mapCamerashClass } = require("../src/vision/camerashDataset");

const DATASET_URL =
  "https://raw.githubusercontent.com/Camerash/mahjong-dataset/master/train.zip";
const DEFAULT_OUTPUT_DIR = path.join(__dirname, "..", "datasets", "camerash");

async function main() {
  const outputDir = path.resolve(process.argv[2] || DEFAULT_OUTPUT_DIR);
  const archivePath = path.join(outputDir, "train.zip");
  const extractDir = path.join(outputDir, "train");
  const manifestPath = path.join(outputDir, "manifest.json");

  fs.mkdirSync(outputDir, { recursive: true });

  if (!fs.existsSync(archivePath)) {
    console.log(`Downloading Camerash mahjong dataset to ${archivePath}`);
    await download(DATASET_URL, archivePath);
  } else {
    console.log(`Using existing archive ${archivePath}`);
  }

  fs.mkdirSync(extractDir, { recursive: true });
  execFileSync("unzip", ["-q", "-o", archivePath, "-d", extractDir], { stdio: "inherit" });

  const csvPath = findFirstFile(extractDir, "data.csv");
  if (!csvPath) {
    throw new Error("Could not find data.csv after extracting Camerash train.zip.");
  }

  const imageRoot = findFirstDirectory(extractDir, "images") || path.dirname(csvPath);
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const samples = rows.map((row) => {
    const mapped = mapCamerashClass(row);
    const imagePath = path.relative(outputDir, path.join(imageRoot, row.imageName));
    return {
      image: imagePath,
      label: Number(row.label),
      labelName: row.labelName,
      tile: mapped ? mapped.tile : null,
      flower: Boolean(mapped && mapped.flower),
      source: "Camerash/mahjong-dataset",
    };
  });

  const knownTiles = samples.filter((item) => item.tile).length;
  const flowers = samples.filter((item) => item.flower).length;
  const unknown = samples.length - knownTiles - flowers;

  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        source: "https://github.com/Camerash/mahjong-dataset",
        sourceArchive: DATASET_URL,
        generatedAt: new Date().toISOString(),
        sampleCount: samples.length,
        knownTiles,
        flowers,
        unknown,
        samples,
      },
      null,
      2
    )}\n`
  );

  console.log(`Wrote ${manifestPath}`);
  console.log(`Samples=${samples.length}, knownTiles=${knownTiles}, flowers=${flowers}, unknown=${unknown}`);
}

async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(destination, Buffer.from(arrayBuffer));
}

function parseCsv(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^image-name\s*,?\s*label/i.test(line))
    .map((line) => {
      const parts = line.split(",").map((item) => item.trim());
      if (parts.length < 3) {
        throw new Error(`Invalid Camerash CSV row: ${line}`);
      }
      return {
        imageName: parts[0],
        label: parts[1],
        labelName: parts[2],
      };
    });
}

function findFirstFile(dir, filename) {
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    return null;
  }

  for (const name of fs.readdirSync(dir)) {
    const absolute = path.join(dir, name);
    const childStat = fs.statSync(absolute);
    if (childStat.isDirectory()) {
      const match = findFirstFile(absolute, filename);
      if (match) {
        return match;
      }
    } else if (name === filename) {
      return absolute;
    }
  }
  return null;
}

function findFirstDirectory(dir, dirname) {
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    return null;
  }

  for (const name of fs.readdirSync(dir)) {
    const absolute = path.join(dir, name);
    const childStat = fs.statSync(absolute);
    if (childStat.isDirectory()) {
      if (name === dirname) {
        return absolute;
      }
      const match = findFirstDirectory(absolute, dirname);
      if (match) {
        return match;
      }
    }
  }
  return null;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
