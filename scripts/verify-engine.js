const { solveState } = require("../src/engine/mahjong");

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
