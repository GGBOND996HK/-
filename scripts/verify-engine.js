const { solveState } = require("../src/engine/mahjong");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

const cases = [
  {
    name: "有明牌时的出牌推荐",
    input: {
      handText: "123m 456p SSBBC",
      meldText: "EEE",
      deadText: "1m 1m 9s C 789p",
      flowerCount: 0,
    },
  },
  {
    name: "闭门手进张推荐",
    input: {
      handText: "123m 456m 789m EECC",
      meldText: "",
      deadText: "1m 2m 3m N",
      flowerCount: 0,
    },
  },
];

for (const item of cases) {
  const result = solveState(item.input);
  console.log(`\n[${item.name}]`);
  console.log(`shanten=${result.baseAnalysis.shanten}`);
  console.log(`flowers=${result.flowerCount}`);
  if (result.recommendations.length > 0) {
    console.log(
      `bestDiscard=${result.recommendations[0].discard}, waits=${result.recommendations[0].waitCount}, effective=${result.recommendations[0].effectiveCount}`
    );
  } else {
    console.log(`bestDraws=${result.bestDraws.slice(0, 3).map((it) => it.tile).join(",")}`);
  }
}

console.log("\n[规则回归]");

const openHonor = solveState({
  handText: "11122233344m",
  meldText: "EEE",
  deadText: "",
  flowerCount: 0,
});
assert(!openHonor.baseAnalysis.patterns.includes("清一色"), "明牌 EEE 时不能判定清一色");
assert(!openHonor.baseAnalysis.patterns.includes("清碰"), "明牌 EEE 时不能判定清碰");

const openNumber = solveState({
  handText: "EEESSSWWWNN",
  meldText: "123m",
  deadText: "",
  flowerCount: 0,
});
assert(!openNumber.baseAnalysis.patterns.includes("字一色"), "明牌 123m 时不能判定字一色");

let invalidMeldCaught = false;
try {
  solveState({
    handText: "11122233344m",
    meldText: "12m3p",
    deadText: "",
    flowerCount: 0,
  });
} catch (error) {
  invalidMeldCaught = true;
}
assert(invalidMeldCaught, "非法明牌 12m3p 必须报错");

const tenpai = solveState({
  handText: "1112223334445m",
  meldText: "",
  deadText: "",
  flowerCount: 0,
});
assert(tenpai.readiness.key === "tenpai", "13 张 0 向显示为听牌");

const completeOrReady = solveState({
  handText: "11122233344455m",
  meldText: "",
  deadText: "",
  flowerCount: 0,
});
assert(completeOrReady.readiness.key === "ready-or-complete", "14 张成型牌显示为可胡或可保持听牌");
assert(completeOrReady.tileEfficiency.enabled, "外部 JS 牌效库可作为基础向听参考");
assert(
  completeOrReady.recommendations.some((item) => item.tileEfficiency),
  "出牌候选包含外部牌效参考信息"
);
