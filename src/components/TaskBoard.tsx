"use client";

import { useState } from "react";
import type { TaskItem } from "@/lib/types";

type TaskBoardProps = {
  tasks: TaskItem[];
  onTasksChange: (tasks: TaskItem[]) => void;
  onTaskCompleted?: (taskId: string) => void;
  suggestedTaskText?: string | null;
};

export function TaskBoard({ tasks, onTasksChange, onTaskCompleted, suggestedTaskText }: TaskBoardProps) {
  const [draft, setDraft] = useState("");

  const completedCount = tasks.filter((task) => task.done).length;
  const pendingCount = tasks.length - completedCount;
  const completionRatio = tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0;

  function updateTasks(next: TaskItem[]) {
    onTasksChange(next);
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
        <div className="task-head-meta">
          <p className="task-count">{completedCount} / {tasks.length} done</p>
          {completedCount > 0 && (
            <button className="ghost task-clear-btn" onClick={() => updateTasks(tasks.filter((t) => !t.done))}>
              Clear done
            </button>
          )}
        </div>
      </div>

      <div className="task-progress-meta" aria-live="polite">
        <p>{pendingCount} remaining</p>
        <p>{completionRatio}% complete</p>
      </div>
      <div className="task-progress-track" aria-hidden="true">
        <span style={{ width: `${completionRatio}%` }} />
      </div>

      {suggestedTaskText && pendingCount > 0 && (
        <div className="task-suggested" aria-live="polite">
          <p className="task-suggested-label">Suggested next</p>
          <strong>{suggestedTaskText}</strong>
        </div>
      )}

      <div className="input-row task-compose">
        <input
          className="task-input"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={120}
          placeholder="Add a task for this focus block"
          onKeyDown={(event) => {
            if (event.key === "Enter") addTask();
          }}
        />
        <button className="accent task-add-btn" onClick={addTask}>Add</button>
      </div>
      <p className="task-compose-hint">{draft.trim().length}/120</p>

      <ul className="task-list">
        {tasks.length === 0 && (
          <li className="task-empty">
            <p>No tasks yet.</p>
            <span>Add one to start your sprint.</span>
          </li>
        )}
        {tasks.map((task) => (
          <li key={task.id} className={task.done ? "task-item task-done" : "task-item"}>
            <label className="task-main">
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => {
                  const next = tasks.map((candidate) =>
                    candidate.id === task.id ? { ...candidate, done: !candidate.done } : candidate
                  );
                  updateTasks(next);
                  const toggled = next.find((candidate) => candidate.id === task.id);
                  if (toggled?.done) {
                    onTaskCompleted?.(task.id);
                  }
                }}
              />
              <span className="task-text">{task.text}</span>
            </label>
            <button
              className="ghost task-delete-btn"
              aria-label="Delete task"
              onClick={() => updateTasks(tasks.filter((candidate) => candidate.id !== task.id))}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
