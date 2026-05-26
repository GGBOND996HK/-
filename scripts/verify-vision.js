const fs = require("fs");
const path = require("path");

const {
  runCloudVerification,
  runLocalRecommendation,
} = require("../src/vision/recommendationPipeline");
const { recognitionSchema, extractOutputText } = require("../server/visionProxy");
const { mapCamerashClass } = require("../src/vision/camerashDataset");

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

  const cloudConflict = await runCloudVerification(
    {},
    {},
    HIGH_CONFIDENCE,
    {
      cloudRecognizer: async () => ({
        ...HIGH_CONFIDENCE,
        drawnTile: "4m",
        source: "cloud-test",
      }),
    }
  );
  assert(cloudConflict.status === "conflict", "本地与云端识别冲突时提示重拍确认");

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
