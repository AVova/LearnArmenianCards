import { describe, it, expect } from 'vitest'
import {
  selectionReducer,
  initialSelectionState,
  SelectionState,
} from '../selectionReducer'

// ── helpers ────────────────────────────────────────────────────────────────

function s(overrides: Partial<SelectionState> = {}): SelectionState {
  return { ...initialSelectionState(), ...overrides }
}

function sel(...ids: string[]): Set<string> { return new Set(ids) }

// ── FOCUS ──────────────────────────────────────────────────────────────────

describe('FOCUS', () => {
  it('sets anchor and end to the given index', () => {
    const next = selectionReducer(s(), { type: 'FOCUS', idx: 3, shift: false })
    expect(next.focusAnchor).toBe(3)
    expect(next.focusEnd).toBe(3)
  })

  it('resets lastEnterSelected to null', () => {
    const state = s({ lastEnterSelected: true })
    const next = selectionReducer(state, { type: 'FOCUS', idx: 2, shift: false })
    expect(next.lastEnterSelected).toBeNull()
  })

  it('shift+FOCUS extends the range end, keeps anchor', () => {
    const state = s({ focusAnchor: 2, focusEnd: 2 })
    const next = selectionReducer(state, { type: 'FOCUS', idx: 5, shift: true })
    expect(next.focusAnchor).toBe(2)  // anchor unchanged
    expect(next.focusEnd).toBe(5)
  })

  it('shift+FOCUS with no anchor behaves like non-shift (sets new anchor)', () => {
    const next = selectionReducer(s({ focusAnchor: null }), { type: 'FOCUS', idx: 4, shift: true })
    expect(next.focusAnchor).toBe(4)
    expect(next.focusEnd).toBe(4)
  })

  it('shift+FOCUS can extend range upward (focusEnd < anchor)', () => {
    const state = s({ focusAnchor: 5, focusEnd: 5 })
    const next = selectionReducer(state, { type: 'FOCUS', idx: 1, shift: true })
    expect(next.focusAnchor).toBe(5)
    expect(next.focusEnd).toBe(1)
  })
})

// ── FOCUS_CLEAR ────────────────────────────────────────────────────────────

describe('FOCUS_CLEAR', () => {
  it('clears anchor and end', () => {
    const state = s({ focusAnchor: 3, focusEnd: 7 })
    const next = selectionReducer(state, { type: 'FOCUS_CLEAR' })
    expect(next.focusAnchor).toBeNull()
    expect(next.focusEnd).toBeNull()
  })

  it('does not affect selectedInstanceIds', () => {
    const state = s({ focusAnchor: 0, selectedInstanceIds: sel('a', 'b') })
    const next = selectionReducer(state, { type: 'FOCUS_CLEAR' })
    expect(next.selectedInstanceIds).toEqual(sel('a', 'b'))
  })
})

// ── SELECT_FOCUSED ─────────────────────────────────────────────────────────

describe('SELECT_FOCUSED', () => {
  it('selects focused items when none are selected and lastEnterSelected is null', () => {
    const state = s({ selectedInstanceIds: sel() })
    const next = selectionReducer(state, { type: 'SELECT_FOCUSED', focusedIds: sel('a', 'b') })
    expect(next.selectedInstanceIds).toEqual(sel('a', 'b'))
    expect(next.lastEnterSelected).toBe(true)
  })

  it('deselects when lastEnterSelected is null and all focused items are already selected', () => {
    const state = s({ selectedInstanceIds: sel('a', 'b'), lastEnterSelected: null })
    const next = selectionReducer(state, { type: 'SELECT_FOCUSED', focusedIds: sel('a', 'b') })
    expect(next.selectedInstanceIds).toEqual(sel())
    expect(next.lastEnterSelected).toBe(false)
  })

  it('deselects on second Enter (lastEnterSelected=true → deselect)', () => {
    const state = s({ selectedInstanceIds: sel('a', 'b'), lastEnterSelected: true })
    const next = selectionReducer(state, { type: 'SELECT_FOCUSED', focusedIds: sel('a', 'b') })
    expect(next.selectedInstanceIds).toEqual(sel())
    expect(next.lastEnterSelected).toBe(false)
  })

  it('selects on third Enter (lastEnterSelected=false → select)', () => {
    const state = s({ selectedInstanceIds: sel(), lastEnterSelected: false })
    const next = selectionReducer(state, { type: 'SELECT_FOCUSED', focusedIds: sel('a') })
    expect(next.selectedInstanceIds).toEqual(sel('a'))
    expect(next.lastEnterSelected).toBe(true)
  })

  it('does nothing when focusedIds is empty', () => {
    const state = s({ selectedInstanceIds: sel('x') })
    const next = selectionReducer(state, { type: 'SELECT_FOCUSED', focusedIds: sel() })
    expect(next).toBe(state)  // same reference — no change
  })

  it('mixed focused selection (some selected, some not) → selects all when lastEnterSelected=null', () => {
    // When partially selected and lastEnterSelected=null: not ALL are selected → shouldDeselect=false → select all
    const state = s({ selectedInstanceIds: sel('a'), lastEnterSelected: null })
    const next = selectionReducer(state, { type: 'SELECT_FOCUSED', focusedIds: sel('a', 'b') })
    expect(next.selectedInstanceIds.has('a')).toBe(true)
    expect(next.selectedInstanceIds.has('b')).toBe(true)
  })
})

