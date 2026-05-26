import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";

const { solveState } = require("./src/engine/mahjong");

import { Field, ActionButton } from "./src/components/shared";
import { ResultView } from "./src/components/ResultView";
import GameView from "./src/components/GameView";
import PhotoAdvisorView from "./src/components/PhotoAdvisorView";

const PRESET = {
  handText: "123m 456p SSBBC",
  meldText: "EEE",
  deadText: "1m 1m 9s C 789p",
  flowerCount: "0",
};

export default function App() {
  const [mode, setMode] = useState("snapshot"); // "snapshot" | "photo" | "game"
  const [handText, setHandText] = useState(PRESET.handText);
  const [meldText, setMeldText] = useState(PRESET.meldText);
  const [deadText, setDeadText] = useState(PRESET.deadText);
  const [flowerCount, setFlowerCount] = useState(PRESET.flowerCount);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const onSolve = () => {
    try {
      const next = solveState({
        handText,
        meldText,
        deadText,
        flowerCount: Number(flowerCount || 0),
      });
      setResult(next);
      setError("");
    } catch (solveError) {
      setResult(null);
      setError(solveError.message);
    }
  };

  const onUsePreset = () => {
    setHandText(PRESET.handText);
    setMeldText(PRESET.meldText);
    setDeadText(PRESET.deadText);
    setFlowerCount(PRESET.flowerCount);
    setResult(null);
    setError("");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ExpoStatusBar style="dark" />
      <StatusBar barStyle="dark-content" />

      {/* Mode Switch Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, mode === "snapshot" ? styles.tabActive : null]}
          onPress={() => setMode("snapshot")}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, mode === "snapshot" ? styles.tabTextActive : null]}>
            快照分析
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === "photo" ? styles.tabActive : null]}
          onPress={() => setMode("photo")}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, mode === "photo" ? styles.tabTextActive : null]}>
            本地拍照
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, mode === "game" ? styles.tabActive : null]}
          onPress={() => setMode("game")}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, mode === "game" ? styles.tabTextActive : null]}>
            对局模式
          </Text>
        </TouchableOpacity>
      </View>

      {mode === "game" ? (
        <ScrollView contentContainerStyle={styles.container}>
          <GameView onExit={() => setMode("snapshot")} />
        </ScrollView>
      ) : mode === "photo" ? (
        <ScrollView contentContainerStyle={styles.container}>
          <PhotoAdvisorView />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>Shanghai Qiao Ma AI</Text>
            <Text style={styles.title}>上海敲麻出牌助手</Text>
            <Text style={styles.subtitle}>
              核心目标是让 AI 判断下一张该打什么，优先比较能否直接进听、听口数量和有效进张。
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>现场牌型输入</Text>
            <Field
              label="暗手牌"
              value={handText}
              onChangeText={setHandText}
              multiline
              placeholder="例如：123m 456p 789s EEBB"
            />
            <Field
              label="自己的明牌组"
              value={meldText}
              onChangeText={setMeldText}
              placeholder="例如：EEE 789p"
            />
            <Field
              label="场上已知死牌"
              value={deadText}
              onChangeText={setDeadText}
              multiline
              placeholder="例如：1m 1m 9s C 789p"
            />
            <Field
              label="花牌数量"
              value={flowerCount}
              onChangeText={setFlowerCount}
              keyboardType="numeric"
              placeholder="0"
            />

            <View style={styles.buttonRow}>
              <ActionButton title="开始分析" onPress={onSolve} primary />
              <ActionButton title="载入示例" onPress={onUsePreset} />
            </View>

            <View style={styles.tipBox}>
              <Text style={styles.tipTitle}>输入格式</Text>
              <Text style={styles.tipText}>
                m=万，p=筒/饼，s=条/索，东南西北用 E S W N 表示；中发白按这套上海敲麻口径会自动算进花牌。
              </Text>
              <Text style={styles.tipText}>
                支持 123m 789p EEE，也支持中文 123万 789筒 东东东；如果输入了中发白，系统会自动转成花牌数量。
              </Text>
            </View>
          </View>

          {error ? (
            <View style={[styles.card, styles.errorCard]}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {result ? <ResultView result={result} /> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f3ecdf",
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingTop: 8,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: "#f4e5cc",
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#b45309",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#7c4708",
  },
  tabTextActive: {
    color: "#fff",
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 18,
  },
  hero: {
    paddingTop: 10,
    paddingBottom: 6,
  },
  eyebrow: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  title: {
    color: "#1f2937",
    fontSize: 33,
    fontWeight: "800",
    lineHeight: 38,
    marginBottom: 10,
  },
  subtitle: {
    color: "#665f57",
    fontSize: 15,
    lineHeight: 24,
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
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    marginBottom: 16,
  },
  tipBox: {
    borderRadius: 20,
    backgroundColor: "#fff1dc",
    padding: 14,
  },
  tipTitle: {
    color: "#7c4708",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
  },
  tipText: {
    color: "#6b6257",
    fontSize: 13,
    lineHeight: 21,
  },
  errorCard: {
    backgroundColor: "#fef1ef",
    borderColor: "rgba(185, 28, 28, 0.12)",
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
  },
});
