const { solveState } = require("../engine/mahjong");
const { recognizeLocally } = require("./localRecognizer");
const {
  buildSolveInput,
  describeRecognition,
  hasRecognitionConflict,
  isHighConfidence,
  normalizeRecognition,
} = require("./recognitionSchema");

async function runLocalRecommendation(photo, context = {}, options = {}) {
  const localRecognizer = options.localRecognizer || recognizeLocally;
  const localRecognition = normalizeRecognition(await localRecognizer(photo, context));

  if (!isHighConfidence(localRecognition)) {
    return {
      status: "retake",
      stage: "local",
      recognition: localRecognition,
      message: "请重拍或靠近牌面。",
      warnings: localRecognition.warnings,
    };
  }

  return createRecommendation(localRecognition, context, "local");
}

async function runCloudVerification(photo, context = {}, localRecognition, options = {}) {
  if (!options.cloudRecognizer) {
    return null;
  }

  const cloudRecognition = normalizeRecognition(await options.cloudRecognizer(photo, context));
  if (!isHighConfidence(cloudRecognition)) {
    return {
      status: "retake",
      stage: "cloud",
      recognition: cloudRecognition,
      message: "云端识别置信度不足，请重拍。",
      warnings: cloudRecognition.warnings,
    };
  }

  if (localRecognition && isHighConfidence(localRecognition) && hasRecognitionConflict(localRecognition, cloudRecognition)) {
    return {
      status: "conflict",
      stage: "cloud",
      recognition: cloudRecognition,
      message: "本地与云端识别结果不一致，请重拍确认。",
      warnings: ["牌面可能识别错。"],
    };
  }

  return createRecommendation(cloudRecognition, context, "cloud");
}

function createRecommendation(recognition, context = {}, stage = "local") {
  const input = buildSolveInput(recognition, context);
  const result = solveState(input);
  return {
    status: "recommendation",
    stage,
    recognition,
    input,
    result,
    message: describeRecognition(recognition),
  };
}

module.exports = {
  runLocalRecommendation,
  runCloudVerification,
  createRecommendation,
};
