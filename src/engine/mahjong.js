const TILE_ORDER = [
  ...Array.from({ length: 9 }, (_, index) => `${index + 1}m`),
  ...Array.from({ length: 9 }, (_, index) => `${index + 1}p`),
  ...Array.from({ length: 9 }, (_, index) => `${index + 1}s`),
  "E",
  "S",
  "W",
  "N",
  "C",
  "F",
  "B",
];

const HONOR_INDEX = new Set([27, 28, 29, 30, 31, 32, 33]);
const FLOWER_HONOR_TILES = new Set(["C", "F", "B"]);

const PATTERNS = [
  { key: "allPungs", name: "碰碰胡", type: "global", allowSequence: false },
  { key: "halfFlush", name: "混一色", type: "halfFlush", allowSequence: true },
  { key: "fullFlush", name: "清一色", type: "fullFlush", allowSequence: true },
  { key: "purePungs", name: "清碰", type: "fullFlush", allowSequence: false },
  { key: "allHonors", name: "字一色", type: "allHonors", allowSequence: false },
];

const PATTERN_VALUES = {
  碰碰胡: 5,
  混一色: 6,
  清一色: 8,
  清碰: 10,
  字一色: 10,
};

const CHINESE_MAP = new Map([
  ["万", "m"],
  ["萬", "m"],
  ["筒", "p"],
  ["桶", "p"],
  ["饼", "p"],
  ["餅", "p"],
  ["条", "s"],
  ["條", "s"],
  ["索", "s"],
  ["东", "E"],
  ["東", "E"],
  ["南", "S"],
  ["西", "W"],
  ["北", "N"],
  ["中", "C"],
  ["发", "F"],
  ["發", "F"],
  ["白", "B"],
]);

const {
  calculateTileEfficiencyReference,
  describeDiscardEfficiency,
} = require("./tileEfficiency");

function solveState({ handText, meldText, deadText, flowerCount }) {
  const handCounts = parseTiles(handText);
  const meldGroups = parseMelds(meldText);
  const deadCounts = parseTiles(deadText);
  const meldCounts = countMeldTiles(meldGroups);
  const extractedFlowerCount =
    stripFlowerHonors(handCounts) +
    stripFlowerHonors(deadCounts) +
    stripFlowerHonors(meldCounts);
  const concealedCount = sumCounts(handCounts);
  const openMeldCount = meldGroups.length;

  if (openMeldCount > 4) {
    throw new Error("明牌组最多只能填 4 组。");
  }

  if (concealedCount === 0) {
    throw new Error("请至少输入暗手牌。");
  }

  for (let index = 0; index < TILE_ORDER.length; index += 1) {
    const used = handCounts[index] + meldCounts[index] + deadCounts[index];
    if (used > 4) {
      throw new Error(`牌张数量冲突：${formatTileLabel(TILE_ORDER[index])} 总数超过 4 张。`);
    }
  }

  const availability = TILE_ORDER.map(
    (_, index) => 4 - handCounts[index] - meldCounts[index] - deadCounts[index]
  );
  for (const tile of FLOWER_HONOR_TILES) {
    availability[tileToIndex(tile)] = 0;
  }
  const baseAnalysis = analyzeHand(handCounts, meldGroups);
  const mode = concealedCount % 3 === 2 ? "discard14" : "wait13";
  const safetyContext = createSafetyContext(deadCounts);
  const tileEfficiency = calculateTileEfficiencyReference({
    handCounts,
    rule: "HK",
  });

  return {
    concealedCount,
    openMeldCount,
    flowerCount: Number(flowerCount || 0) + extractedFlowerCount,
    baseAnalysis,
    readiness: describeReadiness(baseAnalysis, mode),
    safetyContext,
    advisor: {
      source: "本地上海敲麻引擎",
      mode,
    },
    tileEfficiency,
    recommendations:
      mode === "discard14"
        ? rankDiscards(handCounts, meldGroups, availability, deadCounts, safetyContext, tileEfficiency)
        : [],
    bestDraws:
      mode === "discard14" ? [] : listImprovingDraws(handCounts, meldGroups, availability),
  };
}

