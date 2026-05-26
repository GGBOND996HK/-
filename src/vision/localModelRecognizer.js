const { mapCamerashClass } = require("./camerashDataset");
const { normalizeRecognition } = require("./recognitionSchema");

const LOCAL_MODEL_SOURCE = "local-device-model";

async function recognizeWithLocalModel(photo, context = {}, options = {}) {
  const runtime = options.runtime || context.localModelRuntime;
  if (!runtime || typeof runtime.detect !== "function") {
    return normalizeRecognition({
      handTiles: [],
      drawnTile: null,
      melds: [],
      deadTiles: [],
      overallConfidence: 0.12,
      perTileConfidence: [],
      source: LOCAL_MODEL_SOURCE,
      warnings: [
        "本地麻将牌检测模型尚未安装。请先用公开数据集和本机样本训练模型，再接入本地运行时。",
      ],
    });
  }

  const detections = await runtime.detect(photo, context);
  return recognitionFromDetections(detections, {
    source: runtime.source || LOCAL_MODEL_SOURCE,
    minTileConfidence: Number(context.minTileConfidence || options.minTileConfidence || 0.55),
  });
}

function recognitionFromDetections(detections = [], options = {}) {
  const minTileConfidence = Number(options.minTileConfidence || 0.55);
  const usable = detections
    .map(normalizeDetection)
    .filter((item) => item.tile || item.flower)
    .filter((item) => item.confidence >= minTileConfidence)
    .sort(compareDetections);

  const handTiles = [];
  const deadTiles = [];
  const meldBuckets = new Map();
  let drawnTile = null;
  let flowerCount = 0;

  for (const detection of usable) {
    if (detection.flower) {
      flowerCount += 1;
      continue;
    }

    if (detection.role === "drawn" || detection.role === "drawnTile") {
      drawnTile = drawnTile || detection.tile;
    } else if (detection.role === "dead" || detection.role === "discard") {
      deadTiles.push(detection.tile);
    } else if (detection.role === "meld") {
      const key = String(detection.groupIndex || 0);
      const bucket = meldBuckets.get(key) || [];
      bucket.push(detection.tile);
      meldBuckets.set(key, bucket);
    } else {
      handTiles.push(detection.tile);
    }
  }

  const perTileConfidence = usable
    .filter((item) => item.tile)
    .map((item) => item.confidence);
  const overallConfidence =
    perTileConfidence.length > 0
      ? perTileConfidence.reduce((sum, value) => sum + value, 0) / perTileConfidence.length
      : 0;

  return normalizeRecognition({
    handTiles,
    drawnTile,
    melds: [...meldBuckets.values()],
    deadTiles,
    overallConfidence,
    perTileConfidence,
    source: options.source || LOCAL_MODEL_SOURCE,
    warnings: buildWarnings({ detections, usable, handTiles, drawnTile }),
    flowerCount,
  });
}

function normalizeDetection(raw = {}) {
  const mapped = mapCamerashClass(raw);
  return {
    tile: raw.tile || (mapped && mapped.tile) || null,
    flower: Boolean(raw.flower || (mapped && mapped.flower)),
    confidence: clampConfidence(raw.confidence),
    role: raw.role || "hand",
    groupIndex: raw.groupIndex,
    x: Number(raw.x || (raw.box && raw.box.x) || 0),
    y: Number(raw.y || (raw.box && raw.box.y) || 0),
  };
}

function compareDetections(left, right) {
  if (left.role !== right.role) {
    return roleOrder(left.role) - roleOrder(right.role);
  }
  if (Math.abs(left.y - right.y) > 24) {
    return left.y - right.y;
  }
  return left.x - right.x;
}

function roleOrder(role) {
  if (role === "hand") return 0;
  if (role === "drawn" || role === "drawnTile") return 1;
  if (role === "meld") return 2;
  if (role === "dead" || role === "discard") return 3;
  return 4;
}

function buildWarnings({ detections, usable, handTiles, drawnTile }) {
  const warnings = [];
  if (detections.length === 0) {
    warnings.push("本地模型没有检测到可用牌张。");
  }
  if (detections.length > usable.length) {
    warnings.push("部分低置信度检测已丢弃。");
  }
  if (handTiles.length === 0 && !drawnTile) {
    warnings.push("没有识别到手牌，请靠近牌面重拍。");
  }
  return warnings;
}

function clampConfidence(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.max(0, Math.min(1, number));
}

module.exports = {
  LOCAL_MODEL_SOURCE,
  recognizeWithLocalModel,
  recognitionFromDetections,
};
