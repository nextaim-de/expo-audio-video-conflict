import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Recorder Test",
  slug: "recorder-test",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  ios: {
    bundleIdentifier: "com.test.recorder",
    supportsTablet: true,
  },
  android: {
    package: "com.test.recorder",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#ffffff",
    },
  },
  plugins: [
    [
      "expo-audio",
      {
        microphonePermission:
          "We use the microphone to capture your voice and upload recordings.",
      },
    ],
  ],
});
