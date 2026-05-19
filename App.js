import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

const Tab = createBottomTabNavigator();

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

function AddTaskScreen({ taskTitle, setTaskTitle, taskMinutes, setTaskMinutes, addTask, tasks, canStart, startSession, navigation }) {
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
          placeholderTextColor="#8b95a7"
          value={taskTitle}
          onChangeText={setTaskTitle}
        />
        <TextInput
          style={styles.input}
          placeholder="Minutes"
          keyboardType="number-pad"
          placeholderTextColor="#8b95a7"
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
          onPress={() => {
            startSession();
            navigation.navigate("Timer");
          }}
          disabled={!canStart}
        >
          <Text style={styles.buttonText}>Start Flow</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function TimerScreen({ currentSession, isSessionActive, secondsLeft, focusModeSummary, resetSession }) {
  return (
    <SafeAreaView style={styles.container}>
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
        {isSessionActive && (
          <Pressable style={styles.button} onPress={resetSession}>
            <Text style={styles.buttonText}>Reset Flow</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Focus Guard</Text>
        <Text style={styles.emptyText}>{focusModeSummary}</Text>
        <Text style={styles.hintText}>
          Integrate native app-blocking + notification APIs later using this policy.
        </Text>
      </View>
    </SafeAreaView>
  );
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
  const taskIdRef = useRef(1);

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
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous > 0) {
          return previous - 1;
        }

        const nextIndex = activeIndex + 1;
        const nextSession = sessionQueue[nextIndex];

        if (!nextSession) {
          setSessionQueue([]);
          setIsRunning(false);
          setFocusPolicy(getFocusPolicy("break"));
          return 0;
        }

        setActiveIndex(nextIndex);
        setFocusPolicy(getFocusPolicy(nextSession.type));
        return nextSession.seconds;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeIndex, currentSession, isRunning, sessionQueue]);

  useEffect(() => {
    const nextSession = sessionQueue[activeIndex];
    if (nextSession) {
      setSecondsLeft(nextSession.seconds);
    }
  }, [activeIndex, sessionQueue]);

  function addTask() {
    const parsedMinutes = Number(taskMinutes);
    const cleanTitle = taskTitle.trim();
    const roundedMinutes = Math.ceil(parsedMinutes);

    if (!isValidTaskInput(cleanTitle, roundedMinutes)) {
      return;
    }

    setTasks((previous) => [
      ...previous,
      {
        id: taskIdRef.current++,
        title: cleanTitle,
        minutes: roundedMinutes,
      },
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
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: "#5da2ff",
          tabBarInactiveTintColor: "#6b7688",
          tabBarStyle: {
            backgroundColor: "#0f1319",
            borderTopColor: "#1f2630",
          },
        }}
      >
        <Tab.Screen name="Tasks">
          {(props) => (
            <AddTaskScreen
              {...props}
              taskTitle={taskTitle}
              setTaskTitle={setTaskTitle}
              taskMinutes={taskMinutes}
              setTaskMinutes={setTaskMinutes}
              addTask={addTask}
              tasks={tasks}
              canStart={canStart}
              startSession={startSession}
            />
          )}
        </Tab.Screen>
        <Tab.Screen name="Timer">
          {(props) => (
            <TimerScreen
              {...props}
              currentSession={currentSession}
              isSessionActive={isSessionActive}
              secondsLeft={secondsLeft}
              focusModeSummary={focusModeSummary}
              resetSession={resetSession}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}

function isValidTaskInput(title, minutes) {
  return Boolean(title) && Number.isFinite(minutes) && minutes > 0;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#0d1117",
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#f0f6fc",
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    color: "#a0acbd",
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#161b22",
    borderRadius: 12,
    padding: 14,
    gap: 8,
    marginTop: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e6edf3",
  },
  input: {
    borderColor: "#2b3442",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#0f1319",
    color: "#e6edf3",
  },
  button: {
    backgroundColor: "#2f81f7",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#f0f6fc",
    fontWeight: "600",
  },
  taskRow: {
    color: "#d2d9e6",
    paddingVertical: 2,
  },
  emptyText: {
    color: "#8b95a7",
  },
  sessionType: {
    fontSize: 13,
    fontWeight: "600",
    color: "#9fb3d1",
  },
  currentTask: {
    fontSize: 18,
    fontWeight: "600",
    color: "#e6edf3",
  },
  timer: {
    fontSize: 38,
    fontWeight: "700",
    color: "#ffffff",
  },
  hintText: {
    color: "#7e8899",
    fontSize: 12,
  },
});
