// Exercise session orchestration. Manages session lifecycle: setup → exercise → round-end → all-done.
// Holds all session state (sessionState refs, answerLog, undoStack) and delegates rendering
// to DeckSetup, DeckExercise, DeckResults. No visual styling lives here.

import { useCallback, useEffect, useRef, useState } from 'react'
import { Category, Word } from '../lib/types'
import { getSubtreeIds } from '../lib/categoryUtils'
import {
  SelectionMethod, selectWords,
  computeBloom, computeC, computeCurrentState,
  applyAnswerInSession, applySessionResult,
  SessionWordState,
} from '../lib/scheduler'
import { SetupView } from './DeckSetup'
import { ExerciseView } from './DeckExercise'
import { RoundEndView, AllDoneView } from './DeckResults'

type DeckPhase = 'setup' | 'exercise' | 'roundEnd' | 'allDone'

type DeckProps = {
  words: Word[]
  categories: Category[]
  onClose: (updatedWords: Word[]) => void
  onPrepareNew: (updatedWords: Word[]) => void
  skipSetup?: boolean
  deltaDays: number
  learnedLang?: string
  knownLang?: string
}

type UndoEntry = {
  wordIndex: number
  wordId: string
  wasCorrect: boolean
  phaseAfter: DeckPhase
}

function makeSessionState(w: Word, deltaDays: number): SessionWordState {
  return {
    state: computeCurrentState(w, deltaDays),
    B: computeBloom(w, deltaDays),
    C: computeC(w, deltaDays),
    D: w.metadata?.difficulty ?? 1.0,
  }
}

