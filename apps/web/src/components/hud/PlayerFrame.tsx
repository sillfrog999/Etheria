import React from 'react';
import { useGameStore } from '../../store/gameStore';

export function PlayerFrame() {
  const { character, hp, maxHp, mana, maxMana, stamina, maxStamina } = useGameStore();

  if (!character) return null;

  const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const manaPercent = Math.max(0, Math.min(100, (mana / maxMana) * 100));
  const staminaPercent = Math.max(0, Math.min(100, (stamina / maxStamina) * 100));

  return (
    <div className="fantasy-panel wow-unit-frame wow-player-frame" style={{
      position: 'absolute',
      top: '18px',
      left: '18px',
      width: '304px',
      padding: '9px',
      display: 'flex',
      gap: '10px',
      pointerEvents: 'auto',
      zIndex: 10,
    }}>
      <div className="wow-portrait">
        <span>{character.class.slice(0, 3)}</span>
        <strong>{character.level}</strong>
      </div>
      <div className="wow-unit-content">
        <div className="wow-unit-heading">
          <span>{character.name}</span>
          <small>Lv. {character.level}</small>
        </div>
        <div className="wow-resource wow-health">
          <div style={{ width: `${hpPercent}%` }} />
          <span>{hp} / {maxHp}</span>
        </div>
        <div className="wow-resource wow-mana">
          <div style={{ width: `${manaPercent}%` }} />
          <span>{mana} / {maxMana}</span>
        </div>
        <div className="wow-resource wow-energy">
          <div style={{ width: `${staminaPercent}%` }} />
          <span>{stamina} / {maxStamina}</span>
        </div>
      </div>
    </div>
  );
}
