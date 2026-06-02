import { describe, it, expect } from 'vitest'
import strings from '../../locales/strings'

// ── helpers ────────────────────────────────────────────────────────────────

function flatKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.keys(obj).flatMap(k => {
    const path = prefix ? `${prefix}.${k}` : k
    const val = obj[k]
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      return flatKeys(val as Record<string, unknown>, path)
    }
    return [path]
  }).sort()
}

// ── key parity ─────────────────────────────────────────────────────────────

describe('locale key parity', () => {
  const enKeys = flatKeys(strings.en as unknown as Record<string, unknown>)

  it('ru has same keys as en', () => {
    expect(flatKeys(strings.ru as unknown as Record<string, unknown>)).toEqual(enKeys)
  })

  it('hy has same keys as en', () => {
    expect(flatKeys(strings.hy as unknown as Record<string, unknown>)).toEqual(enKeys)
  })
})
