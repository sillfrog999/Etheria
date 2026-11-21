import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../lib/socket';
import { ABILITY_DATABASE, DEFAULT_HOTBAR } from '@etheria/game-data';

const HOTKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

// Tile coordinates in the 6-column x 4-row image generated for ETHERIA.
const ABILITY_ICONS: Record<string, number> = {
  basic_attack: 0,
  arcane_bolt: 1,
  fireball: 2,
  ice_nova: 3,
  arcane_shield: 4,
  healing_wave: 5,
  meteor: 6,
  heavy_strike: 7,
  shield_bash: 8,
  charge: 9,
  whirlwind: 10,
  shadow_step: 12,
  smoke_veil: 13,
  backstab: 14,
  ambush: 15,
  evasive_roll: 16,
  piercing_shot: 17,
  quick_shot: 20,
  reload: 21,
  blink: 22,
  counterattack: 23,
  explosive_arrow: 19,
  tactical_roll: 16,
};

export function SkillBar() {
  const { character, targetId } = useGameStore();
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  const charClass = character?.class || 'fighter';
  const abilityIds = DEFAULT_HOTBAR[charClass] || [];

  const triggerAbility = (abilityId: string) => {
    if (!abilityId) return;
    const ability = ABILITY_DATABASE[abilityId];
    if (!ability) return;

    if (cooldowns[abilityId] && Date.now() < cooldowns[abilityId]) return;

    const socket = getSocket();
    if (ability.targetType === 'enemy') {
      if (!targetId) {
        useGameStore.getState().addChatMessage({
          id: Math.random().toString(),
          channel: 'system',
          content: 'You must select a target first!',
          timestamp: Date.now()
        });
        return;
      }
      socket.emit('combat:attack', { targetId, abilityId });
    } else {
      socket.emit('combat:use_ability', { abilityId });
    }

    setCooldowns(prev => ({ ...prev, [abilityId]: Date.now() + ability.cooldown }));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const key = e.key.toUpperCase();
      const idx = HOTKEYS.indexOf(key);
      if (idx !== -1 && abilityIds[idx]) triggerAbility(abilityIds[idx]);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [abilityIds, targetId, cooldowns]);

  return (
    <div className="fantasy-panel hud-skillbar" style={{
      position: 'absolute',
      bottom: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '6px 8px',
      display: 'flex',
      gap: '4px',
      pointerEvents: 'auto',
      zIndex: 10,
    }}>
      {HOTKEYS.map((key, idx) => {
        const abilityId = abilityIds[idx];
        const ability = abilityId ? ABILITY_DATABASE[abilityId] : null;
        const cdExpires = abilityId ? cooldowns[abilityId] : 0;
        const onCd = cdExpires && Date.now() < cdExpires;
        const tile = abilityId ? ABILITY_ICONS[abilityId] : undefined;
        const col = tile === undefined ? 0 : tile % 6;
        const row = tile === undefined ? 0 : Math.floor(tile / 6);

        return (
          <div
            key={key}
            className="slot-box"
            onClick={() => abilityId && triggerAbility(abilityId)}
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderColor: ability ? 'var(--color-gold-dark)' : '#222',
              backgroundColor: ability ? '#090b12' : 'rgba(0,0,0,0.7)',
              backgroundImage: ability && tile !== undefined
                ? "url('/assets/abilities/generated-skill-sprite.webp')"
                : 'none',
              backgroundSize: '600% 400%',
              backgroundPosition: `${(col / 5) * 100}% ${(row / 3) * 100}%`,
              backgroundRepeat: 'no-repeat',
            }}
            title={ability ? `${ability.name} (${ability.description})` : 'Empty Slot'}
          >
            {ability && (
              <span style={{
                position: 'absolute',
                top: '2px',
                left: '4px',
                zIndex: 2,
                fontSize: '10px',
                color: '#ffe2a0',
                fontWeight: 'bold',
                textShadow: '0 1px 3px #000',
              }}>
                {key}
              </span>
            )}

            {ability && ability.manaCost > 0 && (
              <span style={{
                position: 'absolute',
                bottom: '2px',
                right: '4px',
                zIndex: 2,
                fontSize: '9px',
                color: '#8bd7ff',
                textShadow: '0 1px 3px #000',
              }}>
                {ability.manaCost}
              </span>
            )}

            {onCd && (
              <div style={{
                position: 'absolute',
                inset: 0,
                zIndex: 3,
                background: 'rgba(0,0,0,0.72)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 'bold',
              }}>
                {Math.ceil((cdExpires - Date.now()) / 1000)}s
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
