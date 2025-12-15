# expo-audio + react-native-video Conflict Reproduction

Minimal reproduction demonstrating that `react-native-video` conflicts with `expo-audio` recording on iOS.

## Bug Description

When a `react-native-video` `<Video>` component is rendered on the same screen as `expo-audio` recording, the **second and subsequent recordings produce empty files** (~4000KB of silence) on iOS physical devices.

## Environment

- **expo**: ~54.0.29
- **expo-audio**: ~1.1.0
- **react-native-video**: ^6.18.0
- **react-native**: 0.81.5
- **Platform**: iOS (physical device only - may not reproduce in simulator)
- **Architecture**: New Architecture enabled

## Steps to Reproduce

1. Clone this repo
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build and run on iOS device:
   ```bash
   npx expo run:ios --device
   ```
4. With "Enable Video Animation" toggle **ON** (default):
   - Tap Record, speak for a few seconds, tap Save
   - **First recording works** - file size is reasonable for duration
   - Tap Record again, speak, tap Save
   - **Second recording is empty** - file is ~4000KB regardless of duration (this is the bug)

5. Toggle "Enable Video Animation" **OFF**:
   - Record multiple times
   - **All recordings work correctly**

## Expected Behavior

All recordings should capture audio from the microphone, regardless of whether a `<Video>` component is rendered.

## Actual Behavior

When `react-native-video` is rendering a video (even muted), the second and subsequent `expo-audio` recordings produce files with:
- Correct file size (~4000KB for WAV)
- Valid audio headers
- **Silent/empty audio data**

## Root Cause Analysis

The `react-native-video` component modifies the iOS `AVAudioSession` when rendering video content. After the first recording stops:

1. `react-native-video` reconfigures the audio session for playback
2. When `expo-audio` starts the second recording, even though `setAudioModeAsync()` and `prepareToRecordAsync()` are called, the audio input is not properly reinitialized
3. The recorder writes to a new file but captures silence instead of microphone input

## Workaround

Replace video-based animations with alternatives that don't touch the iOS audio session:
- Lottie animations (`lottie-react-native`)
- GIF/animated PNG via `expo-image`
- React Native Animated API
- Static images

## Files

- `App.tsx` - Main app with toggle to enable/disable video
- `assets/recordAnimation.mov` - Sample video file for reproduction
