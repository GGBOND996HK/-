import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const { TILE_ORDER, formatTileLabel } = require("../engine/mahjong");

export default function HandDisplay({ tiles, recommendedTile, onDiscard }) {
  if (!tiles || tiles.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>暂无手牌</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>我的手牌{onDiscard ? "（点击打出）" : ""}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.hand}>
          {tiles.map((tileIndex, position) => {
            const isRecommended =
              recommendedTile != null && TILE_ORDER[tileIndex] === recommendedTile;
            return (
              <TouchableOpacity
                key={`${tileIndex}-${position}`}
                style={[styles.tile, isRecommended ? styles.tileRecommended : null]}
                activeOpacity={onDiscard ? 0.7 : 1}
                onPress={onDiscard ? () => onDiscard(tileIndex) : undefined}
                disabled={!onDiscard}
              >
                <Text style={[styles.tileText, isRecommended ? styles.tileTextRecommended : null]}>
                  {formatTileLabel(TILE_ORDER[tileIndex])}
                </Text>
                {isRecommended ? <Text style={styles.star}>★</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  title: {
    color: "#1f2937",
    fontSize: 16,
    fontWeight: "800",
  },
  hand: {
    flexDirection: "row",
    gap: 6,
    paddingVertical: 4,
  },
  tile: {
    width: 48,
    height: 64,
    backgroundColor: "#fffdf6",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(180, 83, 9, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  tileRecommended: {
    backgroundColor: "#fff4d8",
    borderColor: "#b45309",
    borderWidth: 2.5,
  },
  tileText: {
    color: "#1f2937",
    fontSize: 20,
    fontWeight: "800",
  },
  tileTextRecommended: {
    color: "#8a4f08",
  },
  star: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  empty: {
    padding: 20,
    alignItems: "center",
  },
  emptyText: {
    color: "#8b857b",
    fontSize: 14,
  },
});
