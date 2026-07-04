/**
 * Skeleton — Phase 7
 *
 * Loading placeholder components following the design system's void/dark aesthetic.
 * Use instead of spinners for content-heavy pages (library lists, character sheets).
 * All skeletons respect prefers-reduced-motion via CSS.
 */

import { cn } from '@/lib/cn'

// ── Base skeleton pulse ───────────────────────────────────────────────────────

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded bg-void-800/60',
        className,
      )}
    />
  )
}

// ── Skeleton variants ─────────────────────────────────────────────────────────

/** Single line of text placeholder. */
export function SkeletonText({ className, width = 'full' }: { className?: string; width?: 'full' | '3/4' | '1/2' | '1/3' }) {
  const widthClass = {
    'full': 'w-full',
    '3/4': 'w-3/4',
    '1/2': 'w-1/2',
    '1/3': 'w-1/3',
  }[width]
  return <Skeleton className={cn('h-4', widthClass, className)} />
}

/** Card skeleton that mirrors CampaignCard / CharacterCard layout. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn('chr-panel p-4 rounded-lg flex flex-col gap-3', className)}
      role="presentation"
      aria-hidden="true"
    >
      <SkeletonText width="3/4" className="h-5" />
      <SkeletonText width="full" />
      <SkeletonText width="1/2" />
      <div className="flex gap-2 mt-1">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  )
}

/** Grid of skeleton cards for library pages. */
export function SkeletonGrid({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4', className)}
      aria-label="Loading content…"
      role="status"
      aria-busy="true"
    >
      <span className="sr-only">Loading…</span>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}
