const {
  TILE_ORDER,
  parseTiles,
  expandCounts,
  formatTileLabel,
} = require("../engine/mahjong");

const HIGH_CONFIDENCE_THRESHOLD = 0.78;

function normalizeRecognition(raw = {}) {
  const handTiles = normalizeTileList(raw.handTiles || []);
  const drawnTile = raw.drawnTile ? normalizeTile(raw.drawnTile) : null;
  const melds = normalizeMelds(raw.melds || []);
  const deadTiles = normalizeTileList(raw.deadTiles || []);
  const perTileConfidence = Array.isArray(raw.perTileConfidence) ? raw.perTileConfidence : [];
  const overallConfidence = clampConfidence(raw.overallConfidence);
  const warnings = Array.isArray(raw.warnings) ? raw.warnings.filter(Boolean) : [];

  return {
    handTiles,
    drawnTile,
    melds,
    deadTiles,
    overallConfidence,
    perTileConfidence,
    source: raw.source || "unknown",
    warnings,
    flowerCount: Number(raw.flowerCount || 0),
    capturedAt: raw.capturedAt || new Date().toISOString(),
  };
}

function buildSolveInput(recognition, fallback = {}) {
  const normalized = normalizeRecognition(recognition);
  const handTiles = normalized.drawnTile
    ? [...normalized.handTiles, normalized.drawnTile]
    : normalized.handTiles;

  return {
    handText: tilesToText(handTiles),
    meldText: normalized.melds.map(tilesToText).join(" "),
    deadText: tilesToText(normalized.deadTiles),
    flowerCount: Number(fallback.flowerCount || 0) + normalized.flowerCount,
  };
}

function isHighConfidence(recognition) {
  return (
    recognition &&
    Number(recognition.overallConfidence || 0) >= HIGH_CONFIDENCE_THRESHOLD &&
    (recognition.handTiles || []).length > 0
  );
}

function hasRecognitionConflict(left, right) {
  if (!left || !right) {
    return false;
  }

  const a = normalizeRecognition(left);
  const b = normalizeRecognition(right);
  return (
    signature(a.handTiles) !== signature(b.handTiles) ||
    String(a.drawnTile || "") !== String(b.drawnTile || "") ||
    a.melds.map(signature).join("|") !== b.melds.map(signature).join("|")
  );
}

function normalizeMelds(melds) {
  return melds.map((meld) => {
    if (Array.isArray(meld)) {
      return normalizeTileList(meld);
    }
    if (typeof meld === "string") {
      return normalizeTileList(expandCounts(parseTiles(meld)).map((index) => TILE_ORDER[index]));
    }
    return [];
  });
}

function normalizeTileList(tiles) {
  return tiles.map(normalizeTile).filter(Boolean);
}

function normalizeTile(tile) {
  if (typeof tile !== "string") {
    return null;
  }
  const counts = parseTiles(tile);
  const indexes = expandCounts(counts);
  if (indexes.length !== 1) {
    throw new Error(`识别牌张 ${tile} 必须只代表一张牌。`);
  }
  return TILE_ORDER[indexes[0]];
}

function tilesToText(tiles) {
  const counts = new Array(TILE_ORDER.length).fill(0);
  for (const tile of tiles) {
    counts[TILE_ORDER.indexOf(tile)] += 1;
  }

  let text = "";
  const suits = ["m", "p", "s"];
  for (let suit = 0; suit < 3; suit += 1) {
    let digits = "";
    for (let rank = 0; rank < 9; rank += 1) {
      const index = suit * 9 + rank;
      digits += String(rank + 1).repeat(counts[index]);
    }
    if (digits) {
      text += `${text ? " " : ""}${digits}${suits[suit]}`;
    }
  }

  const honors = ["E", "S", "W", "N", "C", "F", "B"]
    .map((tile) => tile.repeat(counts[TILE_ORDER.indexOf(tile)]))
    .join("");
  if (honors) {
    text += `${text ? " " : ""}${honors}`;
  }
  return text;
}

function describeRecognition(recognition) {
  const normalized = normalizeRecognition(recognition);
  const tileLabel = normalized.drawnTile ? `，摸牌 ${formatTileLabel(normalized.drawnTile)}` : "";
  return `识别 ${normalized.handTiles.length} 张手牌${tileLabel}，置信度 ${Math.round(
    normalized.overallConfidence * 100
  )}%`;
}

function clampConfidence(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.min(1, number));
}

function signature(tiles) {
  return tiles.slice().sort().join(",");
}

module.exports = {
  HIGH_CONFIDENCE_THRESHOLD,
  normalizeRecognition,
  buildSolveInput,
  isHighConfidence,
  hasRecognitionConflict,
  describeRecognition,
  tilesToText,
};