function analyzeHand(handCounts, meldGroupsOrCount = 0) {
  const meldContext = createMeldContext(meldGroupsOrCount);
  let best = { shanten: Number.POSITIVE_INFINITY, patterns: [], winning: [] };
  for (const pattern of PATTERNS) {
    const stats = evaluatePattern(handCounts, meldContext, pattern);
    if (stats.shanten < best.shanten) {
      best = {
        shanten: stats.shanten,
        patterns: [pattern.name],
        winning: stats.shanten === 0 ? [pattern.name] : [],
      };
    } else if (stats.shanten === best.shanten) {
      best.patterns.push(pattern.name);
      if (stats.shanten === 0) {
        best.winning.push(pattern.name);
      }
    }
  }

  best.patterns = dedupe(best.patterns);
  best.winning = dedupe(best.winning);
  return best;
}

function rankDiscards(
  handCounts,
  meldGroupsOrCount,
  availability,
  deadCounts,
  safetyContext,
  tileEfficiency
) {
  const analyze = createCachedAnalyzer(meldGroupsOrCount);
  const currentTiles = expandCounts(handCounts);
  const uniqueTiles = [...new Set(currentTiles)];
  const recommendations = [];
  const context = safetyContext || createSafetyContext(deadCounts);

  for (const tileIndex of uniqueTiles) {
    const nextHand = cloneCounts(handCounts);
    nextHand[tileIndex] -= 1;

    const state = analyze(nextHand);
    const waits = [];
    let waitCount = 0;
    let effectiveCount = 0;
    let immediateWinWeight = 0;
    let lookaheadWeight = 0;
    let lookaheadTotal = 0;
    const improvingTiles = [];
    const drawPlans = [];

    for (let draw = 0; draw < TILE_ORDER.length; draw += 1) {
      if (availability[draw] <= 0 || isFlowerHonorIndex(draw)) {
        continue;
      }

      const drawnHand = cloneCounts(nextHand);
      drawnHand[draw] += 1;
      const drawnState = analyze(drawnHand);
      const drawWeight = availability[draw];

      if (drawnState.shanten === 0) {
        waits.push(`${TILE_ORDER[draw]}(${availability[draw]})`);
        waitCount += drawWeight;
        immediateWinWeight += drawWeight * scoreState(drawnState);
      }

      if (drawnState.shanten < state.shanten) {
        improvingTiles.push(`${TILE_ORDER[draw]}(${availability[draw]})`);
        effectiveCount += drawWeight;
      }

      const bestAfterDraw = pickBestDiscardAfterDraw(drawnHand, analyze);
      if (bestAfterDraw) {
        const weightedScore = bestAfterDraw.stateScore * drawWeight;
        lookaheadTotal += drawWeight;
        lookaheadWeight += weightedScore;
        if (drawnState.shanten < state.shanten || bestAfterDraw.state.shanten <= state.shanten) {
          drawPlans.push({
            tile: TILE_ORDER[draw],
            remaining: drawWeight,
            discard: bestAfterDraw.discard,
            shanten: bestAfterDraw.state.shanten,
            stateScore: bestAfterDraw.stateScore,
          });
        }
      }
    }

    drawPlans.sort((left, right) => {
      if (left.shanten !== right.shanten) {
        return left.shanten - right.shanten;
      }
      if (left.remaining !== right.remaining) {
        return right.remaining - left.remaining;
      }
      return right.stateScore - left.stateScore;
    });

    const patternValue = estimatePatternValue(state);
    const safetyScore = estimateSafety(tileIndex, availability, deadCounts);
    const lookaheadScore = lookaheadTotal > 0 ? lookaheadWeight / lookaheadTotal : 0;
    const immediateScore = waitCount > 0 ? immediateWinWeight / waitCount : 0;
    const attackScore =
      scoreState(state) * 100 +
      waitCount * 85 +
      effectiveCount * 18 +
      patternValue * 25 +
      lookaheadScore * 0.18 +
      immediateScore * 0.12;
    const balancedScore = attackScore + safetyScore * context.defensiveWeight;
    const totalScore = balancedScore;

    recommendations.push({
      discard: TILE_ORDER[tileIndex],
      state,
      waits,
      waitCount,
      improvingTiles,
      effectiveCount,
      drawPlans,
      patternValue,
      safetyScore,
      attackScore: Math.round(attackScore),
      balancedScore: Math.round(balancedScore),
      lookaheadScore: Math.round(lookaheadScore),
      totalScore: Math.round(totalScore),
      tileEfficiency: describeDiscardEfficiency(tileEfficiency, TILE_ORDER[tileIndex]),
      score: [totalScore, waitCount > 0 ? 1 : 0, -state.shanten, waitCount, effectiveCount],
      safetyNote: context.note,
    });
  }

  recommendations.sort((left, right) => compareScores(right.score, left.score));
  annotatePolicyPicks(recommendations);
  return recommendations;
}

