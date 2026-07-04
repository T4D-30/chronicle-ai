import { useState } from 'react'
import { Button, Input, Select } from '@/components/ui'
import { PixelPanel } from '@/components/pixel'
import {
  validateEquipmentItem,
  getEquipmentAttackBonus,
  getEquipmentArmorBonus,
} from '@/lib/engine'
import type { EquipmentItem, EquipmentSlot } from '@/lib/engine'
import type { CharacterRecord, UpdateCharacterInput } from '@/lib/supabase'

interface EquipmentTabProps {
  character: CharacterRecord
  onPatch: (servicePatch: UpdateCharacterInput, localPreview?: Partial<CharacterRecord>) => void
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

export function EquipmentTab({ character, onPatch }: EquipmentTabProps) {
  const { sheet } = character
  const [name, setName] = useState('')
  const [slot, setSlot] = useState<EquipmentSlot>('weapon')
  const [attackBonus, setAttackBonus] = useState('')
  const [armorBonus, setArmorBonus] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const totalAttackBonus = getEquipmentAttackBonus(sheet.equipment)
  const totalArmorBonus = getEquipmentArmorBonus(sheet.equipment)

  function commitEquipment(next: EquipmentItem[]) {
    onPatch({ equipment: next }, { sheet: { ...sheet, equipment: next } })
  }

  function addItem() {
    const candidate: EquipmentItem = {
      id: makeItemId(),
      name: name.trim(),
      slot,
      equipped: true,
      ...(attackBonus.trim() !== '' ? { attackBonus: Number(attackBonus) } : {}),
      ...(armorBonus.trim() !== '' ? { armorBonus: Number(armorBonus) } : {}),
    }

    const error = validateEquipmentItem(candidate)
    if (error) {
      setFormError(error)
      return
    }

    commitEquipment([...sheet.equipment, candidate])
    setName('')
    setAttackBonus('')
    setArmorBonus('')
    setFormError(null)
  }

  function removeItem(id: string) {
    commitEquipment(sheet.equipment.filter((item) => item.id !== id))
  }

  function toggleEquipped(id: string) {
    commitEquipment(
      sheet.equipment.map((item) =>
        item.id === id ? { ...item, equipped: !item.equipped } : item,
      ),
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        <PixelPanel className="p-4">
          <p className="font-pixel-display text-[7px] text-void-500 mb-1 uppercase">Total Attack Bonus</p>
          <p className="font-mono text-xl text-arcane-300">
            {totalAttackBonus >= 0 ? `+${totalAttackBonus}` : totalAttackBonus}
          </p>
        </PixelPanel>
        <PixelPanel className="p-4">
          <p className="font-pixel-display text-[7px] text-void-500 mb-1 uppercase">Total Armor Bonus</p>
          <p className="font-mono text-xl text-arcane-300">
            {totalArmorBonus >= 0 ? `+${totalArmorBonus}` : totalArmorBonus}
          </p>
        </PixelPanel>
      </div>

      {sheet.equipment.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {sheet.equipment.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-void-700/50 bg-void-900"
            >
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.equipped}
                  onChange={() => toggleEquipped(item.id)}
                  className="accent-arcane-500"
                />
                <div>
                  <p className="text-sm text-white">{item.name}</p>
                  <p className="text-void-500 text-xs capitalize">
                    {item.slot}
                    {item.attackBonus !== undefined && ` · Attack +${item.attackBonus}`}
                    {item.armorBonus !== undefined && ` · Armor +${item.armorBonus}`}
                    {!item.equipped && ' · Unequipped'}
                  </p>
                </div>
              </label>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeItem(item.id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-void-500 text-sm">No equipment yet.</p>
      )}

      <PixelPanel className="p-4">
        <p className="font-pixel-display text-[7px] text-void-300 mb-3 uppercase">Add Equipment</p>
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
          />
          <Input
            label="Armor Bonus"
            type="number"
            value={armorBonus}
            onChange={(e) => setArmorBonus(e.target.value)}
            placeholder="0"
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
      </PixelPanel>
    </div>
  )
}
