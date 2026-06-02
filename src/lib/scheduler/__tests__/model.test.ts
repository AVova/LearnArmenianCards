import { describe, it, expect } from 'vitest'
import {
  defaultMetadata,
  computeBloom,
  computeC,
  computeCurrentState,
  computeT,
  applyAnswerInSession,
  IMPORTANCE_VALS,
} from '../model'
import { Word, WordState, Metadata } from '../../types'

// ── helpers ────────────────────────────────────────────────────────────────

function makeWord(meta: Metadata): Word {
  return {
    id: 'w1',
    word: 'test',
    translations: [{ lang: 'en', text: 'test' }],
    metadata: meta,
  }
}

function session(state: WordState, B: number, C: number, D = 1.0) {
  return { state, B, C, D }
}

// ── defaultMetadata ────────────────────────────────────────────────────────

describe('defaultMetadata', () => {
  it('starts every word as N with zero bloom/cram and full difficulty', () => {
    const m = defaultMetadata()
    expect(m.state).toBe('N')
    expect(m.bloom).toBe(0)
    expect(m.cramProgress).toBe(0)
    expect(m.difficulty).toBe(1.0)
    expect(m.importance).toBe(1)
  })
})

// ── computeT ──────────────────────────────────────────────────────────────

describe('computeT', () => {
  it('returns 4 days for importance=1 D=1.0  [ (45/0.25)^0 + 3 = 1+3 ]', () => {
    expect(computeT(IMPORTANCE_VALS[1], 1.0)).toBeCloseTo(4)
  })

  it('grows larger for lower importance', () => {
    const T1 = computeT(IMPORTANCE_VALS[1], 0.5)
    const T3 = computeT(IMPORTANCE_VALS[3], 0.5)
    expect(T3).toBeLessThan(T1)
  })
})

// ── computeBloom ───────────────────────────────────────────────────────────

describe('computeBloom', () => {
  it('returns stored bloom unchanged in N state regardless of delta', () => {
    const w = makeWord({ ...defaultMetadata(), state: 'N', bloom: 0 })
    expect(computeBloom(w, 100)).toBe(0)
  })

  it('returns stored bloom unchanged in C state', () => {
    const w = makeWord({ state: 'C', bloom: 0, cramProgress: 0, difficulty: 1.0 })
    expect(computeBloom(w, 10)).toBe(0)
  })

  it('returns stored bloom=1 unchanged in R state', () => {
    const w = makeWord({ state: 'R', bloom: 1, cramProgress: 0, difficulty: 1.0 })
    expect(computeBloom(w, 10)).toBe(1)
  })

  it('returns stored bloom when deltaDays=0 in S state', () => {
    const w = makeWord({ state: 'S', bloom: 0.3, cramProgress: 0, difficulty: 1.0 })
    expect(computeBloom(w, 0)).toBe(0.3)
  })

  it('grows bloom in S state proportional to delta/T', () => {
    // importance=1, D=1.0 → T = (45/0.25)^0 + 3 = 4 days
    const w = makeWord({ state: 'S', bloom: 0, cramProgress: 0, difficulty: 1.0, importance: 1 })
    expect(computeBloom(w, 2)).toBeCloseTo(0.5)   // 0 + 2/4
    expect(computeBloom(w, 4)).toBeCloseTo(1.0)   // fully bloomed
  })

  it('caps bloom at 1.0', () => {
    const w = makeWord({ state: 'S', bloom: 0, cramProgress: 0, difficulty: 1.0, importance: 1 })
    expect(computeBloom(w, 100)).toBe(1.0)
  })
})

// ── computeC ──────────────────────────────────────────────────────────────

describe('computeC', () => {
  it('returns stored C when deltaDays=0', () => {
    const w = makeWord({ state: 'S', bloom: 0, cramProgress: 0.6 })
    expect(computeC(w, 0)).toBe(0.6)
  })

  it('decays C linearly — 1 day = full decay', () => {
    const w = makeWord({ state: 'S', bloom: 0, cramProgress: 0.8 })
    expect(computeC(w, 0.5)).toBeCloseTo(0.3)
    expect(computeC(w, 1.0)).toBe(0)
  })

  it('does NOT decay in C state — consolidation progress is frozen', () => {
    const w = makeWord({ state: 'C', bloom: 0, cramProgress: 0.4 })
    expect(computeC(w, 0.5)).toBe(0.4)
    expect(computeC(w, 100)).toBe(0.4)
  })

  it('clamps C at 0', () => {
    const w = makeWord({ state: 'N', bloom: 0, cramProgress: 0.1 })
    expect(computeC(w, 2.0)).toBe(0)
  })
})

