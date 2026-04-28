# Focus Cat

Focus Cat is a Next.js focus workspace that combines a Pomodoro timer, tasks, notes, ambient sound mixing, and lightweight focus stats in one interface.

## Features

- Pomodoro timer with work/break modes
- Presets and custom timer durations
- Auto-start next session toggle
- Task board tied to the current session
- Notes pad for quick session notes
- Lofi player and ambient mixer (rain, cafe, forest, brown noise loops)
- Focus Mode (fullscreen layout)
- Daily and weekly focused-minute stats
- Local persistence for timer settings, theme, and stats

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript (strict)
- Recharts

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
npm install
```

### Run in Development

```bash
npm run dev
```

Open http://localhost:3000.

## Scripts

- `npm run dev` - Start the local development server
- `npm run build` - Build for production
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint

## Keyboard Shortcuts

- `Space` - Start/Pause timer
- `N` - Start new session
- `F` - Toggle fullscreen focus mode
- `?` - Open settings
- `Esc` - Close settings

## Project Structure

```text
src/
  app/
    layout.tsx
    page.tsx
    globals.css
  components/
    FocusApp.tsx
    PomodoroTimer.tsx
    TaskBoard.tsx
    NotesPad.tsx
    LofiPlayer.tsx
    AmbientMixer.tsx
    StatsPanel.tsx
  lib/
    types.ts
    timer.ts
    useLocalStorage.ts
    useToast.ts
```

## Quality Gate

Before creating a PR:

```bash
npm run lint
npm run build
```
