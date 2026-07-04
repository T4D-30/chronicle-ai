import { describe, it, expect } from 'vitest'
import { getEngineStatus, ENGINE_VERSION } from '@/lib/engine'

describe('Resolution Engine (Phase 1.6)', () => {
  it('returns the correct engine version', () => {
    expect(ENGINE_VERSION).toBe('1.6.0')
  })

  it('reports phase 1 and ready', () => {
    const status = getEngineStatus()
    expect(status.phase).toBe(1)
    expect(status.ready).toBe(true)
  })
})
