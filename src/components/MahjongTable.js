import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const { TILE_ORDER, formatTileLabel } = require("../engine/mahjong");

const SEAT_NAMES = {
  left: "上家",
  opposite: "对家",
  right: "下家",
};

export default function MahjongTable({
  phase,
  handTiles,
  tableState,
  recommendedTile,
  advisor,
  shanten,
  turn,
  wallEstimate,
  activeSeat,
  onDiscard,
}) {
  const opponents = tableState && tableState.opponents ? tableState.opponents : {};
  const self = tableState && tableState.self ? tableState.self : { discards: [], flowers: 0 };

  return (
    <View style={styles.shell}>
      <View style={styles.table}>
        <View style={styles.topSeat}>
          <SeatPanel
            seatKey="opposite"
            seat={opponents.opposite}
            active={activeSeat === "opposite"}
          />
        </View>

        <View style={styles.middleRow}>
          <SeatPanel seatKey="left" seat={opponents.left} active={activeSeat === "left"} side />

          <View style={styles.center}>
            <Text style={styles.phase}>{phase}</Text>
            <View style={styles.centerStats}>
              <Stat label="轮" value={String(turn)} />
              <Stat label="向听" value={shanten != null ? String(shanten) : "-"} />
              <Stat label="牌墙" value={`≈${wallEstimate}`} />
              <Stat label="花" value={String(self.flowers || 0)} />
            </View>
            <AdvisorHud advisor={advisor} />
            <River label="我的牌河" tiles={self.discards} />
          </View>

          <SeatPanel seatKey="right" seat={opponents.right} active={activeSeat === "right"} side />
        </View>

        <View style={styles.bottomSeat}>
          <Text style={styles.selfLabel}>我</Text>
          <HandRack
            tiles={handTiles}
            recommendedTile={recommendedTile}
            recommendations={advisor && advisor.recommendations ? advisor.recommendations : []}
            onDiscard={onDiscard}
          />
        </View>
      </View>
    </View>
  );
}

function AdvisorHud({ advisor }) {
  const recommendations = advisor && advisor.recommendations ? advisor.recommendations : [];
  if (recommendations.length === 0) {
    return (
      <View style={styles.hud}>
        <Text style={styles.hudTitle}>AI HUD</Text>
        <Text style={styles.hudEmpty}>等待摸牌或起手分析</Text>
      </View>
    );
  }

  const attack = recommendations.find((item) => item.policy && item.policy.attack) || recommendations[0];
  const stable = recommendations.find((item) => item.policy && item.policy.stable) || attack;

  return (
    <View style={styles.hud}>
      <View style={styles.hudHeader}>
        <Text style={styles.hudTitle}>AI HUD</Text>
        <Text style={styles.hudSource}>{advisor.advisor ? advisor.advisor.source : "本地引擎"}</Text>
      </View>
      <View style={styles.hudRows}>
        <AdviceLine label="进攻" item={attack} accent="#facc15" />
        <AdviceLine label="稳健" item={stable} accent="#38bdf8" />
      </View>
    </View>
  );
}

function AdviceLine({ label, item, accent }) {
  return (
    <View style={styles.adviceLine}>
      <View style={[styles.adviceDot, { backgroundColor: accent }]} />
      <Text style={styles.adviceLabel}>{label}</Text>
      <Text style={styles.adviceTile}>打 {formatTileLabel(item.discard)}</Text>
      <Text style={styles.adviceMeta}>
        进 {item.effectiveCount} / 安 {item.safetyScore}
      </Text>
    </View>
  );
}

function SeatPanel({ seatKey, seat = { discards: [], flowers: 0 }, active = false, side = false }) {
  return (
    <View style={[styles.seat, side ? styles.sideSeat : null, active ? styles.activeSeat : null]}>
      <View style={styles.seatHeader}>
        <Text style={styles.seatName}>{SEAT_NAMES[seatKey]}</Text>
        <Text style={styles.seatMeta}>花 {seat.flowers || 0}</Text>
      </View>
      <BackRack count={13} compact={side} />
      <River label="牌河" tiles={seat.discards || []} compact={side} />
    </View>
  );
}

function BackRack({ count, compact = false }) {
  const visible = compact ? 8 : 13;
  return (
    <View style={styles.backRack}>
      {Array.from({ length: visible }, (_, index) => (
        <View key={index} style={[styles.tileBack, compact ? styles.tileBackCompact : null]} />
      ))}
      {compact ? <Text style={styles.backCount}>{count}</Text> : null}
    </View>
  );
}

