import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { SKILL_NAMES, xpForLevel, xpToNextLevel, levelProgress } from '@etheria/shared';

export function SkillsWindow() {
  const { windows, closeWindow, character } = useGameStore();

  if (!windows.skills || !character) return null;

  return (
    <div className="fantasy-panel" style={{
      position: 'absolute',
      top: '120px',
      left: '300px',
      width: '320px',
      maxHeight: '480px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 20,
      pointerEvents: 'auto',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 className="fantasy-header" style={{ margin: 0, fontSize: '15px' }}>SKILL PROGRESSION (15)</h3>
        <span onClick={() => closeWindow('skills')} style={{ cursor: 'pointer', color: '#888' }}>✕</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
        {SKILL_NAMES.map((s) => {
          const level = (character.skills as any)?.[s] || 1;
          const xp = (character.skillXP as any)?.[s] || 0;
          const progress = Math.min(100, Math.max(0, levelProgress(xp) * 100));

          return (
            <div
              key={s}
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid #2a2419',
                padding: '8px 10px',
                borderRadius: '4px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ textTransform: 'capitalize', color: '#fff', fontWeight: 'bold' }}>{s}</span>
                <span style={{ color: 'var(--color-gold)' }}>Level {level} / 99</span>
              </div>

              {/* XP Bar */}
              <div style={{ height: '6px', background: '#111', border: '1px solid #222', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--color-gold)', transition: 'width 0.2s' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#777', marginTop: '2px' }}>
                <span>XP: {xp}</span>
                <span>Next: {xpToNextLevel(xp)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
