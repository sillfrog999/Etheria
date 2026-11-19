import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../lib/socket';
import { ABILITY_DATABASE, DEFAULT_HOTBAR } from '@etheria/game-data';

const HOTKEYS = ['Q', 'W', 'E', 'R', 'T', 'Y', 'A', 'S', 'D', 'F', 'G', 'H'];

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
      return; // Cooldown not ready
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

    // Set cooldown timer
    setCooldowns(prev => ({ ...prev, [abilityId]: Date.now() + ability.cooldown }));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in chat
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
    <div className="fantasy-panel" style={{
      position: 'absolute',
      bottom: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '8px 12px',
      display: 'flex',
      gap: '6px',
      pointerEvents: 'auto',
      zIndex: 10,
    }}>
      {HOTKEYS.map((key, idx) => {
        const abilityId = abilityIds[idx];
        const ability = abilityId ? ABILITY_DATABASE[abilityId] : null;
        const cdExpires = abilityId ? cooldowns[abilityId] : 0;
        const onCd = cdExpires && Date.now() < cdExpires;

        return (
          <div
            key={key}
            className="slot-box"
            onClick={() => abilityId && triggerAbility(abilityId)}
            style={{
              borderColor: ability ? 'var(--color-gold-dark)' : '#222',
              background: ability ? 'radial-gradient(circle, #2d2315 0%, #0d0a06 100%)' : 'rgba(0,0,0,0.7)',
            }}
            title={ability ? `${ability.name} (${ability.description})` : 'Empty Slot'}
          >
            {/* Hotkey Tag */}
            <span style={{
              position: 'absolute',
              top: '2px',
              left: '3px',
              fontSize: '10px',
              color: 'var(--color-gold-bright)',
              fontWeight: 'bold',
            }}>
              {key}
            </span>

            {/* Ability Short Title */}
            {ability && (
              <span style={{ fontSize: '10px', color: '#fff', textAlign: 'center', lineHeight: '1.1' }}>
                {ability.name.slice(0, 4)}
              </span>
            )}

            {/* Mana Cost */}
            {ability && ability.manaCost > 0 && (
              <span style={{
                position: 'absolute',
                bottom: '2px',
                right: '3px',
                fontSize: '9px',
                color: '#64b5f6',
              }}>
                {ability.manaCost}
              </span>
            )}

            {/* Cooldown Mask */}
            {onCd && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ff4444',
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
