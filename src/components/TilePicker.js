import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const { TILE_ORDER, formatTileLabel } = require("../engine/mahjong");

const ROWS = [
  { label: "万", start: 0, end: 9 },
  { label: "筒", start: 9, end: 18 },
  { label: "条", start: 18, end: 27 },
  { label: "字", start: 27, end: 34 },
];

export default function TilePicker({ onSelect, availability, title, hiddenTileIndices = [] }) {
  const hidden = new Set(hiddenTileIndices);
  return (
    <View style={styles.container}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {ROWS.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.rowLabel}>{row.label}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroll}>
            <View style={styles.rowTiles}>
              {Array.from({ length: row.end - row.start }, (_, i) => {
                const tileIndex = row.start + i;
                if (hidden.has(tileIndex)) {
                  return null;
                }
                const remaining = availability ? availability[tileIndex] : 4;
                const disabled = remaining <= 0;
                return (
                  <TouchableOpacity
                    key={tileIndex}
                    style={[styles.tile, disabled ? styles.tileDisabled : null]}
                    disabled={disabled}
                    activeOpacity={0.7}
                    onPress={() => onSelect(tileIndex)}
                  >
                    <Text style={[styles.tileText, disabled ? styles.tileTextDisabled : null]}>
                      {formatTileLabel(TILE_ORDER[tileIndex])}
                    </Text>
                    <Text style={[styles.tileBadge, disabled ? styles.tileBadgeDisabled : null]}>
                      {remaining}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ))}
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
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  rowLabel: {
    color: "#74675b",
    fontSize: 13,
    fontWeight: "700",
    width: 22,
    textAlign: "center",
  },
  rowScroll: {
    flex: 1,
  },
  rowTiles: {
    flexDirection: "row",
    gap: 6,
  },
  tile: {
    width: 48,
    height: 58,
    backgroundColor: "#fffdf6",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(180, 83, 9, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  tileDisabled: {
    backgroundColor: "#ece8e0",
    borderColor: "rgba(0, 0, 0, 0.06)",
  },
  tileText: {
    color: "#1f2937",
    fontSize: 18,
    fontWeight: "800",
  },
  tileTextDisabled: {
    color: "#b0a89e",
  },
  tileBadge: {
    color: "#b45309",
    fontSize: 10,
    fontWeight: "700",
  },
  tileBadgeDisabled: {
    color: "#b0a89e",
  },
});
