import React, { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const DEFAULT_BREAK_MINUTES = 5;

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${pad(minutes)}:${pad(seconds)}`;
}

function buildSessions(tasks, breakMinutes) {
  const sessions = [];

  tasks.forEach((task, index) => {
    sessions.push({
      id: `task-${task.id}`,
      type: "work",
      label: task.title,
      seconds: task.minutes * 60,
    });

    if (index < tasks.length - 1) {
      sessions.push({
        id: `break-${task.id}`,
        type: "break",
        label: "Break",
        seconds: breakMinutes * 60,
      });
    }
  });

  return sessions;
}

function getFocusPolicy(sessionType) {
  if (sessionType === "break") {
    return {
      allowNotifications: true,
      blockedApps: [],
      mode: "break",
    };
  }

  return {
    allowNotifications: false,
    blockedApps: ["all_non_essential_apps"],
    mode: "focus",
  };
}

export default function App() {
  const [taskTitle, setTaskTitle] = useState("");
  const [taskMinutes, setTaskMinutes] = useState("25");
  const [tasks, setTasks] = useState([]);

  const [sessionQueue, setSessionQueue] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [focusPolicy, setFocusPolicy] = useState(getFocusPolicy("work"));

  const currentSession = sessionQueue[activeIndex];

  const canStart = tasks.length > 0;
  const isSessionActive = sessionQueue.length > 0;
  const focusModeSummary = useMemo(() => {
    if (focusPolicy.allowNotifications) {
      return "Break mode: notifications allowed";
    }

    return `Focus mode: notifications blocked, apps blocked = ${focusPolicy.blockedApps.join(", ")}`;
  }, [focusPolicy]);

  useEffect(() => {
    if (!isRunning || !currentSession) {
      return undefined;
    }

    const timer = setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          setActiveIndex((oldIndex) => {
            const nextIndex = oldIndex + 1;
            const nextSession = sessionQueue[nextIndex];

            if (!nextSession) {
              setSessionQueue([]);
              setIsRunning(false);
              setFocusPolicy(getFocusPolicy("break"));
              return oldIndex;
            }

            setFocusPolicy(getFocusPolicy(nextSession.type));
            return nextIndex;
          });

          return currentSession.seconds;
        }

        return previous - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [currentSession, isRunning, sessionQueue]);

  useEffect(() => {
    const nextSession = sessionQueue[activeIndex];
    if (nextSession) {
      setSecondsLeft(nextSession.seconds);
    }
  }, [activeIndex, sessionQueue]);

  function addTask() {
    const parsedMinutes = Number(taskMinutes);
    const cleanTitle = taskTitle.trim();

    if (!cleanTitle || !Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      return;
    }

    setTasks((previous) => [
      ...previous,
      { id: Date.now(), title: cleanTitle, minutes: Math.round(parsedMinutes) },
    ]);
    setTaskTitle("");
    setTaskMinutes("25");
  }

  function startSession() {
    const queue = buildSessions(tasks, DEFAULT_BREAK_MINUTES);
    if (queue.length === 0) {
      return;
    }

    setSessionQueue(queue);
    setActiveIndex(0);
    setSecondsLeft(queue[0].seconds);
    setFocusPolicy(getFocusPolicy(queue[0].type));
    setIsRunning(true);
  }

  function resetSession() {
    setSessionQueue([]);
    setActiveIndex(0);
    setSecondsLeft(0);
    setIsRunning(false);
    setFocusPolicy(getFocusPolicy("break"));
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>AI Powered Focus App</Text>
      <Text style={styles.subtitle}>
        Add tasks with duration, then start focus flow with automatic task switching.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create Task</Text>
        <TextInput
          style={styles.input}
          placeholder="Task title"
          value={taskTitle}
          onChangeText={setTaskTitle}
        />
        <TextInput
          style={styles.input}
          placeholder="Minutes"
          keyboardType="number-pad"
          value={taskMinutes}
          onChangeText={setTaskMinutes}
        />
        <Pressable style={styles.button} onPress={addTask}>
          <Text style={styles.buttonText}>Add task</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Task Queue</Text>
        <FlatList
          data={tasks}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => (
            <Text style={styles.taskRow}>
              {index + 1}. {item.title} ({item.minutes}m)
            </Text>
          )}
          ListEmptyComponent={<Text style={styles.emptyText}>No tasks yet</Text>}
        />
        <Pressable
          style={[styles.button, !canStart && styles.buttonDisabled]}
          onPress={startSession}
          disabled={!canStart}
        >
          <Text style={styles.buttonText}>Start</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Current Session</Text>
        {currentSession ? (
          <>
            <Text style={styles.sessionType}>
              {currentSession.type === "work" ? "Work" : "Break"}
            </Text>
            <Text style={styles.currentTask}>{currentSession.label}</Text>
            <Text style={styles.timer}>{formatTime(secondsLeft)}</Text>
          </>
        ) : (
          <Text style={styles.emptyText}>Start a task flow to begin</Text>
        )}
        {isSessionActive ? (
          <Pressable style={styles.button} onPress={resetSession}>
            <Text style={styles.buttonText}>Reset</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Focus Guard (Adjustable Placeholder)</Text>
        <Text style={styles.emptyText}>{focusModeSummary}</Text>
        <Text style={styles.hintText}>
          Integrate native app-blocking + notification APIs later using this policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f5f7ff",
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1f2a44",
  },
  subtitle: {
    fontSize: 14,
    color: "#4a5673",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2a44",
  },
  input: {
    borderColor: "#d8deed",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#3461ff",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
  taskRow: {
    color: "#1f2a44",
    paddingVertical: 2,
  },
  emptyText: {
    color: "#4a5673",
  },
  sessionType: {
    fontSize: 13,
    fontWeight: "600",
    color: "#3b4f7a",
  },
  currentTask: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2a44",
  },
  timer: {
    fontSize: 38,
    fontWeight: "700",
    color: "#111b36",
  },
  hintText: {
    color: "#667088",
    fontSize: 12,
  },
});
