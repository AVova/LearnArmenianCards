// Shared emoji constants for word lifecycle stages.
// Import from here in both LibraryRow.tsx and DeckSetup.tsx to keep icons consistent.

export const ICON_NEW           = '🌱'  // N state — new, never exercised
export const ICON_BLOOMING_LOW  = '🌿'  // S state 0–50%
export const ICON_BLOOMING_HIGH = '🌷'  // S state 50–99%
export const ICON_READY         = '🌸'  // R state — fully bloomed
export const ICON_CONSOLIDATING = '🎯'  // C state — needs urgent exercise (shown in bloom column)
export const ICON_CRAM_LOCK     = '💯'  // C > 0.9 — heavily drilled (row indicator)
export const ICON_CRAM_MODE     = '🥊'  // cram selection mode card

// Knowledge level progression (based on 1−D, long-term mastery)
export const ICON_KNW_0 = '👶'  // 0–25%  newborn
export const ICON_KNW_1 = '🎒'  // 25–50% school kid
export const ICON_KNW_2 = '🎓'  // 50–75% graduate
export const ICON_KNW_3 = '🏆'  // 75–100% champion
