import React, { useRef, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

import { ResultView } from "./ResultView";
import { ActionButton, Field } from "./shared";

const { createMockGlassesInput, createPhoneCameraGlassesInput } = require("../vision/glassesInput");
const { createRecommendation, runLocalRecommendation } = require("../vision/recommendationPipeline");
const {
  describeRecognition,
  normalizeRecognition,
  textToTiles,
  tilesToText,
} = require("../vision/recognitionSchema");
const {
  exportVisionTrainingManifest,
  saveAdoptedVisionSample,
  saveVisionSample,
  updateVisionSample,
} = require("../vision/sampleStore");

const MOCK_RECOGNITION = {
  handTiles: ["1m", "2m", "3m", "4p", "5p", "6p", "7s", "8s", "9s", "E", "E", "N", "N"],
  drawnTile: "3m",
  melds: [],
  deadTiles: ["1m", "1m", "9s"],
  overallConfidence: 0.94,
  perTileConfidence: Array.from({ length: 14 }, () => 0.94),
  source: "local-mock",
  warnings: [],
};

const EMPTY_CORRECTION = {
  handText: "",
  drawnTile: "",
  meldText: "",
  deadText: "",
};

export default function PhotoAdvisorView() {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState("idle");
  const [photoUri, setPhotoUri] = useState("");
  const [localOutcome, setLocalOutcome] = useState(null);
  const [currentSample, setCurrentSample] = useState(null);
  const [correction, setCorrection] = useState(EMPTY_CORRECTION);
  const [trainingInfo, setTrainingInfo] = useState("");
  const [error, setError] = useState("");

  const visibleOutcome = localOutcome;
  const result = visibleOutcome && visibleOutcome.status === "recommendation" ? visibleOutcome.result : null;
  const recognition = visibleOutcome ? visibleOutcome.recognition : null;

  const onRunMock = () => {
    runPipeline(createMockGlassesInput(MOCK_RECOGNITION));
  };

  const runPipeline = async (input) => {
    setError("");
    setTrainingInfo("");
    setCurrentSample(null);
    setLocalOutcome(null);
    setStatus("capturing");

    try {
      const frame = await input.captureFrame();
      const prepared = await preparePhoto(frame);
      setPhotoUri(prepared.uri || "");

      setStatus("local");
      const local = await runLocalRecommendation(prepared, { localOnly: true });
      setLocalOutcome(local);
      setCorrection(recognitionToFields(local.recognition));
      const sample = await saveVisionSample({
        imageUri: prepared.uri,
        imageWidth: prepared.width,
        imageHeight: prepared.height,
        recognition: local.recognition,
        accepted: local.status === "recommendation",
        retakeRequested: local.status !== "recommendation",
      });
      setCurrentSample(sample);

      setStatus(local.status === "recommendation" ? "done" : "retake");
    } catch (captureError) {
      setStatus("idle");
      setError(captureError.message);
    }
  };

  const onAcceptRecognition = async () => {
    if (!currentSample || !recognition) {
      setTrainingInfo("当前平台没有可写入的本地样本。");
      return;
    }

    const updated = await saveAdoptedVisionSample(currentSample.id, recognition, {
      corrected: false,
      note: "用户确认本地识别牌面",
    });
    setCurrentSample(updated);
    setTrainingInfo("已确认牌面，可用于下一轮本地模型训练。");
  };

  const onSaveCorrection = async () => {
    try {
      const adopted = recognitionFromFields(correction, recognition);
      const correctedOutcome = createRecommendation(adopted, {}, "local-corrected");
      setLocalOutcome(correctedOutcome);
      setStatus("done");

      if (currentSample) {
        const updated = await saveAdoptedVisionSample(currentSample.id, adopted, {
          corrected: true,
          note: "用户手动修正牌面",
        });
        setCurrentSample(updated);
      }

      setTrainingInfo("已保存修正牌面，并用修正结果重新生成推荐。");
      setError("");
    } catch (correctionError) {
      setError(correctionError.message);
    }
  };

  const onMarkRetake = async () => {
    if (!currentSample) {
      setTrainingInfo("当前平台没有可写入的本地样本。");
      return;
    }

    const updated = await updateVisionSample(currentSample.id, {
      accepted: false,
      corrected: false,
      retakeRequested: true,
      note: "用户标记为需要重拍",
    });
    setCurrentSample(updated);
    setStatus("retake");
    setTrainingInfo("已标记为重拍样本，训练时会作为低质量样本记录。");
  };

  const onExportTrainingManifest = async () => {
    const exported = await exportVisionTrainingManifest({ includeRetakes: true });
    if (!exported) {
      setTrainingInfo("当前平台不能导出本地训练 manifest。");
      return;
    }
    setTrainingInfo(
      `已导出 ${exported.manifest.sampleCount} 个样本：${exported.exportUri}`
    );
  };

  if (!permission) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>全本地拍照推荐</Text>
        <Text style={styles.body}>正在检查相机权限。</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>全本地拍照推荐</Text>
          <Text style={styles.body}>需要相机权限才能拍摄手牌。</Text>
          <View style={styles.buttonRow}>
            <ActionButton title="授权相机" onPress={requestPermission} primary />
            <ActionButton title="样例识别" onPress={onRunMock} />
          </View>
          <StatusPanel status={status} outcome={visibleOutcome} recognition={recognition} />
          <TrainingSamplePanel
            correction={correction}
            currentSample={currentSample}
            onAcceptRecognition={onAcceptRecognition}
            onExportTrainingManifest={onExportTrainingManifest}
            onMarkRetake={onMarkRetake}
            onSaveCorrection={onSaveCorrection}
            recognition={recognition}
            setCorrection={setCorrection}
            trainingInfo={trainingInfo}
          />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
        {result ? <ResultView result={result} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>全本地拍照推荐</Text>
        <View style={styles.cameraShell}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        </View>
        <View style={styles.buttonRow}>
          <ActionButton
            title={status === "capturing" || status === "local" ? "识别中" : "拍照分析"}
            onPress={() => runPipeline(createPhoneCameraGlassesInput(cameraRef))}
            primary
            disabled={status === "capturing" || status === "local"}
          />
          <ActionButton title="样例识别" onPress={onRunMock} />
        </View>
        <StatusPanel status={status} outcome={visibleOutcome} recognition={recognition} />
        <TrainingSamplePanel
          correction={correction}
          currentSample={currentSample}
          onAcceptRecognition={onAcceptRecognition}
          onExportTrainingManifest={onExportTrainingManifest}
          onMarkRetake={onMarkRetake}
          onSaveCorrection={onSaveCorrection}
          recognition={recognition}
          setCorrection={setCorrection}
          trainingInfo={trainingInfo}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      {photoUri ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>本次照片</Text>
          <Image source={{ uri: photoUri }} style={styles.preview} />
        </View>
      ) : null}

      {result ? <ResultView result={result} /> : null}
    </View>
  );
}

