let FileSystem = null;

try {
  FileSystem = require("expo-file-system");
} catch (error) {
  FileSystem = null;
}

const SAMPLE_DIR = "mahjong-vision-samples/";
const EXPORT_DIR = "mahjong-training-exports/";

async function saveVisionSample(sample) {
  if (!FileSystem || !FileSystem.documentDirectory) {
    return null;
  }

  const root = `${FileSystem.documentDirectory}${SAMPLE_DIR}`;
  await ensureDirectory(root);
  const id = sample.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const metadataUri = `${root}${id}.json`;
  const metadata = {
    id,
    createdAt: new Date().toISOString(),
    imageUri: sample.imageUri || null,
    imageWidth: sample.imageWidth || null,
    imageHeight: sample.imageHeight || null,
    recognition: sample.recognition || null,
    adoptedRecognition: sample.adoptedRecognition || sample.recognition || null,
    accepted: Boolean(sample.accepted),
    corrected: Boolean(sample.corrected),
    retakeRequested: Boolean(sample.retakeRequested),
    note: sample.note || "",
  };

  await FileSystem.writeAsStringAsync(metadataUri, JSON.stringify(metadata, null, 2));
  return metadata;
}

async function listVisionSamples() {
  if (!FileSystem || !FileSystem.documentDirectory) {
    return [];
  }

  const root = `${FileSystem.documentDirectory}${SAMPLE_DIR}`;
  const info = await FileSystem.getInfoAsync(root);
  if (!info.exists) {
    return [];
  }

  const files = await FileSystem.readDirectoryAsync(root);
  return files.filter((name) => name.endsWith(".json"));
}

async function loadVisionSamples() {
  if (!FileSystem || !FileSystem.documentDirectory) {
    return [];
  }

  const root = `${FileSystem.documentDirectory}${SAMPLE_DIR}`;
  const info = await FileSystem.getInfoAsync(root);
  if (!info.exists) {
    return [];
  }

  const files = await listVisionSamples();
  const samples = [];
  for (const file of files) {
    try {
      const raw = await FileSystem.readAsStringAsync(`${root}${file}`);
      samples.push(JSON.parse(raw));
    } catch (error) {
      samples.push({
        id: file.replace(/\.json$/, ""),
        unreadable: true,
        error: error.message,
      });
    }
  }
  return samples.sort((left, right) => String(right.createdAt || "").localeCompare(left.createdAt || ""));
}

async function updateVisionSample(id, updates) {
  if (!FileSystem || !FileSystem.documentDirectory || !id) {
    return null;
  }

  const root = `${FileSystem.documentDirectory}${SAMPLE_DIR}`;
  const metadataUri = `${root}${id}.json`;
  const info = await FileSystem.getInfoAsync(metadataUri);
  if (!info.exists) {
    return null;
  }

  const existing = JSON.parse(await FileSystem.readAsStringAsync(metadataUri));
  const next = {
    ...existing,
    ...updates,
    id: existing.id || id,
    updatedAt: new Date().toISOString(),
  };
  await FileSystem.writeAsStringAsync(metadataUri, JSON.stringify(next, null, 2));
  return next;
}

async function saveAdoptedVisionSample(id, adoptedRecognition, options = {}) {
  return updateVisionSample(id, {
    adoptedRecognition,
    accepted: true,
    corrected: Boolean(options.corrected),
    retakeRequested: false,
    note: options.note || "",
  });
}

async function exportVisionTrainingManifest(options = {}) {
  if (!FileSystem || !FileSystem.documentDirectory) {
    return null;
  }

  const root = `${FileSystem.documentDirectory}${EXPORT_DIR}`;
  await ensureDirectory(root);
  const samples = await loadVisionSamples();
  const manifest = buildTrainingManifest(samples, options);
  const exportName = `mahjong-training-${Date.now()}.json`;
  const exportUri = `${root}${exportName}`;
  await FileSystem.writeAsStringAsync(exportUri, JSON.stringify(manifest, null, 2));
  return {
    exportName,
    exportUri,
    manifest,
  };
}

function buildTrainingManifest(samples = [], options = {}) {
  const includeRetakes = options.includeRetakes !== false;
  const normalized = samples
    .filter((sample) => sample && !sample.unreadable)
    .filter((sample) => includeRetakes || !sample.retakeRequested)
    .map(sampleToTrainingRecord);

  return {
    schemaVersion: "mahjong-local-training-v1",
    generatedAt: new Date().toISOString(),
    source: "shanghai-qiaoma-mobile",
    sampleCount: normalized.length,
    acceptedCount: normalized.filter((sample) => sample.labelStatus === "accepted").length,
    correctedCount: normalized.filter((sample) => sample.labelStatus === "corrected").length,
    retakeCount: normalized.filter((sample) => sample.labelStatus === "retake").length,
    samples: normalized,
  };
}

function sampleToTrainingRecord(sample) {
  const adopted = sample.adoptedRecognition || sample.recognition || null;
  const labelStatus = sample.retakeRequested ? "retake" : sample.corrected ? "corrected" : "accepted";

  return {
    id: sample.id,
    createdAt: sample.createdAt,
    updatedAt: sample.updatedAt || null,
    image: {
      uri: sample.imageUri || null,
      width: sample.imageWidth || null,
      height: sample.imageHeight || null,
    },
    labelStatus,
    accepted: Boolean(sample.accepted),
    corrected: Boolean(sample.corrected),
    retakeRequested: Boolean(sample.retakeRequested),
    labels: adopted
      ? {
          handTiles: adopted.handTiles || [],
          drawnTile: adopted.drawnTile || null,
          melds: adopted.melds || [],
          deadTiles: adopted.deadTiles || [],
          flowerCount: Number(adopted.flowerCount || 0),
        }
      : null,
    recognition: sample.recognition || null,
    adoptedRecognition: adopted,
    note: sample.note || "",
  };
}

async function deleteVisionSamples() {
  if (!FileSystem || !FileSystem.documentDirectory) {
    return;
  }

  const root = `${FileSystem.documentDirectory}${SAMPLE_DIR}`;
  const info = await FileSystem.getInfoAsync(root);
  if (info.exists) {
    await FileSystem.deleteAsync(root, { idempotent: true });
  }
}

async function ensureDirectory(uri) {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  }
}

module.exports = {
  saveVisionSample,
  listVisionSamples,
  loadVisionSamples,
  updateVisionSample,
  saveAdoptedVisionSample,
  exportVisionTrainingManifest,
  buildTrainingManifest,
  deleteVisionSamples,
};
