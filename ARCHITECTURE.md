# Lang Cards — Architecture

## What is this

A vocabulary flashcard app. The user loads a YAML vocabulary, studies words with a card-flip exercise, and the app tracks how well each word is known using a spaced-repetition algorithm. No server, no database — YAML files are the entire data store.

**Stack:** React 18 · TypeScript 5 · Vite 5 · Tauri 2 (native desktop).

---

## Layer diagram

```
┌─────────────────────────────────────────────────────┐
│  src/components/   Feature UI                        │
│  App · Library · Deck · Editor                       │
│  CategoryTree · CategoryNode                         │
│  VocabPicker · VocabCreator · LanguagePicker         │
│  + sub-files: LibraryRow, LibraryBulkBar,            │
│    DeckSetup, DeckExercise, DeckResults              │
│                                                      │
│  Rule: connects UI events → lib/ functions.          │
│  No business logic lives here.                       │
├─────────────────────────────────────────────────────┤
│  src/ui/           Visual primitives                 │
│  Button · Card · Popover · Stack · FormField · Modal │
│                                                      │
│  Rule: purely visual. No lib/ imports, no app logic. │
├─────────────────────────────────────────────────────┤
│  src/lib/          Pure business logic               │
│  types · scheduler · parser · storage                │
│  tauri-storage · i18n · platform · categoryUtils     │
│                                                      │
│  Rule: no React, no UI. Functions in, values out.    │
│  Exception: i18n.tsx exports a React Context/hook.   │
└─────────────────────────────────────────────────────┘
```

Import direction is strictly downward. `lib/` never imports from `components/` or `ui/`.

---

## File map

```
src/
├── main.tsx                    React entry — bootstraps App inside <LangProvider>
├── index.css                   Design tokens (CSS variables) + global classes
│
├── ui/                         Reusable visual primitives
│   ├── Button.tsx              All variants and sizes
│   ├── Card.tsx                White rounded container with shadow
│   ├── FormField.tsx           Label + input slot + inline error message
│   ├── Modal.tsx               Fixed backdrop + centered scrollable container
│   ├── Popover.tsx             Floating dropdown panel + PopoverItem
│   ├── Stack.tsx               Vertical flex container with gap
│   └── index.ts                Barrel export
│
├── components/                 Feature components
│   ├── App.tsx                 Root: file/vocab state, auto-save, two runtime paths (IS_TAURI)
│   │
│   ├── VocabPicker.tsx         Home screen — list vocabs, create/edit/delete/export
│   ├── VocabCreator.tsx        Modal — name, language pair, import or create empty
│   ├── LanguagePicker.tsx      [EN] [RU] [ՀԱՅ] toolbar widget
│   │
│   ├── Library.tsx             Vocabulary table — state, keyboard, selection logic
│   ├── LibraryRow.tsx          WordRow, GroupHeaderRow, flat/grammar/alphabet tbodies
│   ├── LibraryBulkBar.tsx      Bulk-action toolbar (PoS, category, exercise, delete)
│   ├── CategoryTree.tsx        Category tree root — renders CategoryNode list + add-root form
│   ├── CategoryNode.tsx        Single category node — owns rename/addChild/hover state; recursive
│   │
│   ├── Deck.tsx                Exercise session — session state, answer/undo, flow
│   ├── DeckSetup.tsx           Setup screen: mode cards, word count, category filter
│   ├── DeckExercise.tsx        Card-flip UI + Wrong/Correct action buttons
│   ├── DeckResults.tsx         RoundEndView + AllDoneView result screens
│   │
│   └── Editor.tsx              Word add/edit modal form
│
├── locales/                    UI string dictionaries
│   ├── en.ts                   English (source of truth; exports Strings type)
│   ├── ru.ts                   Russian
│   └── hy.ts                   Armenian (phonetic; needs native speaker review)
│
└── lib/                        Pure business logic
    ├── types.ts                Word, Category, Metadata, Translation, PartOfSpeech,
    │                           LibraryMeta, VocabMeta, GlobalMeta
    ├── platform.ts             IS_TAURI — runtime Tauri detection flag
    ├── i18n.tsx                LangProvider, useI18n() hook, t() resolver
    ├── wordIcons.ts            Shared emoji constants for word lifecycle stages
    ├── categoryUtils.ts        buildCategoryTree, getSubtreeIds, countDescendants
    ├── parser.ts               YAML ↔ {words, categories, meta, vocabulary}
    ├── browser-storage.ts      Browser localStorage: lc_meta + lc_vocab_* keys; import/export via blob
    ├── tauri-storage.ts        Tauri: program folder at ~/Documents/LangCards/, metadata.yaml, vocab I/O
    │
    ├── scheduler.ts            Barrel — import from here (re-exports all three below)
    └── scheduler/
        ├── model.ts            Core algorithm: computeBloom, computeC, applyAnswerInSession
        ├── selection.ts        selectWords, selectReady, selectFresh, selectCram, etc.
        └── metrics.ts          computeSTK, computeLTK, predictedGain, computeModeCounts

src-tauri/                      Tauri 2 native desktop wrapper
├── tauri.conf.json             App config: identifier, window size, dev/build URLs
├── Cargo.toml                  Rust deps: tauri, tauri-plugin-fs, tauri-plugin-dialog
├── build.rs                    tauri-build invocation
├── capabilities/
│   └── default.json            Scoped fs permissions: $DOCUMENT/LangCards/**
├── icons/                      RGBA PNG icon set (512×512 base)
└── src/
    ├── main.rs                 Binary entry — calls lib::run()
    └── lib.rs                  Tauri builder: registers fs + dialog plugins
```

