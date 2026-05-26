const { RuleSet, tilesToHand } = require("mahjong-tile-efficiency");

const TILE_ORDER = [
  ...Array.from({ length: 9 }, (_, index) => `${index + 1}m`),
  ...Array.from({ length: 9 }, (_, index) => `${index + 1}p`),
  ...Array.from({ length: 9 }, (_, index) => `${index + 1}s`),
  "E",
  "S",
  "W",
  "N",
  "C",
  "F",
  "B",
];

const INTERNAL_TO_EXTERNAL = {
  E: "1z",
  S: "2z",
  W: "3z",
  N: "4z",
  B: "5z",
  F: "6z",
  C: "7z",
};

const EXTERNAL_TO_INTERNAL = {
  "1z": "E",
  "2z": "S",
  "3z": "W",
  "4z": "N",
  "5z": "B",
  "6z": "F",
  "7z": "C",
};

const FLOWER_HONOR_TILES = new Set(["C", "F", "B"]);

function calculateTileEfficiencyReference({ handCounts, rule = "HK" } = {}) {
  const warnings = [];

  try {
    const externalTiles = countsToExternalTiles(handCounts || [], warnings);
    if (externalTiles.length === 0) {
      return disabledReference(rule, ["没有可交给外部牌效库的普通手牌。"]);
    }

    const ruleSet = new RuleSet(rule);
    const externalHand = tilesToHand(externalTiles);
    const rawUkeire = ruleSet.calUkeire(externalHand);

    return {
      enabled: true,
      source: "mahjong-tile-efficiency",
      rule,
      shanten: ruleSet.calShanten(externalHand),
      tileCount: externalTiles.length,
      ukeire: normalizeExternalResult(rawUkeire),
      warnings,
    };
  } catch (error) {
    return disabledReference(rule, [`外部牌效参考计算失败：${error.message}`]);
  }
}

function describeDiscardEfficiency(reference, tile) {
  if (!reference || !reference.enabled || !reference.ukeire || !tile) {
    return null;
  }

  const normal = reference.ukeire.normalDiscard || {};
  const receding = reference.ukeire.recedingDiscard || {};
  if (normal[tile]) {
    return {
      kind: "normal",
      label: "外部牌效：保持向听",
      totalUkeire: sumUkeire(normal[tile]),
      ukeire: normal[tile],
    };
  }

  if (receding[tile]) {
    return {
      kind: "receding",
      label: "外部牌效：向听倒退",
      totalUkeire: sumUkeire(receding[tile]),
      ukeire: receding[tile],
    };
  }

  return null;
}

function countsToExternalTiles(counts, warnings) {
  const tiles = [];
  for (let index = 0; index < TILE_ORDER.length; index += 1) {
    const count = Number(counts[index] || 0);
    if (count <= 0) {
      continue;
    }

    const tile = TILE_ORDER[index];
    if (FLOWER_HONOR_TILES.has(tile)) {
      warnings.push("中、发、白按当前上海敲麻口径算花，外部牌效参考会忽略这些牌。");
      continue;
    }

    const external = toExternalTile(tile);
    for (let copy = 0; copy < count; copy += 1) {
      tiles.push(external);
    }
  }
  return tiles;
}

function toExternalTile(tile) {
  if (/^[1-9][mps]$/.test(tile)) {
    return tile;
  }
  if (INTERNAL_TO_EXTERNAL[tile]) {
    return INTERNAL_TO_EXTERNAL[tile];
  }
  throw new Error(`无法转换牌效库牌张：${tile}`);
}

function fromExternalTile(tile) {
  if (/^[1-9][mps]$/.test(tile)) {
    return tile;
  }
  return EXTERNAL_TO_INTERNAL[tile] || tile;
}

function normalizeExternalResult(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeExternalResult);
  }

  if (value && typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      const normalizedKey = isExternalTileName(key) ? fromExternalTile(key) : key;
      output[normalizedKey] = normalizeExternalResult(item);
    }
    return output;
  }

  return value;
}

function isExternalTileName(value) {
  return /^[1-9][mpsz]$/.test(value);
}

function sumUkeire(ukeire) {
  if (!ukeire || typeof ukeire !== "object") {
    return 0;
  }
  return Object.values(ukeire).reduce((sum, value) => sum + Number(value || 0), 0);
}

function disabledReference(rule, warnings) {
  return {
    enabled: false,
    source: "mahjong-tile-efficiency",
    rule,
    warnings,
  };
}

module.exports = {
  calculateTileEfficiencyReference,
  describeDiscardEfficiency,
  toExternalTile,
  fromExternalTile,
};
