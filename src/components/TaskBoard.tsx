"use client";

import { useState } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";
import type { TaskItem } from "@/lib/types";

type TaskBoardProps = {
  sessionId: string;
};

export function TaskBoard({ sessionId }: TaskBoardProps) {
  const [taskMap, setTaskMap] = useLocalStorage<Record<string, TaskItem[]>>("focus-task-map", {});
  const [draft, setDraft] = useState("");
  const tasks = taskMap[sessionId] ?? [];

  const completedCount = tasks.filter((task) => task.done).length;
  const completionRatio = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  function updateTasks(next: TaskItem[]) {
    setTaskMap((prev) => ({ ...prev, [sessionId]: next }));
  }

  function addTask() {
    const text = draft.trim();
    if (!text) return;

    updateTasks([
      ...tasks,
      {
        id: crypto.randomUUID(),
        text,
        done: false
      }
    ]);
    setDraft("");
  }

  return (
    <section className="panel task-board">
      <div className="section-head">
        <h3>Session Tasks</h3>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {completedCount > 0 && (
            <button
              onClick={() => updateTasks(tasks.filter((t) => !t.done))}
              style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem" }}
            >
              Clear done
            </button>
          )}
          <p>{completedCount} / {tasks.length} done</p>
        </div>
      </div>

      <div className="task-progress-track" aria-hidden="true">
        <span style={{ width: `${completionRatio}%` }} />
      </div>

      <div className="input-row">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a task for this focus block"
          onKeyDown={(event) => {
            if (event.key === "Enter") addTask();
          }}
        />
        <button className="accent" onClick={addTask}>Add</button>
      </div>

      <ul className="task-list">
        {tasks.length === 0 && <li className="task-empty">No tasks yet. Add one to start your sprint.</li>}
        {tasks.map((task) => (
          <li key={task.id} className={task.done ? "task-done" : ""}>
            <label>
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => {
                  const next = tasks.map((candidate) =>
                    candidate.id === task.id ? { ...candidate, done: !candidate.done } : candidate
                  );
                  updateTasks(next);
                }}
              />
              <span>{task.text}</span>
            </label>
            <button
              aria-label="Delete task"
              onClick={() => updateTasks(tasks.filter((candidate) => candidate.id !== task.id))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
