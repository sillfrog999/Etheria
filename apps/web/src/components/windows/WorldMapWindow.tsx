import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { REGIONS } from '@etheria/shared';

export function WorldMapWindow() {
  const { windows, closeWindow, currentRegion } = useGameStore();

  if (!windows.map) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: 40,
      pointerEvents: 'auto',
    }}>
      <div className="fantasy-panel" style={{ width: '560px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 className="fantasy-header" style={{ margin: 0, fontSize: '18px' }}>REALM OF ETHERIA</h3>
          <span onClick={() => closeWindow('map')} style={{ cursor: 'pointer', color: '#888' }}>✕</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {Object.values(REGIONS).map((r) => {
            const isCurrent = r.id === currentRegion;
            return (
              <div
                key={r.id}
                style={{
                  background: isCurrent ? 'rgba(212, 175, 55, 0.15)' : 'rgba(0, 0, 0, 0.4)',
                  border: `1px solid ${isCurrent ? 'var(--color-gold)' : '#2a2419'}`,
                  padding: '12px',
                  borderRadius: '4px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: isCurrent ? 'var(--color-gold-bright)' : '#fff' }}>
                    {r.name}
                  </span>
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    background: r.pvpZone === 'safe' ? '#1b4a15' : r.pvpZone === 'normal' ? '#4a3a15' : '#4a1515',
                    color: r.pvpZone === 'safe' ? '#66bb6a' : r.pvpZone === 'normal' ? '#ffa726' : '#ef5350',
                    textTransform: 'uppercase',
                  }}>
                    {r.pvpZone.replace('_', ' ')}
                  </span>
                </div>
                <p style={{ margin: '0 0 6px 0', fontSize: '11px', color: '#999', lineHeight: '1.3' }}>
                  {r.description}
                </p>
                <span style={{ fontSize: '10px', color: '#666' }}>Min Level: {r.minLevel}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
