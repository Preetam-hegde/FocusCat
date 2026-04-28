"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { DailyStatsMap } from "@/lib/types";

type StatsPanelProps = {
  stats: DailyStatsMap;
};

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

    return `${year}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
  }

  const dashMatch = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, left, right, year] = dashMatch;
    const a = Number(left);
    const b = Number(right);

    if (a > 12 && b <= 12) {
      return `${year}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
    }

    if (b > 12 && a <= 12) {
      return `${year}-${String(a).padStart(2, "0")}-${String(b).padStart(2, "0")}`;
    }

    return `${year}-${String(b).padStart(2, "0")}-${String(a).padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return dateKey(parsed);
  }

  return null;
}

function buildLastDays(total: number) {
  return Array.from({ length: total }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() - (total - 1 - offset));
    return {
      key: dateKey(date),
      date
    };
  });
}

function getStreak(stats: DailyStatsMap) {
  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = dateKey(cursor);
    if (!stats[key] || stats[key].focusedMinutes <= 0) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
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

export function StatsPanel({ stats }: StatsPanelProps) {
  const today = dateKey(new Date());
  const todayEntry = dailyTotals(stats, today);
  const streak = getStreak(stats);

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = dateKey(yesterdayDate);
  const yesterdayEntry = dailyTotals(stats, yesterdayKey);
  const deltaMinutes = (todayEntry?.focusedMinutes ?? 0) - (yesterdayEntry?.focusedMinutes ?? 0);

  const weekDays = buildLastDays(7);
  const monthDays = buildLastDays(30);

  const weeklySeries = weekDays.map(({ key, date }) => ({
    day: date.toLocaleDateString("en-US", { weekday: "short" }),
    minutes: dailyTotals(stats, key).focusedMinutes
  }));

  const monthlySeries = monthDays.map(({ key, date }) => ({
    day: date.getDate().toString(),
    minutes: dailyTotals(stats, key).focusedMinutes,
    sessions: dailyTotals(stats, key).completedSessions
  }));

  const avgWeek = Math.round(weeklySeries.reduce((acc, item) => acc + item.minutes, 0) / 7);
  const peakDay = weeklySeries.reduce(
    (peak, item) => (item.minutes > peak.minutes ? item : peak),
    { day: "-", minutes: 0 }
  );

  return (
    <section className="panel">
      <div className="section-head">
        <h3>Stats & Streaks</h3>
        <p>Daily progress snapshots</p>
      </div>

      <div className="stats-grid">
        <article>
          <h4>{todayEntry?.focusedMinutes ?? 0} min</h4>
          <p>Focused today{deltaMinutes !== 0 ? ` (${deltaMinutes > 0 ? "+" : ""}${deltaMinutes}m vs yesterday)` : ""}</p>
        </article>
        <article>
          <h4>{todayEntry?.completedSessions ?? 0}</h4>
          <p>Sessions today</p>
        </article>
        <article>
          <h4>{streak} days</h4>
          <p>{streak > 1 ? "🔥 " : ""}Current streak</p>
        </article>
        <article>
          <h4>{avgWeek} min</h4>
          <p>Daily avg this week</p>
        </article>
      </div>

      <div className="chart-head">
        <h5>Last 7 days</h5>
        <p>Peak: {peakDay.day}</p>
      </div>
      <div className="chart-shell">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={weeklySeries} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id="weeklyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="rgba(125, 240, 197, 0.85)" />
                <stop offset="95%" stopColor="rgba(125, 240, 197, 0)" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(154, 181, 230, 0.15)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: "#8fa5c6", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#8fa5c6", fontSize: 12 }} axisLine={false} tickLine={false} width={34} />
            <Tooltip
              cursor={{ stroke: "rgba(125, 240, 197, 0.5)", strokeWidth: 1 }}
              contentStyle={{
                background: "rgba(4, 10, 20, 0.92)",
                border: "1px solid rgba(143, 175, 232, 0.4)",
                borderRadius: "12px",
                color: "#d8e7ff"
              }}
            />
            <Area
              type="monotone"
              dataKey="minutes"
              stroke="#7df0c5"
              strokeWidth={2.4}
              fill="url(#weeklyFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="chart-head">
        <h5>Last 30 days</h5>
        <p>Minutes + sessions</p>
      </div>
      <div className="chart-shell chart-shell-month">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthlySeries} margin={{ top: 12, right: 8, left: -14, bottom: 0 }}>
            <CartesianGrid stroke="rgba(154, 181, 230, 0.15)" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fill: "#8fa5c6", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval={4}
            />
            <YAxis tick={{ fill: "#8fa5c6", fontSize: 12 }} axisLine={false} tickLine={false} width={34} />
            <Tooltip
              contentStyle={{
                background: "rgba(4, 10, 20, 0.92)",
                border: "1px solid rgba(143, 175, 232, 0.4)",
                borderRadius: "12px",
                color: "#d8e7ff"
              }}
            />
            <Bar dataKey="minutes" fill="#6fb9ff" radius={[6, 6, 0, 0]} maxBarSize={14} />
            <Bar dataKey="sessions" fill="#7df0c5" radius={[6, 6, 0, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
