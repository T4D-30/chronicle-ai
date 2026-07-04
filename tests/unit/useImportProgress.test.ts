/**
 * useImportProgress Tests — Phase 11.2
 */
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useImportProgress, PROGRESS_STAGE_LABEL } from '@/lib/ocr/useImportProgress'

describe('useImportProgress — initial state', () => {
  it('starts at stage "idle"', () => {
    const { result } = renderHook(() => useImportProgress())
    expect(result.current.stage).toBe('idle')
  })

  it('starts with an empty label', () => {
    const { result } = renderHook(() => useImportProgress())
    expect(result.current.label).toBe('')
  })

  it('starts with isActive: false', () => {
    const { result } = renderHook(() => useImportProgress())
    expect(result.current.isActive).toBe(false)
  })
})

describe('useImportProgress — setStage', () => {
  it('updates the stage', () => {
    const { result } = renderHook(() => useImportProgress())
    act(() => result.current.setStage('uploading'))
    expect(result.current.stage).toBe('uploading')
  })

  it.each([
    ['uploading', 'Uploading…'],
    ['reading_pages', 'Reading pages…'],
    ['processing', 'Processing…'],
    ['extracting', 'Extracting…'],
    ['building_draft', 'Building draft…'],
    ['ready', 'Ready for review'],
  ] as const)('derives the correct label for stage "%s"', (stage, expectedLabel) => {
    const { result } = renderHook(() => useImportProgress())
    act(() => result.current.setStage(stage))
    expect(result.current.label).toBe(expectedLabel)
  })

  it('derives an empty label for the "error" stage — error UI supplies its own message', () => {
    const { result } = renderHook(() => useImportProgress())
    act(() => result.current.setStage('error'))
    expect(result.current.label).toBe('')
  })
})

describe('useImportProgress — isActive', () => {
  it('is true for every real in-progress stage', () => {
    const { result } = renderHook(() => useImportProgress())
    const inProgressStages = ['uploading', 'reading_pages', 'processing', 'extracting', 'building_draft'] as const
    for (const stage of inProgressStages) {
      act(() => result.current.setStage(stage))
      expect(result.current.isActive).toBe(true)
    }
  })

  it('is false for "idle"', () => {
    const { result } = renderHook(() => useImportProgress())
    expect(result.current.isActive).toBe(false)
  })

  it('is false for "ready" — extraction finished, no longer "in progress"', () => {
    const { result } = renderHook(() => useImportProgress())
    act(() => result.current.setStage('ready'))
    expect(result.current.isActive).toBe(false)
  })

  it('is false for "error" — failed, no longer "in progress"', () => {
    const { result } = renderHook(() => useImportProgress())
    act(() => result.current.setStage('error'))
    expect(result.current.isActive).toBe(false)
  })
})

describe('useImportProgress — reset', () => {
  it('returns the stage to "idle" from any other stage', () => {
    const { result } = renderHook(() => useImportProgress())
    act(() => result.current.setStage('extracting'))
    expect(result.current.stage).toBe('extracting')
    act(() => result.current.reset())
    expect(result.current.stage).toBe('idle')
  })
})

describe('PROGRESS_STAGE_LABEL — exported constant completeness', () => {
  it('has an entry for every ImportProgressStage value', () => {
    const stages = ['idle', 'uploading', 'reading_pages', 'processing', 'extracting', 'building_draft', 'ready', 'error']
    for (const stage of stages) {
      expect(PROGRESS_STAGE_LABEL).toHaveProperty(stage)
    }
  })
})
