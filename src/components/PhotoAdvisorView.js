import React, { useRef, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";

import { ResultView } from "./ResultView";
import { ActionButton } from "./shared";

const { createMockGlassesInput, createPhoneCameraGlassesInput } = require("../vision/glassesInput");
const { recognizeWithCloud } = require("../vision/cloudRecognizer");
const {
  runCloudVerification,
  runLocalRecommendation,
} = require("../vision/recommendationPipeline");
const { describeRecognition } = require("../vision/recognitionSchema");
const { saveVisionSample } = require("../vision/sampleStore");

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

export default function PhotoAdvisorView() {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [status, setStatus] = useState("idle");
  const [photoUri, setPhotoUri] = useState("");
  const [localOutcome, setLocalOutcome] = useState(null);
  const [cloudOutcome, setCloudOutcome] = useState(null);
  const [error, setError] = useState("");

  const visibleOutcome =
    cloudOutcome && cloudOutcome.status !== "cloud-unavailable" ? cloudOutcome : localOutcome;
  const result = visibleOutcome && visibleOutcome.status === "recommendation" ? visibleOutcome.result : null;
  const recognition = visibleOutcome ? visibleOutcome.recognition : null;

  const onRunMock = () => {
    runPipeline(createMockGlassesInput(MOCK_RECOGNITION));
  };

  const runPipeline = async (input) => {
    setError("");
    setCloudOutcome(null);
    setLocalOutcome(null);
    setStatus("capturing");

    try {
      const frame = await input.captureFrame();
      const prepared = await preparePhoto(frame);
      setPhotoUri(prepared.uri || "");

      setStatus("local");
      const local = await runLocalRecommendation(prepared, {});
      setLocalOutcome(local);
      await saveVisionSample({
        imageUri: prepared.uri,
        recognition: local.recognition,
        accepted: local.status === "recommendation",
        retakeRequested: local.status !== "recommendation",
      });

      setStatus(local.status === "recommendation" ? "done" : "retake");
      runCloudCheck(prepared, local.recognition);
    } catch (captureError) {
      setStatus("idle");
      setError(captureError.message);
    }
  };

  const runCloudCheck = async (prepared, localRecognition) => {
    setStatus((current) => (current === "done" ? "done-cloud" : "cloud"));
    try {
      const cloud = await runCloudVerification(prepared, {}, localRecognition, {
        cloudRecognizer: recognizeWithCloud,
      });
      if (cloud) {
        setCloudOutcome(cloud);
        setStatus(cloud.status === "recommendation" ? "done" : cloud.status);
        await saveVisionSample({
          imageUri: prepared.uri,
          recognition: cloud.recognition,
          accepted: cloud.status === "recommendation",
          retakeRequested: cloud.status !== "recommendation",
        });
      }
    } catch (cloudError) {
      setStatus((current) => (current === "cloud" ? "retake" : current));
      setCloudOutcome({
        status: "cloud-unavailable",
        message: "云端校验未连接，本次只使用本地结果。",
        warnings: [cloudError.message],
      });
    }
  };

  if (!permission) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>拍照推荐</Text>
        <Text style={styles.body}>正在检查相机权限。</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>拍照推荐</Text>
          <Text style={styles.body}>需要相机权限才能拍摄手牌。</Text>
          <View style={styles.buttonRow}>
            <ActionButton title="授权相机" onPress={requestPermission} primary />
            <ActionButton title="样例识别" onPress={onRunMock} />
          </View>
          <StatusPanel status={status} outcome={visibleOutcome} recognition={recognition} />
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
        {result ? <ResultView result={result} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>拍照推荐</Text>
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
  if (status === "done" || status === "done-cloud") return "已生成推荐";
  if (status === "retake") return "需要重拍";
  if (status === "conflict") return "识别冲突";
  if (status === "cloud") return "等待云端校验";
  if (status === "local") return "本地快识别";
  if (status === "capturing") return "正在拍摄";
  return "待拍照";
}

function statusLabel(status) {
  if (status === "capturing") return "正在获取照片。";
  if (status === "local") return "正在用本地快路径识别。";
  if (status === "cloud") return "本地置信度不足，正在等待云端校验。";
  return "把自己的手牌放进画面后拍照。";
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
