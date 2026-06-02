// Word selection strategies for exercise sessions.

import { Word } from '../types'
import { computeBloom, computeC, computeCurrentState, IMPORTANCE_VALS } from './model'

export type SelectionMethod = 'fresh' | 'ready' | 'consolidating' | 'cram' | 'smart'

/** Words in R state — bloom reached 1.0, ready to start a new cram cycle */
export function selectReady(words: Word[], count: number, deltaDays: number): Word[] {
  const ready = words.filter(w => computeCurrentState(w, deltaDays) === 'R')
  return shuffle(ready).slice(0, Math.min(count, ready.length))
}

/** Words in C state — consolidating, need one correct answer to begin blossoming */
export function selectConsolidating(words: Word[], count: number): Word[] {
  const consolidating = words.filter(w => (w.metadata?.state ?? 'N') === 'C')
  return shuffle(consolidating).slice(0, Math.min(count, consolidating.length))
}

/** Words in N state — never exercised */
export function selectFresh(words: Word[], count: number): Word[] {
  const fresh = words.filter(w => (w.metadata?.state ?? 'N') === 'N')
  return shuffle(fresh).slice(0, Math.min(count, fresh.length))
}

/** Words with C > 0, sorted by cram progress descending — pure cram drill */
export function selectCram(words: Word[], count: number, deltaDays: number): Word[] {
  const withCram = words.filter(w => computeC(w, deltaDays) > 0)
  return withCram
    .sort((a, b) => computeC(b, deltaDays) - computeC(a, deltaDays))
    .slice(0, Math.min(count, withCram.length))
}

/** Sort by priority (B×I×D×(1-C)) desc — fallback "most suited" mode */
export function selectMostSuited(words: Word[], count: number, deltaDays: number): Word[] {
  const priority = (w: Word) => {
    const B = computeBloom(w, deltaDays)
    const I = IMPORTANCE_VALS[w.metadata?.importance ?? 1]
    const D = w.metadata?.difficulty ?? 1.0
    const C = computeC(w, deltaDays)
    return B * I * D * (1 - C)
  }
  return [...words]
    .sort((a, b) => priority(b) - priority(a))
    .slice(0, Math.min(count, words.length))
}

export function selectWords(
  words: Word[],
  method: SelectionMethod,
  count: number,
  deltaDays: number,
): Word[] {
  if (method === 'fresh')         return selectFresh(words, count)
  if (method === 'ready')         return selectReady(words, count, deltaDays)
  if (method === 'consolidating') return selectConsolidating(words, count)
  if (method === 'cram')          return selectCram(words, count, deltaDays)
  return selectMostSuited(words, count, deltaDays)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
