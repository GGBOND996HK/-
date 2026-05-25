import React, { useCallback, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const {
  TILE_ORDER,
  FLOWER_HONOR_TILES,
  formatTileLabel,
  tileToIndex,
} = require("../engine/mahjong");
const { GameSession } = require("../engine/gameSession");

import TilePicker from "./TilePicker";
import MahjongTable from "./MahjongTable";
import { ResultView } from "./ResultView";
import { ActionButton } from "./shared";

const INITIAL_HAND_SIZE = 13;
const FLOWER_TILE_INDICES = [...FLOWER_HONOR_TILES].map((tile) => tileToIndex(tile));
const OPPONENT_SEATS = [
  { key: "left", label: "上家" },
  { key: "opposite", label: "对家" },
  { key: "right", label: "下家" },
];

export default function GameView({ onExit }) {
  const sessionRef = useRef(null);
  const [phase, setPhase] = useState("setup");
  const [setupTiles, setSetupTiles] = useState([]);
  const [setupAvailability, setSetupAvailability] = useState(new Array(TILE_ORDER.length).fill(4));
  const [handTiles, setHandTiles] = useState([]);
  const [availability, setAvailability] = useState(new Array(TILE_ORDER.length).fill(4));
  const [result, setResult] = useState(null);
  const [turn, setTurn] = useState(0);
  const [wallEstimate, setWallEstimate] = useState(0);
  const [error, setError] = useState("");
  const [flowerCount, setFlowerCount] = useState(0);
  const [tableState, setTableState] = useState(null);
  const [activeOpponentSeat, setActiveOpponentSeat] = useState("left");

  const syncUI = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    setHandTiles(session.getHandTiles());
    setAvailability(session.getAvailability());
    setTurn(session.turn);
    setWallEstimate(session.getWallEstimate());
    setTableState(session.getTableState());
  }, []);

  const onSetupSelect = useCallback(
    (tileIndex) => {
      if (setupTiles.length >= INITIAL_HAND_SIZE) return;
      const nextTiles = [...setupTiles, tileIndex];
      const nextAvail = [...setupAvailability];
      nextAvail[tileIndex] -= 1;
      setSetupTiles(nextTiles);
      setSetupAvailability(nextAvail);
    },
    [setupTiles, setupAvailability]
  );

  const onSetupUndo = useCallback(() => {
    if (setupTiles.length === 0) return;
    const nextTiles = setupTiles.slice(0, -1);
    const removed = setupTiles[setupTiles.length - 1];
    const nextAvail = [...setupAvailability];
    nextAvail[removed] += 1;
    setSetupTiles(nextTiles);
    setSetupAvailability(nextAvail);
  }, [setupTiles, setupAvailability]);

  const onStartGame = useCallback(() => {
    const counts = new Array(TILE_ORDER.length).fill(0);
    for (const t of setupTiles) {
      counts[t] += 1;
    }
    const session = new GameSession(counts, [], flowerCount);
    sessionRef.current = session;
    syncUI();
    setPhase("draw");
    setError("");
  }, [setupTiles, flowerCount, syncUI]);

  const onDraw = useCallback(
    (tileIndex) => {
      try {
        const analysisResult = sessionRef.current.draw(tileIndex);
        setResult(analysisResult);
        syncUI();
        setPhase("discard");
        setError("");
      } catch (err) {
        setError(err.message);
      }
    },
    [syncUI]
  );

  const onDrawFlower = useCallback(() => {
    try {
      sessionRef.current.recordFlower(1, "draw");
      setResult(null);
      syncUI();
      setPhase("draw");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [syncUI]);

  const onDiscard = useCallback(
    (tileIndex) => {
      try {
        sessionRef.current.discard(tileIndex);
        setResult(null);
        syncUI();
        setPhase("opponent");
        setError("");
      } catch (err) {
        setError(err.message);
      }
    },
    [syncUI]
  );

  const onOpponentDiscard = useCallback(
    (tileIndex) => {
      try {
        sessionRef.current.recordOpponentDiscard(tileIndex, activeOpponentSeat);
        syncUI();
        setPhase("draw");
        setError("");
      } catch (err) {
        setError(err.message);
      }
    },
    [activeOpponentSeat, syncUI]
  );

  const onOpponentFlower = useCallback(() => {
    try {
      sessionRef.current.recordFlower(1, "opponent", activeOpponentSeat);
      syncUI();
      setPhase("opponent");
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [activeOpponentSeat, syncUI]);

  const onSkipOpponent = useCallback(() => {
    setPhase("draw");
    setError("");
  }, []);

  const onUndo = useCallback(() => {
    try {
      const log = sessionRef.current.turnLog;
      const lastEntry = log.length > 0 ? log[log.length - 1] : null;
      const lastType = lastEntry ? lastEntry.type : null;
      sessionRef.current.undo();
      syncUI();
      setResult(null);
      setError("");
      if (lastType === "discard") {
        setPhase("discard");
        setResult(sessionRef.current.analyze());
      } else if (lastType === "opponentDiscard") {
        setPhase("opponent");
      } else if (lastType === "draw") {
        setPhase("draw");
      } else if (lastType === "flower") {
        setPhase(lastEntry && lastEntry.source === "opponent" ? "opponent" : "draw");
      } else {
        const handCount = sessionRef.current.getHandCount();
        if (handCount % 3 === 2) {
          setPhase("discard");
          setResult(sessionRef.current.analyze());
        } else {
          setPhase("draw");
        }
      }
    } catch (err) {
      setError(err.message);
    }
  }, [syncUI]);

  const onRestart = useCallback(() => {
    sessionRef.current = null;
    setPhase("setup");
    setSetupTiles([]);
    setSetupAvailability(new Array(TILE_ORDER.length).fill(4));
    setHandTiles([]);
    setAvailability(new Array(TILE_ORDER.length).fill(4));
    setResult(null);
    setTurn(0);
    setWallEstimate(0);
    setError("");
    setFlowerCount(0);
    setTableState(null);
    setActiveOpponentSeat("left");
  }, []);

  const recommendedTile =
    result && result.recommendations && result.recommendations.length > 0
      ? result.recommendations[0].discard
      : null;

  const shanten =
    result && result.baseAnalysis ? result.baseAnalysis.shanten : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Status Bar */}
      {phase !== "setup" ? (
        <View style={styles.statusBar}>
          <StatusItem label="轮次" value={String(turn)} />
          <StatusItem label="手牌" value={String(handTiles.length)} />
          <StatusItem label="向听" value={shanten != null ? String(shanten) : "-"} />
          <StatusItem label="牌墙" value={`≈${wallEstimate}`} />
        </View>
      ) : null}

      {/* Phase indicator */}
      <View style={styles.phaseBar}>
        <Text style={styles.phaseText}>{PHASE_LABELS[phase]}</Text>
      </View>

      {phase !== "setup" ? (
        <MahjongTable
          phase={PHASE_LABELS[phase]}
          handTiles={handTiles}
          tableState={tableState}
          recommendedTile={recommendedTile}
          advisor={result}
          shanten={shanten}
          turn={turn}
          wallEstimate={wallEstimate}
          activeSeat={phase === "opponent" ? activeOpponentSeat : null}
          onDiscard={phase === "discard" ? onDiscard : undefined}
        />
      ) : null}

      {/* Error */}
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Setup Phase */}
      {phase === "setup" ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>选择起手牌（{setupTiles.length}/{INITIAL_HAND_SIZE}）</Text>

          {/* Flower count */}
          <View style={styles.flowerRow}>
            <Text style={styles.flowerLabel}>花牌数量：</Text>
            <TouchableOpacity
              style={styles.flowerBtn}
              onPress={() => setFlowerCount(Math.max(0, flowerCount - 1))}
            >
              <Text style={styles.flowerBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.flowerValue}>{flowerCount}</Text>
            <TouchableOpacity
              style={styles.flowerBtn}
              onPress={() => setFlowerCount(Math.min(8, flowerCount + 1))}
            >
              <Text style={styles.flowerBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <TilePicker
            onSelect={onSetupSelect}
            availability={setupAvailability}
            title="点选牌张"
            hiddenTileIndices={FLOWER_TILE_INDICES}
          />
          <Text style={styles.helperText}>
            中、发、白按你这个上海敲麻口径算花，不作为正常手牌录入，直接加到花牌数量里。
          </Text>

          {/* Selected tiles preview */}
          {setupTiles.length > 0 ? (
            <View style={styles.setupPreview}>
              <Text style={styles.previewLabel}>已选牌：</Text>
              <View style={styles.previewTiles}>
                {setupTiles.map((t, i) => (
                  <Text key={`${t}-${i}`} style={styles.previewTile}>
                    {formatTileLabel(TILE_ORDER[t])}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.buttonRow}>
            <ActionButton
              title="开始对局"
              onPress={onStartGame}
              primary
              disabled={setupTiles.length !== INITIAL_HAND_SIZE}
            />
            <ActionButton title="撤销一张" onPress={onSetupUndo} disabled={setupTiles.length === 0} />
          </View>
        </View>
      ) : null}

      {/* Draw Phase */}
      {phase === "draw" ? (
        <View style={styles.card}>
          <TilePicker
            onSelect={onDraw}
            availability={availability}
            title="摸到了什么牌？"
            hiddenTileIndices={FLOWER_TILE_INDICES}
          />
          <View style={[styles.buttonRow, { marginTop: 14 }]}>
            <ActionButton title="摸到花牌 / 中发白" onPress={onDrawFlower} primary />
          </View>
          <Text style={styles.helperText}>
            摸到花牌或中发白后，不会直接进手牌，而是记 1 花并继续补摸。
          </Text>
        </View>
      ) : null}

      {/* Discard Phase */}
      {phase === "discard" ? (
        <>
          {result ? <ResultView result={result} /> : null}
        </>
      ) : null}

      {/* Opponent Phase */}
      {phase === "opponent" ? (
        <View style={styles.card}>
          <SeatSelector
            activeSeat={activeOpponentSeat}
            onChange={setActiveOpponentSeat}
          />
          <TilePicker
            onSelect={onOpponentDiscard}
            availability={availability}
            title="对手打出了什么牌？（可选）"
            hiddenTileIndices={FLOWER_TILE_INDICES}
          />
          <View style={[styles.buttonRow, { marginTop: 14 }]}>
            <ActionButton title="对手补花 / 中发白" onPress={onOpponentFlower} />
            <ActionButton title="跳过，直接摸牌" onPress={onSkipOpponent} primary />
          </View>
          <Text style={styles.helperText}>
            对手普通摸牌是未知信息，不需要录；如果对手连补花，可以连续点“对手补花 / 中发白”。
          </Text>
        </View>
      ) : null}

      {/* Bottom Actions */}
      {phase !== "setup" ? (
        <View style={styles.buttonRow}>
          <ActionButton title="撤销" onPress={onUndo} />
          <ActionButton title="重新开局" onPress={onRestart} />
          <ActionButton title="退出对局" onPress={onExit} />
        </View>
      ) : (
        <View style={styles.buttonRow}>
          <ActionButton title="返回快照模式" onPress={onExit} />
        </View>
      )}
    </ScrollView>
  );
}

const PHASE_LABELS = {
  setup: "📋 起手牌录入",
  draw: "🀄 摸牌阶段",
  discard: "🎯 出牌阶段 — 请选择要打的牌",
  opponent: "👀 对手出牌阶段",
};

function StatusItem({ label, value }) {
  return (
    <View style={styles.statusItem}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}

function SeatSelector({ activeSeat, onChange }) {
  return (
    <View style={styles.seatSelector}>
      {OPPONENT_SEATS.map((seat) => {
        const active = activeSeat === seat.key;
        return (
          <TouchableOpacity
            key={seat.key}
            style={[styles.seatButton, active ? styles.seatButtonActive : null]}
            activeOpacity={0.82}
            onPress={() => onChange(seat.key)}
          >
            <Text style={[styles.seatButtonText, active ? styles.seatButtonTextActive : null]}>
              {seat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
    paddingBottom: 30,
  },
  statusBar: {
    flexDirection: "row",
    gap: 10,
  },
  statusItem: {
    flex: 1,
    backgroundColor: "#fff8ee",
    borderRadius: 16,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(180, 83, 9, 0.12)",
  },
  statusLabel: {
    color: "#74675b",
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 4,
  },
  statusValue: {
    color: "#1f2937",
    fontSize: 18,
    fontWeight: "800",
  },
  phaseBar: {
    backgroundColor: "#b45309",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  phaseText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  errorBox: {
    backgroundColor: "#fef1ef",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(185, 28, 28, 0.12)",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 14,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#fff8ee",
    borderRadius: 26,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(180, 83, 9, 0.12)",
    shadowColor: "#9a5b15",
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  cardTitle: {
    color: "#1f2937",
    fontSize: 21,
    fontWeight: "800",
    marginBottom: 14,
  },
  flowerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  flowerLabel: {
    color: "#3d342a",
    fontSize: 14,
    fontWeight: "700",
  },
  flowerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f4e5cc",
    alignItems: "center",
    justifyContent: "center",
  },
  flowerBtnText: {
    color: "#7c4708",
    fontSize: 18,
    fontWeight: "800",
  },
  flowerValue: {
    color: "#1f2937",
    fontSize: 18,
    fontWeight: "800",
    minWidth: 24,
    textAlign: "center",
  },
  setupPreview: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(180, 83, 9, 0.1)",
  },
  previewLabel: {
    color: "#74675b",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  previewTiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  previewTile: {
    backgroundColor: "#fff4d8",
    color: "#1f2937",
    fontSize: 16,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: "hidden",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(180, 83, 9, 0.1)",
    marginVertical: 14,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  helperText: {
    color: "#74675b",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  seatSelector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  seatButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#f4e5cc",
    borderWidth: 1,
    borderColor: "rgba(180, 83, 9, 0.14)",
  },
  seatButtonActive: {
    backgroundColor: "#1f6f5b",
    borderColor: "#1f6f5b",
  },
  seatButtonText: {
    color: "#7c4708",
    fontSize: 14,
    fontWeight: "800",
  },
  seatButtonTextActive: {
    color: "#fff",
  },
});
