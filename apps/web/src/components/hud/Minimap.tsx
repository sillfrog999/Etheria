import React from 'react';
import { useGameStore } from '../../store/gameStore';

export function Minimap() {
  const { playerPos, currentRegion } = useGameStore();

  return (
    <div className="fantasy-panel" style={{
      position: 'absolute',
      top: '16px',
      right: '16px',
      width: '160px',
      padding: '8px',
      textAlign: 'center',
      pointerEvents: 'auto',
      zIndex: 10,
    }}>
      <div style={{
        height: '110px',
        background: 'radial-gradient(circle, #1a2f1a 0%, #081108 100%)',
        border: '1px solid var(--color-gold-dark)',
        borderRadius: '4px',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* Radar concentric rings */}
        <div style={{ width: '80px', height: '80px', border: '1px dashed rgba(212, 175, 55, 0.3)', borderRadius: '50%', position: 'absolute' }} />
        <div style={{ width: '40px', height: '40px', border: '1px dashed rgba(212, 175, 55, 0.4)', borderRadius: '50%', position: 'absolute' }} />

        {/* Center player blip */}
        <div style={{
          width: '8px',
          height: '8px',
          background: '#ffea00',
          borderRadius: '50%',
          boxShadow: '0 0 6px #ffea00',
          zIndex: 2,
        }} />

        <span style={{ position: 'absolute', top: '4px', left: '6px', fontSize: '9px', color: '#66bb6a' }}>
          SAFE ZONE
        </span>
      </div>

      <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--color-gold)', fontWeight: 'bold', textTransform: 'capitalize' }}>
        {currentRegion}
      </div>
      <div style={{ fontSize: '10px', color: '#888' }}>
        X: {Math.round(playerPos.x)} | Y: {Math.round(playerPos.y)}
      </div>
    </div>
  );
}
