const { normalizeRecognition } = require("./recognitionSchema");
const { recognizeWithLocalModel } = require("./localModelRecognizer");

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

  if (context && context.localModelRuntime) {
    return recognizeWithLocalModel(photo, context);
  }

  return normalizeRecognition(await recognizeWithLocalModel(photo, context));
}

module.exports = { recognizeLocally };