function listImprovingDraws(handCounts, meldGroupsOrCount, availability) {
  const current = analyzeHand(handCounts, meldGroupsOrCount);
  const options = [];

  for (let tileIndex = 0; tileIndex < TILE_ORDER.length; tileIndex += 1) {
    if (availability[tileIndex] <= 0 || isFlowerHonorIndex(tileIndex)) {
      continue;
    }

    const nextHand = cloneCounts(handCounts);
    nextHand[tileIndex] += 1;
    const nextState = analyzeHand(nextHand, meldGroupsOrCount);
    if (nextState.shanten < current.shanten || nextState.shanten === 0) {
      options.push({
        tile: TILE_ORDER[tileIndex],
        remaining: availability[tileIndex],
        nextState,
      });
    }
  }

  options.sort((left, right) => {
    if (left.nextState.shanten !== right.nextState.shanten) {
      return left.nextState.shanten - right.nextState.shanten;
    }
    return right.remaining - left.remaining;
  });

  return options;
}

function evaluatePattern(handCounts, meldContext, pattern) {
  const filtered = filterCountsForPattern(handCounts, pattern, meldContext);
  if (!filtered.allowed) {
    return { shanten: Number.POSITIVE_INFINITY };
  }

  const meldsNeeded = 4 - meldContext.count;
  if (meldsNeeded < 0) {
    return { shanten: Number.POSITIVE_INFINITY };
  }

  const missingTiles = minAdditionsToStructure(
    filtered.counts,
    meldsNeeded,
    true,
    pattern.allowSequence
  );

  return { shanten: Math.max(0, missingTiles - 1) };
}

function createCachedAnalyzer(meldGroupsOrCount) {
  const cache = new Map();
  return (counts) => {
    const key = counts.join(",");
    if (!cache.has(key)) {
      cache.set(key, analyzeHand(counts, meldGroupsOrCount));
    }
    return cache.get(key);
  };
}

function pickBestDiscardAfterDraw(drawnHand, analyze) {
  let best = null;
  const tiles = [...new Set(expandCounts(drawnHand))];
  for (const discardIndex of tiles) {
    if (isFlowerHonorIndex(discardIndex)) {
      continue;
    }
    const afterDiscard = cloneCounts(drawnHand);
    afterDiscard[discardIndex] -= 1;
    const state = analyze(afterDiscard);
    const stateScore = scoreState(state);
    if (
      !best ||
      stateScore > best.stateScore ||
      (stateScore === best.stateScore && estimatePatternValue(state) > estimatePatternValue(best.state))
    ) {
      best = {
        discard: TILE_ORDER[discardIndex],
        state,
        stateScore,
      };
    }
  }
  return best;
}

function scoreState(state) {
  if (!Number.isFinite(state.shanten)) {
    return -1000;
  }
  return (6 - state.shanten) * 100 + estimatePatternValue(state) * 12;
}

function estimatePatternValue(state) {
  if (!state || !state.patterns || state.patterns.length === 0) {
    return 0;
  }
  return Math.max(...state.patterns.map((name) => PATTERN_VALUES[name] || 0));
}

