const fs = require("fs");
const path = require("path");

const {
  runCloudVerification,
  runLocalRecommendation,
} = require("../src/vision/recommendationPipeline");
const { recognitionFromDetections } = require("../src/vision/localModelRecognizer");
const { recognitionSchema, extractOutputText } = require("../server/visionProxy");
const { mapCamerashClass } = require("../src/vision/camerashDataset");
const { buildTrainingManifest } = require("../src/vision/sampleStore");

function assert(condition, message) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`  PASS: ${message}`);
  }
}

const HIGH_CONFIDENCE = {
  handTiles: ["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "E", "E", "N", "N"],
  drawnTile: "3m",
  melds: [],
  deadTiles: ["1m", "1m", "9s"],
  overallConfidence: 0.94,
  perTileConfidence: Array.from({ length: 14 }, () => 0.94),
  source: "test",
  warnings: [],
};

async function main() {
  console.log("\n=== Vision Pipeline Tests ===\n");

  const high = await runLocalRecommendation({
    mockRecognition: HIGH_CONFIDENCE,
  });
  assert(high.status === "recommendation", "高置信本地识别会生成推荐");
  assert(high.result.recommendations.length > 0, "高置信识别结果包含出牌候选");

  const low = await runLocalRecommendation({});
  assert(low.status === "retake", "低置信本地识别提示重拍");
  assert(!low.result, "低置信识别不会输出误导性推荐");

  const localModelRecognition = recognitionFromDetections(
    HIGH_CONFIDENCE.handTiles.map((tile, index) => ({
      tile,
      confidence: 0.93,
      role: "hand",
      x: index * 28,
      y: 0,
    })).concat({
      tile: HIGH_CONFIDENCE.drawnTile,
      confidence: 0.93,
      role: "drawn",
      x: 420,
      y: 0,
    })
  );
  assert(localModelRecognition.overallConfidence > 0.9, "本地模型检测输出可转换为统一识别结构");

  const modelRuntime = {
    source: "test-local-model",
    detect: async () =>
      HIGH_CONFIDENCE.handTiles.map((tile, index) => ({
        tile,
        confidence: 0.93,
        role: "hand",
        x: index * 28,
        y: 0,
      })).concat({
        tile: HIGH_CONFIDENCE.drawnTile,
        confidence: 0.93,
        role: "drawn",
        x: 420,
        y: 0,
      }),
  };
  const modelLocal = await runLocalRecommendation({}, { localOnly: true, localModelRuntime: modelRuntime });
  assert(modelLocal.status === "recommendation", "全本地模型识别结果可直接生成推荐");

  const skippedCloud = await runCloudVerification(
    {},
    { localOnly: true },
    HIGH_CONFIDENCE,
    {
      cloudRecognizer: async () => {
        throw new Error("local-only should not call cloud recognizer");
      },
    }
  );
  assert(skippedCloud.status === "skipped", "全本地模式不会调用云端识别");

  const schema = recognitionSchema();
  assert(schema.properties.handTiles.items.enum.includes("1m"), "后端代理使用结构化麻将牌 JSON Schema");

  const output = extractOutputText({
    output: [
      {
        content: [
          {
            type: "output_text",
            text: JSON.stringify(HIGH_CONFIDENCE),
          },
        ],
      },
    ],
  });
  assert(output.includes("overallConfidence"), "后端能解析 Responses API 文本输出");

  const clientFiles = readFiles(["App.js", "src"]);
  assert(!clientFiles.includes("OPENAI_API_KEY"), "App 客户端不包含 OPENAI_API_KEY");

  const serverSource = fs.readFileSync(path.join(__dirname, "../server/visionProxy.js"), "utf8");
  assert(!/writeFile|appendFile|createWriteStream/.test(serverSource), "后端代理不落盘原图");

  assert(mapCamerashClass({ label: 19 }).tile === "1m", "Camerash 万子标签映射到项目牌码");
  assert(mapCamerashClass({ labelName: "honors-red" }).tile === "C", "Camerash 红中标签映射到项目牌码");
  assert(mapCamerashClass({ label: 35 }).flower, "Camerash 花牌标签可被识别为训练样本花牌");

  const manifest = buildTrainingManifest([
    {
      id: "accepted-1",
      createdAt: "2026-05-26T00:00:00.000Z",
      imageUri: "file:///accepted.jpg",
      recognition: HIGH_CONFIDENCE,
      adoptedRecognition: HIGH_CONFIDENCE,
      accepted: true,
      corrected: false,
      retakeRequested: false,
    },
    {
      id: "corrected-1",
      createdAt: "2026-05-26T00:00:01.000Z",
      imageUri: "file:///corrected.jpg",
      recognition: { ...HIGH_CONFIDENCE, drawnTile: "4m" },
      adoptedRecognition: HIGH_CONFIDENCE,
      accepted: true,
      corrected: true,
      retakeRequested: false,
    },
    {
      id: "retake-1",
      createdAt: "2026-05-26T00:00:02.000Z",
      imageUri: "file:///retake.jpg",
      recognition: { handTiles: [], overallConfidence: 0.1 },
      accepted: false,
      corrected: false,
      retakeRequested: true,
    },
  ]);
  assert(manifest.sampleCount === 3, "训练 manifest 包含确认、修正和重拍样本");
  assert(manifest.correctedCount === 1, "训练 manifest 统计修正样本");
  assert(
    manifest.samples.find((sample) => sample.id === "corrected-1").labels.drawnTile === "3m",
    "训练 manifest 使用最终采用牌面作为标签"
  );

  console.log("\n=== Vision Pipeline tests finished ===\n");
}

function readFiles(entries) {
  let output = "";
  for (const entry of entries) {
    const absolute = path.join(__dirname, "..", entry);
    const stat = fs.statSync(absolute);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(absolute)) {
        output += readFiles([path.join(entry, name)]);
      }
    } else if (absolute.endsWith(".js")) {
      output += fs.readFileSync(absolute, "utf8");
    }
  }
  return output;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
