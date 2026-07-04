import { useState } from 'react'
import { Button, Input, Textarea } from '@/components/ui'
import type { FeatureRow, CharacterRecord, UpdateCharacterInput } from '@/lib/supabase'

interface FeaturesTabProps {
  character: CharacterRecord
  onPatch: (servicePatch: UpdateCharacterInput, localPreview?: Partial<CharacterRecord>) => void
}

function makeFeatureId(): string {
  return `feature-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function FeaturesTab({ character, onPatch }: FeaturesTabProps) {
  const [name, setName] = useState('')
  const [source, setSource] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  function commitFeatures(next: FeatureRow[]) {
    onPatch({ features: next }, { features: next })
  }

  function addFeature() {
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      setError('Feature name cannot be empty.')
      return
    }

    const feature: FeatureRow = {
      id: makeFeatureId(),
      name: trimmedName,
      source: source.trim(),
      description: description.trim(),
    }

    commitFeatures([...character.features, feature])
    setName('')
    setSource('')
    setDescription('')
    setError(null)
  }

  function removeFeature(id: string) {
    commitFeatures(character.features.filter((f) => f.id !== id))
  }

  return (
    <div className="flex flex-col gap-6">
      {character.features.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {character.features.map((feature) => (
            <li key={feature.id} className="chr-panel p-4 rounded-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-body font-semibold text-white">{feature.name}</h3>
                  {feature.source && <p className="text-void-500 text-xs">{feature.source}</p>}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeFeature(feature.id)}>
                  Remove
                </Button>
              </div>
              {feature.description && (
                <p className="text-void-300 text-sm mt-2">{feature.description}</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-void-500 text-sm">No features recorded yet.</p>
      )}

      <div className="chr-panel p-4 rounded-lg">
        <p className="stat-label text-void-300 mb-3">Add Feature</p>
        <div className="flex flex-col gap-3 mb-3">
          <Input
            label="Feature Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Second Wind"
          />
          <Input label="Source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Fighter 1" />
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this feature do?"
            rows={3}
          />
        </div>
        {error && (
          <p role="alert" className="text-harm-400 text-xs mb-3">
            {error}
          </p>
        )}
        <Button type="button" variant="spirit" size="sm" onClick={addFeature}>
          Add Feature
        </Button>
      </div>
    </div>
  )
}