// ── computeCurrentState ────────────────────────────────────────────────────

describe('computeCurrentState', () => {
  it('returns stored state for N/C/R words regardless of delta', () => {
    expect(computeCurrentState(makeWord({ state: 'N', bloom: 0 }), 100)).toBe('N')
    expect(computeCurrentState(makeWord({ state: 'C', bloom: 0 }), 100)).toBe('C')
    expect(computeCurrentState(makeWord({ state: 'R', bloom: 1 }), 100)).toBe('R')
  })

  it('keeps S state while bloom < 1', () => {
    // T=4 days with D=1.0, importance=1 — after 3 days B=0.75, not yet R
    const w = makeWord({ state: 'S', bloom: 0, difficulty: 1.0, importance: 1 })
    expect(computeCurrentState(w, 3)).toBe('S')
  })

  it('transitions S→R once bloom reaches 1', () => {
    const w = makeWord({ state: 'S', bloom: 0, difficulty: 1.0, importance: 1 })
    expect(computeCurrentState(w, 4)).toBe('R')
    expect(computeCurrentState(w, 100)).toBe('R')
  })
})

// ── applyAnswerInSession — state transitions ───────────────────────────────

describe('applyAnswerInSession — state transitions', () => {
  it('N + correct → C, B stays 0', () => {
    const r = applyAnswerInSession(session('N', 0, 0), true)
    expect(r.state).toBe('C')
    expect(r.B).toBe(0)
  })

  it('N + wrong → N (no transition)', () => {
    const r = applyAnswerInSession(session('N', 0, 0), false)
    expect(r.state).toBe('N')
  })

  it('C + correct → S, B resets to 0', () => {
    const r = applyAnswerInSession(session('C', 0, 0.4), true)
    expect(r.state).toBe('S')
    expect(r.B).toBe(0)
  })

  it('C + wrong → C (no transition)', () => {
    const r = applyAnswerInSession(session('C', 0, 0.4), false)
    expect(r.state).toBe('C')
  })

  it('R + correct → C, B stays 1', () => {
    const r = applyAnswerInSession(session('R', 1, 0), true)
    expect(r.state).toBe('C')
    expect(r.B).toBe(1)
  })

  it('R + wrong → R (no transition)', () => {
    const r = applyAnswerInSession(session('R', 1, 0), false)
    expect(r.state).toBe('R')
  })

  it('S + correct → stays S', () => {
    const r = applyAnswerInSession(session('S', 0.5, 0), true)
    expect(r.state).toBe('S')
  })

  it('S + wrong → stays S', () => {
    const r = applyAnswerInSession(session('S', 0.5, 0), false)
    expect(r.state).toBe('S')
  })
})

// ── applyAnswerInSession — cram updates ────────────────────────────────────

describe('applyAnswerInSession — cram updates', () => {
  it('correct adds 0.4', () => {
    const r = applyAnswerInSession(session('N', 0, 0), true)
    expect(r.C).toBeCloseTo(0.4)
  })

  it('wrong adds 0.2 when C < 0.5', () => {
    const r = applyAnswerInSession(session('N', 0, 0), false)
    expect(r.C).toBeCloseTo(0.2)
  })

  it('wrong adds nothing when C >= 0.5', () => {
    const r = applyAnswerInSession(session('N', 0, 0.5), false)
    expect(r.C).toBeCloseTo(0.5)
  })

  it('wrong adds nothing when C = 0.8', () => {
    const r = applyAnswerInSession(session('S', 0.5, 0.8), false)
    expect(r.C).toBeCloseTo(0.8)
  })

  it('cram is capped at 1.0', () => {
    const r = applyAnswerInSession(session('N', 0, 0.8), true)
    expect(r.C).toBe(1.0)
  })

  it('three correct answers saturate cram: 0 → 0.4 → 0.8 → 1.0', () => {
    let s = session('N', 0, 0)
    s = applyAnswerInSession(s, true)
    expect(s.C).toBeCloseTo(0.4)
    s = applyAnswerInSession({ ...s, state: 'C' }, true)  // N→C after first, then C state
    expect(s.C).toBeCloseTo(0.8)
    s = applyAnswerInSession({ ...s, state: 'S' }, true)  // C→S after second
    expect(s.C).toBe(1.0)
  })

  it('cram updates in all states', () => {
    for (const st of ['N', 'C', 'S', 'R'] as WordState[]) {
      const r = applyAnswerInSession(session(st, st === 'R' ? 1 : 0, 0), true)
      expect(r.C).toBeCloseTo(0.4)
    }
  })
})

// ── applyAnswerInSession — bloom penalty in S state ────────────────────────