function TrainingSamplePanel({
  correction,
  currentSample,
  onAcceptRecognition,
  onExportTrainingManifest,
  onMarkRetake,
  onSaveCorrection,
  recognition,
  setCorrection,
  trainingInfo,
}) {
  const hasRecognition = Boolean(recognition);
  return (
    <View style={styles.trainingBox}>
      <Text style={styles.trainingTitle}>本地训练样本</Text>
      <Text style={styles.muted}>
        确认或修正牌面后，会把照片路径和最终采用牌面写入本机 manifest，不上传照片。
      </Text>
      {currentSample ? (
        <Text style={styles.muted}>样本 {String(currentSample.id).slice(0, 12)} 已保存。</Text>
      ) : null}
      {hasRecognition ? (
        <>
          <Field
            label="修正手牌"
            value={correction.handText}
            onChangeText={(value) => setCorrection((current) => ({ ...current, handText: value }))}
            multiline
            placeholder="例如：123m 456p 789s EENN"
          />
          <Field
            label="修正摸牌"
            value={correction.drawnTile}
            onChangeText={(value) => setCorrection((current) => ({ ...current, drawnTile: value }))}
            placeholder="例如：3m"
          />
          <Field
            label="修正明牌"
            value={correction.meldText}
            onChangeText={(value) => setCorrection((current) => ({ ...current, meldText: value }))}
            placeholder="例如：EEE 789p"
          />
          <Field
            label="修正死牌"
            value={correction.deadText}
            onChangeText={(value) => setCorrection((current) => ({ ...current, deadText: value }))}
            multiline
            placeholder="例如：1m 1m 9s"
          />
          <View style={styles.buttonRow}>
            <ActionButton title="确认牌面" onPress={onAcceptRecognition} primary />
            <ActionButton title="保存修正" onPress={onSaveCorrection} />
          </View>
          <View style={styles.buttonRow}>
            <ActionButton title="标记重拍" onPress={onMarkRetake} />
            <ActionButton title="导出样本" onPress={onExportTrainingManifest} />
          </View>
        </>
      ) : (
        <View style={styles.buttonRow}>
          <ActionButton title="导出样本" onPress={onExportTrainingManifest} />
        </View>
      )}
      {trainingInfo ? <Text style={styles.trainingInfo}>{trainingInfo}</Text> : null}
    </View>
  );
}

