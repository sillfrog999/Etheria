import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../lib/socket';
import { ITEM_DATABASE } from '@etheria/game-data';
import { RARITY_COLORS } from '@etheria/shared';

const SLOTS = [
  { id: 'head', label: 'Head' },
  { id: 'chest', label: 'Chest' },
  { id: 'legs', label: 'Legs' },
  { id: 'boots', label: 'Boots' },
  { id: 'gloves', label: 'Gloves' },
  { id: 'mainHand', label: 'Main Hand' },
  { id: 'offHand', label: 'Off Hand' },
  { id: 'accessory1', label: 'Ring' },
  { id: 'accessory2', label: 'Amulet' },
];

export function EquipmentWindow() {
  const { windows, closeWindow, equipment } = useGameStore();

  if (!windows.character) return null;

  const handleUnequip = (slotId: string) => {
    const socket = getSocket();
    socket.emit('inventory:unequip', { equipSlot: slotId });
  };

  return (
    <div className="fantasy-panel" style={{
      position: 'absolute',
      top: '120px',
      left: '20px',
      width: '260px',
      padding: '16px',
      zIndex: 20,
      pointerEvents: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 className="fantasy-header" style={{ margin: 0, fontSize: '15px' }}>EQUIPMENT</h3>
        <span onClick={() => closeWindow('character')} style={{ cursor: 'pointer', color: '#888' }}>✕</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {SLOTS.map((slot) => {
          const itemInst = equipment[slot.id];
          const defId = itemInst ? ((itemInst as any).definition_id || (itemInst as any).definitionId) : null;
          const def = defId ? ITEM_DATABASE[defId] : null;

          return (
            <div
              key={slot.id}
              onClick={() => def && handleUnequip(slot.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: `1px solid ${def ? RARITY_COLORS[def.rarity] : '#2a2419'}`,
                borderRadius: '4px',
                cursor: def ? 'pointer' : 'default',
              }}
              title={def ? `${def.name}\nClick to Unequip` : slot.label}
            >
              <span style={{ fontSize: '11px', color: '#888' }}>{slot.label}</span>
              <span style={{ fontSize: '12px', color: def ? '#fff' : '#444', fontWeight: def ? 'bold' : 'normal' }}>
                {def ? def.name : '(Empty)'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
