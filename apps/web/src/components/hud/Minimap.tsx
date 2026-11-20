import React from 'react';
import { useGameStore } from '../../store/gameStore';

export function Minimap() {
  const { playerPos, currentRegion } = useGameStore();

  return (
    <div className="fantasy-panel wow-minimap" style={{
      position: 'absolute',
      top: '16px',
      right: '16px',
      width: '190px',
      padding: '7px',
      textAlign: 'center',
      pointerEvents: 'auto',
      zIndex: 10,
    }}>
      <div className="wow-minimap-view">
        <div className="wow-map-ring" />
        <div className="wow-map-ring wow-map-ring-inner" />
        <div className="wow-map-player" />
        <span className="wow-zone-label">SAFE ZONE</span>
      </div>
      <div className="wow-zone-name">{currentRegion}</div>
      <div className="wow-coordinates">X: {Math.round(playerPos.x)} | Y: {Math.round(playerPos.y)}</div>
    </div>
  );
}
