import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../lib/socket';
import { ITEM_DATABASE } from '@etheria/game-data';
import { RARITY_COLORS } from '@etheria/shared';

export function InventoryWindow() {
  const { windows, closeWindow, inventory, gold } = useGameStore();

  if (!windows.inventory) return null;

  const handleUseOrEquip = (slotIdx: number, itemInstance: any) => {
    if (!itemInstance) return;
    const def = ITEM_DATABASE[itemInstance.definition_id || itemInstance.definitionId];
    if (!def) return;

    const socket = getSocket();
    if (def.equipmentSlot) {
      socket.emit('inventory:equip', { slot: slotIdx });
    } else if (def.consumeEffect) {
      socket.emit('inventory:use', { slot: slotIdx });
    }
  };

  return (
    <div className="fantasy-panel" style={{
      position: 'absolute',
      top: '120px',
      right: '20px',
      width: '280px',
      padding: '16px',
      zIndex: 20,
      pointerEvents: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 className="fantasy-header" style={{ margin: 0, fontSize: '15px' }}>INVENTORY (28)</h3>
        <span onClick={() => closeWindow('inventory')} style={{ cursor: 'pointer', color: '#888' }}>✕</span>
      </div>

      {/* 4 columns x 7 rows = 28 slots */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '6px',
        background: 'rgba(0, 0, 0, 0.4)',
        padding: '8px',
        borderRadius: '4px',
        border: '1px solid #2a2419',
      }}>
        {inventory.map((slotData, idx) => {
          const itemInst = slotData.item;
          const defId = itemInst ? ((itemInst as any).definition_id || (itemInst as any).definitionId) : null;
          const def = defId ? ITEM_DATABASE[defId] : null;
          const borderColor = def ? RARITY_COLORS[def.rarity] : '#2a2419';

          return (
            <div
              key={idx}
              className="slot-box"
              onClick={() => handleUseOrEquip(idx, itemInst)}
              style={{
                width: '54px',
                height: '54px',
                borderColor: borderColor,
              }}
              title={def ? `${def.name} (${def.rarity})\n${def.description}\nLeft-click to Equip/Use` : `Slot ${idx + 1}`}
            >
              {def && (
                <>
                  <span style={{ fontSize: '10px', color: '#fff', textAlign: 'center', lineHeight: '1.1' }}>
                    {def.name.slice(0, 7)}
                  </span>
                  {itemInst && (itemInst as any).quantity > 1 && (
                    <span style={{
                      position: 'absolute',
                      bottom: '2px',
                      right: '3px',
                      fontSize: '10px',
                      color: '#ffd700',
                      fontWeight: 'bold',
                    }}>
                      {(itemInst as any).quantity}
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-gold)' }}>
        <span>Purse:</span>
        <span style={{ fontWeight: 'bold' }}>{gold} Gold</span>
      </div>
    </div>
  );
}
