"use client";

import type { StoredTimerState } from "@/lib/types";

export const DEFAULT_TIMER_STATE: StoredTimerState = {
  workMinutes: 25,
  breakMinutes: 5,
  mode: "work",
  timeLeft: 25 * 60,
  isRunning: false,
  autoStartNext: true,
  cycleCount: 0
};

const TIMER_STORAGE_KEY = "focus-timer-state";
const RUNNING_PERSIST_INTERVAL_MS = 5000;

let timerSharedState: StoredTimerState = DEFAULT_TIMER_STATE;
let timerStateLoaded = false;
let pendingPersistTimeout: number | null = null;
let lastPersistedState: StoredTimerState = DEFAULT_TIMER_STATE;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeTimerState(candidate: unknown): StoredTimerState {
  if (!candidate || typeof candidate !== "object") return DEFAULT_TIMER_STATE;

  const value = candidate as Partial<StoredTimerState>;
  const workMinutes = clamp(typeof value.workMinutes === "number" ? value.workMinutes : 25, 5, 180);
  const breakMinutes = clamp(typeof value.breakMinutes === "number" ? value.breakMinutes : 5, 1, 60);
  const mode = value.mode === "break" ? "break" : "work";

  return {
    workMinutes,
    breakMinutes,
    mode,
    timeLeft: clamp(
      typeof value.timeLeft === "number" ? value.timeLeft : workMinutes * 60,
      0,
      Math.max(workMinutes, breakMinutes) * 60
    ),
    isRunning: Boolean(value.isRunning),
    autoStartNext: typeof value.autoStartNext === "boolean" ? value.autoStartNext : true,
    cycleCount: Math.max(0, Math.floor(typeof value.cycleCount === "number" ? value.cycleCount : 0))
  };
}

function hasPersistentStateChange(prev: StoredTimerState, next: StoredTimerState) {
  return (
    prev.workMinutes !== next.workMinutes ||
    prev.breakMinutes !== next.breakMinutes ||
    prev.mode !== next.mode ||
    prev.isRunning !== next.isRunning ||
    prev.autoStartNext !== next.autoStartNext ||
    prev.cycleCount !== next.cycleCount
  );
}

function persistTimerStateNow(next: StoredTimerState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(next));
  lastPersistedState = next;
}

function schedulePersistTimerState() {
  if (typeof window === "undefined") return;

  if (pendingPersistTimeout !== null) return;

  pendingPersistTimeout = window.setTimeout(() => {
    pendingPersistTimeout = null;
    persistTimerStateNow(timerSharedState);
  }, RUNNING_PERSIST_INTERVAL_MS);
}

export function getTimerSharedState() {
  return timerSharedState;
}

export function hydrateTimerSharedState() {
  if (timerStateLoaded || typeof window === "undefined") {
    return timerSharedState;
  }

  try {
    const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
    if (raw !== null) {
      timerSharedState = sanitizeTimerState(JSON.parse(raw));
    }
  } catch {
    timerSharedState = DEFAULT_TIMER_STATE;
  } finally {
    lastPersistedState = timerSharedState;
    timerStateLoaded = true;
  }

  return timerSharedState;
}

export function setTimerSharedState(next: StoredTimerState) {
  timerSharedState = sanitizeTimerState(next);
  timerStateLoaded = true;

  if (typeof window !== "undefined") {
    const shouldPersistImmediately =
      !timerSharedState.isRunning ||
      hasPersistentStateChange(lastPersistedState, timerSharedState);

    if (shouldPersistImmediately) {
      if (pendingPersistTimeout !== null) {
        window.clearTimeout(pendingPersistTimeout);
        pendingPersistTimeout = null;
      }
      persistTimerStateNow(timerSharedState);
    } else {
      schedulePersistTimerState();
    }
  }
}