function estimateSafety(tileIndex, availability, deadCounts) {
  const seenOutsideHand = deadCounts[tileIndex] || 0;
  const unseen = Math.max(0, availability[tileIndex] || 0);
  const honorBonus = tileIndex >= 27 ? 12 : 0;
  const terminalBonus = tileIndex < 27 && tileIndex % 9 !== 0 && tileIndex % 9 !== 8 ? 0 : 6;
  return Math.max(0, Math.min(100, seenOutsideHand * 22 + (4 - unseen) * 12 + honorBonus + terminalBonus));
}

function annotatePolicyPicks(recommendations) {
  if (recommendations.length === 0) {
    return;
  }
  const attack = recommendations
    .slice()
    .sort((left, right) => {
      if (left.attackScore !== right.attackScore) {
        return right.attackScore - left.attackScore;
      }
      return right.effectiveCount - left.effectiveCount;
    })[0];
  attack.policy = { ...(attack.policy || {}), attack: true };

  const stable = recommendations[0];

  if (stable) {
    stable.policy = { ...(stable.policy || {}), stable: true };
  }
}

function filterCountsForPattern(handCounts, pattern, meldContext) {
  const counts = cloneCounts(handCounts);
  const combinedCounts = addCounts(counts, meldContext.counts);

  if (!pattern.allowSequence && meldContext.types.some((type) => type === "sequence")) {
    return { allowed: false, counts };
  }

  if (pattern.type === "global") {
    return { allowed: true, counts };
  }

  if (pattern.type === "allHonors") {
    for (let index = 0; index < 27; index += 1) {
      if (combinedCounts[index] > 0) {
        return { allowed: false, counts };
      }
    }
    return { allowed: true, counts };
  }

  const suitCandidates = [0, 1, 2].filter((suit) => suitUsage(combinedCounts, suit) > 0);
  if (suitCandidates.length > 1) {
    return { allowed: false, counts };
  }

  const chosenSuit = suitCandidates[0] ?? 0;
  for (let index = 0; index < 27; index += 1) {
    const suit = Math.floor(index / 9);
    if (suit !== chosenSuit && combinedCounts[index] > 0) {
      return { allowed: false, counts };
    }
  }

  if (pattern.type === "fullFlush") {
    for (let index = 27; index < TILE_ORDER.length; index += 1) {
      if (combinedCounts[index] > 0) {
        return { allowed: false, counts };
      }
    }
  }

  return { allowed: true, counts };
}

function createMeldContext(meldGroupsOrCount) {
  if (Array.isArray(meldGroupsOrCount)) {
    const groups = meldGroupsOrCount.map((group) => cloneCounts(group));
    return {
      groups,
      count: groups.length,
      counts: countMeldTiles(groups),
      types: groups.map((group) => classifyMeld(group)),
    };
  }

  return {
    groups: [],
    count: Number(meldGroupsOrCount || 0),
    counts: new Array(TILE_ORDER.length).fill(0),
    types: [],
  };
}

function classifyMeld(counts) {
  const tiles = expandCounts(counts);
  const uniqueTiles = [...new Set(tiles)];

  if (tiles.some(isFlowerHonorIndex)) {
    throw new Error("中、发、白按当前口径算花，不能作为明牌组。");
  }

  if ((tiles.length === 3 || tiles.length === 4) && uniqueTiles.length === 1) {
    return tiles.length === 4 ? "kong" : "pung";
  }

  if (tiles.length === 3 && isSequenceTiles(tiles)) {
    return "sequence";
  }

  throw new Error(`明牌组 ${tiles.map((index) => TILE_ORDER[index]).join("")} 不是合法顺子、刻子或杠。`);
}

function isSequenceTiles(tiles) {
  const sorted = tiles.slice().sort((left, right) => left - right);
  if (sorted.some((index) => index >= 27)) {
    return false;
  }
  if (new Set(sorted).size !== 3) {
    return false;
  }
  return (
    Math.floor(sorted[0] / 9) === Math.floor(sorted[1] / 9) &&
    Math.floor(sorted[1] / 9) === Math.floor(sorted[2] / 9) &&
    sorted[1] === sorted[0] + 1 &&
    sorted[2] === sorted[1] + 1
  );
}

