import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../lib/socket';

export function TargetFrame() {
  const { targetId, targetType, monsters, nearbyPlayers, setTarget } = useGameStore();

  if (!targetId) return null;

  let targetName = 'Target';
  let targetLevel = 1;
  let targetHp = 100;
  let targetMaxHp = 100;
  let isPlayer = targetType === 'player';

  if (targetType === 'monster') {
    const m = monsters.get(targetId);
    if (!m) return null;
    targetName = m.name;
    targetLevel = m.level;
    targetHp = m.hp;
    targetMaxHp = m.maxHp;
  } else if (targetType === 'player') {
    const p = nearbyPlayers.get(targetId);
    if (!p) return null;
    targetName = p.name;
    targetLevel = p.level;
    targetHp = p.hp;
    targetMaxHp = p.maxHp;
  }

  const hpPercent = Math.max(0, Math.min(100, (targetHp / targetMaxHp) * 100));

  const handleTrade = () => {
    if (isPlayer) {
      const socket = getSocket();
      socket.emit('trade:request', { targetCharacterId: targetId });
      useGameStore.getState().addChatMessage({
        id: Math.random().toString(),
        channel: 'system',
        content: `Sent trade proposal to ${targetName}...`,
        timestamp: Date.now()
      });
    }
  };

  const handleAttack = () => {
    const socket = getSocket();
    socket.emit('combat:attack', { targetId });
  };

  return (
    <div className="fantasy-panel wow-unit-frame wow-target-frame" style={{
      position: 'absolute',
      top: '112px',
      left: '18px',
      width: '304px',
      padding: '9px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      pointerEvents: 'auto',
      zIndex: 10,
    }}>
      <div className="wow-unit-heading">
        <span style={{ color: isPlayer ? '#79c8ff' : '#f08a72' }}>{targetName}</span>
        <small>Lv. {targetLevel}</small>
        <button className="wow-close" onClick={() => setTarget(null)} aria-label="Clear target">×</button>
      </div>
      <div className="wow-resource wow-target-health">
        <div style={{ width: `${hpPercent}%` }} />
        <span>{targetHp} / {targetMaxHp} HP</span>
      </div>
      <div className="wow-target-actions">
        <button onClick={handleAttack} className="fantasy-button">Attack</button>
        {isPlayer && <button onClick={handleTrade} className="fantasy-button">Trade</button>}
      </div>
    </div>
  );
}
