"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { TaskBoard } from "@/components/TaskBoard";
import { ToastStack } from "@/components/Toast";
import { useLocalStorage } from "@/lib/useLocalStorage";
import { getTimerSharedState, setTimerSharedState } from "@/lib/timer";
import { useToast } from "@/lib/useToast";
import { MagneticButton } from "@/components/MagneticButton";
import type { DailyStat, DailyStatsMap, FocusSurface, FocusTheme, StoredTimerState, TaskItem, TimerMode } from "@/lib/types";

const THEMES: Array<{
  id: FocusTheme;
  label: string;
  note: string;
}> = [
  { id: "ember", label: "Ember", note: "Warm focus" },
  { id: "mist", label: "Mist", note: "Cool glass" },
  { id: "grove", label: "Grove", note: "Quiet green" }
];

const SURFACES: Array<{
  id: FocusSurface;
  label: string;
  note: string;
}> = [
  { id: "minimal", label: "Minimal", note: "Near-flat glass" },
  { id: "premium", label: "Premium", note: "Subtle hierarchy" }
];

const KEY_HINTS = [
  { key: "Space", action: "Start / pause timer" },
  { key: "N", action: "New session" },
  { key: "F", action: "Toggle focus mode" },
  { key: "?", action: "Open settings" }
];

function PaneLoading({ label }: { label: string }) {
  return (
    <section className="panel" aria-live="polite">
      <p className="meta">{label}</p>
    </section>
  );
}

const LofiPlayer = dynamic(() => import("@/components/LofiPlayer").then((mod) => mod.LofiPlayer), {
  ssr: false,
  loading: () => <PaneLoading label="Loading audio..." />
});

const AmbientMixer = dynamic(() => import("@/components/AmbientMixer").then((mod) => mod.AmbientMixer), {
  ssr: false,
  loading: () => <PaneLoading label="Loading mixer..." />
});

const NotesPad = dynamic(() => import("@/components/NotesPad").then((mod) => mod.NotesPad), {
  ssr: false,
  loading: () => <PaneLoading label="Loading notes..." />
});

const StatsPanel = dynamic(() => import("@/components/StatsPanel").then((mod) => mod.StatsPanel), {
  ssr: false,
  loading: () => <PaneLoading label="Loading stats..." />
});

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

type SessionSummaryState = {
  sessionId: string;
  doneCount: number;
  skippedCount: number;
  focusMinutes: number;
  suggestedNextTask: string | null;
};

function getSuggestedNextTask(tasks: TaskItem[], lastCompletedTaskId?: string) {
  const pending = tasks.filter((task) => !task.done);
  if (pending.length === 0) return null;

  if (!lastCompletedTaskId) {
    return pending[0]?.text ?? null;
  }

  const completedIndex = tasks.findIndex((task) => task.id === lastCompletedTaskId);
  if (completedIndex < 0) {
    return pending[0]?.text ?? null;
  }

  for (let index = completedIndex + 1; index < tasks.length; index += 1) {
    if (!tasks[index].done) {
      return tasks[index].text;
    }
  }

  for (let index = 0; index < completedIndex; index += 1) {
    if (!tasks[index].done) {
      return tasks[index].text;
    }
  }

  return pending[0]?.text ?? null;
}

