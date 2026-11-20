import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../lib/socket';
import { ABILITY_DATABASE, DEFAULT_HOTBAR } from '@etheria/game-data';

const HOTKEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];

const ABILITY_ICONS: Record<string, string> = {
  basic_attack: 'basic_attack',
  arcane_bolt: 'arcane_bolt',
  fireball: 'fireball',
  ice_nova: 'ice_nova',
  arcane_shield: 'arcane_shield',
  healing_wave: 'healing_wave',
  meteor: 'meteor',
  heavy_strike: 'heavy_strike',
  shield_bash: 'shield_bash',
  charge: 'charge',
  counterattack: 'counterattack',
  whirlwind: 'whirlwind',
  shadow_step: 'shadow_step',
  smoke_veil: 'smoke_veil',
  ambush: 'ambush',
  backstab: 'backstab',
  evasive_roll: 'evasive_roll',
  quick_shot: 'quick_shot',
  piercing_shot: 'piercing_shot',
  explosive_arrow: 'explosive_arrow',
  tactical_roll: 'tactical_roll',
  reload: 'reload',
  blink: 'blink',
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

    if (cooldowns[abilityId] && Date.now() < cooldowns[abilityId]) {
      return;
    }

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
      if (idx !== -1 && abilityIds[idx]) {
        triggerAbility(abilityIds[idx]);
      }
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
        const iconId = abilityId ? ABILITY_ICONS[abilityId] : null;

        return (
          <div
            key={key}
            className="slot-box"
            onClick={() => abilityId && triggerAbility(abilityId)}
            style={{
              position: 'relative',
              overflow: 'hidden',
              borderColor: ability ? 'var(--color-gold-dark)' : '#222',
              background: ability ? '#090b12' : 'rgba(0,0,0,0.7)',
            }}
            title={ability ? `${ability.name} (${ability.description})` : 'Empty Slot'}
          >
            {ability && iconId && (
              <svg
                viewBox="0 0 64 64"
                aria-label={ability.name}
                role="img"
                style={{
                  position: 'absolute',
                  inset: '0',
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  pointerEvents: 'none',
                }}
              >
                <use href={`/assets/abilities/ability-icons.svg#${iconId}`} />
              </svg>
            )}

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