export default function Deck({ words, categories, onClose, onPrepareNew, skipSetup, deltaDays, learnedLang, knownLang }: DeckProps) {
  const [phase, setPhase]               = useState<DeckPhase>(() => skipSetup ? 'exercise' : 'setup')
  const [sessionMethod, setSessionMethod] = useState<SelectionMethod>(() => skipSetup ? 'smart' : 'ready')
  const [sessionCount, setSessionCount]   = useState(() => skipSetup ? words.length : Math.min(20, words.length))
  const [selectionMethod, setSelectionMethod] = useState<SelectionMethod>('ready')
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())

  const [sessionWords, setSessionWords] = useState<Word[]>(() => skipSetup ? words : [])
  const sessionState        = useRef<Record<string, SessionWordState>>({})
  const sessionStartState   = useRef<Record<string, SessionWordState>>({})
  const answerLog           = useRef<Record<string, boolean[]>>({})

  // Populate refs synchronously for forced sessions (skipSetup) before first render
  const forcedInit = useRef(false)
  if (skipSetup && !forcedInit.current) {
    forcedInit.current = true
    words.forEach(w => {
      const s = makeSessionState(w, deltaDays)
      sessionState.current[w.id]      = { ...s }
      sessionStartState.current[w.id] = { ...s }
      answerLog.current[w.id]         = []
    })
  }

  const [roundQueue, setRoundQueue]   = useState<Word[]>(() => skipSetup ? words : [])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [flipped, setFlipped]         = useState(false)
  const [roundAnswers, setRoundAnswers] = useState<Record<string, boolean>>({})

  const [animClass, setAnimClass] = useState<string>('')
  const [entering, setEntering]   = useState(false)

  const [roundCorrect, setRoundCorrect] = useState(0)
  const [roundTotal, setRoundTotal]     = useState(0)
  const [roundNumber, setRoundNumber]   = useState(1)

  const [undoStack, setUndoStack]   = useState<UndoEntry[]>([])
  const [btnWrong, setBtnWrong]     = useState(false)
  const [btnCorrect, setBtnCorrect] = useState(false)

  const currentWord = roundQueue[currentIndex] ?? null
  const canUndo = undoStack.length > 0 && animClass === ''

  // ── session init ───────────────────────────────────────────

  const startSession = useCallback(() => {
    // Expand selected category IDs to include all descendant category IDs
    const expandedCatIds = new Set<string>()
    selectedCategoryIds.forEach(id => getSubtreeIds(id, categories).forEach(sid => expandedCatIds.add(sid)))
    const pool = expandedCatIds.size > 0
      ? words.filter(w => (w.categoryIds ?? []).some(id => expandedCatIds.has(id)))
      : words
    const selected = selectWords(pool, selectionMethod, sessionCount, deltaDays)

    sessionState.current      = {}
    sessionStartState.current = {}
    answerLog.current         = {}

    selected.forEach(w => {
      const s = makeSessionState(w, deltaDays)
      sessionState.current[w.id]      = { ...s }
      sessionStartState.current[w.id] = { ...s }
      answerLog.current[w.id]         = []
    })

    setSessionMethod(selectionMethod)
    setSessionWords(selected)
    setRoundQueue(selected)
    setCurrentIndex(0)
    setFlipped(false)
    setRoundAnswers({})
    setRoundNumber(1)
    setUndoStack([])
    setPhase('exercise')
  }, [words, selectionMethod, sessionCount, selectedCategoryIds, deltaDays])

  // ── answer ─────────────────────────────────────────────────

  const flip = useCallback(() => setFlipped(f => !f), [])

  const answer = useCallback((isCorrect: boolean) => {
    if (!currentWord || animClass) return

    const id = currentWord.id
    const capturedIndex = currentIndex

    const state = sessionState.current[id] ?? { state: 'N', S: 1.0, C: 0, D: 1.0 }
    const result = applyAnswerInSession(state, isCorrect)
    sessionState.current[id] = result
    answerLog.current[id] = [...(answerLog.current[id] ?? []), isCorrect]

    const newAnswers = { ...roundAnswers, [id]: isCorrect }
    setRoundAnswers(newAnswers)

    const nextIndex = capturedIndex + 1
    const isLastCard = nextIndex >= roundQueue.length
    let phaseAfter: DeckPhase = 'exercise'
    if (isLastCard) {
      const wrongCount = Object.values(newAnswers).filter(v => !v).length
      phaseAfter = wrongCount === 0 ? 'allDone' : 'roundEnd'
    }

    setUndoStack(prev => [...prev, { wordIndex: capturedIndex, wordId: id, wasCorrect: isCorrect, phaseAfter }])
    setAnimClass(isCorrect ? 'card-exit-correct' : 'card-exit-wrong')

    setTimeout(() => {
      setAnimClass('')
      if (isLastCard) {
        setRoundCorrect(Object.values(newAnswers).filter(Boolean).length)
        setRoundTotal(roundQueue.length)
        setPhase(phaseAfter)
      } else {
        setCurrentIndex(nextIndex)
        setFlipped(false)
        setEntering(true)
        setTimeout(() => setEntering(false), 350)
      }
    }, 350)
  }, [currentWord, animClass, currentIndex, roundAnswers, roundQueue])

  // ── undo ───────────────────────────────────────────────────

  const undo = useCallback(() => {
    if (undoStack.length === 0 || animClass) return

    const last = undoStack[undoStack.length - 1]

    const log = answerLog.current[last.wordId] ?? []
    const newLog = log.slice(0, -1)
    answerLog.current[last.wordId] = newLog

    const startSnap = sessionStartState.current[last.wordId]
    let st: SessionWordState = startSnap ?? { state: 'N', S: 1.0, C: 0, D: 1.0 }
    for (const a of newLog) {
      st = applyAnswerInSession(st, a)
    }
    sessionState.current[last.wordId] = st

    setRoundAnswers(prev => { const n = { ...prev }; delete n[last.wordId]; return n })
    setCurrentIndex(last.wordIndex)
    setFlipped(false)

    if (last.phaseAfter === 'roundEnd' || last.phaseAfter === 'allDone') setPhase('exercise')
    setUndoStack(prev => prev.slice(0, -1))
  }, [undoStack, animClass])

  // ── round / session flow ───────────────────────────────────

  const continueNextRound = useCallback(() => {
    const wrongIds = new Set(
      Object.entries(roundAnswers).filter(([, ok]) => !ok).map(([id]) => id)
    )
    setRoundQueue(sessionWords.filter(w => wrongIds.has(w.id)))
    setCurrentIndex(0); setFlipped(false); setRoundAnswers({})
    setRoundNumber(n => n + 1); setUndoStack([]); setPhase('exercise')
  }, [roundAnswers, sessionWords])

  const restartFull = useCallback(() => {
    setRoundQueue(sessionWords)
    setCurrentIndex(0); setFlipped(false); setRoundAnswers({})
    setRoundNumber(1); setUndoStack([]); setPhase('exercise')
  }, [sessionWords])

  // ── commit helpers ─────────────────────────────────────────

  // Apply session results to answered words; fast-forward S/C/state for all others.
  // App will reset LibraryMeta timestamps after receiving the result.
  const buildUpdatedWords = useCallback((currentDeltaDays: number): Word[] => {
    return words.map(w => {
      const hasAnswers = (answerLog.current[w.id]?.length ?? 0) > 0
      const state = sessionState.current[w.id]
      if (hasAnswers && state) {
        return applySessionResult(w, state)
      }
      // Not answered — fast-forward stored B/C and detect S→R transitions
      const newB     = computeBloom(w, currentDeltaDays)
      const newC     = computeC(w, currentDeltaDays)
      const newState = computeCurrentState(w, currentDeltaDays)
      const curB     = w.metadata?.bloom ?? 0
      const curC     = w.metadata?.cramProgress ?? 0
      const curState = w.metadata?.state ?? 'N'
      if (newB === curB && newC === curC && newState === curState) return w
      return { ...w, metadata: { ...w.metadata, state: newState, bloom: newB, cramProgress: newC } }
    })
  }, [words])

  const handleClose = useCallback(() => {
    onClose(buildUpdatedWords(deltaDays))
  }, [buildUpdatedWords, onClose, deltaDays])

  const commitAndPrepareNew = useCallback(() => {
    onPrepareNew(buildUpdatedWords(deltaDays))
    sessionState.current      = {}
    sessionStartState.current = {}
    answerLog.current         = {}
    setSessionWords([]); setRoundQueue([]); setCurrentIndex(0)
    setFlipped(false); setRoundAnswers({}); setRoundNumber(1); setUndoStack([])
    setPhase('setup')
  }, [buildUpdatedWords, onPrepareNew, deltaDays])

  // ── keyboard ───────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (phase === 'allDone' || phase === 'roundEnd' || phase === 'setup')) {
        e.preventDefault(); handleClose(); return
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); undo(); return }
      if (phase !== 'exercise') return
      if (e.key === ' ')           { e.preventDefault(); flip() }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); setBtnWrong(true);   setTimeout(() => setBtnWrong(false), 200);   answer(false) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); setBtnCorrect(true); setTimeout(() => setBtnCorrect(false), 200); answer(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, flip, answer, undo, handleClose])

  // ── render ─────────────────────────────────────────────────

  return (
    <div style={{
      position: 'fixed', inset: 0,
      backgroundColor: '#f0f2f5',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 500,
    }}>
      <button onClick={handleClose} style={{
        position: 'absolute', top: 16, right: 20,
        fontSize: 22, background: 'none', border: 'none',
        cursor: 'pointer', color: '#666', lineHeight: 1,
      }} title="Exit exercise">✕</button>

      {phase === 'setup' && (
        <SetupView
          words={words} categories={categories}
          count={sessionCount} setCount={setSessionCount}
          method={selectionMethod} setMethod={setSelectionMethod}
          selectedCategoryIds={selectedCategoryIds} setSelectedCategoryIds={setSelectedCategoryIds}
          onStart={startSession} deltaDays={deltaDays}
        />
      )}
      {phase === 'exercise' && currentWord && (
        <ExerciseView
          word={currentWord} flipped={flipped} animClass={animClass} entering={entering}
          index={currentIndex} total={roundQueue.length} roundNumber={roundNumber}
          btnWrong={btnWrong} btnCorrect={btnCorrect} canUndo={canUndo}
          onFlip={flip} onAnswer={answer} onUndo={undo}
          learnedLang={learnedLang} knownLang={knownLang}
        />
      )}
      {phase === 'roundEnd' && (
        <RoundEndView
          correct={roundCorrect} total={roundTotal} sessionTotal={sessionWords.length} roundNumber={roundNumber}
          onContinue={continueNextRound} onRestart={restartFull} onPrepareNew={commitAndPrepareNew}
        />
      )}
      {phase === 'allDone' && (
        <AllDoneView
          correct={roundCorrect} total={roundTotal} roundNumber={roundNumber}
          onRestart={restartFull} onClose={handleClose} onPrepareNew={commitAndPrepareNew}
        />
      )}
    </div>
  )
}
