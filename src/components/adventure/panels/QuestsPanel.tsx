/**
 * QuestsPanel — Phase 9.2 (Quest Log MVP)
 *
 * Displays DirectorConfig.activeThreads (PlotThread[]) — a field that has
 * existed on the schema since Phase 2.2 but was never populated or rendered
 * until this phase. See src/lib/engine/worldDispatcher.ts for how the
 * Director populates it via directorConfigUpdates.newThreads/threadUpdates,
 * and supabase/functions/narrate/index.ts for the prompt instructions that
 * tell the Director when to use it.
 *
 * No fake data: if the Director hasn't surfaced any threads yet, this shows
 * the honest empty state, not placeholder quests.
 *
 * isHidden threads (part of the Director's private hidden arc) are never
 * rendered — the Constitution requires the hidden arc stay hidden.
 */

import { useMemo } from 'react'
import { PixelPanel, PixelCard, Window } from '@/components/pixel'
import type { Campaign } from '@/lib/supabase'
import type { PlotThread, ThreadStatus } from '@/types/campaign'

interface QuestsPanelProps {
  campaign: Campaign
}

const STATUS_META: Record<ThreadStatus, { label: string; icon: string; variant: 'default' | 'arcane' | 'harm' | 'spirit' }> = {
  active:    { label: 'Active',    icon: '⚡', variant: 'arcane' },
  resolved:  { label: 'Resolved',  icon: '✓',  variant: 'spirit' },
  abandoned: { label: 'Abandoned', icon: '✕',  variant: 'default' },
}

export function QuestsPanel({ campaign }: QuestsPanelProps) {
  const threads = campaign.directorConfig.activeThreads.filter((t) => !t.isHidden)

  const grouped = useMemo(() => {
    const active: PlotThread[] = []
    const resolved: PlotThread[] = []
    const abandoned: PlotThread[] = []
    for (const t of threads) {
      if (t.status === 'active') active.push(t)
      else if (t.status === 'resolved') resolved.push(t)
      else abandoned.push(t)
    }
    const byRecency = (a: PlotThread, b: PlotThread) => b.startedAtTurn - a.startedAtTurn
    return {
      active: active.sort(byRecency),
      resolved: resolved.sort(byRecency),
      abandoned: abandoned.sort(byRecency),
    }
  }, [threads])

  const hasAny = threads.length > 0

  return (
    <Window title="Quest Log" icon="questsMap" regionLabel="Quest log">
      {!hasAny ? (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <PixelPanel variant="arcane" className="p-6 max-w-sm">
            <p className="lore-text text-void-400 text-sm mb-3">
              "Unfinished business shapes every hero."
            </p>
            <p className="text-void-600 text-xs">
              Quests appear here as the Director recognises them in your
              story — a request, a mystery, a clear goal. None have
              emerged yet.
            </p>
          </PixelPanel>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.active.length > 0 && (
            <QuestGroup title="Active" threads={grouped.active} />
          )}
          {grouped.resolved.length > 0 && (
            <QuestGroup title="Resolved" threads={grouped.resolved} />
          )}
          {grouped.abandoned.length > 0 && (
            <QuestGroup title="Abandoned" threads={grouped.abandoned} />
          )}
        </div>
      )}
    </Window>
  )
}

function QuestGroup({ title, threads }: { title: string; threads: PlotThread[] }) {
  return (
    <section aria-label={`${title} quests`}>
      <p className="stat-label text-void-500 mb-2">{title}</p>
      <div className="flex flex-col gap-2" role="list">
        {threads.map((thread) => {
          const meta = STATUS_META[thread.status]
          return (
            <div key={thread.id} role="listitem">
              <PixelCard
                title={thread.title}
                icon={meta.icon}
                variant={meta.variant}
                footer={
                  <div className="flex items-center justify-between">
                    <span>{meta.label}</span>
                    <span>
                      Turn {thread.startedAtTurn}
                      {thread.resolvedAtTurn !== null ? ` → ${thread.resolvedAtTurn}` : ''}
                    </span>
                  </div>
                }
              >
                {thread.description || 'No further detail yet.'}
              </PixelCard>
            </div>
          )
        })}
      </div>
    </section>
  )
}