// ── SELECT_INSTANCE ────────────────────────────────────────────────────────

describe('SELECT_INSTANCE', () => {
  it('adds instanceId when not selected', () => {
    const state = s({ selectedInstanceIds: sel() })
    const next = selectionReducer(state, { type: 'SELECT_INSTANCE', instanceId: 'w1' })
    expect(next.selectedInstanceIds).toEqual(sel('w1'))
  })

  it('removes instanceId when already selected', () => {
    const state = s({ selectedInstanceIds: sel('w1', 'w2') })
    const next = selectionReducer(state, { type: 'SELECT_INSTANCE', instanceId: 'w1' })
    expect(next.selectedInstanceIds).toEqual(sel('w2'))
  })
})

// ── TOGGLE_GROUP ───────────────────────────────────────────────────────────

describe('TOGGLE_GROUP', () => {
  it('selects all when none are selected', () => {
    const state = s()
    const next = selectionReducer(state, { type: 'TOGGLE_GROUP', instanceIds: ['a', 'b', 'c'] })
    expect(next.selectedInstanceIds).toEqual(sel('a', 'b', 'c'))
  })

  it('deselects all when all are already selected', () => {
    const state = s({ selectedInstanceIds: sel('a', 'b', 'c') })
    const next = selectionReducer(state, { type: 'TOGGLE_GROUP', instanceIds: ['a', 'b', 'c'] })
    expect(next.selectedInstanceIds).toEqual(sel())
  })

  it('selects all when only some are selected', () => {
    const state = s({ selectedInstanceIds: sel('a') })
    const next = selectionReducer(state, { type: 'TOGGLE_GROUP', instanceIds: ['a', 'b', 'c'] })
    expect(next.selectedInstanceIds).toEqual(sel('a', 'b', 'c'))
  })

  it('does not affect other selected ids outside the group', () => {
    const state = s({ selectedInstanceIds: sel('x', 'a', 'b') })
    const next = selectionReducer(state, { type: 'TOGGLE_GROUP', instanceIds: ['a', 'b'] })
    expect(next.selectedInstanceIds.has('x')).toBe(true)
    expect(next.selectedInstanceIds.has('a')).toBe(false)
  })
})

// ── SELECTION_CLEAR ────────────────────────────────────────────────────────

describe('SELECTION_CLEAR', () => {
  it('empties selectedInstanceIds, keeps focus', () => {
    const state = s({ focusAnchor: 2, focusEnd: 4, selectedInstanceIds: sel('a', 'b') })
    const next = selectionReducer(state, { type: 'SELECTION_CLEAR' })
    expect(next.selectedInstanceIds.size).toBe(0)
    expect(next.focusAnchor).toBe(2)
    expect(next.focusEnd).toBe(4)
  })
})

// ── FULL_RESET ─────────────────────────────────────────────────────────────

describe('FULL_RESET', () => {
  it('returns initial state', () => {
    const state = s({ focusAnchor: 3, focusEnd: 5, selectedInstanceIds: sel('a'), lastEnterSelected: true })
    const next = selectionReducer(state, { type: 'FULL_RESET' })
    expect(next).toEqual(initialSelectionState())
  })
})

// ── REMOVE_INSTANCE_IDS ────────────────────────────────────────────────────

describe('REMOVE_INSTANCE_IDS', () => {
  it('removes listed ids from selection', () => {
    const state = s({ selectedInstanceIds: sel('a', 'b', 'c') })
    const next = selectionReducer(state, { type: 'REMOVE_INSTANCE_IDS', ids: ['a', 'c'] })
    expect(next.selectedInstanceIds).toEqual(sel('b'))
  })

  it('is safe when ids are not in selection', () => {
    const state = s({ selectedInstanceIds: sel('a') })
    const next = selectionReducer(state, { type: 'REMOVE_INSTANCE_IDS', ids: ['x', 'y'] })
    expect(next.selectedInstanceIds).toEqual(sel('a'))
  })

  it('handles empty ids list', () => {
    const state = s({ selectedInstanceIds: sel('a', 'b') })
    const next = selectionReducer(state, { type: 'REMOVE_INSTANCE_IDS', ids: [] })
    expect(next.selectedInstanceIds).toEqual(sel('a', 'b'))
  })
})
