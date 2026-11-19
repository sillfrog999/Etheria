import React from 'react';
import { useGameStore } from '../../store/gameStore';

export function CharacterWindow() {
  const { windows, closeWindow, character, hp, maxHp, mana, maxMana, stamina, maxStamina, gold } = useGameStore();

  if (!windows.character || !character) return null;

  return (
    <div className="fantasy-panel" style={{
      position: 'absolute',
      top: '120px',
      left: '20px',
      width: '280px',
      padding: '16px',
      zIndex: 20,
      pointerEvents: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 className="fantasy-header" style={{ margin: 0, fontSize: '15px' }}>CHARACTER SHEET</h3>
        <span onClick={() => closeWindow('character')} style={{ cursor: 'pointer', color: '#888' }}>✕</span>
      </div>

      <div style={{ textAlign: 'center', paddingBottom: '12px', borderBottom: '1px solid #2a2419' }}>
        <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>{character.name}</h2>
        <span style={{ color: 'var(--color-gold)', fontSize: '13px', textTransform: 'capitalize' }}>
          Level {character.level} {character.class}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px', fontSize: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#888' }}>Hit Points:</span>
          <span style={{ color: '#ff6666', fontWeight: 'bold' }}>{hp} / {maxHp}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#888' }}>Mana Pool:</span>
          <span style={{ color: '#66a3ff', fontWeight: 'bold' }}>{mana} / {maxMana}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#888' }}>Stamina:</span>
          <span style={{ color: '#66ff66', fontWeight: 'bold' }}>{stamina} / {maxStamina}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#888' }}>Gold in Purse:</span>
          <span style={{ color: 'var(--color-gold-bright)', fontWeight: 'bold' }}>{gold}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#888' }}>Carry Weight:</span>
          <span style={{ color: '#aaa' }}>{character.stats?.carryWeight || 0} / 100 kg</span>
        </div>
      </div>
    </div>
  );
}