function HandRack({ tiles, recommendedTile, recommendations, onDiscard }) {
  if (!tiles || tiles.length === 0) {
    return (
      <View style={styles.emptyHand}>
        <Text style={styles.emptyText}>等待起手牌</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.handScroll}>
      <View style={styles.handRack}>
        {tiles.map((tileIndex, position) => {
          const tile = TILE_ORDER[tileIndex];
          const recommended = recommendedTile === tile;
          const tileAdvice = recommendations.find((item) => item.discard === tile);
          const safety = tileAdvice ? tileAdvice.safetyScore : 0;
          return (
            <TouchableOpacity
              key={`${tileIndex}-${position}`}
              activeOpacity={onDiscard ? 0.75 : 1}
              disabled={!onDiscard}
              onPress={onDiscard ? () => onDiscard(tileIndex) : undefined}
              style={[styles.handTile, recommended ? styles.recommendedTile : null]}
            >
              <Text style={[styles.handTileText, recommended ? styles.recommendedText : null]}>
                {formatTileLabel(tile)}
              </Text>
              {recommended ? <Text style={styles.recommendedMark}>推</Text> : null}
              {tileAdvice ? (
                <View style={styles.safetyTrack}>
                  <View
                    style={[
                      styles.safetyFill,
                      {
                        width: `${Math.max(8, Math.min(100, safety))}%`,
                        backgroundColor: safety >= 70 ? "#38bdf8" : safety >= 42 ? "#facc15" : "#f97316",
                      },
                    ]}
                  />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function River({ label, tiles, compact = false }) {
  return (
    <View style={styles.riverBlock}>
      <Text style={styles.riverLabel}>{label}</Text>
      <View style={styles.river}>
        {tiles && tiles.length > 0 ? (
          tiles.slice(-18).map((tileIndex, index) => (
            <View key={`${tileIndex}-${index}`} style={[styles.riverTile, compact ? styles.riverTileCompact : null]}>
              <Text style={[styles.riverText, compact ? styles.riverTextCompact : null]}>
                {formatTileLabel(TILE_ORDER[tileIndex])}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyRiver}>空</Text>
        )}
      </View>
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#143f34",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
  },
  table: {
    minHeight: 520,
    padding: 12,
    backgroundColor: "#195846",
    gap: 10,
  },
  topSeat: {
    alignItems: "center",
  },
  middleRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    flex: 1,
  },
  bottomSeat: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.13)",
  },
  selfLabel: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  seat: {
    width: "58%",
    maxWidth: 420,
    backgroundColor: "rgba(255, 255, 255, 0.09)",
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    gap: 8,
  },
  sideSeat: {
    width: 92,
    maxWidth: 92,
  },
  activeSeat: {
    borderColor: "#facc15",
    backgroundColor: "rgba(250, 204, 21, 0.14)",
  },
  seatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  seatName: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  seatMeta: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "700",
  },
  backRack: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    alignItems: "center",
  },
  tileBack: {
    width: 20,
    height: 28,
    borderRadius: 4,
    backgroundColor: "#243b6b",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.22)",
  },
  tileBackCompact: {
    width: 16,
    height: 24,
  },
  backCount: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "800",
  },
  center: {
    flex: 1,
    minHeight: 235,
    borderRadius: 8,
    backgroundColor: "rgba(10, 30, 25, 0.36)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 12,
    justifyContent: "center",
    gap: 12,
  },
  phase: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "900",
    textAlign: "center",
  },
  centerStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  stat: {
    minWidth: 58,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  statLabel: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "700",
  },
  statValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  hud: {
    borderRadius: 8,
    backgroundColor: "rgba(15, 23, 42, 0.48)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 10,
    gap: 8,
  },
  hudHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  hudTitle: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "900",
  },
  hudSource: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "700",
  },
  hudRows: {
    gap: 6,
  },
  hudEmpty: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "700",
  },
  adviceLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  adviceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  adviceLabel: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "800",
    minWidth: 28,
  },
  adviceTile: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    flex: 1,
  },
  adviceMeta: {
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: "800",
  },
  riverBlock: {
    gap: 5,
  },
  riverLabel: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "800",
  },
  river: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    minHeight: 24,
    alignItems: "center",
  },
  riverTile: {
    width: 30,
    height: 38,
    borderRadius: 5,
    backgroundColor: "#fffaf0",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  riverTileCompact: {
    width: 24,
    height: 32,
  },
  riverText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
  },
  riverTextCompact: {
    fontSize: 11,
  },
  emptyRiver: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  handScroll: {
    width: "100%",
  },
  handRack: {
    flexDirection: "row",
    gap: 6,
    paddingBottom: 2,
  },
  handTile: {
    width: 46,
    height: 64,
    borderRadius: 7,
    backgroundColor: "#fffaf0",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  recommendedTile: {
    borderColor: "#facc15",
    backgroundColor: "#fef3c7",
    borderWidth: 2,
    transform: [{ translateY: -6 }],
  },
  handTileText: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
  },
  recommendedText: {
    color: "#92400e",
  },
  recommendedMark: {
    color: "#92400e",
    fontSize: 10,
    fontWeight: "900",
    marginTop: 2,
  },
  safetyTrack: {
    width: "70%",
    height: 4,
    borderRadius: 4,
    backgroundColor: "rgba(15, 23, 42, 0.14)",
    marginTop: 3,
    overflow: "hidden",
  },
  safetyFill: {
    height: "100%",
    borderRadius: 4,
  },
  emptyHand: {
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "700",
  },
});
