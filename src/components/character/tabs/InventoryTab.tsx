import { useState } from 'react'
import { Button, Input } from '@/components/ui'
import { PixelPanel } from '@/components/pixel'
import type { InventoryItemRow, CharacterRecord, UpdateCharacterInput } from '@/lib/supabase'

interface InventoryTabProps {
  character: CharacterRecord
  onPatch: (servicePatch: UpdateCharacterInput, localPreview?: Partial<CharacterRecord>) => void
}

function makeItemId(): string {
  return `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function InventoryTab({ character, onPatch }: InventoryTabProps) {
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [weight, setWeight] = useState('0')
  const [error, setError] = useState<string | null>(null)

  const totalWeight = character.inventory.reduce((sum, item) => sum + item.weight * item.quantity, 0)

  function commitInventory(next: InventoryItemRow[]) {
    onPatch({ inventory: next }, { inventory: next })
  }

  function addItem() {
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      setError('Item name cannot be empty.')
      return
    }
    const parsedQuantity = Number.parseInt(quantity, 10)
    const parsedWeight = Number.parseFloat(weight)
    if (Number.isNaN(parsedQuantity) || parsedQuantity < 1) {
      setError('Quantity must be a positive whole number.')
      return
    }
    if (Number.isNaN(parsedWeight) || parsedWeight < 0) {
      setError('Weight must be zero or greater.')
      return
    }

    const item: InventoryItemRow = {
      id: makeItemId(),
      name: trimmedName,
      quantity: parsedQuantity,
      weight: parsedWeight,
      equipped: false,
      description: '',
    }

    commitInventory([...character.inventory, item])
    setName('')
    setQuantity('1')
    setWeight('0')
    setError(null)
  }

  function removeItem(id: string) {
    commitInventory(character.inventory.filter((item) => item.id !== id))
  }

  function adjustQuantity(id: string, delta: number) {
    commitInventory(
      character.inventory.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PixelPanel className="p-4">
        <p className="font-pixel-display text-[7px] text-void-500 mb-1 uppercase">Total Carried Weight</p>
        <p className="font-mono text-xl text-white">{totalWeight} lbs</p>
      </PixelPanel>

      {character.inventory.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {character.inventory.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-void-700/50 bg-void-900"
            >
              <div>
                <p className="text-sm text-white">{item.name}</p>
                <p className="text-void-500 text-xs">{item.weight} lbs each</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustQuantity(item.id, -1)}
                  aria-label={`Decrease quantity of ${item.name}`}
                  className="text-void-400 hover:text-harm-400 font-mono px-1"
                >
                  −
                </button>
                <span className="font-mono text-white w-8 text-center">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => adjustQuantity(item.id, 1)}
                  aria-label={`Increase quantity of ${item.name}`}
                  className="text-void-400 hover:text-heal-400 font-mono px-1"
                >
                  +
                </button>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-void-500 text-sm">Inventory is empty.</p>
      )}

      <PixelPanel className="p-4">
        <p className="font-pixel-display text-[7px] text-void-300 mb-3 uppercase">Add Item</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <Input
            label="Item Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rope (50 ft)"
          />
          <Input
            label="Quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Input
            label="Weight (lbs each)"
            type="number"
            min={0}
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-harm-400 text-xs mb-3">
            {error}
          </p>
        )}
        <Button type="button" variant="spirit" size="sm" onClick={addItem}>
          Add Item
        </Button>
      </PixelPanel>
    </div>
  )
}
