# Lang Cards

Vocabulary flashcard app with spaced repetition. Just open it and start learning — no setup, no account, no database to think about.

**Try it online:** https://vova-lang-cards.netlify.app/

## Features

- **Spaced repetition** — words move through four stages (New → Consolidating → Blossoming → Ready), reviewed at the right time automatically
- **Card-flip exercise** — multi-round sessions with Wrong/Correct/Undo; keyboard shortcuts (Space / ← / →)
- **Vocabulary manager** — create multiple vocabs, import/export, rename, set language pair
- **Four library views** — flat, grammar (by part of speech), A–Z, custom category tree
- **Bulk actions** — set part of speech, attach/detach categories, delete, exercise a selection
- **Importance levels** — mark words ★★★ to review them more often
- **Localization** — English / Russian / Armenian UI

## Install

| Platform | Download |
|---|---|
| Windows | [Lang.Cards_1.0.3_x64_en-US.msi](https://github.com/AVova/LearnArmenianCards/releases/download/v1.0.3/Lang.Cards_1.0.3_x64_en-US.msi) |
| Ubuntu / Debian | [Lang.Cards_1.0.3_amd64.deb](https://github.com/AVova/LearnArmenianCards/releases/download/v1.0.3/Lang.Cards_1.0.3_amd64.deb) |
| macOS (Apple Silicon) | [Lang.Cards_1.0.3_aarch64.dmg](https://github.com/AVova/LearnArmenianCards/releases/download/v1.0.3/Lang.Cards_1.0.3_aarch64.dmg) |
| macOS (Intel) | [Lang.Cards_1.0.3_x64.dmg](https://github.com/AVova/LearnArmenianCards/releases/download/v1.0.3/Lang.Cards_1.0.3_x64.dmg) |

## Running locally

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

React 18 · TypeScript 5 · Vite 5 · Tauri 2

## Docs

- [ARCHITECTURE.md](ARCHITECTURE.md) — layer diagram, file map, data model, spaced repetition algorithm, design decisions
