import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { getAbilitiesForClass } from '@etheria/game-data';

export function SpellbookWindow() {
  const { windows, closeWindow, character } = useGameStore();

  if (!windows.spellbook || !character) return null;

  const abilities = getAbilitiesForClass(character.class);

  return (
    <div className="fantasy-panel" style={{
      position: 'absolute',
      top: '120px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '400px',
      maxHeight: '440px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 20,
      pointerEvents: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 className="fantasy-header" style={{ margin: 0, fontSize: '15px' }}>
          SPELLBOOK & ABILITIES ({character.class.toUpperCase()})
        </h3>
        <span onClick={() => closeWindow('spellbook')} style={{ cursor: 'pointer', color: '#888' }}>✕</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {abilities.map((ab) => (
          <div
            key={ab.id}
            style={{
              background: 'rgba(0, 0, 0, 0.4)',
              border: '1px solid #2a2419',
              padding: '10px',
              borderRadius: '4px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--color-gold-bright)' }}>
                {ab.name}
              </span>
              <span style={{ fontSize: '11px', color: '#64b5f6' }}>
                {ab.manaCost ? `${ab.manaCost} Mana` : 'Free'} | {(ab.cooldown / 1000).toFixed(1)}s CD
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: '#bbb' }}>{ab.description}</p>
            <div style={{ fontSize: '10px', color: '#777', marginTop: '4px' }}>
              Range: {ab.range}m | Target: {ab.targetType}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
