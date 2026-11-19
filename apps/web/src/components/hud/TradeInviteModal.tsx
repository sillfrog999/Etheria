import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../lib/socket';

export function TradeInviteModal() {
  const { tradeInvite, setTradeInvite } = useGameStore();

  if (!tradeInvite) return null;

  const handleAccept = () => {
    const socket = getSocket();
    socket.emit('trade:accept', { tradeId: tradeInvite.tradeId });
    setTradeInvite(null);
  };

  const handleDecline = () => {
    const socket = getSocket();
    socket.emit('trade:decline', { tradeId: tradeInvite.tradeId });
    setTradeInvite(null);
  };

  return (
    <div style={{
      position: 'absolute',
      top: '90px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      pointerEvents: 'auto',
    }}>
      <div className="fantasy-panel" style={{ width: '320px', padding: '16px', textAlign: 'center' }}>
        <h4 className="fantasy-header" style={{ margin: '0 0 8px 0', fontSize: '16px' }}>
          Trade Proposal
        </h4>
        <p style={{ fontSize: '13px', color: '#ddd', margin: '0 0 16px 0' }}>
          <strong style={{ color: 'var(--color-gold)' }}>{tradeInvite.fromName}</strong> wishes to conduct a trade with you.
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button onClick={handleAccept} className="fantasy-button" style={{ flex: 1 }}>
            Accept
          </button>
          <button onClick={handleDecline} className="fantasy-button" style={{ flex: 1, borderColor: '#732c2c', background: '#251313' }}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
