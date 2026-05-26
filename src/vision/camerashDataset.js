const CAMERASH_CLASSES = [
  { index: 1, labelName: "dots-1", tile: "1p" },
  { index: 2, labelName: "dots-2", tile: "2p" },
  { index: 3, labelName: "dots-3", tile: "3p" },
  { index: 4, labelName: "dots-4", tile: "4p" },
  { index: 5, labelName: "dots-5", tile: "5p" },
  { index: 6, labelName: "dots-6", tile: "6p" },
  { index: 7, labelName: "dots-7", tile: "7p" },
  { index: 8, labelName: "dots-8", tile: "8p" },
  { index: 9, labelName: "dots-9", tile: "9p" },
  { index: 10, labelName: "bamboo-1", tile: "1s" },
  { index: 11, labelName: "bamboo-2", tile: "2s" },
  { index: 12, labelName: "bamboo-3", tile: "3s" },
  { index: 13, labelName: "bamboo-4", tile: "4s" },
  { index: 14, labelName: "bamboo-5", tile: "5s" },
  { index: 15, labelName: "bamboo-6", tile: "6s" },
  { index: 16, labelName: "bamboo-7", tile: "7s" },
  { index: 17, labelName: "bamboo-8", tile: "8s" },
  { index: 18, labelName: "bamboo-9", tile: "9s" },
  { index: 19, labelName: "characters-1", tile: "1m" },
  { index: 20, labelName: "characters-2", tile: "2m" },
  { index: 21, labelName: "characters-3", tile: "3m" },
  { index: 22, labelName: "characters-4", tile: "4m" },
  { index: 23, labelName: "characters-5", tile: "5m" },
  { index: 24, labelName: "characters-6", tile: "6m" },
  { index: 25, labelName: "characters-7", tile: "7m" },
  { index: 26, labelName: "characters-8", tile: "8m" },
  { index: 27, labelName: "characters-9", tile: "9m" },
  { index: 28, labelName: "honors-east", tile: "E" },
  { index: 29, labelName: "honors-south", tile: "S" },
  { index: 30, labelName: "honors-west", tile: "W" },
  { index: 31, labelName: "honors-north", tile: "N" },
  { index: 32, labelName: "honors-red", tile: "C" },
  { index: 33, labelName: "honors-green", tile: "F" },
  { index: 34, labelName: "honors-white", tile: "B" },
  { index: 35, labelName: "bonus-spring", tile: null, flower: true },
  { index: 36, labelName: "bonus-summer", tile: null, flower: true },
  { index: 37, labelName: "bonus-autumn", tile: null, flower: true },
  { index: 38, labelName: "bonus-winter", tile: null, flower: true },
  { index: 39, labelName: "bonus-plum", tile: null, flower: true },
  { index: 40, labelName: "bonus-orchid", tile: null, flower: true },
  { index: 41, labelName: "bonus-chrysanthemum", tile: null, flower: true },
  { index: 42, labelName: "bonus-bamboo", tile: null, flower: true },
];

const CAMERASH_BY_INDEX = new Map(CAMERASH_CLASSES.map((item) => [item.index, item]));
const CAMERASH_BY_LABEL = new Map(CAMERASH_CLASSES.map((item) => [item.labelName, item]));

function mapCamerashClass({ label, labelName } = {}) {
  const byIndex = CAMERASH_BY_INDEX.get(Number(label));
  const byName = labelName ? CAMERASH_BY_LABEL.get(String(labelName).trim()) : null;
  return byIndex || byName || null;
}

module.exports = {
  CAMERASH_CLASSES,
  CAMERASH_BY_INDEX,
  CAMERASH_BY_LABEL,
  mapCamerashClass,
};
