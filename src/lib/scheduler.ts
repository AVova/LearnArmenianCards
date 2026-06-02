// Barrel — re-exports from the scheduler sub-modules.
// Import from here as before; or import directly from the sub-module for focused editing.
//
//   lib/scheduler/model.ts     — core types, computeBloom/computeC/computeT, applyAnswer*, defaultMetadata
//   lib/scheduler/selection.ts — selectWords, selectReady, selectFresh, selectConsolidating, selectCram
//   lib/scheduler/metrics.ts   — computeSTK, computeLTK, predictedGain, computeModeCounts

export * from './scheduler/model'
export * from './scheduler/selection'
export * from './scheduler/metrics'
