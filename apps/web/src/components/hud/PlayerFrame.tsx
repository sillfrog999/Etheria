import React from 'react';
import { useGameStore } from '../../store/gameStore';

export function PlayerFrame() {
  const { character, hp, maxHp, mana, maxMana, stamina, maxStamina } = useGameStore();

  if (!character) return null;

  const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const manaPercent = Math.max(0, Math.min(100, (mana / maxMana) * 100));
  const staminaPercent = Math.max(0, Math.min(100, (stamina / maxStamina) * 100));

  return (
    <div className="fantasy-panel" style={{
      position: 'absolute',
      top: '16px',
      left: '16px',
      width: '280px',
      padding: '12px',
      display: 'flex',
      gap: '12px',
      pointerEvents: 'auto',
      zIndex: 10,
    }}>
      {/* Avatar Box */}
      <div style={{
        width: '56px',
        height: '56px',
        background: 'radial-gradient(circle, #2a2215 0%, #0d0a06 100%)',
        border: '2px solid var(--color-gold)',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ fontSize: '10px', color: 'var(--color-gold-bright)', textTransform: 'uppercase' }}>
          {character.class.slice(0, 3)}
        </span>
        <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>
          {character.level}
        </span>
      </div>

      {/* Vitals Column */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>{character.name}</span>
          <span style={{ fontSize: '11px', color: 'var(--color-gold)' }}>Lv. {character.level}</span>
        </div>

        {/* HP Bar */}
        <div style={{ height: '12px', background: '#200b0b', border: '1px solid #4a1515', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ width: `${hpPercent}%`, height: '100%', background: 'linear-gradient(90deg, #c62828 0%, #ef5350 100%)', transition: 'width 0.2s' }} />
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 'bold', color: '#fff', textShadow: '0 1px 2px black' }}>
            {hp} / {maxHp}
          </span>
        </div>

        {/* Mana Bar */}
        <div style={{ height: '10px', background: '#0b1620', border: '1px solid #15324a', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ width: `${manaPercent}%`, height: '100%', background: 'linear-gradient(90deg, #1565c0 0%, #42a5f5 100%)', transition: 'width 0.2s' }} />
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 'bold', color: '#fff', textShadow: '0 1px 2px black' }}>
            {mana} / {maxMana}
          </span>
        </div>

        {/* Stamina Bar */}
        <div style={{ height: '8px', background: '#0d200b', border: '1px solid #1c4a15', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
          <div style={{ width: `${staminaPercent}%`, height: '100%', background: 'linear-gradient(90deg, #2e7d32 0%, #66bb6a 100%)', transition: 'width 0.2s' }} />
          <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 'bold', color: '#fff', textShadow: '0 1px 2px black' }}>
            {stamina} / {maxStamina}
          </span>
        </div>
      </div>
    </div>
  );
}
