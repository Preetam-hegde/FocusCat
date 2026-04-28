"use client";

import { useEffect, useMemo, useState } from "react";
import { playAlertTone } from "@/lib/audio";
import { FocusCat } from "@/components/FocusCat";
import { getTimerSharedState, setTimerSharedState } from "@/lib/timer";
import type { StoredTimerState, TimerMode } from "@/lib/types";

const RING_R = 88
const CIRCUMFERENCE = 2 * Math.PI * RING_R

type PomodoroTimerProps = {
  onWorkComplete: (minutes: number) => void;
  onModeChange?: (mode: TimerMode) => void;
  compact?: boolean;
  theme?: "ember" | "mist" | "grove";
};

function formatSeconds(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function PomodoroTimer({ onWorkComplete, onModeChange, compact = false, theme = "ember" }: PomodoroTimerProps) {
  const [timerState, setTimerState] = useState<StoredTimerState>(() => getTimerSharedState());
  const { workMinutes, breakMinutes, mode, timeLeft, isRunning, autoStartNext, cycleCount } = timerState;

  function updateTimerState(updater: StoredTimerState | ((prev: StoredTimerState) => StoredTimerState)) {
    setTimerState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setTimerSharedState(next);
      return next;
    });
  }

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<string>;
      if (custom.detail === "toggle") {
        updateTimerState((prev) => ({ ...prev, isRunning: !prev.isRunning }));
      }
      if (custom.detail === "reset") {
        updateTimerState((prev) => ({
          ...prev,
          isRunning: false,
          mode: "work",
          timeLeft: prev.workMinutes * 60
        }));
      }
    };

    window.addEventListener("focus-timer-control", handler as EventListener);
    return () => window.removeEventListener("focus-timer-control", handler as EventListener);
  }, []);

  useEffect(() => {
    const syncHandler = (event: Event) => {
      const custom = event as CustomEvent<StoredTimerState>;
      if (!custom.detail) return;
      setTimerState(custom.detail);
    };

    window.addEventListener("focus-timer-sync", syncHandler as EventListener);
    return () => window.removeEventListener("focus-timer-sync", syncHandler as EventListener);
  }, []);

  useEffect(() => {
    if (!isRunning) return;

    const intervalId = window.setInterval(() => {
      updateTimerState((prev) => ({ ...prev, timeLeft: prev.timeLeft - 1 }));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [isRunning]);

  useEffect(() => {
    if (timeLeft > 0) return;

    const timeoutId = window.setTimeout(() => {
      playAlertTone();

      if (mode === "work") {
        onWorkComplete(workMinutes);
        updateTimerState((prev) => ({
          ...prev,
          mode: "break",
          timeLeft: prev.breakMinutes * 60,
          cycleCount: prev.cycleCount + 1,
          isRunning: prev.autoStartNext
        }));
      } else {
        updateTimerState((prev) => ({
          ...prev,
          mode: "work",
          timeLeft: prev.workMinutes * 60,
          isRunning: prev.autoStartNext
        }));
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [mode, onWorkComplete, timeLeft, workMinutes]);

  const progress = useMemo(() => {
    const total = (mode === "work" ? workMinutes : breakMinutes) * 60;
    const spent = Math.max(0, total - timeLeft);
    return Math.min(100, (spent / total) * 100);
  }, [breakMinutes, mode, timeLeft, workMinutes]);

  function skipToNext() {
    updateTimerState((prev) => ({ ...prev, timeLeft: 0 }));
  }

  const presetLabel = `${workMinutes}/${breakMinutes}`;

  return (
    <section
      className={compact ? "panel timer-panel timer-panel-compact" : "panel timer-panel"}
      data-running={String(isRunning)}
    >
      <div className="timer-head section-head">
        <div>
          <p className="eyebrow">Pomodoro</p>
          <h2>{mode === "work" ? "Work Sprint" : "Break Reset"}</h2>
        </div>
        <span className={mode === "work" ? "mode-pill" : "mode-pill mode-pill-break"}>
          {mode === "work" ? "Focus" : "Recover"}
        </span>
      </div>

      <div className="timer-ring-wrap">
        {mode === "break" ? (
          <div className="pause-meter" aria-hidden="true">
            <div className="pause-meter-line">
              <span className="pause-meter-fill" style={{ height: `${progress}%` }} />
            </div>
            <div className="pause-meter-line">
              <span className="pause-meter-fill" style={{ height: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <svg className="timer-ring" viewBox="0 0 200 200" aria-hidden="true">
            <circle className="timer-ring-track" cx="100" cy="100" r={RING_R} />
            <circle
              className="timer-ring-fill"
              cx="100"
              cy="100"
              r={RING_R}
              style={{
                strokeDasharray: CIRCUMFERENCE,
                strokeDashoffset: CIRCUMFERENCE * (1 - progress / 100),
              }}
            />
          </svg>
        )}
        <div className="timer-display">{formatSeconds(Math.max(0, timeLeft))}</div>
      </div>

      <div className="timer-kpis">
        <article>
          <p>Preset</p>
          <h4>{presetLabel}</h4>
        </article>
        <article>
          <p>Cycles</p>
          <h4>{cycleCount}</h4>
        </article>
      </div>

      <FocusCat mode={mode} isRunning={isRunning} theme={theme} compact={compact} />

      <div className="actions-row">
        <button className="accent" onClick={() => updateTimerState((prev) => ({ ...prev, isRunning: !prev.isRunning }))}>
          {isRunning ? "Pause" : "Start"}
        </button>
        <button onClick={skipToNext}>Skip</button>
        <button
          onClick={() => {
            updateTimerState((prev) => ({
              ...prev,
              mode: "work",
              timeLeft: prev.workMinutes * 60,
              isRunning: false
            }));
          }}
        >
          Reset
        </button>
      </div>

      {!compact && <p className="meta">Shortcut: Space toggles start/pause.</p>}
    </section>
  );
}