export function FocusApp() {
  const [sessionId, setSessionId] = useState(newSessionId);
  const [taskMap, setTaskMap] = useLocalStorage<Record<string, TaskItem[]>>("focus-task-map", {});
  const [sessionFocusMap, setSessionFocusMap] = useLocalStorage<Record<string, number>>("focus-session-focus-map", {});
  const [sessionSignalMap, setSessionSignalMap] = useLocalStorage<Record<string, { lastCompletedTaskId?: string }>>(
    "focus-session-signal-map",
    {}
  );
  const [suggestedTaskMap, setSuggestedTaskMap] = useLocalStorage<Record<string, string>>("focus-suggested-task-map", {});
  const [stats, setStats, statsHydrated] = useLocalStorage<DailyStatsMap>("focus-stats", {});
  const [theme, setTheme] = useLocalStorage<FocusTheme>("focus-theme", "ember");
  const [surface, setSurface] = useLocalStorage<FocusSurface>("focus-surface", "premium");
  const [accentIntensity, setAccentIntensity] = useLocalStorage<number>("focus-accent-intensity", 66);
  const [focusMode, setFocusMode] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sessionRollover, setSessionRollover] = useState(false);
  const [timerMode, setTimerMode] = useState<TimerMode>("work");
  const { toasts, addToast, removeToast } = useToast();
  const [activePane, setActivePane] = useState<"tasks" | "notes" | "audio" | "review">("tasks");
  const [sessionSummary, setSessionSummary] = useState<SessionSummaryState | null>(null);
  const sessionRolloverTimerRef = useRef<number | null>(null);
  const [timerSettings, setTimerSettings] = useState(() => {
    const timer = getTimerSharedState();
    return {
      workMinutes: timer.workMinutes,
      breakMinutes: timer.breakMinutes,
      autoStartNext: timer.autoStartNext
    };
  });
  const currentTasks = useMemo(() => taskMap[sessionId] ?? [], [sessionId, taskMap]);
  const sessionSuggestedFromHistory = suggestedTaskMap[sessionId];
  const sessionLastCompletedTaskId = sessionSignalMap[sessionId]?.lastCompletedTaskId;
  const liveSuggestedTask = useMemo(
    () => getSuggestedNextTask(currentTasks, sessionLastCompletedTaskId),
    [currentTasks, sessionLastCompletedTaskId]
  );
  const suggestedTask = useMemo(() => {
    if (sessionSuggestedFromHistory && currentTasks.some((task) => !task.done && task.text === sessionSuggestedFromHistory)) {
      return sessionSuggestedFromHistory;
    }

    return liveSuggestedTask;
  }, [currentTasks, liveSuggestedTask, sessionSuggestedFromHistory]);

  const openSettings = useCallback(() => {
    const current = getTimerSharedState();
    setTimerSettings({
      workMinutes: current.workMinutes,
      breakMinutes: current.breakMinutes,
      autoStartNext: current.autoStartNext
    });
    setSettingsOpen(true);
  }, []);

  const startNewSession = useCallback(() => {
    if (sessionRolloverTimerRef.current) {
      window.clearTimeout(sessionRolloverTimerRef.current);
    }
    setSessionRollover(false);
    window.requestAnimationFrame(() => setSessionRollover(true));
    sessionRolloverTimerRef.current = window.setTimeout(() => setSessionRollover(false), 520);

    const outgoingTasks = taskMap[sessionId] ?? [];
    const completed = outgoingTasks.filter((task) => task.done).length;
    const pendingTasks = outgoingTasks.filter((task) => !task.done);
    const skipped = pendingTasks.length;
    const focusMinutes = sessionFocusMap[sessionId] ?? 0;
    const nextSuggestion = getSuggestedNextTask(outgoingTasks, sessionSignalMap[sessionId]?.lastCompletedTaskId);
    const nextSessionId = newSessionId();
    const carriedTasks = pendingTasks.map((task) => ({
      id: crypto.randomUUID(),
      text: task.text,
      done: false
    }));

    setTaskMap((prev) => ({
      ...prev,
      [nextSessionId]: carriedTasks
    }));
    setSessionFocusMap((prev) => ({
      ...prev,
      [nextSessionId]: 0
    }));
    setSessionSignalMap((prev) => ({
      ...prev,
      [nextSessionId]: {}
    }));

    if (nextSuggestion) {
      setSuggestedTaskMap((prev) => ({
        ...prev,
        [nextSessionId]: nextSuggestion
      }));
    }

    setSessionId(nextSessionId);
    setActivePane("tasks");
    setSessionSummary(
      completed > 0 || skipped > 0 || focusMinutes > 0
        ? {
            sessionId,
            doneCount: completed,
            skippedCount: skipped,
            focusMinutes,
            suggestedNextTask: nextSuggestion
          }
        : null
    );

    addToast("New session started", "info");
    if (skipped > 0) {
      addToast(`${skipped} unfinished task${skipped > 1 ? "s" : ""} moved to the next session`, "info");
    }
  }, [addToast, sessionFocusMap, sessionId, sessionSignalMap, setSessionFocusMap, setSessionSignalMap, setSuggestedTaskMap, setTaskMap, taskMap]);

  useEffect(() => {
    const onChange = () => setFocusMode(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    return () => {
      if (sessionRolloverTimerRef.current) {
        window.clearTimeout(sessionRolloverTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const mix = `${Math.round(10 + accentIntensity * 0.5)}%`;
    const glow = `${Math.round(20 + accentIntensity * 0.75)}%`;
    const tint = `${Math.round(8 + accentIntensity * 0.55)}%`;
    root.style.setProperty("--accent-mix-strength", mix);
    root.style.setProperty("--accent-glow-strength", glow);
    root.style.setProperty("--accent-tint-strength", tint);
  }, [accentIntensity]);

  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      root.style.setProperty("--parallax-bg-x", "0px");
      root.style.setProperty("--parallax-bg-y", "0px");
      root.style.setProperty("--parallax-glow-x", "0px");
      root.style.setProperty("--parallax-glow-y", "0px");
      return;
    }

    let raf = 0;
    const onMove = (event: MouseEvent) => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const xRatio = event.clientX / window.innerWidth - 0.5;
        const yRatio = event.clientY / window.innerHeight - 0.5;
        root.style.setProperty("--parallax-bg-x", `${(-xRatio * 14).toFixed(2)}px`);
        root.style.setProperty("--parallax-bg-y", `${(-yRatio * 14).toFixed(2)}px`);
        root.style.setProperty("--parallax-glow-x", `${(xRatio * 22).toFixed(2)}px`);
        root.style.setProperty("--parallax-glow-y", `${(yRatio * 22).toFixed(2)}px`);
      });
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

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
        startNewSession();
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
  }, [openSettings, startNewSession]);

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
    setSessionFocusMap((prev) => ({
      ...prev,
      [sessionId]: (prev[sessionId] ?? 0) + minutes
    }));
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

  function syncTimerState(next: StoredTimerState) {
    setTimerSharedState(next);
    window.dispatchEvent(new CustomEvent("focus-timer-sync", { detail: next }));
    setTimerSettings({
      workMinutes: next.workMinutes,
      breakMinutes: next.breakMinutes,
      autoStartNext: next.autoStartNext
    });
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

  function resetTimerDefaults() {
    applyPreset(25, 5);
    updateTimerSettings({ autoStartNext: false });
    addToast("Timer reset to 25 / 5", "info");
  }

  function updateCurrentSessionTasks(nextTasks: TaskItem[]) {
    setTaskMap((prev) => ({
      ...prev,
      [sessionId]: nextTasks
    }));
  }

  function handleTaskCompleted(taskId: string) {
    setSessionSignalMap((prev) => ({
      ...prev,
      [sessionId]: {
        ...prev[sessionId],
        lastCompletedTaskId: taskId
      }
    }));

    setSuggestedTaskMap((prev) => {
      if (!prev[sessionId]) return prev;
      const { [sessionId]: _ignored, ...rest } = prev;
      return rest;
    });
  }

  return (
    <main
      className={`${focusMode ? "app-shell app-shell-focus" : "app-shell"}${sessionRollover ? " session-rollover" : ""}`}
      data-mode={timerMode}
      data-theme={theme}
      data-surface={surface}
    >
      {!focusMode && (
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
      )}

      {focusMode ? (
        <section className="focus-immersive" aria-live="polite">
          <div className="focus-immersive-main">
            <PomodoroTimer onWorkComplete={handleWorkComplete} onModeChange={setTimerMode} compact immersive theme={theme} />
          </div>
          <div className="focus-immersive-audio">
            <LofiPlayer compact />
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
                {activePane === "tasks" && (
                  <TaskBoard
                    tasks={currentTasks}
                    onTasksChange={updateCurrentSessionTasks}
                    onTaskCompleted={handleTaskCompleted}
                    suggestedTaskText={suggestedTask}
                  />
                )}
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
            <p className="workspace-bottombar-signoff">made by ptwo - preetam</p>
            <div className="bottombar-group bottombar-group-right">
              <span>{todaySummary.minutes}m today</span>
              <span>{todaySummary.weekTotal}m week</span>
              <span>Space toggles timer</span>
            </div>
          </section>
        </>
      )}

      {sessionSummary && (
        <aside className="session-summary-modal" role="dialog" aria-modal="true" aria-label="Session summary">
          <div className="session-summary-card">
            <div className="session-summary-head">
              <div>
                <p className="eyebrow">Session wrapped</p>
                <h3>Summary</h3>
                <p className="session-summary-note" suppressHydrationWarning>
                  Session {sessionSummary.sessionId.slice(-6)}
                </p>
              </div>
              <button
                className="ghost"
                onClick={() => setSessionSummary(null)}
                aria-label="Close session summary"
              >
                Close
              </button>
            </div>

            <div className="session-summary-grid">
              <article>
                <h4>{sessionSummary.doneCount}</h4>
                <p>Done</p>
              </article>
              <article>
                <h4>{sessionSummary.skippedCount}</h4>
                <p>Skipped</p>
              </article>
              <article>
                <h4>{sessionSummary.focusMinutes}m</h4>
                <p>Focus minutes</p>
              </article>
            </div>

            {sessionSummary.suggestedNextTask && (
              <p className="session-summary-suggestion">
                Suggested next task: <strong>{sessionSummary.suggestedNextTask}</strong>
              </p>
            )}
          </div>
        </aside>
      )}

      {settingsOpen && (
        <aside className="settings-modal" role="dialog" aria-modal="true" aria-label="Workspace settings">
          <div className="settings-card">
            <div className="settings-head">
              <div>
                <p className="eyebrow">Workspace Settings</p>
                <h3>Studio controls</h3>
                <p className="settings-head-note">Tune visuals, timer flow, and shortcuts from one panel.</p>
              </div>
              <button className="ghost settings-close" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
                Close
              </button>
            </div>

            <div className="settings-layout">
              <nav className="settings-nav" aria-label="Settings sections">
                <a href="#settings-theme">Theme</a>
                <a href="#settings-style">Style</a>
                <a href="#settings-timer">Timer</a>
                <a href="#settings-keys">Keys</a>
              </nav>

              <div className="settings-content">
                <section id="settings-theme" className="settings-section">
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

                <section id="settings-style" className="settings-section">
                  <div className="settings-section-copy">
                    <h4>Style</h4>
                    <p>Switch between minimal and premium glass density.</p>
                  </div>

                  <div className="theme-row" role="radiogroup" aria-label="Choose surface style">
                    {SURFACES.map((option) => (
                      <button
                        key={option.id}
                        className={surface === option.id ? "theme-chip theme-chip-active" : "theme-chip"}
                        onClick={() => setSurface(option.id)}
                        role="radio"
                        aria-checked={surface === option.id}
                      >
                        <strong>{option.label}</strong>
                        <span>{option.note}</span>
                      </button>
                    ))}
                  </div>

                  <div className="settings-slider-row">
                    <label htmlFor="accent-intensity">Accent intensity</label>
                    <input
                      id="accent-intensity"
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={accentIntensity}
                      onChange={(event) => setAccentIntensity(Number(event.target.value))}
                    />
                    <span>{accentIntensity}%</span>
                  </div>
                </section>

                <section id="settings-timer" className="settings-section">
                  <div className="settings-section-copy">
                    <h4>Timer</h4>
                    <p>Keep timer setup here and leave the main widget clean.</p>
                  </div>

                  <div className="preset-row settings-preset-row">
                    <button onClick={() => applyPreset(25, 5)}>25 / 5</button>
                    <button onClick={() => applyPreset(50, 10)}>50 / 10</button>
                    <button onClick={() => applyPreset(90, 15)}>90 / 15</button>
                    <button className="ghost" onClick={resetTimerDefaults}>Reset defaults</button>
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

                <section id="settings-keys" className="settings-section">
                  <div className="settings-section-copy">
                    <h4>Keys</h4>
                    <p>Fast controls stay here instead of taking space in the main workspace.</p>
                  </div>

                  <ul className="settings-hints">
                    {KEY_HINTS.map((hint) => (
                      <li key={hint.key}>
                        <span>{hint.key}</span>
                        <span>{hint.action}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          </div>
        </aside>
      )}

      <ToastStack toasts={toasts} onDismiss={removeToast} />
    </main>
  );
}
