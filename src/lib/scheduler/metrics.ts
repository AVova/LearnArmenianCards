// Aggregate metrics shown in the exercise setup screen (STK, LTK, predicted gain).

import { Word } from '../types'
import { computeBloom, computeC, computeCurrentState, IMPORTANCE_VALS } from './model'

/** Priority score for a word: B × I × D × (1 − C) — ignores overdrilled words */
export function computePriority(word: Word, deltaDays: number): number {
  const B = computeBloom(word, deltaDays)
  const I = IMPORTANCE_VALS[word.metadata?.importance ?? 1]
  const D = word.metadata?.difficulty ?? 1.0
  const C = computeC(word, deltaDays)
  return B * I * D * (1 - C)
}

/** STK = mean(C_current) over all non-N words */
export function computeSTK(words: Word[], deltaDays: number): number {
  const active = words.filter(w => (w.metadata?.state ?? 'N') !== 'N')
  if (active.length === 0) return 0
  return active.reduce((sum, w) => sum + computeC(w, deltaDays), 0) / active.length
}

/** LTK = 1 − mean(D) over all non-N words */
export function computeLTK(words: Word[]): number {
  const active = words.filter(w => (w.metadata?.state ?? 'N') !== 'N')
  if (active.length === 0) return 0
  return 1 - active.reduce((sum, w) => sum + (w.metadata?.difficulty ?? 1.0), 0) / active.length
}

/**
 * Predicted STK gain if all selected words get one correct answer.
 * = Σ((1-C_i)/2) / total_active
 */
export function predictedGain(selected: Word[], totalActive: number, deltaDays: number): number {
  if (totalActive === 0) return 0
  return selected.reduce((sum, w) => sum + (1 - computeC(w, deltaDays)) / 2, 0) / totalActive
}

/** Word counts per selection mode — used for SetupView display */
export function computeModeCounts(words: Word[], deltaDays: number): {
  fresh: number
  ready: number
  consolidating: number
  cram: number
} {
  return {
    fresh:         words.filter(w => (w.metadata?.state ?? 'N') === 'N').length,
    ready:         words.filter(w => computeCurrentState(w, deltaDays) === 'R').length,
    consolidating: words.filter(w => (w.metadata?.state ?? 'N') === 'C').length,
    cram:          words.filter(w => computeC(w, deltaDays) > 0).length,
  }
}
