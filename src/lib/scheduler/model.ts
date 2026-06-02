/**
 * Core Blossoming+Cram model — state machine version.
 *
 * Word lifecycle:  N → C → S → R → C → S → R → ...
 *
 *   N (New)          — never exercised
 *   C (Consolidating)— needs one more correct answer before blossoming starts; cram frozen
 *   S (Blossoming)   — waiting for time; B grows from 0 to 1
 *   R (Ready)        — B reached 1.0; ready for the next cram cycle
 *
 * Transitions (correct answer only):
 *   N → C   (1 correct)   B stays 0
 *   C → S   (1 correct)   B resets to 0, bloom clock starts
 *   R → C   (1 correct)   B stays 1 until C→S
 *   S → R                 time-based: when computeBloom reaches 1.0
 *
 * Cram (C) — all states, every answer:
 *   correct: C += 0.4   wrong: C += 0.2 only if C < 0.5, else no change   (capped at 1.0)
 *   decay:   C -= 1.0 per day; frozen in C state
 *
 * Bloom decrease in S state (early exercise penalty):
 *   new_B = B - 0.1 * deltaC
 *
 * Difficulty update (most effective when B ≈ 1):
 *   r = (1 − C) × B³
 *   D_new = (1 − 0.1r) × D + 0.1r × (1 − a)    a=1 correct, a=0 wrong
 *
 * Time is tracked globally via LibraryMeta (lastUpdateDate, lastDebugDateOffset).
 * computeBloom / computeC take deltaDays = time elapsed since last library commit.
 */

import { Word, WordState, Metadata } from '../types'

export const IMPORTANCE_VALS = { 1: 0.25, 2: 0.50, 3: 0.75 } as const

export function defaultMetadata(): Metadata {
  return {
    state: 'N',
    bloom: 0,
    cramProgress: 0,
    difficulty: 1.0,
    importance: 1,
  }
}

/** T = (45/I)^(1-D) + 3  (days) — steeping period */
export function computeT(importanceVal: number, D: number): number {
  return Math.pow(45 / importanceVal, 1 - D) + 3
}

/**
 * Current bloom (B) after time-based growth.
 * Only grows while state = 'S'. Returns stored value in all other states.
 */
export function computeBloom(word: Word, deltaDays: number): number {
  const state = word.metadata?.state ?? 'N'
  const B = word.metadata?.bloom ?? 0
  if (state !== 'S') return B
  if (B >= 1) return 1
  if (deltaDays <= 0) return B
  const D = word.metadata?.difficulty ?? 1.0
  const I = IMPORTANCE_VALS[word.metadata?.importance ?? 1]
  const T = computeT(I, D)
  return Math.max(0, Math.min(1, B + deltaDays / T))
}

/**
 * Current C after linear time decay (full decay in 1 day).
 * Frozen in C state — consolidation progress cannot slip while waiting for the next exercise.
 */
export function computeC(word: Word, deltaDays: number): number {
  const C = word.metadata?.cramProgress ?? 0
  if ((word.metadata?.state ?? 'N') === 'C') return C
  if (deltaDays <= 0) return C
  return Math.max(0, C - deltaDays)
}

/**
 * Effective current state after applying time delta.
 * The only time-based transition is S → R when bloom reaches 1.
 */
export function computeCurrentState(word: Word, deltaDays: number): WordState {
  const state = word.metadata?.state ?? 'N'
  if (state === 'S' && computeBloom(word, deltaDays) >= 1) return 'R'
  return state
}

export type SessionWordState = {
  state: WordState
  B: number  // bloom (was S)
  C: number
  D: number
}

/**
 * Apply one answer to in-session word state.
 * Fires immediately when the user presses Wrong or Correct on a card.
 */
export function applyAnswerInSession(
  session: SessionWordState,
  correct: boolean,
): SessionWordState {
  const { state, B, C, D } = session

  // Cram update — wrong only adds cram if C < 0.5
  const cramIncrease = correct ? 0.4 : (C < 0.5 ? 0.2 : 0)
  const newC = Math.min(1, C + cramIncrease)
  const deltaC = newC - C

  // Difficulty update: r = (1-C)*B³  (significant only when B≈1)
  const r = (1 - C) * Math.pow(B, 3)
  const a = correct ? 1 : 0
  const newD = Math.max(0, Math.min(1, (1 - 0.1 * r) * D + 0.1 * r * (1 - a)))

  if (correct) {
    switch (state) {
      case 'N': return { state: 'C', B: 0, C: newC, D: newD }         // activated
      case 'C': return { state: 'S', B: 0, C: newC, D: newD }         // bloom clock starts
      case 'R': return { state: 'C', B,    C: newC, D: newD }         // B stays 1 until C→S
      case 'S': {
        const newB = Math.max(0, B - 0.1 * deltaC)                    // early exercise penalty
        return { state: 'S', B: newB, C: newC, D: newD }
      }
    }
  }

  // Wrong answer — no state transition; bloom penalty in S state
  const newB = state === 'S' ? Math.max(0, B - 0.1 * deltaC) : B
  return { state, B: newB, C: newC, D: newD }
}

/** Write session results back to a Word. */
export function applySessionResult(word: Word, finalState: SessionWordState): Word {
  return {
    ...word,
    metadata: {
      ...word.metadata,
      state: finalState.state,
      bloom: finalState.B,
      cramProgress: finalState.C,
      difficulty: finalState.D,
    },
  }
}
