import { useRef, useState } from 'react'
import { Button } from '@/components/ui'
import type { CharacterDraft } from '../useCharacterDraft'

interface PortraitStepProps {
  draft: CharacterDraft
  onChange: (patch: Partial<CharacterDraft>) => void
}

// 1.5MB cap on the raw file. Data URLs are ~33% larger than the source
// file once base64-encoded, and this gets stored directly in a text
// column (migration 0005) — keeping it bounded keeps row writes fast.
const MAX_FILE_BYTES = 1.5 * 1024 * 1024

export function PortraitStep({ draft, onChange }: PortraitStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setError('Image is too large — please choose a file under 1.5MB.')
      return
    }

    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      onChange({ portraitUrl: reader.result as string })
    }
    reader.onerror = () => {
      setError('Could not read that image. Please try a different file.')
    }
    reader.readAsDataURL(file)
  }

  function clearPortrait() {
    onChange({ portraitUrl: null })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="flex flex-col items-center gap-5">
      <div
        className={[
          'w-40 h-40 rounded-full overflow-hidden flex items-center justify-center',
          'border-2 border-dashed',
          draft.portraitUrl ? 'border-arcane-600' : 'border-void-700',
          'bg-void-900',
        ].join(' ')}
      >
        {draft.portraitUrl ? (
          <img
            src={draft.portraitUrl}
            alt={`Portrait of ${draft.name || 'this character'}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-void-600 text-xs text-center px-4">No portrait selected</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="spirit" size="sm" onClick={() => fileInputRef.current?.click()}>
          {draft.portraitUrl ? 'Change Portrait' : 'Upload Portrait'}
        </Button>
        {draft.portraitUrl && (
          <Button type="button" variant="ghost" size="sm" onClick={clearPortrait}>
            Remove
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="sr-only"
        aria-label="Choose a portrait image"
      />

      {error && (
        <p role="alert" className="text-harm-400 text-xs">
          {error}
        </p>
      )}

      <p className="text-void-500 text-xs text-center max-w-xs">
        Optional. A portrait helps you recognise this character at a glance in your library.
      </p>
    </div>
  )
}