async function preparePhoto(photo) {
  if (!photo.uri) {
    return photo;
  }

  const manipulated = await manipulateAsync(
    photo.uri,
    [{ resize: { width: 1280 } }],
    {
      compress: 0.72,
      format: SaveFormat.JPEG,
      base64: true,
    }
  );

  return {
    ...photo,
    uri: manipulated.uri,
    base64: manipulated.base64 || photo.base64,
    width: manipulated.width,
    height: manipulated.height,
    mimeType: "image/jpeg",
  };
}

function StatusPanel({ status, outcome, recognition }) {
  const message = outcome && outcome.message ? outcome.message : statusLabel(status);
  const detail = recognition ? describeRecognition(recognition) : "";
  return (
    <View style={styles.statusBox}>
      <Text style={styles.statusTitle}>{statusTitle(status)}</Text>
      <Text style={styles.body}>{message}</Text>
      {detail && detail !== message ? <Text style={styles.muted}>{detail}</Text> : null}
      {outcome && outcome.warnings && outcome.warnings.length > 0 ? (
        <Text style={styles.warning}>{outcome.warnings.join(" / ")}</Text>
      ) : null}
    </View>
  );
}

function statusTitle(status) {
  if (status === "done") return "已生成推荐";
  if (status === "retake") return "需要重拍";
  if (status === "local") return "本地模型识别";
  if (status === "capturing") return "正在拍摄";
  return "待拍照";
}

function statusLabel(status) {
  if (status === "capturing") return "正在获取照片。";
  if (status === "local") return "正在用手机本地模型识别牌面，不上传照片。";
  if (status === "retake") return "本地模型置信度不足，请靠近牌面重拍。";
  return "把自己的手牌放进画面后拍照，照片只在本机处理。";
}

function recognitionToFields(recognition) {
  if (!recognition) {
    return EMPTY_CORRECTION;
  }

  const normalized = normalizeRecognition(recognition);
  return {
    handText: tilesToText(normalized.handTiles),
    drawnTile: normalized.drawnTile || "",
    meldText: normalized.melds.map(tilesToText).join(" "),
    deadText: tilesToText(normalized.deadTiles),
  };
}

function recognitionFromFields(fields, previousRecognition) {
  const previous = normalizeRecognition(previousRecognition || {});
  const drawnTiles = textToTiles(fields.drawnTile || "");
  if (drawnTiles.length > 1) {
    throw new Error("修正摸牌只能填一张牌。");
  }

  return normalizeRecognition({
    ...previous,
    handTiles: textToTiles(fields.handText || ""),
    drawnTile: drawnTiles[0] || null,
    melds: splitMeldText(fields.meldText).map(textToTiles),
    deadTiles: textToTiles(fields.deadText || ""),
    overallConfidence: 1,
    perTileConfidence: [],
    source: "user-corrected",
    warnings: [],
  });
}

function splitMeldText(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

const styles = StyleSheet.create({
  container: {
    gap: 18,
  },
  card: {
    backgroundColor: "#fff8ee",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(180, 83, 9, 0.12)",
  },
  cardTitle: {
    color: "#1f2937",
    fontSize: 21,
    fontWeight: "800",
    marginBottom: 14,
  },
  cameraShell: {
    height: 320,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#111827",
    marginBottom: 14,
  },
  camera: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  statusBox: {
    borderRadius: 12,
    backgroundColor: "#fff1dc",
    padding: 12,
    gap: 4,
  },
  statusTitle: {
    color: "#7c4708",
    fontSize: 14,
    fontWeight: "800",
  },
  body: {
    color: "#433a31",
    fontSize: 14,
    lineHeight: 22,
  },
  muted: {
    color: "#6f675e",
    fontSize: 13,
    lineHeight: 20,
  },
  warning: {
    color: "#b45309",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700",
  },
  trainingBox: {
    borderRadius: 12,
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "rgba(180, 83, 9, 0.1)",
    padding: 12,
    gap: 4,
    marginTop: 12,
  },
  trainingTitle: {
    color: "#1f2937",
    fontSize: 15,
    fontWeight: "800",
  },
  trainingInfo: {
    color: "#7c4708",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 20,
  },
  errorText: {
    color: "#b91c1c",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700",
    marginTop: 10,
  },
  preview: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    backgroundColor: "#111827",
  },
});