---

## Runtime paths

The app has two runtime paths selected by `IS_TAURI` at startup:

```
IS_TAURI = typeof window !== 'undefined' &&
           ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
```

| Path | Entry point | File I/O |
|------|-------------|----------|
| **Tauri (desktop)** | VocabPicker → select vocab → Library | `tauri-storage.ts` via plugin-fs, files at `~/Documents/LangCards/` |
| **Browser** | VocabPicker → select vocab → Library | `browser-storage.ts` via localStorage (`lc_meta`, `lc_vocab_*`) |

Both paths share the same VocabPicker, Library, Deck, and Editor components. `IS_TAURI` only gates I/O calls.

---

## Data model

### Per-vocabulary YAML file

```yaml
vocabulary:                         # optional header block (new files); old files without it load fine
  id: "abc123"
  name: "Armenian Basics"
  learnedLang: "Armenian"
  knownLang: "English"
  showTranscription: true
  createdAt: "2026-06-01T00:00:00Z"

meta:
  lastUpdateDate: '2026-06-01T00:00:00.000Z'
  lastDebugDateOffset: 0

categories:
  - id: string
    name: string
    parentId: string | null
    order: number

words:
  - id: string
    word: string
    transcription: string
    translations:
      - lang: string
        text: string
    partOfSpeech: noun | verb | adjective | adverb | phrase | other
    categoryIds: [string]
    dateAdded: string
    metadata:
      importance: 1 | 2 | 3
      state: N | C | S | R
      bloom: number           # B ∈ [0,1]
      cramProgress: number    # C ∈ [0,1]
      difficulty: number      # D ∈ [0,1]
```

### Program folder (Tauri)

```
~/Documents/LangCards/
├── metadata.yaml          ← global index of all vocabularies
├── armenian_basics.yaml
└── russian_travel.yaml
```

`metadata.yaml` schema:
```yaml
version: 1
vocabs:
  - id: string
    name: string
    file: string             # filename within program folder
    learnedLang: string
    knownLang: string
    showTranscription: boolean
    createdAt: string
    wordCount: number        # cached; not authoritative
```

---

## The Blossoming + Cram model

Core algorithm in `src/lib/scheduler/`.

### Word lifecycle

```
  [N — New]
     │  first correct answer
     ▼
  [C — Consolidating]  ───────  needs one more correct answer; cram frozen
     │  correct answer
     ▼
  [S — Blossoming]  ──────────  B grows from 0 toward 1.0 over time
     │  B reaches 1.0
     ▼
  [R — Ready]  ───────────────  fully bloomed; ready for next cram cycle
     │  correct answer
     ▼
  [C — Consolidating]  ───────  new cycle; S stays 1 until C→S
     │
     └──► back to [S — Blossoming] (B resets to 0)
```

### Three live values per word

| Symbol | Name | Range | Meaning |
|--------|------|-------|---------|
| **B** | Bloom | [0, 1] | Review readiness. Grows only in S state. |
| **C** | Cram progress | [0, 1] | Short-term retention. Decays 1.0/day. |
| **D** | Difficulty | [0, 1] | Long-term mastery. Starts 1.0 (hardest). |

B and C are stored per-word as of `meta.lastUpdateDate`. Current value computed on demand.

### Formulas