function createSafetyContext(deadCounts) {
  const knownDeadCount = sumCounts(deadCounts || []);
  const hasMeaningfulRiver = knownDeadCount > 0;
  return {
    knownDeadCount,
    defensiveWeight: hasMeaningfulRiver ? 9 : 3,
    note: hasMeaningfulRiver ? "" : "防守信息不足，稳健评分已降低安全权重。",
  };
}

function describeReadiness(baseAnalysis, mode) {
  if (!baseAnalysis || baseAnalysis.shanten > 0) {
    return {
      key: "building",
      summary: `当前离最近可胡目标还差 ${baseAnalysis ? baseAnalysis.shanten : "-"} 向。`,
    };
  }

  if (mode === "wait13") {
    return {
      key: "tenpai",
      summary: "当前是听牌状态，等有效进张胡牌。",
    };
  }

  return {
    key: "ready-or-complete",
    summary: "当前摸牌后已到可胡或可保持听牌的牌面。",
  };
}

function suitUsage(counts, suit) {
  const start = suit * 9;
  let total = 0;
  for (let index = start; index < start + 9; index += 1) {
    total += counts[index];
  }
  return total;
}

function minAdditionsToStructure(counts, meldsNeeded, pairNeeded, allowSequence) {
  const cache = new Map();

  function dfs(localCounts, meldsLeft, pairLeft) {
    if (meldsLeft === 0 && !pairLeft) {
      return 0;
    }

    const key = `${localCounts.join(",")}|${meldsLeft}|${pairLeft ? 1 : 0}|${
      allowSequence ? 1 : 0
    }`;
    if (cache.has(key)) {
      return cache.get(key);
    }

    let first = -1;
    for (let index = 0; index < localCounts.length; index += 1) {
      if (localCounts[index] > 0) {
        first = index;
        break;
      }
    }

    if (first === -1) {
      const emptyCost = meldsLeft * 3 + (pairLeft ? 2 : 0);
      cache.set(key, emptyCost);
      return emptyCost;
    }

    let best = Number.POSITIVE_INFINITY;

    const skipped = cloneCounts(localCounts);
    skipped[first] -= 1;
    best = Math.min(best, dfs(skipped, meldsLeft, pairLeft));

    if (pairLeft) {
      const used = Math.min(2, localCounts[first]);
      const next = cloneCounts(localCounts);
      next[first] -= used;
      best = Math.min(best, 2 - used + dfs(next, meldsLeft, false));
    }

    if (meldsLeft > 0) {
      const tripUsed = Math.min(3, localCounts[first]);
      const nextTrip = cloneCounts(localCounts);
      nextTrip[first] -= tripUsed;
      best = Math.min(best, 3 - tripUsed + dfs(nextTrip, meldsLeft - 1, pairLeft));

      if (allowSequence && canStartSequence(first)) {
        const needed = [first, first + 1, first + 2];
        const nextSeq = cloneCounts(localCounts);
        let missing = 0;
        for (const index of needed) {
          if (nextSeq[index] > 0) {
            nextSeq[index] -= 1;
          } else {
            missing += 1;
          }
        }
        best = Math.min(best, missing + dfs(nextSeq, meldsLeft - 1, pairLeft));
      }
    }

    cache.set(key, best);
    return best;
  }

  return dfs(counts, meldsNeeded, pairNeeded);
}

function canStartSequence(index) {
  if (HONOR_INDEX.has(index) || index >= 27) {
    return false;
  }
  return index % 9 <= 6;
}

