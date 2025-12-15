import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "expo-audio + video conflict",
  slug: "expo-audio-video-conflict-repro",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  ios: {
    bundleIdentifier: "com.expo.audio.video.conflict.repro",
    supportsTablet: true,
  },
  android: {
    package: "com.expo.audio.video.conflict.repro",
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
          "This app needs microphone access to demonstrate the audio recording bug.",
      },
    ],
  ],
});
