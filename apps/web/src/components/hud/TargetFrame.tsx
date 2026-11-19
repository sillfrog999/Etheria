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
    <div className="fantasy-panel" style={{
      position: 'absolute',
      top: '16px',
      left: '310px',
      width: '240px',
      padding: '10px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      pointerEvents: 'auto',
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: isPlayer ? '#81c784' : '#ef5350' }}>
          {targetName}
        </span>
        <span
          onClick={() => setTarget(null)}
          style={{ cursor: 'pointer', color: '#888', fontSize: '12px' }}
        >
          ✕
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#aaa' }}>
        <span>Level {targetLevel}</span>
        <span>{targetHp} / {targetMaxHp} HP</span>
      </div>

      <div style={{ height: '8px', background: '#200b0b', border: '1px solid #4a1515', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${hpPercent}%`, height: '100%', background: '#ef5350', transition: 'width 0.2s' }} />
      </div>

      <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
        <button onClick={handleAttack} className="fantasy-button" style={{ flex: 1, fontSize: '11px', padding: '4px' }}>
          Attack
        </button>
        {isPlayer && (
          <button onClick={handleTrade} className="fantasy-button" style={{ flex: 1, fontSize: '11px', padding: '4px' }}>
            Trade
          </button>
        )}
      </div>
    </div>
  );
}
