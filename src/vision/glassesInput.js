function createPhoneCameraGlassesInput(cameraRef, options = {}) {
  return {
    kind: "phone-camera",
    async captureFrame() {
      if (!cameraRef || !cameraRef.current) {
        throw new Error("相机尚未准备好。");
      }
      const picture = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: options.quality || 0.75,
        skipProcessing: false,
      });
      return {
        uri: picture.uri,
        base64: picture.base64,
        width: picture.width,
        height: picture.height,
        mimeType: "image/jpeg",
        source: "phone-camera",
        capturedAt: new Date().toISOString(),
      };
    },
  };
}

function createMockGlassesInput(mockRecognition) {
  return {
    kind: "mock-glasses",
    async captureFrame() {
      return {
        uri: null,
        base64: "",
        mimeType: "image/jpeg",
        source: "mock-glasses",
        capturedAt: new Date().toISOString(),
        mockRecognition,
      };
    },
  };
}

module.exports = {
  createPhoneCameraGlassesInput,
  createMockGlassesInput,
};
