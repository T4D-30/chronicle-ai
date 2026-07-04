import type { AdventureState } from '../useAdventureSession'

interface DebugPanelProps {
  state: AdventureState
}

export function DebugPanel({ state }: DebugPanelProps) {
  const sections = [
    { label: 'SESSION', data: state.session },
    { label: 'CAMPAIGN', data: state.campaign ? {
      id: state.campaign.id,
      title: state.campaign.title,
      status: state.campaign.status,
      tone: state.campaign.tone,
      difficulty: state.campaign.difficulty,
      characterId: state.campaign.characterId,
      directorConfig: {
        tone: state.campaign.directorConfig.tone,
        difficulty: state.campaign.directorConfig.difficulty,
        rulesStyle: state.campaign.directorConfig.rulesStyle,
        hiddenArc: state.campaign.directorConfig.hiddenArc ? '[set]' : '[none]',
        worldSeed: state.campaign.directorConfig.worldSeed || '[none]',
        activeThreads: state.campaign.directorConfig.activeThreads.length,
        npcMemory: state.campaign.directorConfig.npcMemory.length,
      },
    } : null },
    { label: 'CHARACTER SHEET', data: state.character?.sheet ?? null },
    { label: 'RECENT TURNS', data: state.turns.map((t) => ({
      turn: t.turnNumber,
      input: t.playerInput.slice(0, 60),
      mode: t.mode,
    })) },
    { label: 'LOAD STATUS', data: {
      status: state.status,
      error: state.error,
      isActionInFlight: state.isActionInFlight,
    }},
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 gap-4">
      <div className="chr-panel-spirit p-3 rounded-lg flex-shrink-0">
        <p className="stat-label text-spirit-400 mb-1">DEBUG PANEL</p>
        <p className="text-void-500 text-xs">
          Live game state. Invaluable during Phase 2 AI Narration integration.
          Never shown to end users — exists for development only.
        </p>
      </div>

      {sections.map(({ label, data }) => (
        <div key={label} className="chr-panel rounded-lg overflow-hidden flex-shrink-0">
          <div className="px-3 py-1.5 border-b border-void-700/50 bg-void-900/60">
            <span className="stat-label text-spirit-400">{label}</span>
          </div>
          <pre className="p-3 text-xs text-void-300 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap break-all">
            {data === null ? 'null' : JSON.stringify(data, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  )
}
