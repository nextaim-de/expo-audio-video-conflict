import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import {
  AudioModule,
  RecordingPresets,
  IOSOutputFormat,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { supabase } from "./lib/supabase";
import { Session } from "@supabase/supabase-js";

// Normalize MIME types for compatibility
function normalizeAudioMimeType(mimeType: string): string {
  const mimeTypeMap: Record<string, string> = {
    "audio/x-m4a": "audio/m4a",
    "audio/x-wav": "audio/wav",
    "audio/vnd.wave": "audio/wav",
  };
  return mimeTypeMap[mimeType] || mimeType;
}

// Convert recording URI to file object for upload
async function getAudioFile(audioURI: string) {
  const audio = await fetch(audioURI);
  const audioBlob = await audio.blob();
  const fileName = audioURI.split("/").pop();
  // @ts-ignore - accessing internal blob data
  const rawType = audioBlob["_data"]?.["type"] || "audio/wav";
  const fileType = normalizeAudioMimeType(rawType);
  return {
    uri: audioURI,
    name: fileName,
    type: fileType,
  };
}

// Format seconds to MM:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);

  // Check for existing session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

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

  // Login handler
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter email and password");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        Alert.alert("Login failed", error.message);
      }
    } catch (err: any) {
      Alert.alert("Error", err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

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

  // Stop and upload recording
  const handleSave = async () => {
    if (!recorderState.durationMillis || recorderState.durationMillis === 0) {
      Alert.alert("No recording", "Please record something first");
      return;
    }

    setIsUploading(true);
    try {
      await audioRecorder.stop();
      const recordingURI = audioRecorder.uri;

      if (!recordingURI) {
        Alert.alert("Error", "No recording URI found");
        return;
      }

      console.log("Recording URI:", recordingURI);

      // Convert to file object
      const audioFile = await getAudioFile(recordingURI);
      console.log("Audio file:", audioFile);

      // Create FormData and upload
      const formData = new FormData();
      formData.append("file", audioFile as any);

      console.log("Uploading to Supabase...");
      const { data, error } = await supabase.functions.invoke("upload-audio", {
        body: formData,
      });

      if (error) {
        console.error("Upload error:", error);
        Alert.alert("Upload failed", error.message);
      } else {
        console.log("Upload success:", data);
        Alert.alert("Success", "Recording uploaded successfully!");
      }
    } catch (error: any) {
      console.error("Save error:", error);
      Alert.alert("Error", error.message || "Failed to save recording");
    } finally {
      setIsUploading(false);
    }
  };

  // Cancel recording
  const handleCancel = async () => {
    if (recorderState.durationMillis && recorderState.durationMillis > 0) {
      Alert.alert("Cancel recording?", "This will delete the current recording", [
        { text: "Keep recording", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await audioRecorder.stop();
          },
        },
      ]);
    }
  };

  const durationSeconds = recorderState.durationMillis
    ? Math.floor(recorderState.durationMillis / 1000)
    : 0;

  // LOGIN SCREEN
  if (!session) {
    return (
      <View style={styles.container}>
        <StatusBar style="auto" />
        <Text style={styles.title}>Recorder Test</Text>
        <Text style={styles.subtitle}>Login to continue</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  // RECORDER SCREEN
  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Recorder Test</Text>
      <Text style={styles.subtitle}>Logged in as: {session.user.email}</Text>

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
            (durationSeconds === 0 || isUploading) && styles.buttonDisabled,
          ]}
          onPress={handleSave}
          disabled={durationSeconds === 0 || isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.controlButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 30,
  },
  input: {
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    width: "100%",
    height: 50,
    backgroundColor: "#4a4588",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  timerContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  timer: {
    fontSize: 64,
    fontWeight: "200",
    fontVariant: ["tabular-nums"],
  },
  status: {
    fontSize: 16,
    color: "#666",
    marginTop: 8,
  },
  controls: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 40,
  },
  controlButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  controlButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#999",
  },
  recordButton: {
    backgroundColor: "#e53935",
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  recordingActive: {
    backgroundColor: "#b71c1c",
  },
  saveButton: {
    backgroundColor: "#43a047",
  },
  logoutButton: {
    position: "absolute",
    top: 60,
    right: 20,
  },
  logoutText: {
    color: "#e53935",
    fontSize: 14,
  },
});
