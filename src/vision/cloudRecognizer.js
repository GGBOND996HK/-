const { normalizeRecognition } = require("./recognitionSchema");

const DEFAULT_VISION_API_URL = "http://localhost:8787/recognize-mahjong";

function getVisionApiUrl() {
  if (
    typeof process !== "undefined" &&
    process.env &&
    process.env.EXPO_PUBLIC_VISION_API_URL
  ) {
    return process.env.EXPO_PUBLIC_VISION_API_URL;
  }
  return DEFAULT_VISION_API_URL;
}

async function recognizeWithCloud(photo, context = {}, options = {}) {
  const apiUrl = options.apiUrl || getVisionApiUrl();
  if (!photo || !photo.base64) {
    throw new Error("云端识别需要裁剪压缩后的 base64 图片。");
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64: photo.base64,
      mimeType: photo.mimeType || "image/jpeg",
      context,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "云端识别失败。");
  }

  return normalizeRecognition(payload.recognition || payload);
}

module.exports = {
  DEFAULT_VISION_API_URL,
  getVisionApiUrl,
  recognizeWithCloud,
};
