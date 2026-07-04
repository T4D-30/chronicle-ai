import { useState } from 'react'
import { Button, Input, Select } from '@/components/ui'
import { validateEquipmentItem } from '@/lib/engine'
import type { EquipmentItem, EquipmentSlot } from '@/lib/engine'
import type { CharacterDraft } from '../useCharacterDraft'

interface EquipmentStepProps {
  draft: CharacterDraft
  onChange: (patch: Partial<CharacterDraft>) => void
}

const SLOT_OPTIONS: Array<{ value: EquipmentSlot; label: string }> = [
  { value: 'weapon', label: 'Weapon' },
  { value: 'armor', label: 'Armor' },
  { value: 'shield', label: 'Shield' },
  { value: 'accessory', label: 'Accessory' },
]

function makeItemId(): string {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function EquipmentStep({ draft, onChange }: EquipmentStepProps) {
  const [name, setName] = useState('')
  const [slot, setSlot] = useState<EquipmentSlot>('weapon')
  const [attackBonus, setAttackBonus] = useState('')
  const [armorBonus, setArmorBonus] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  function addItem() {
    const candidate: EquipmentItem = {
      id: makeItemId(),
      name: name.trim(),
      slot,
      equipped: true,
      ...(attackBonus.trim() !== '' ? { attackBonus: Number(attackBonus) } : {}),
      ...(armorBonus.trim() !== '' ? { armorBonus: Number(armorBonus) } : {}),
    }

    // Validated through the engine, not a hand-rolled check.
    const error = validateEquipmentItem(candidate)
    if (error) {
      setFormError(error)
      return
    }

    onChange({ equipment: [...draft.equipment, candidate] })
    setName('')
    setAttackBonus('')
    setArmorBonus('')
    setFormError(null)
  }

  function removeItem(id: string) {
    onChange({ equipment: draft.equipment.filter((item) => item.id !== id) })
  }

  function toggleEquipped(id: string) {
    onChange({
      equipment: draft.equipment.map((item) =>
        item.id === id ? { ...item, equipped: !item.equipped } : item,
      ),
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {draft.equipment.length > 0 && (
        <ul className="flex flex-col gap-2">
          {draft.equipment.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-void-700/50 bg-void-900"
            >
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.equipped}
                    onChange={() => toggleEquipped(item.id)}
                    className="accent-arcane-500"
                  />
                  <span className="sr-only">Equipped</span>
                </label>
                <div>
                  <p className="text-sm text-white">{item.name}</p>
                  <p className="text-void-500 text-xs capitalize">
                    {item.slot}
                    {item.attackBonus !== undefined && ` · Attack +${item.attackBonus}`}
                    {item.armorBonus !== undefined && ` · Armor +${item.armorBonus}`}
                    {!item.equipped && ' · Unequipped'}
                  </p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="chr-panel p-4 rounded-lg">
        <p className="stat-label text-void-300 mb-3">Add Equipment</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <Input
            label="Item Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Longsword +1"
          />
          <Select
            label="Slot"
            options={SLOT_OPTIONS}
            value={slot}
            onChange={(e) => setSlot(e.target.value as EquipmentSlot)}
          />
          <Input
            label="Attack Bonus"
            type="number"
            value={attackBonus}
            onChange={(e) => setAttackBonus(e.target.value)}
            placeholder="0"
            hint="Optional. Applies on attack rolls."
          />
          <Input
            label="Armor Bonus"
            type="number"
            value={armorBonus}
            onChange={(e) => setArmorBonus(e.target.value)}
            placeholder="0"
            hint="Optional. Applies to AC."
          />
        </div>
        {formError && (
          <p role="alert" className="text-harm-400 text-xs mb-3">
            {formError}
          </p>
        )}
        <Button type="button" variant="spirit" size="sm" onClick={addItem} disabled={name.trim().length === 0}>
          Add Item
        </Button>
        <p className="text-void-500 text-xs mt-3">
          Skill, save, and passive bonuses can be added later from the character sheet's Equipment tab.
        </p>
      </div>
    </div>
  )
}
