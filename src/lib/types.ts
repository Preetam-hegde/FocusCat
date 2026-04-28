export type TimerMode = "work" | "break";
export type FocusTheme = "ember" | "mist" | "grove";

export type TaskItem = {
  id: string;
  text: string;
  done: boolean;
};

export type DailyStat = {
  date: string;
  focusedMinutes: number;
  completedSessions: number;
};

export type DailyStatsMap = Record<string, DailyStat>;

export type LofiStation = {
  id: string;
  label: string;
  youtubeId: string;
};

export type AmbientTrack = "rain" | "cafe" | "forest" | "brown";

export type StoredTimerState = {
  workMinutes: number;
  breakMinutes: number;
  mode: TimerMode;
  timeLeft: number;
  isRunning: boolean;
  autoStartNext: boolean;
  cycleCount: number;
};
