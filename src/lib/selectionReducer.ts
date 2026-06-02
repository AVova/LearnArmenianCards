// Pure state machine for Library keyboard focus + selection.
// Extracted so the logic can be tested without React.

export type SelectionState = {
  /** Index of the focus anchor row (start of range). null = no focus. */
  focusAnchor: number | null
  /** Index of the focus end row (end of range; >= or <= anchor). */
  focusEnd: number | null
  /** Instance IDs of checked rows. */
  selectedInstanceIds: Set<string>
  /**
   * Tracks last Enter-key direction to make consecutive presses alternate.
   * null  = focus just moved, check actual state on next Enter
   * true  = last Enter selected → next Enter should deselect
   * false = last Enter deselected → next Enter should select
   */
  lastEnterSelected: boolean | null
}

export type SelectionAction =
  /** Arrow keys / click: move focus cursor. Shift extends the range. */
  | { type: 'FOCUS'; idx: number; shift: boolean }
  /** Escape / click outside: clear both anchor and end. */
  | { type: 'FOCUS_CLEAR' }
  /** Enter / Space: toggle selection of currently focused rows. */
  | { type: 'SELECT_FOCUSED'; focusedIds: Set<string> }
  /** Checkbox click: toggle one instance. */
  | { type: 'SELECT_INSTANCE'; instanceId: string }
  /** Group checkbox (category / PoS / alpha header): toggle all-or-nothing. */
  | { type: 'TOGGLE_GROUP'; instanceIds: string[] }
  /** Select-all checkbox in the table header: replace selection with the full set. */
  | { type: 'SELECT_ALL'; instanceIds: string[] }
  /** Deselect all, keep focus. */
  | { type: 'SELECTION_CLEAR' }
  /** Clear both focus and selection (view mode switch, bulk action done). */
  | { type: 'FULL_RESET' }
  /** Remove specific instance IDs (word deleted). */
  | { type: 'REMOVE_INSTANCE_IDS'; ids: string[] }

export function initialSelectionState(): SelectionState {
  return {
    focusAnchor: null,
    focusEnd: null,
    selectedInstanceIds: new Set(),
    lastEnterSelected: null,
  }
}

export function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case 'FOCUS': {
      if (action.shift && state.focusAnchor !== null) {
        return { ...state, focusEnd: action.idx, lastEnterSelected: null }
      }
      return { ...state, focusAnchor: action.idx, focusEnd: action.idx, lastEnterSelected: null }
    }

    case 'FOCUS_CLEAR': {
      return { ...state, focusAnchor: null, focusEnd: null }
    }

    case 'SELECT_FOCUSED': {
      const { focusedIds } = action
      if (focusedIds.size === 0) return state
      // First Enter after focus moved: check actual selection state instead of assuming.
      // This ensures a fully-selected group deselects on the first press without needing two.
      const shouldDeselect = state.lastEnterSelected === null
        ? [...focusedIds].every(id => state.selectedInstanceIds.has(id))
        : state.lastEnterSelected === true
      const n = new Set(state.selectedInstanceIds)
      if (shouldDeselect) focusedIds.forEach(id => n.delete(id))
      else                focusedIds.forEach(id => n.add(id))
      return { ...state, selectedInstanceIds: n, lastEnterSelected: !shouldDeselect }
    }

    case 'SELECT_INSTANCE': {
      const n = new Set(state.selectedInstanceIds)
      n.has(action.instanceId) ? n.delete(action.instanceId) : n.add(action.instanceId)
      return { ...state, selectedInstanceIds: n }
    }

    case 'TOGGLE_GROUP': {
      const { instanceIds } = action
      const allSelected = instanceIds.every(id => state.selectedInstanceIds.has(id))
      const n = new Set(state.selectedInstanceIds)
      if (allSelected) instanceIds.forEach(id => n.delete(id))
      else             instanceIds.forEach(id => n.add(id))
      return { ...state, selectedInstanceIds: n }
    }

    case 'SELECT_ALL': {
      return { ...state, selectedInstanceIds: new Set(action.instanceIds) }
    }

    case 'SELECTION_CLEAR': {
      return { ...state, selectedInstanceIds: new Set() }
    }

    case 'FULL_RESET': {
      return initialSelectionState()
    }

    case 'REMOVE_INSTANCE_IDS': {
      const n = new Set(state.selectedInstanceIds)
      action.ids.forEach(id => n.delete(id))
      return { ...state, selectedInstanceIds: n }
    }
  }
}
