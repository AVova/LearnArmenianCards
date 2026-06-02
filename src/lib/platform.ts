// Tauri v2 injects __TAURI_INTERNALS__ unconditionally; __TAURI__ requires withGlobalTauri:true
export const IS_TAURI = typeof window !== 'undefined' && (
  '__TAURI_INTERNALS__' in window || '__TAURI__' in window
)
