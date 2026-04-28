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

let timerSharedState: StoredTimerState = DEFAULT_TIMER_STATE;
let timerStateLoaded = false;

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

export function getTimerSharedState() {
  if (!timerStateLoaded && typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(TIMER_STORAGE_KEY);
      if (raw !== null) {
        timerSharedState = sanitizeTimerState(JSON.parse(raw));
      }
    } catch {
      timerSharedState = DEFAULT_TIMER_STATE;
    } finally {
      timerStateLoaded = true;
    }
  }

  return timerSharedState;
}

export function setTimerSharedState(next: StoredTimerState) {
  timerSharedState = sanitizeTimerState(next);
  timerStateLoaded = true;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timerSharedState));
  }
}

export function resetTimerSharedState() {
  setTimerSharedState(DEFAULT_TIMER_STATE);
}
