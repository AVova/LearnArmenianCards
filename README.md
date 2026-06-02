# Lang Cards

Vocabulary flashcard app with spaced repetition. No server, no account — your words live in YAML files you own.

## Features

- **Spaced repetition** — N/C/S/R state machine (New → Consolidating → Blossoming → Ready) with a Bloom + Cram model
- **Card-flip exercise** — multi-round sessions with Wrong/Correct/Undo; keyboard shortcuts (Space / ← / →)
- **Vocabulary manager** — create multiple vocabs, import/export YAML, rename, set language pair
- **Four library views** — flat, grammar (by part of speech), A–Z, custom category tree
- **Bulk actions** — set PoS, attach/detach categories, delete, exercise a selection
- **Browser + desktop** — runs as a web app (localStorage) or native desktop app (Tauri, `~/Documents/LangCards/`)
- **Localization** — English / Russian / Armenian UI

## Running

```bash
npm install
npm run dev          # web dev server → http://localhost:5173
npm run build        # production web build → dist/

npm run tauri:dev    # native desktop window (requires Rust toolchain)
npm run tauri:build  # native installer for current platform

npx vitest run       # unit tests
npx tsc --noEmit     # type-check
```

## Stack

React 18 · TypeScript 5 · Vite 5 · Tauri 2 (optional desktop wrapper)

## Docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — layer diagram, file map, data model, spaced repetition algorithm, design decisions
