const { normalizeRecognition } = require("./recognitionSchema");

async function recognizeLocally(photo, context = {}) {
  if (photo && photo.mockRecognition) {
    return normalizeRecognition({
      ...photo.mockRecognition,
      source: photo.mockRecognition.source || "local-mock",
    });
  }

  if (context && context.mockRecognition) {
    return normalizeRecognition({
      ...context.mockRecognition,
      source: context.mockRecognition.source || "local-mock",
    });
  }

  return normalizeRecognition({
    handTiles: [],
    drawnTile: null,
    melds: [],
    deadTiles: [],
    overallConfidence: 0.12,
    perTileConfidence: [],
    source: "local-fast-path",
    warnings: ["本地麻将牌检测模型尚未训练，无法给出高置信识别。"],
  });
}

module.exports = { recognizeLocally };