describe('applyAnswerInSession — bloom penalty in S', () => {
  it('correct in S decreases B by 0.1 * deltaC (deltaC=0.4)', () => {
    const r = applyAnswerInSession(session('S', 0.5, 0), true)
    // deltaC = min(0.4, 1-0) = 0.4  →  newB = 0.5 - 0.04 = 0.46
    expect(r.B).toBeCloseTo(0.46)
  })

  it('wrong in S decreases B less (deltaC=0.2 when C=0)', () => {
    const r = applyAnswerInSession(session('S', 0.5, 0), false)
    // deltaC = min(0.2, 1-0) = 0.2  →  newB = 0.5 - 0.02 = 0.48
    expect(r.B).toBeCloseTo(0.48)
  })

  it('wrong in S with C>=0.5 causes no bloom penalty (deltaC=0)', () => {
    const r = applyAnswerInSession(session('S', 0.5, 0.6), false)
    // C >= 0.5 → cramIncrease = 0 → deltaC = 0 → no bloom drop
    expect(r.B).toBeCloseTo(0.5)
  })

  it('wrong in S decreases B exactly half vs correct (C=0)', () => {
    const rCorrect = applyAnswerInSession(session('S', 0.5, 0), true)
    const rWrong   = applyAnswerInSession(session('S', 0.5, 0), false)
    const dropCorrect = 0.5 - rCorrect.B
    const dropWrong   = 0.5 - rWrong.B
    expect(dropCorrect).toBeCloseTo(dropWrong * 2)
  })

  it('B cannot go below 0', () => {
    const r = applyAnswerInSession(session('S', 0.01, 0), true)
    expect(r.B).toBeGreaterThanOrEqual(0)
  })

  it('B does NOT decrease in N, C, R states', () => {
    for (const st of ['N', 'C', 'R'] as WordState[]) {
      const B = st === 'R' ? 1 : 0
      const r = applyAnswerInSession(session(st, B, 0), true)
      if (st === 'N') expect(r.B).toBe(0)   // N→C, B stays 0
      if (st === 'C') expect(r.B).toBe(0)   // C→S, B resets to 0
      if (st === 'R') expect(r.B).toBe(1)   // R→C, B stays 1
    }
  })
})

// ── applyAnswerInSession — difficulty update ──────────────────────────────

describe('applyAnswerInSession — difficulty', () => {
  it('D does not change when B=0 (r=0)', () => {
    const r = applyAnswerInSession(session('N', 0, 0, 0.5), true)
    expect(r.D).toBeCloseTo(0.5)
    const r2 = applyAnswerInSession(session('N', 0, 0, 0.5), false)
    expect(r2.D).toBeCloseTo(0.5)
  })

  it('correct in R decreases D (word got easier)', () => {
    // B=1, C=0, D=0.8 → r=(1-0)*1³=1; correct: D=(1-0.1)*0.8+0.1*0=0.72
    const r = applyAnswerInSession(session('R', 1, 0, 0.8), true)
    expect(r.D).toBeCloseTo(0.72)
  })

  it('wrong in R increases D (word is hard)', () => {
    // B=1, C=0, D=0.8 → r=1; wrong: D=(1-0.1)*0.8+0.1*1=0.72+0.1=0.82
    const r = applyAnswerInSession(session('R', 1, 0, 0.8), false)
    expect(r.D).toBeCloseTo(0.82)
  })

  it('D stays in [0,1]', () => {
    const r1 = applyAnswerInSession(session('R', 1, 0, 0.0), false)
    expect(r1.D).toBeGreaterThanOrEqual(0)
    const r2 = applyAnswerInSession(session('R', 1, 0, 1.0), true)
    expect(r2.D).toBeLessThanOrEqual(1)
  })
})

// ── full lifecycle simulation ──────────────────────────────────────────────

