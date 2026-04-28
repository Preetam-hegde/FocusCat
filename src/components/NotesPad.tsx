"use client";

import { useMemo, useRef, useState } from "react";
import { useLocalStorage } from "@/lib/useLocalStorage";

// ── Minimal markdown → HTML renderer (no external deps) ──────────────────────

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function inlineMd(s: string) {
  return escHtml(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
}

function markdownToHtml(md: string): string {
  const lines = md.split("\n")
  const parts: string[] = []
  let inUl = false

  const closeUl = () => {
    if (inUl) { parts.push("</ul>"); inUl = false }
  }

  for (const line of lines) {
    if (/^### /.test(line)) {
      closeUl(); parts.push(`<h3>${inlineMd(line.slice(4))}</h3>`)
    } else if (/^## /.test(line)) {
      closeUl(); parts.push(`<h2>${inlineMd(line.slice(3))}</h2>`)
    } else if (/^# /.test(line)) {
      closeUl(); parts.push(`<h1>${inlineMd(line.slice(2))}</h1>`)
    } else if (/^---+$/.test(line.trim())) {
      closeUl(); parts.push("<hr />")
    } else if (/^- \[x\] /i.test(line)) {
      if (!inUl) { parts.push("<ul class='md-list'>"); inUl = true }
      parts.push(`<li class="md-li md-checked"><span class="md-cb md-cb-done">✓</span>${inlineMd(line.slice(6))}</li>`)
    } else if (/^- \[ \] /.test(line)) {
      if (!inUl) { parts.push("<ul class='md-list'>"); inUl = true }
      parts.push(`<li class="md-li"><span class="md-cb">○</span>${inlineMd(line.slice(6))}</li>`)
    } else if (/^- /.test(line)) {
      if (!inUl) { parts.push("<ul class='md-list'>"); inUl = true }
      parts.push(`<li class="md-li"><span class="md-bullet">·</span>${inlineMd(line.slice(2))}</li>`)
    } else if (line.trim() === "") {
      closeUl(); parts.push("<div class='md-gap'></div>")
    } else {
      closeUl(); parts.push(`<p class="md-p">${inlineMd(line)}</p>`)
    }
  }
  closeUl()
  return parts.join("")
}

type NotesPadProps = {
  sessionId: string;
};

type SlashTrigger = { start: number; end: number; query: string };
type ApplyResult = { next: string; cursor: number; selectLen?: number };
type Command = {
  id: string;
  label: string;
  icon: string;
  hint: string;
  apply: (value: string, slash: SlashTrigger) => ApplyResult;
};

function lineStartOf(value: string, pos: number): number {
  return value.lastIndexOf("\n", pos - 1) + 1;
}

const COMMANDS: Command[] = [
  {
    id: "heading",
    label: "Heading",
    icon: "H",
    hint: "## text",
    apply(value, { start, end }) {
      const ls = lineStartOf(value, start);
      const without = value.slice(0, start) + value.slice(end);
      const next = without.slice(0, ls) + "## " + without.slice(ls);
      return { next, cursor: ls + 3 };
    },
  },
  {
    id: "list",
    label: "List item",
    icon: "−",
    hint: "- item",
    apply(value, { start, end }) {
      const ls = lineStartOf(value, start);
      const without = value.slice(0, start) + value.slice(end);
      const next = without.slice(0, ls) + "- " + without.slice(ls);
      return { next, cursor: ls + 2 };
    },
  },
  {
    id: "check",
    label: "Checklist",
    icon: "☐",
    hint: "- [ ] item",
    apply(value, { start, end }) {
      const ls = lineStartOf(value, start);
      const without = value.slice(0, start) + value.slice(end);
      const next = without.slice(0, ls) + "- [ ] " + without.slice(ls);
      return { next, cursor: ls + 6 };
    },
  },
  {
    id: "bold",
    label: "Bold",
    icon: "B",
    hint: "**bold**",
    apply(value, { start, end }) {
      const next = value.slice(0, start) + "**bold**" + value.slice(end);
      return { next, cursor: start + 2, selectLen: 4 };
    },
  },
  {
    id: "italic",
    label: "Italic",
    icon: "I",
    hint: "_italic_",
    apply(value, { start, end }) {
      const next = value.slice(0, start) + "_italic_" + value.slice(end);
      return { next, cursor: start + 1, selectLen: 6 };
    },
  },
  {
    id: "code",
    label: "Inline code",
    icon: "`",
    hint: "`code`",
    apply(value, { start, end }) {
      const next = value.slice(0, start) + "`code`" + value.slice(end);
      return { next, cursor: start + 1, selectLen: 4 };
    },
  },
  {
    id: "divider",
    label: "Divider",
    icon: "—",
    hint: "---",
    apply(value, { start, end }) {
      const next = value.slice(0, start) + "\n---\n" + value.slice(end);
      return { next, cursor: start + 5 };
    },
  },
];

function getSlashTrigger(value: string, pos: number): SlashTrigger | null {
  const before = value.slice(0, pos);
  const match = before.match(/\/(\w*)$/);
  if (!match) return null;
  const start = pos - match[0].length;
  return { start, end: pos, query: match[1].toLowerCase() };
}

export function NotesPad({ sessionId }: NotesPadProps) {
  const [pagesMap, setPagesMap] = useLocalStorage<Record<string, string[]>>("focus-notes-v2", {});
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [savePulse, setSavePulse] = useState(0);
  const [copied, setCopied] = useState(false);
  const [activePage, setActivePage] = useState(0);
  const [slash, setSlash] = useState<SlashTrigger | null>(null);
  const [slashIdx, setSlashIdx] = useState(0);
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const pages = pagesMap[sessionId] ?? [""];
  const safeActive = Math.min(activePage, pages.length - 1);
  const text = pages[safeActive] ?? "";

  const { words, lines } = useMemo(() => {
    const w = text.trim() ? text.trim().split(/\s+/).length : 0;
    const l = text ? text.split("\n").length : 0;
    return { words: w, lines: l };
  }, [text]);

  function savePages(next: string[]) {
    setPagesMap((prev) => ({ ...prev, [sessionId]: next }));
    setSavedAt(new Date());
    setSavePulse((p) => p + 1);
  }

  function saveText(next: string) {
    const updated = [...pages];
    updated[safeActive] = next;
    savePages(updated);
  }

  function addPage() {
    const next = [...pages, ""];
    savePages(next);
    setActivePage(next.length - 1);
  }

  function deletePage(idx: number) {
    if (pages.length === 1) { saveText(""); return; }
    const next = pages.filter((_, i) => i !== idx);
    savePages(next);
    setActivePage(Math.min(safeActive, next.length - 1));
  }

  const filtered = slash
    ? COMMANDS.filter((c) =>
        !slash.query ||
        c.id.startsWith(slash.query) ||
        c.label.toLowerCase().startsWith(slash.query)
      )
    : [];

  function applyCommand(cmd: Command) {
    const ta = textareaRef.current;
    if (!ta || !slash) return;
    const { next, cursor, selectLen = 0 } = cmd.apply(text, slash);
    saveText(next);
    setSlash(null);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(cursor, cursor + selectLen);
    }, 0);
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    saveText(val);
    const trigger = getSlashTrigger(val, pos);
    setSlash(trigger);
    setSlashIdx(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!slash || filtered.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSlashIdx((i) => (i + 1) % filtered.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSlashIdx((i) => (i - 1 + filtered.length) % filtered.length); }
    else if (e.key === "Enter") { e.preventDefault(); applyCommand(filtered[slashIdx]); }
    else if (e.key === "Escape") { setSlash(null); }
  }

  function handleCopy() {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <section className="panel notes-panel">
      <div className="section-head">
        <h3>Notes</h3>
        <div className="notes-head-actions">
          <div className="notes-mode-toggle">
            <button
              className={`notes-mode-btn${viewMode === "edit" ? " notes-mode-btn-active" : ""}`}
              onClick={() => setViewMode("edit")}
            >Edit</button>
            <button
              className={`notes-mode-btn${viewMode === "preview" ? " notes-mode-btn-active" : ""}`}
              onClick={() => setViewMode("preview")}
            >Preview</button>
          </div>
          <button
            className={`notes-action-btn${copied ? " notes-copied" : ""}`}
            onClick={handleCopy}
            disabled={!text}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div className="notes-tabs">
        {pages.map((_, idx) => (
          <button
            key={idx}
            className={`notes-tab${safeActive === idx ? " notes-tab-active" : ""}`}
            onClick={() => setActivePage(idx)}
          >
            Note {idx + 1}
            {pages.length > 1 && (
              <span
                className="notes-tab-close"
                onMouseDown={(e) => { e.stopPropagation(); deletePage(idx); }}
              >
                ×
              </span>
            )}
          </button>
        ))}
        <button className="notes-tab notes-tab-add" onClick={addPage} title="New note">+</button>
      </div>

      {viewMode === "preview" ? (
        <div
          className="notes-preview"
          onClick={() => setViewMode("edit")}
          title="Click to edit"
          dangerouslySetInnerHTML={{ __html: text.trim() ? markdownToHtml(text) : "<p class='md-empty'>Nothing here yet — click to start writing.</p>" }}
        />
      ) : (
        <div className="notes-body">
          <textarea
            ref={textareaRef}
            value={text}
            placeholder={"Start typing… or type / for commands"}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setSlash(null), 150)}
          />
          {slash && filtered.length > 0 && (
            <div className="slash-menu">
              {filtered.map((cmd, i) => (
                <button
                  key={cmd.id}
                  className={`slash-item${slashIdx === i ? " slash-item-active" : ""}`}
                  onMouseDown={(e) => { e.preventDefault(); applyCommand(cmd); }}
                >
                  <span className="slash-icon">{cmd.icon}</span>
                  <span className="slash-label">{cmd.label}</span>
                  <span className="slash-hint">{cmd.hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="meta">
        <span
          key={savePulse}
          className={savePulse > 0 ? "save-dot save-dot-active" : "save-dot"}
        />
        {savedAt
          ? `Saved ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : "Auto-saved"}{" "}
        · {words}w · {text.length}ch · {lines}ln
      </p>
    </section>
  );
}