function parseTiles(text) {
  const counts = Array(TILE_ORDER.length).fill(0);
  const normalized = normalizeInput(text);

  let buffer = "";
  for (const char of normalized) {
    if (/\d/.test(char)) {
      buffer += char;
      continue;
    }

    if ("mps".includes(char) || (buffer && "MPS".includes(char))) {
      if (!buffer) {
        throw new Error(`花色 ${char} 前面缺少数字。`);
      }
      for (const digit of buffer) {
        const value = Number(digit);
        if (value < 1 || value > 9) {
          throw new Error(`非法数字牌：${digit}${char}`);
        }
        counts[tileToIndex(`${value}${char.toLowerCase()}`)] += 1;
      }
      buffer = "";
      continue;
    }

    if ("ESWNCFBP".includes(char)) {
      if (buffer) {
        throw new Error(`字牌 ${char} 前面不能直接带数字。`);
      }
      counts[tileToIndex(char === "P" ? "B" : char)] += 1;
      continue;
    }

    if (char === " ") {
      if (buffer) {
        throw new Error(`数字 ${buffer} 后面缺少花色。`);
      }
      continue;
    }

    throw new Error(`无法识别的字符：${char}`);
  }

  if (buffer) {
    throw new Error(`数字 ${buffer} 后面缺少花色。`);
  }

  return counts;
}

function parseMelds(text) {
  const normalized = normalizeInput(text).trim();
  if (!normalized) {
    return [];
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  return tokens.map((token) => {
    const counts = parseTiles(token);
    const tiles = expandCounts(counts);
    if (tiles.length < 3 || tiles.length > 4) {
      throw new Error(`明牌组 ${token} 必须是 3 张或 4 张。`);
    }
    classifyMeld(counts);
    return counts;
  });
}

function countMeldTiles(groups) {
  const counts = Array(TILE_ORDER.length).fill(0);
  for (const group of groups) {
    for (let index = 0; index < TILE_ORDER.length; index += 1) {
      counts[index] += group[index];
    }
  }
  return counts;
}

function normalizeInput(text) {
  const source = (text || "")
    .replace(/[，、；;｜|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let normalized = "";
  for (const char of source) {
    normalized += CHINESE_MAP.get(char) ?? char;
  }
  return normalized;
}

function stripFlowerHonors(counts) {
  let flowerCount = 0;
  for (const tile of FLOWER_HONOR_TILES) {
    const index = tileToIndex(tile);
    flowerCount += counts[index];
    counts[index] = 0;
  }
  return flowerCount;
}

function isFlowerHonorIndex(index) {
  return FLOWER_HONOR_TILES.has(TILE_ORDER[index]);
}

function tileToIndex(tile) {
  const index = TILE_ORDER.indexOf(tile);
  if (index === -1) {
    throw new Error(`无法识别的牌：${tile}`);
  }
  return index;
}

function expandCounts(counts) {
  const tiles = [];
  for (let index = 0; index < counts.length; index += 1) {
    for (let copy = 0; copy < counts[index]; copy += 1) {
      tiles.push(index);
    }
  }
  return tiles;
}

function cloneCounts(counts) {
  return counts.slice();
}

function addCounts(left, right) {
  return left.map((value, index) => value + (right[index] || 0));
}

function sumCounts(counts) {
  return counts.reduce((sum, value) => sum + value, 0);
}

function dedupe(items) {
  return [...new Set(items)];
}

function compareScores(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] - right[index];
    }
  }
  return 0;
}

function formatTileLabel(tile) {
  if (!tile) {
    return "";
  }
  if (tile.endsWith("m")) {
    return `${tile[0]}万`;
  }
  if (tile.endsWith("p")) {
    return `${tile[0]}筒`;
  }
  if (tile.endsWith("s")) {
    return `${tile[0]}条`;
  }

  const mapping = {
    E: "东",
    S: "南",
    W: "西",
    N: "北",
    C: "中",
    F: "发",
    B: "白",
  };
  return mapping[tile] || tile;
}

module.exports = {
  TILE_ORDER,
  solveState,
  analyzeHand,
  parseTiles,
  parseMelds,
  formatTileLabel,
  expandCounts,
  tileToIndex,
  cloneCounts,
  sumCounts,
  FLOWER_HONOR_TILES,
  isFlowerHonorIndex,
};