describe('full lifecycle simulation', () => {
  it('N → C → S → (wait 4 days) → R → C → S → (wait T+1 days) → R', () => {
    const w = makeWord({ ...defaultMetadata(), importance: 1 })  // T=4 days when D=1.0

    // Epoch 1: N
    expect(computeCurrentState(w, 0)).toBe('N')

    // Answer 1: correct → N→C
    let ss = applyAnswerInSession({ state: 'N', B: 0, C: 0, D: 1.0 }, true)
    expect(ss.state).toBe('C')

    // Answer 2: correct → C→S, B resets to 0
    ss = applyAnswerInSession(ss, true)
    expect(ss.state).toBe('S')
    expect(ss.B).toBe(0)

    // Word stored after session: state=S, bloom=0
    const w2 = makeWord({ state: 'S', bloom: 0, cramProgress: ss.C, difficulty: ss.D, importance: 1 })

    // After 2 days: still S
    expect(computeCurrentState(w2, 2)).toBe('S')
    expect(computeBloom(w2, 2)).toBeCloseTo(0.5)

    // After 4 days: transitions to R
    expect(computeCurrentState(w2, 4)).toBe('R')

    // Answer 3 (R session): correct → R→C, B stays 1
    const s3 = applyAnswerInSession({ state: 'R', B: 1, C: computeC(w2, 4), D: ss.D }, true)
    expect(s3.state).toBe('C')
    expect(s3.B).toBe(1)

    // Answer 4 (still C): correct → C→S, B resets to 0
    const s4 = applyAnswerInSession(s3, true)
    expect(s4.state).toBe('S')
    expect(s4.B).toBe(0)

    // Word stored: state=S, bloom=0 — new blossoming cycle starts
    // D changed during session (answers at B=1), so T may be longer than 4 days.
    const w3 = makeWord({ state: 'S', bloom: 0, cramProgress: s4.C, difficulty: s4.D, importance: 1 })
    const T3 = computeT(IMPORTANCE_VALS[1], s4.D)
    expect(computeCurrentState(w3, T3 + 1)).toBe('R')
  })

  it('wrong answers alone never advance state', () => {
    let s = { state: 'N' as WordState, B: 0, C: 0, D: 1.0 }
    for (let i = 0; i < 10; i++) {
      s = applyAnswerInSession(s, false)
    }
    expect(s.state).toBe('N')
  })

  it('1h threshold: deltaDays below 1/24 treats as no time passed', () => {
    const w = makeWord({ state: 'S', bloom: 0, cramProgress: 0, difficulty: 1.0, importance: 1 })
    // deltaDays = 0 → no change (as sent by App when < 1h)
    expect(computeBloom(w, 0)).toBe(0)
    expect(computeC(w, 0)).toBe(0)
  })
})

// ── debug day commit behaviour ─────────────────────────────────────────────

describe('debug day commit — fast-forward logic', () => {
  function fastForward(w: Word, days: number): Word {
    const newB     = computeBloom(w, days)
    const newC     = computeC(w, days)
    const newState = computeCurrentState(w, days)
    return { ...w, metadata: { ...w.metadata, state: newState, bloom: newB, cramProgress: newC } }
  }

  it('+1 day advances bloom by 1/T', () => {
    // importance=1, D=1.0 → T=4 days; 1 day → B=0.25
    const w = makeWord({ state: 'S', bloom: 0, cramProgress: 0, difficulty: 1.0, importance: 1 })
    const committed = fastForward(w, 1)
    expect(committed.metadata!.bloom).toBeCloseTo(0.25)
    expect(committed.metadata!.state).toBe('S')
  })

  it('+1 day applied four times reaches R state (T=4 days)', () => {
    let w = makeWord({ state: 'S', bloom: 0, cramProgress: 0, difficulty: 1.0, importance: 1 })
    for (let i = 0; i < 4; i++) {
      w = fastForward(w, 1)
    }
    expect(w.metadata!.state).toBe('R')
    expect(computeCurrentState(w, 0)).toBe('R')
  })

  it('turning off debug preserves simulated bloom in stored value', () => {
    const w = makeWord({ state: 'S', bloom: 0, cramProgress: 0, difficulty: 1.0, importance: 1 })
    const committed = fastForward(w, 3)   // T=4 → B = 0.75
    expect(committed.metadata!.bloom).toBeCloseTo(0.75)
    // After commit, meta resets → deltaDays ~0; computeBloom returns stored value
    expect(computeBloom(committed, 0)).toBeCloseTo(0.75)
  })

  it('debug off then back on continues from committed value, not from 0', () => {
    let w = makeWord({ state: 'S', bloom: 0, cramProgress: 0, difficulty: 1.0, importance: 1 })
    w = fastForward(w, 2)          // bloom = 0.5
    expect(w.metadata!.bloom).toBeCloseTo(0.5)
    w = fastForward(w, 2)          // bloom = 0.5 + 0.5 = 1.0 → R
    expect(w.metadata!.state).toBe('R')
  })

  it('C decay commits correctly when turning off debug', () => {
    const w = makeWord({ state: 'S', bloom: 0, cramProgress: 0.8, difficulty: 1.0 })
    const committed = fastForward(w, 0.5)  // C = 0.8 - 0.5 = 0.3
    expect(committed.metadata!.cramProgress).toBeCloseTo(0.3)
    expect(computeC(committed, 0)).toBeCloseTo(0.3)
  })
})