```
T = (45 / I)^(1 − D) + 3            days for B to reach 1.0
B_now = min(1, B_stored + deltaDays / T)

C_now = max(0, C_stored − deltaDays)  (frozen while in C state)

cramIncrease = correct ? 0.4 : (C < 0.5 ? 0.2 : 0)
C_new = min(1, C + cramIncrease)
r = (1 − C) × B³
D_new = (1 − 0.1r) × D + 0.1r × (1 − a)    (a=1 correct, 0 wrong)

State transitions (correct only):
  N → C   B stays 0
  C → S   B resets to 0, bloom clock starts
  R → C   B stays 1 until C→S
  S → S   B -= 0.1 × deltaC  (early exercise penalty)
```

### Selection modes

| Mode | Selects |
|------|---------|
| Ready to review | R state (B = 1.0) |
| Consolidating | C state |
| New words | N state |
| Cram | C > 0, sorted descending |
| Most suited | Sorted by B × I × D × (1 − C) |

---

## Data flow

```
Tauri launch
  tauri-storage.ensureProgramFolder()
  tauri-storage.readGlobalMeta()
        │
        ▼
  VocabPicker  (user selects a vocab)
        │
        ▼
  tauri-storage.readVocabFile()
  parser.parseVocabularyFromYAML()
        │
        ▼               Browser launch
  App.tsx  ◄──────────  storage.openVocabularyFile()
  holds words[] + categories[] + libraryMeta + activeVocabMeta
        │
        ├── deltaDays computed from libraryMeta + debugDaysOffset
        │
        ├──► Library.tsx  (display + edits)
        │         └──► scheduler.computeBloom/computeC()  (per-row)
        │
        └──► Deck.tsx  (exercise session)
                  ├──► scheduler.selectWords()
                  ├──► scheduler.applyAnswerInSession()
                  └──► scheduler.applySessionResult()
                            │
                            ▼
                      App.tsx  receives updated words[]
                            │
                            ├── Tauri: tauri-storage.writeVocabFile()
                            └── Browser: browser-storage.writeVocabFileBrowser()
```

---

## Component behaviour

### Library view

**Keyboard navigation** — the table has a keyboard focus cursor separate from checkbox selection:
- `↑` / `↓` — move the focus cursor one row; wraps around
- `Shift+↑` / `Shift+↓` — extend selection range (anchor at first focused item)
- `Shift+click` — range-select from last focused item to clicked item
- `Ctrl/Cmd+click` — toggle one item's selection without moving focus
- `Enter` — toggle selection of all currently focused items; first Enter selects, next Enter deselects (tracked via `lastEnterSelected`); if focus moved to a group where all items are already selected, first Enter deselects

**Selection model** — each row has an `instanceId` (unique selection unit):
- Flat / grammar / alphabet views: `instanceId = word.id`
- Custom (category tree) view: `instanceId = word.id:category.id` — one word can appear in multiple categories and each instance is independently selectable. A `●` dot marks multi-category words.

**View modes** — toggled by toolbar buttons:
- `flat` — all words in insertion order
- `grammar` — grouped by part of speech
- `alphabet` — grouped by first 1 or 2 characters
- `custom` — hierarchical category tree; uncategorized words shown at the bottom

**Bulk bar** — appears when ≥ 1 word is selected; floats at the bottom of the screen. Actions: deselect all, exercise selected, set PoS, attach/detach category, delete.

---

### Deck exercise flow

```
VocabPicker (Tauri) ──► App loads vocab ──► user clicks "Exercise"
                                                   │
                                                   ▼
                                             DeckSetup
                                       (mode, count, category filter)
                                                   │ Start
                                                   ▼
                                            DeckExercise  ◄─────┐
                                       show front → flip → judge │
                                       Wrong: word stays in round │
                                       Correct: word removed       │
                                                   │ round complete│
                                                   ▼               │
                                             DeckResults            │
                                  ┌── all correct? → AllDoneView    │
                                  └── some wrong?  → RoundEndView   │
                                                        │ Continue  │
                                                        └───────────┘
                                                        │ New exercise
                                                        └──► DeckSetup
```

**Cram model in the UI** — the cram-meter column (Library table) shows how saturated a word is with short-term drilling. `💯` icon appears when `C > 0.9` (over-drilled; deprioritised by selection engine). The cram meter decays at 1.0/day naturally.

---

## Running the project

```bash
npm install
npm run dev           # browser dev server on http://localhost:5173
npm run tauri:dev     # native desktop window (requires Rust toolchain)
npm run build         # production web build → dist/
npm run tauri:build   # native installer for current platform
npx vitest run        # unit tests (132 tests)
npx tsc --noEmit      # type-check
```
