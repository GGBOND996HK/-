let FileSystem = null;

try {
  FileSystem = require("expo-file-system");
} catch (error) {
  FileSystem = null;
}

const SAMPLE_DIR = "mahjong-vision-samples/";

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
    recognition: sample.recognition || null,
    accepted: Boolean(sample.accepted),
    retakeRequested: Boolean(sample.retakeRequested),
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
  deleteVisionSamples,
};
