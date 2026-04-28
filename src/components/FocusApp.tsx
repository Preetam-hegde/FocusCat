"use client";

import { useEffect, useMemo, useState } from "react";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { TaskBoard } from "@/components/TaskBoard";
import { LofiPlayer } from "@/components/LofiPlayer";
import { AmbientMixer } from "@/components/AmbientMixer";
import { NotesPad } from "@/components/NotesPad";
import { StatsPanel } from "@/components/StatsPanel";
import { ToastStack } from "@/components/Toast";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { getTimerSharedState, setTimerSharedState } from "@/lib/timer";
import { useToast } from "@/lib/useToast";
import { MagneticButton } from "@/components/MagneticButton";
import type { DailyStat, DailyStatsMap, FocusTheme, StoredTimerState, TimerMode } from "@/lib/types";

const THEMES: Array<{
  id: FocusTheme;
  label: string;
  note: string;
}> = [
  { id: "ember", label: "Ember", note: "Warm focus" },
  { id: "mist", label: "Mist", note: "Cool glass" },
  { id: "grove", label: "Grove", note: "Quiet green" }
];

function newSessionId() {
  return `session-${Date.now()}`;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateKey(raw: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const [, left, right, year] = slashMatch;
    const a = Number(left);
    const b = Number(right);

    if (a > 12 && b <= 12) {
      return `${year}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    }

    if (b > 12 && a <= 12) {
      return `${year}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
    }

    // Ambiguous 1-12/1-12: prefer day-first to preserve common en-IN formats.
    return `${year}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
  }

  const dashMatch = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, month, day, year] = dashMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return dateKey(parsed);
  }

  return null;
}

function normalizeStatsMap(stats: DailyStatsMap) {
  let changed = false;
  const next: DailyStatsMap = {};

  Object.entries(stats).forEach(([rawKey, value]) => {
    const normalizedKey = normalizeDateKey(rawKey) ?? normalizeDateKey(value.date) ?? rawKey;

    if (normalizedKey !== rawKey || value.date !== normalizedKey) {
      changed = true;
    }

    const existing = next[normalizedKey];
    const merged: DailyStat = {
      date: normalizedKey,
      focusedMinutes: (existing?.focusedMinutes ?? 0) + (value.focusedMinutes ?? 0),
      completedSessions: (existing?.completedSessions ?? 0) + (value.completedSessions ?? 0)
    };

    if (existing) {
      changed = true;
    }

    next[normalizedKey] = merged;
  });

  return changed ? next : stats;
}

function dailyTotals(stats: DailyStatsMap, targetKey: string) {
  return Object.entries(stats).reduce(
    (acc, [rawKey, value]) => {
      const normalized = normalizeDateKey(rawKey) ?? normalizeDateKey(value.date) ?? rawKey;
      if (normalized !== targetKey) return acc;

      return {
        focusedMinutes: acc.focusedMinutes + (value.focusedMinutes ?? 0),
        completedSessions: acc.completedSessions + (value.completedSessions ?? 0)
      };
    },
    { focusedMinutes: 0, completedSessions: 0 }
  );
}

function lastDays(total: number) {
  return Array.from({ length: total }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    return dateKey(date);
  });
}

export function FocusApp() {
  const [sessionId, setSessionId] = useState(newSessionId);
  const [stats, setStats, statsHydrated] = useLocalStorage<DailyStatsMap>("focus-stats", {});
  const [theme, setTheme] = useLocalStorage<FocusTheme>("focus-theme", "ember");
  const [focusMode, setFocusMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timerMode, setTimerMode] = useState<TimerMode>("work");
  const { toasts, addToast, removeToast } = useToast();
  const [activePane, setActivePane] = useState<"tasks" | "notes" | "audio" | "review">("tasks");
  const [timerSettings, setTimerSettings] = useState(() => {
    const timer = getTimerSharedState();
    return {
      workMinutes: timer.workMinutes,
      breakMinutes: timer.breakMinutes,
      autoStartNext: timer.autoStartNext
    };
  });

  useEffect(() => {
    const onChange = () => setFocusMode(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!statsHydrated) return;
    setStats((prev) => normalizeStatsMap(prev));
  }, [setStats, statsHydrated]);

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || target?.isContentEditable;
      if (isTyping) return;

      if (event.code === "Space") {
        event.preventDefault();
        window.dispatchEvent(new CustomEvent("focus-timer-control", { detail: "toggle" }));
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setSessionId(newSessionId());
        addToast("New session started", "info");
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => undefined);
        } else {
          document.exitFullscreen().catch(() => undefined);
        }
      }

      if (event.key === "?" || (event.shiftKey && event.key.toLowerCase() === "/")) {
        event.preventDefault();
        openSettings();
      }

      if (event.key === "Escape") {
        setSettingsOpen(false);
      }
    };

    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, [addToast]);

  const todaySummary = useMemo(() => {
    const today = dateKey(new Date());
    const minutes = dailyTotals(stats, today).focusedMinutes;
    const weekTotal = lastDays(7).reduce((acc, key) => acc + dailyTotals(stats, key).focusedMinutes, 0);
    return { minutes, weekTotal };
  }, [stats]);

  const modeLabel = timerMode === "work" ? "Work sprint" : "Break reset";
  const paneLabel = {
    tasks: "Tasks",
    notes: "Notes",
    audio: "Audio",
    review: "Review"
  }[activePane];

  function handleWorkComplete(minutes: number) {
    const key = dateKey(new Date());
    setStats((prev) => {
      const normalized = normalizeStatsMap(prev);
      const current = normalized[key] ?? { date: key, focusedMinutes: 0, completedSessions: 0 };
      return {
        ...normalized,
        [key]: {
          ...current,
          focusedMinutes: current.focusedMinutes + minutes,
          completedSessions: current.completedSessions + 1
        }
      };
    });
    addToast(`${minutes}m sprint complete. Break is ready.`, "success");
  }

  function startNewSession() {
    setSessionId(newSessionId());
    setActivePane("tasks");
    addToast("New session started", "info");
  }

  function syncTimerState(next: StoredTimerState) {
    setTimerSharedState(next);
    window.dispatchEvent(new CustomEvent("focus-timer-sync", { detail: next }));
    setTimerSettings({
      workMinutes: next.workMinutes,
      breakMinutes: next.breakMinutes,
      autoStartNext: next.autoStartNext
    });
  }

  function openSettings() {
    const current = getTimerSharedState();
    setTimerSettings({
      workMinutes: current.workMinutes,
      breakMinutes: current.breakMinutes,
      autoStartNext: current.autoStartNext
    });
    setSettingsOpen(true);
  }

  function updateTimerSettings(
    updates: Partial<Pick<StoredTimerState, "workMinutes" | "breakMinutes" | "autoStartNext">>
  ) {
    const current = getTimerSharedState();
    const nextWork = updates.workMinutes ?? current.workMinutes;
    const nextBreak = updates.breakMinutes ?? current.breakMinutes;

    syncTimerState({
      ...current,
      workMinutes: nextWork,
      breakMinutes: nextBreak,
      autoStartNext: updates.autoStartNext ?? current.autoStartNext,
      timeLeft:
        current.mode === "work"
          ? updates.workMinutes !== undefined
            ? nextWork * 60
            : current.timeLeft
          : updates.breakMinutes !== undefined
            ? nextBreak * 60
            : current.timeLeft
    });
  }

  function applyPreset(workMinutes: number, breakMinutes: number) {
    const current = getTimerSharedState();
    syncTimerState({
      ...current,
      workMinutes,
      breakMinutes,
      mode: "work",
      timeLeft: workMinutes * 60,
      isRunning: false
    });
  }

  return (
    <main
      className={focusMode ? "app-shell app-shell-focus" : "app-shell"}
      data-mode={timerMode}
      data-theme={theme}
    >
      <header className="topbar">
        <div className="topbar-brand">
          <span className="brand-dot" aria-hidden="true" />
          <div className="brand-copy">
            <h1>Focus Cat</h1>
          </div>
        </div>

        <div className="topbar-actions">
          <button className="ghost topbar-btn topbar-btn-ghost" onClick={openSettings}>
            Settings
          </button>
          <button className="topbar-btn" onClick={startNewSession}>New Session</button>
          <MagneticButton
            className="accent topbar-btn topbar-btn-primary"
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => undefined);
              } else {
                document.exitFullscreen().catch(() => undefined);
              }
            }}
          >
            {focusMode ? "Exit Focus" : "Focus Mode"}
          </MagneticButton>
        </div>
      </header>

      {focusMode ? (
        <section className="focus-stage" aria-live="polite">
          <div className="focus-stage-main">
            <PomodoroTimer onWorkComplete={handleWorkComplete} onModeChange={setTimerMode} compact theme={theme} />
          </div>
          <div className="focus-audio-stack">
            <LofiPlayer compact />
            <TaskBoard sessionId={sessionId} />
          </div>
        </section>
      ) : (
        <>
          <section className="workspace-dashboard" aria-label="Focus studio">
            <div className="workspace-main">
              <div className="workspace-stage">
                <PomodoroTimer onWorkComplete={handleWorkComplete} onModeChange={setTimerMode} theme={theme} />
              </div>
            </div>

            <aside className="workspace-sidebar" aria-label="Utility pane">
              <div className="utility-toggles" role="tablist" aria-label="Utility sections">
                <button
                  className={activePane === "tasks" ? "utility-toggle utility-toggle-open" : "utility-toggle"}
                  onClick={() => setActivePane("tasks")}
                  role="tab"
                  aria-selected={activePane === "tasks"}
                >
                  <span>Tasks</span>
                  <strong>Current sprint</strong>
                </button>
                <button
                  className={activePane === "notes" ? "utility-toggle utility-toggle-open" : "utility-toggle"}
                  onClick={() => setActivePane("notes")}
                  role="tab"
                  aria-selected={activePane === "notes"}
                >
                  <span>Notes</span>
                  <strong>Scratchpad</strong>
                </button>
                <button
                  className={activePane === "audio" ? "utility-toggle utility-toggle-open" : "utility-toggle"}
                  onClick={() => setActivePane("audio")}
                  role="tab"
                  aria-selected={activePane === "audio"}
                >
                  <span>Audio</span>
                  <strong>Scene + mix</strong>
                </button>
                <button
                  className={activePane === "review" ? "utility-toggle utility-toggle-open" : "utility-toggle"}
                  onClick={() => setActivePane("review")}
                  role="tab"
                  aria-selected={activePane === "review"}
                >
                  <span>Review</span>
                  <strong>Stats + streaks</strong>
                </button>
              </div>

              <div className="workspace-sidebar-panel">
                {activePane === "tasks" && <TaskBoard sessionId={sessionId} />}
                {activePane === "notes" && <NotesPad sessionId={sessionId} />}
                {activePane === "audio" && (
                  <div className="command-sound">
                    <LofiPlayer />
                    <AmbientMixer />
                  </div>
                )}
                {activePane === "review" && <StatsPanel stats={stats} />}
              </div>
            </aside>
          </section>

          <section className="workspace-bottombar" aria-label="Workspace status">
            <div className="bottombar-group">
              <span>{modeLabel}</span>
              <span suppressHydrationWarning>Session {sessionId.slice(-6)}</span>
              <span>{paneLabel}</span>
            </div>
            <p className="workspace-bottombar-signoff">made by pteo - preetam</p>
            <div className="bottombar-group bottombar-group-right">
              <span>{todaySummary.minutes}m today</span>
              <span>{todaySummary.weekTotal}m week</span>
              <span>Space toggles timer</span>
            </div>
          </section>
        </>
      )}

      {settingsOpen && (
        <aside className="settings-modal" role="dialog" aria-modal="true" aria-label="Workspace settings">
          <div className="settings-card">
            <div className="settings-head">
              <div>
                <p className="eyebrow">Workspace Settings</p>
                <h3>Timer and theme</h3>
              </div>
              <button className="ghost settings-close" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
                Close
              </button>
            </div>

            <section className="settings-section">
              <div className="settings-section-copy">
                <h4>Theme</h4>
                <p>Change the room mood without touching the workspace layout.</p>
              </div>

              <div className="theme-row" role="radiogroup" aria-label="Choose theme">
                {THEMES.map((option) => (
                  <button
                    key={option.id}
                    className={theme === option.id ? "theme-chip theme-chip-active" : "theme-chip"}
                    onClick={() => setTheme(option.id)}
                    role="radio"
                    aria-checked={theme === option.id}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.note}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="settings-section">
              <div className="settings-section-copy">
                <h4>Timer</h4>
                <p>Keep timer setup here and leave the main widget clean.</p>
              </div>

              <div className="preset-row settings-preset-row">
                <button onClick={() => applyPreset(25, 5)}>25 / 5</button>
                <button onClick={() => applyPreset(50, 10)}>50 / 10</button>
                <button onClick={() => applyPreset(90, 15)}>90 / 15</button>
              </div>

              <div className="duration-grid settings-duration-grid">
                <label>
                  Work (min)
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={timerSettings.workMinutes}
                    onChange={(event) => {
                      const nextValue = Math.min(180, Math.max(5, Number(event.target.value) || 25));
                      updateTimerSettings({ workMinutes: nextValue });
                    }}
                  />
                </label>
                <label>
                  Break (min)
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={timerSettings.breakMinutes}
                    onChange={(event) => {
                      const nextValue = Math.min(60, Math.max(1, Number(event.target.value) || 5));
                      updateTimerSettings({ breakMinutes: nextValue });
                    }}
                  />
                </label>
              </div>

              <label className="toggle-row settings-toggle-row">
                <input
                  type="checkbox"
                  checked={timerSettings.autoStartNext}
                  onChange={(event) => updateTimerSettings({ autoStartNext: event.target.checked })}
                />
                Auto-start next session
              </label>
            </section>

            <section className="settings-section">
              <div className="settings-section-copy">
                <h4>Keys</h4>
                <p>Fast controls stay here instead of taking space in the main workspace.</p>
              </div>

              <ul className="settings-hints">
                <li>
                  <span>Space</span>
                  <span>Start / pause timer</span>
                </li>
                <li>
                  <span>N</span>
                  <span>New session</span>
                </li>
                <li>
                  <span>F</span>
                  <span>Toggle focus mode</span>
                </li>
              </ul>
            </section>
          </div>
        </aside>
      )}

      <ToastStack toasts={toasts} onDismiss={removeToast} />
    </main>
  );
}
