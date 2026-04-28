# Repository Guidelines

## Project Structure & Module Organization
This repository is a Next.js 16 app using the App Router and TypeScript. Keep route entry points in `src/app` (`layout.tsx`, `page.tsx`, `globals.css`), reusable UI in `src/components`, and shared logic and types in `src/lib`. Use the `@/*` path alias for imports from `src`. Place static assets in `public/` (currently used for ambient audio loops).

## Build, Test, and Development Commands
- `npm run dev`: start the local development server.
- `npm run build`: create the production build.
- `npm run start`: serve the production build locally.
- `npm run lint`: run the Next.js ESLint configuration.

Run `npm run lint` before opening a pull request. For production checks, use `npm run build` as the final verification step.

## Coding Style & Naming Conventions
The codebase uses TypeScript with `strict` mode enabled. Follow the existing style:
- 2-space indentation and semicolons omitted.
- Double quotes for strings.
- PascalCase for React components and file names in `src/components` (example: `PomodoroTimer.tsx`).
- camelCase for functions, variables, and hooks.
- Keep shared types in `src/lib/types.ts` or nearby when tightly scoped.

Prefer small client components with explicit props and keep browser-only code behind `"use client"`.

## Testing Guidelines
There is no automated test suite configured yet. Until one is added, treat `npm run lint` and `npm run build` as the minimum quality gate. If you introduce tests later, place them next to the feature or under `tests/`, and name them `*.test.ts` or `*.test.tsx`.

## Commit & Pull Request Guidelines
This repository does not have commit history yet, so use clear imperative commit messages such as `Add session notes autosave` or `Fix timer reset behavior`. Keep each commit focused on one change.

Pull requests should include a short summary, manual verification steps, and screenshots or short recordings for UI changes. Link the related issue when one exists, and call out any follow-up work or known limitations.
