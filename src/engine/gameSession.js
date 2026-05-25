const {
  TILE_ORDER,
  solveState,
  expandCounts,
  tileToIndex,
  parseTiles,
  parseMelds,
  cloneCounts,
  sumCounts,
  isFlowerHonorIndex,
} = require("./mahjong");

const TOTAL_TILES = 144;
const FLOWER_TILES = 8;
const PLAYERS = 4;
const INITIAL_HAND = 13;

function countsToText(counts) {
  let result = "";
  const suitLetters = ["m", "p", "s"];

  for (let suit = 0; suit < 3; suit += 1) {
    let digits = "";
    for (let rank = 0; rank < 9; rank += 1) {
      const index = suit * 9 + rank;
      for (let copy = 0; copy < counts[index]; copy += 1) {
        digits += String(rank + 1);
      }
    }
    if (digits) {
      result += (result ? " " : "") + digits + suitLetters[suit];
    }
  }

  const honorKeys = ["E", "S", "W", "N", "C", "F", "B"];
  let honors = "";
  for (let h = 0; h < honorKeys.length; h += 1) {
    const index = 27 + h;
    for (let copy = 0; copy < counts[index]; copy += 1) {
      honors += honorKeys[h];
    }
  }
  if (honors) {
    result += (result ? " " : "") + honors;
  }

  return result;
}

function meldsToText(meldsList) {
  return meldsList.map((counts) => countsToText(counts)).join(" ");
}

function extractFlowerHonors(counts) {
  let flowers = 0;
  for (let i = 0; i < TILE_ORDER.length; i += 1) {
    if (isFlowerHonorIndex(i)) {
      flowers += counts[i];
      counts[i] = 0;
    }
  }
  return flowers;
}

class GameSession {
  constructor(initialHandCounts, initialMelds, flowerCount) {
    this.hand = cloneCounts(initialHandCounts);
    this.melds = initialMelds.map((m) => cloneCounts(m));
    this.dead = new Array(TILE_ORDER.length).fill(0);
    this.flowerCount = flowerCount || 0;
    this.flowerCount += extractFlowerHonors(this.hand);
    for (const meld of this.melds) {
      this.flowerCount += extractFlowerHonors(meld);
    }
    this.observedOpponentFlowerCount = 0;
    this.turnLog = [];
    this.turn = 0;
  }

  static fromText(handText, meldText, flowerCount) {
    const handCounts = parseTiles(handText || "");
    const meldGroups = parseMelds(meldText || "");
    return new GameSession(handCounts, meldGroups, flowerCount || 0);
  }

  _saveSnapshot() {
    return {
      hand: cloneCounts(this.hand),
      melds: this.melds.map((m) => cloneCounts(m)),
      dead: cloneCounts(this.dead),
      flowerCount: this.flowerCount,
      observedOpponentFlowerCount: this.observedOpponentFlowerCount,
      turn: this.turn,
    };
  }

  _restoreSnapshot(snapshot) {
    this.hand = cloneCounts(snapshot.hand);
    this.melds = snapshot.melds.map((m) => cloneCounts(m));
    this.dead = cloneCounts(snapshot.dead);
    this.flowerCount = snapshot.flowerCount;
    this.observedOpponentFlowerCount = snapshot.observedOpponentFlowerCount || 0;
    this.turn = snapshot.turn;
  }

  _validateTileCount(tileIndex) {
    const meldCount = this.melds.reduce((sum, m) => sum + m[tileIndex], 0);
    const total = this.hand[tileIndex] + meldCount + this.dead[tileIndex];
    if (total > 4) {
      throw new Error(
        `牌张数量冲突：${TILE_ORDER[tileIndex]} 总数超过 4 张（当前 ${total} 张）。`
      );
    }
  }

  draw(tileIndex) {
    const snapshot = this._saveSnapshot();
    this.hand[tileIndex] += 1;
    this._validateTileCount(tileIndex);
    this.turn += 1;
    this.turnLog.push({ type: "draw", tile: tileIndex, snapshot });
    return this.analyze();
  }

