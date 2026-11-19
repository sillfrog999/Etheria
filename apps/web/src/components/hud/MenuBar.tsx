import React, { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';

export function MenuBar() {
  const { toggleWindow, gold } = useGameStore();

  const buttons = [
    { id: 'inventory', label: 'Inventory (I)' },
    { id: 'character', label: 'Character (C)' },
    { id: 'skills', label: 'Skills (K)' },
    { id: 'spellbook', label: 'Spells (P)' },
    { id: 'trade', label: 'Trade (T)' },
    { id: 'marketplace', label: 'Market (M)' },
    { id: 'map', label: 'Map (O)' },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      const key = e.key.toLowerCase();
      if (key === 'i') toggleWindow('inventory');
      else if (key === 'c') toggleWindow('character');
      else if (key === 'k') toggleWindow('skills');
      else if (key === 'p') toggleWindow('spellbook');
      else if (key === 't') toggleWindow('trade');
      else if (key === 'm') toggleWindow('marketplace');
      else if (key === 'o') toggleWindow('map');
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleWindow]);

  return (
    <div className="fantasy-panel" style={{
      position: 'absolute',
      bottom: '16px',
      right: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 12px',
      pointerEvents: 'auto',
      zIndex: 10,
    }}>
      <div style={{ color: 'var(--color-gold-bright)', fontSize: '12px', fontWeight: 'bold', marginRight: '8px' }}>
        {gold} G
      </div>

      {buttons.map((b) => (
        <button
          key={b.id}
          onClick={() => toggleWindow(b.id as any)}
          className="fantasy-button"
          style={{ fontSize: '11px', padding: '4px 8px' }}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
