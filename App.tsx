/**
 * Minimal reproduction for expo-audio + react-native-video conflict
 *
 * BUG: When a react-native-video <Video> component is rendered on the same screen
 * as expo-audio recording, the second and subsequent recordings produce empty files
 * (~4000KB of silence) on iOS.
 *
 * Toggle "Enable Video Animation" to reproduce:
 * - OFF: Recording works correctly for multiple consecutive recordings
 * - ON: First recording works, second recording produces empty file
 */

import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Switch,
  Platform,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  AudioModule,
  RecordingPresets,
  IOSOutputFormat,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
} from "expo-audio";
import Video, { ResizeMode } from "react-native-video";

// Format seconds to MM:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

type Recording = {
  id: number;
  uri: string;
  duration: number;
  fileSize: number;
};

export default function App() {
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [playingId, setPlayingId] = useState<number | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  // Request microphone permission and configure audio mode
  useEffect(() => {
    (async () => {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert("Permission denied", "Microphone access is required");
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        interruptionMode: "doNotMix",
      });
    })();
  }, []);

  // Start/pause/resume recording
  const handleRecord = async () => {
    try {
      if (
        recorderState.durationMillis === undefined ||
        recorderState.durationMillis === 0
      ) {
        // Start new recording
        console.log("Starting new recording...");
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
          interruptionMode: "doNotMix",
        });

        await audioRecorder.prepareToRecordAsync({
          ios: {
            extension: ".wav",
            outputFormat: IOSOutputFormat.LINEARPCM,
            audioQuality: 96,
          },
        });
        audioRecorder.record();
      } else if (recorderState.isRecording) {
        // Pause recording
        console.log("Pausing recording...");
        audioRecorder.pause();
      } else {
        // Resume recording
        console.log("Resuming recording...");
        audioRecorder.record();
      }
    } catch (error: any) {
      console.error("Recording error:", error);
      Alert.alert("Recording failed", error.message || "Could not record");
    }
  };

  // Stop recording and save
  const handleSave = async () => {
    if (!recorderState.durationMillis || recorderState.durationMillis === 0) {
      Alert.alert("No recording", "Please record something first");
      return;
    }

    try {
      const duration = recorderState.durationMillis;
      await audioRecorder.stop();
      const recordingURI = audioRecorder.uri;

      if (!recordingURI) {
        Alert.alert("Error", "No recording URI found");
        return;
      }

      console.log("Recording URI:", recordingURI);

      // Fetch file to check size
      const response = await fetch(recordingURI);
      const blob = await response.blob();
      const fileSizeKB = Math.round(blob.size / 1024);

      const newRecording: Recording = {
        id: Date.now(),
        uri: recordingURI,
        duration: Math.round(duration / 1000),
        fileSize: fileSizeKB,
      };

      setRecordings((prev) => [newRecording, ...prev]);
    } catch (error: any) {
      console.error("Save error:", error);
      Alert.alert("Error", error.message || "Failed to save recording");
    }
  };

  // Cancel recording
  const handleCancel = async () => {
    if (recorderState.durationMillis && recorderState.durationMillis > 0) {
      await audioRecorder.stop();
    }
  };

  const durationSeconds = recorderState.durationMillis
    ? Math.floor(recorderState.durationMillis / 1000)
    : 0;

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <Text style={styles.title}>expo-audio + video conflict</Text>
      <Text style={styles.subtitle}>
        Toggle video to reproduce the bug on iOS
      </Text>

      {/* Video toggle */}
      <View style={styles.toggleContainer}>
        <Text style={styles.toggleLabel}>Enable Video Animation:</Text>
        <Switch
          value={videoEnabled}
          onValueChange={setVideoEnabled}
          trackColor={{ false: "#ccc", true: "#4a4588" }}
        />
      </View>

      {/* Video component - THIS CAUSES THE BUG */}
      {videoEnabled && Platform.OS === "ios" && (
        <View style={styles.videoContainer}>
          <Video
            source={require("./assets/recordAnimation.mov")}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            repeat
            muted
          />
          <Text style={styles.videoLabel}>Video playing (muted)</Text>
        </View>
      )}

      {!videoEnabled && (
        <View style={styles.placeholderContainer}>
          <View style={styles.placeholder} />
          <Text style={styles.videoLabel}>Video disabled</Text>
        </View>
      )}

      {/* Timer */}
      <View style={styles.timerContainer}>
        <Text style={styles.timer}>{formatTime(durationSeconds)}</Text>
        <Text style={styles.status}>
          {recorderState.isRecording
            ? "Recording..."
            : durationSeconds > 0
              ? "Paused"
              : "Ready"}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, styles.cancelButton]}
          onPress={handleCancel}
          disabled={durationSeconds === 0}
        >
          <Text style={styles.controlButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlButton,
            styles.recordButton,
            recorderState.isRecording && styles.recordingActive,
          ]}
          onPress={handleRecord}
        >
          <Text style={styles.controlButtonText}>
            {recorderState.isRecording
              ? "Pause"
              : durationSeconds > 0
                ? "Resume"
                : "Record"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlButton,
            styles.saveButton,
            durationSeconds === 0 && styles.buttonDisabled,
          ]}
          onPress={handleSave}
          disabled={durationSeconds === 0}
        >
          <Text style={styles.controlButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Recordings list */}
      <View style={styles.recordingsContainer}>
        <Text style={styles.recordingsTitle}>
          Recordings ({recordings.length})
        </Text>
        <Text style={styles.recordingsHint}>
          Tap to play - if silent, the bug occurred
        </Text>
        <ScrollView style={styles.recordingsList}>
          {recordings.map((rec, index) => (
            <RecordingItem
              key={rec.id}
              recording={rec}
              index={recordings.length - index}
              isPlaying={playingId === rec.id}
              onPlay={() => setPlayingId(rec.id)}
              onStop={() => setPlayingId(null)}
            />
          ))}
          {recordings.length === 0 && (
            <Text style={styles.emptyText}>No recordings yet</Text>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

// Separate component for playback
function RecordingItem({
  recording,
  index,
  isPlaying,
  onPlay,
  onStop,
}: {
  recording: Recording;
  index: number;
  isPlaying: boolean;
  onPlay: () => void;
  onStop: () => void;
}) {
  const player = useAudioPlayer(recording.uri);

  const handlePress = async () => {
    if (isPlaying) {
      player.pause();
      onStop();
    } else {
      // Configure for playback
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
      });
      player.seekTo(0);
      player.play();
      onPlay();
    }
  };

  // Stop playing indicator when audio ends
  useEffect(() => {
    if (isPlaying && player.duration > 0 && player.currentTime >= player.duration) {
      onStop();
    }
  }, [player.currentTime, player.duration, isPlaying]);

  return (
    <TouchableOpacity
      style={[styles.recordingItem, isPlaying && styles.recordingItemPlaying]}
      onPress={handlePress}
    >
      <View style={styles.recordingInfo}>
        <Text style={styles.recordingNumber}>#{index}</Text>
        <Text style={styles.recordingDetails}>
          {recording.duration}s | {recording.fileSize} KB
        </Text>
      </View>
      <Text style={styles.playButton}>{isPlaying ? "Stop" : "Play"}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
    textAlign: "center",
  },
  toggleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  toggleLabel: {
    fontSize: 16,
  },
  videoContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  video: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f0f0f0",
  },
  videoLabel: {
    fontSize: 11,
    color: "#666",
    marginTop: 4,
  },
  placeholderContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  placeholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#4a4588",
  },
  timerContainer: {
    alignItems: "center",
    marginBottom: 8,
  },
  timer: {
    fontSize: 44,
    fontWeight: "200",
    fontVariant: ["tabular-nums"],
  },
  status: {
    fontSize: 14,
    color: "#666",
  },
  controls: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  controlButton: {
    width: 65,
    height: 65,
    borderRadius: 33,
    alignItems: "center",
    justifyContent: "center",
  },
  controlButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#999",
  },
  recordButton: {
    backgroundColor: "#e53935",
    width: 75,
    height: 75,
    borderRadius: 38,
  },
  recordingActive: {
    backgroundColor: "#b71c1c",
  },
  saveButton: {
    backgroundColor: "#43a047",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  recordingsContainer: {
    flex: 1,
    width: "100%",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    padding: 12,
  },
  recordingsTitle: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 2,
  },
  recordingsHint: {
    fontSize: 12,
    color: "#666",
    marginBottom: 8,
  },
  recordingsList: {
    flex: 1,
  },
  recordingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  recordingItemPlaying: {
    backgroundColor: "#e8f5e9",
    borderColor: "#43a047",
    borderWidth: 1,
  },
  recordingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recordingNumber: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#4a4588",
  },
  recordingDetails: {
    color: "#666",
    fontSize: 14,
  },
  playButton: {
    color: "#4a4588",
    fontWeight: "600",
  },
  emptyText: {
    color: "#999",
    textAlign: "center",
    marginTop: 20,
  },
});