  discard(tileIndex) {
    if (this.hand[tileIndex] <= 0) {
      throw new Error(`手中没有 ${TILE_ORDER[tileIndex]}，无法打出。`);
    }
    const snapshot = this._saveSnapshot();
    this.hand[tileIndex] -= 1;
    this.dead[tileIndex] += 1;
    this.turnLog.push({ type: "discard", tile: tileIndex, snapshot });
  }

  recordOpponentDiscard(tileIndex, seat = "left") {
    if (isFlowerHonorIndex(tileIndex)) {
      this.recordFlower(1, "opponent", seat);
      return;
    }
    const snapshot = this._saveSnapshot();
    this.dead[tileIndex] += 1;
    this._validateTileCount(tileIndex);
    this.turnLog.push({ type: "opponentDiscard", tile: tileIndex, seat, snapshot });
  }

  recordFlower(count = 1, source = "draw", seat = "self") {
    if (count <= 0) {
      return;
    }
    const snapshot = this._saveSnapshot();
    if (source === "opponent") {
      this.observedOpponentFlowerCount += count;
    } else {
      this.flowerCount += count;
    }
    this.turnLog.push({ type: "flower", count, source, seat, snapshot });
  }

  recordMeld(meldCounts, isMyMeld) {
    const snapshot = this._saveSnapshot();
    if (isMyMeld) {
      for (let i = 0; i < TILE_ORDER.length; i += 1) {
        if (meldCounts[i] > 0) {
          if (this.hand[i] < meldCounts[i]) {
            throw new Error(`手中 ${TILE_ORDER[i]} 不足以组成明牌组。`);
          }
          this.hand[i] -= meldCounts[i];
        }
      }
      this.melds.push(cloneCounts(meldCounts));
    } else {
      for (let i = 0; i < TILE_ORDER.length; i += 1) {
        this.dead[i] += meldCounts[i];
      }
      for (let i = 0; i < TILE_ORDER.length; i += 1) {
        if (meldCounts[i] > 0) {
          this._validateTileCount(i);
        }
      }
    }
    this.turnLog.push({ type: "meld", isMyMeld, snapshot });
  }

  undo() {
    if (this.turnLog.length === 0) {
      throw new Error("没有可以撤销的操作。");
    }
    const entry = this.turnLog.pop();
    this._restoreSnapshot(entry.snapshot);
  }

  getSnapshot() {
    return {
      handText: countsToText(this.hand),
      meldText: meldsToText(this.melds),
      deadText: countsToText(this.dead),
      flowerCount: this.flowerCount,
    };
  }

  analyze() {
    const snap = this.getSnapshot();
    return solveState(snap);
  }

  getAvailability() {
    const meldCounts = new Array(TILE_ORDER.length).fill(0);
    for (const m of this.melds) {
      for (let i = 0; i < TILE_ORDER.length; i += 1) {
        meldCounts[i] += m[i];
      }
    }
    return TILE_ORDER.map(
      (_, i) => 4 - this.hand[i] - meldCounts[i] - this.dead[i]
    );
  }

  getHandTiles() {
    return expandCounts(this.hand);
  }

  getHandCount() {
    return sumCounts(this.hand);
  }

  getTableState() {
    const opponents = {
      left: { discards: [], flowers: 0 },
      opposite: { discards: [], flowers: 0 },
      right: { discards: [], flowers: 0 },
    };
    const self = { discards: [], flowers: this.flowerCount };

    for (const entry of this.turnLog) {
      if (entry.type === "discard") {
        self.discards.push(entry.tile);
      } else if (entry.type === "opponentDiscard") {
        const seat = opponents[entry.seat] ? entry.seat : "left";
        opponents[seat].discards.push(entry.tile);
      } else if (entry.type === "flower" && entry.source === "opponent") {
        const seat = opponents[entry.seat] ? entry.seat : "left";
        opponents[seat].flowers += entry.count || 1;
      }
    }

    return {
      self,
      opponents,
    };
  }

  getWallEstimate() {
    const knownTiles =
      sumCounts(this.hand) +
      this.melds.reduce((sum, m) => sum + sumCounts(m), 0) +
      sumCounts(this.dead) +
      this.flowerCount +
      this.observedOpponentFlowerCount;
    return Math.max(0, TOTAL_TILES - FLOWER_TILES - (PLAYERS - 1) * INITIAL_HAND - knownTiles);
  }
}

module.exports = { GameSession, countsToText, meldsToText };
