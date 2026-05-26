import React from "react";
import { StyleSheet, Text, View } from "react-native";

const { formatTileLabel } = require("../engine/mahjong");

export function formatWaitLabel(token) {
  const match = token.match(/^([0-9][mps]|[ESWNCFB])\((\d+)\)$/);
  if (!match) {
    return token;
  }
  return `${formatTileLabel(match[1])}(${match[2]})`;
}

export function MetricItem({ label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export function ResultView({ result }) {
  const topChoice = result.recommendations[0];

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>分析摘要</Text>
        <View style={styles.metricGrid}>
          <MetricItem label="暗手牌张数" value={String(result.concealedCount)} />
          <MetricItem label="明牌组" value={String(result.openMeldCount)} />
          <MetricItem label="主目标" value={result.baseAnalysis.patterns.join(" / ")} />
          <MetricItem label="花牌" value={String(result.flowerCount)} />
        </View>
        <Text style={styles.summaryText}>
          {result.readiness && result.readiness.summary
            ? result.readiness.summary
            : `当前离最近可胡目标还差 ${result.baseAnalysis.shanten} 向。`}
        </Text>
        {result.safetyContext && result.safetyContext.note ? (
          <Text style={styles.summaryMuted}>{result.safetyContext.note}</Text>
        ) : null}
        {result.tileEfficiency && result.tileEfficiency.enabled ? (
          <Text style={styles.summaryMuted}>
            外部牌效参考：{result.tileEfficiency.rule} 规则 {result.tileEfficiency.shanten} 向
            {result.tileEfficiency.ukeire && result.tileEfficiency.ukeire.totalUkeire
              ? `，进张 ${result.tileEfficiency.ukeire.totalUkeire}`
              : ""}
            。最终排序仍按上海敲麻收益。
          </Text>
        ) : null}
      </View>

      {result.recommendations.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>出牌推荐</Text>
          <Text style={styles.heroRecommendation}>
            攻守平衡首选打 {formatTileLabel(topChoice.discard)}，它在当前规则下的综合收益最高。
          </Text>
          {result.recommendations.slice(0, 6).map((item, index) => (
            <View
              key={`${item.discard}-${index}`}
              style={[styles.recommendation, index === 0 ? styles.bestRecommendation : null]}
            >
              <Text style={styles.recommendationTitle}>
                {index === 0 ? "首选" : `候选 ${index + 1}`}：打 {formatTileLabel(item.discard)}
              </Text>
              <View style={styles.badgeRow}>
                {item.policy && item.policy.attack ? <Text style={styles.badgeAttack}>进攻首选</Text> : null}
                {item.policy && item.policy.stable ? <Text style={styles.badgeStable}>稳健首选</Text> : null}
              </View>
              <Text style={styles.recommendationBody}>
                最近目标 {item.state.shanten} 向，优先做 {item.state.patterns.join(" / ") || "无"}。
              </Text>
              <Text style={styles.recommendationBody}>
                听牌总数 {item.waitCount}，有效进张 {item.effectiveCount}。
              </Text>
              <Text style={styles.recommendationBody}>
                进攻评分 {item.attackScore}，稳健评分 {item.balancedScore}，安全热度 {item.safetyScore}。
              </Text>
              <Text style={styles.recommendationBody}>
                综合评分 {item.totalScore}，二层改良 {item.lookaheadScore}，牌型价值 {item.patternValue}。
              </Text>
              {item.tileEfficiency ? (
                <Text style={styles.recommendationMuted}>
                  {item.tileEfficiency.label}，参考进张 {item.tileEfficiency.totalUkeire}。
                </Text>
              ) : null}
              {item.safetyNote ? (
                <Text style={styles.recommendationMuted}>{item.safetyNote}</Text>
              ) : null}
              <Text style={styles.recommendationMuted}>
                {item.waits.length > 0
                  ? `可听：${item.waits.map(formatWaitLabel).join("、")}`
                  : "当前打出后还不能直接进听。"}
              </Text>
              <Text style={styles.recommendationMuted}>
                {item.improvingTiles.length > 0
                  ? `进张：${item.improvingTiles.map(formatWaitLabel).slice(0, 14).join("、")}`
                  : "暂无更优进张统计。"}
              </Text>
              <Text style={styles.recommendationMuted}>
                {item.drawPlans && item.drawPlans.length > 0
                  ? `下一手预案：${item.drawPlans
                      .slice(0, 5)
                      .map(
                        (plan) =>
                          `摸${formatTileLabel(plan.tile)}(${plan.remaining})后打${formatTileLabel(
                            plan.discard
                          )}`
                      )
                      .join("、")}`
                  : "暂无二层预案。"}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>进张建议</Text>
          {result.bestDraws.length > 0 ? (
            result.bestDraws.slice(0, 10).map((item, index) => (
              <View key={`${item.tile}-${index}`} style={styles.recommendation}>
                <Text style={styles.recommendationTitle}>摸到 {formatTileLabel(item.tile)}</Text>
                <Text style={styles.recommendationBody}>
                  剩余 {item.remaining} 张，可把最近目标推进到 {item.nextState.shanten} 向。
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.recommendationMuted}>暂无有效进张，请检查输入张数或规则配置。</Text>
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 18,
  },
  cardTitle: {
    color: "#1f2937",
    fontSize: 21,
    fontWeight: "800",
    marginBottom: 14,
  },
  metricGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  metric: {
    width: "48%",
    backgroundColor: "#fffdf8",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(180, 83, 9, 0.1)",
  },
  metricLabel: {
    color: "#74675b",
    fontSize: 12,
    marginBottom: 6,
  },
  metricValue: {
    color: "#1f2937",
    fontSize: 18,
    fontWeight: "800",
  },
  summaryText: {
    color: "#473f36",
    fontSize: 15,
    lineHeight: 24,
  },
  summaryMuted: {
    color: "#786d62",
    fontSize: 13,
    lineHeight: 21,
    marginTop: 6,
  },
  heroRecommendation: {
    color: "#8a4f08",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 24,
    marginBottom: 14,
  },
  recommendation: {
    backgroundColor: "#fffdf8",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(180, 83, 9, 0.1)",
    padding: 14,
    marginBottom: 12,
  },
  bestRecommendation: {
    backgroundColor: "#fff4d8",
  },
  recommendationTitle: {
    color: "#1f2937",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  badgeAttack: {
    alignSelf: "flex-start",
    color: "#7c4708",
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "800",
  },
  badgeStable: {
    alignSelf: "flex-start",
    color: "#075985",
    backgroundColor: "#e0f2fe",
    borderRadius: 8,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: "800",
  },
  recommendationBody: {
    color: "#433a31",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 4,
  },
  recommendationMuted: {
    color: "#6f675e",
    fontSize: 13,
    lineHeight: 21,
    marginTop: 2,
  },
});
