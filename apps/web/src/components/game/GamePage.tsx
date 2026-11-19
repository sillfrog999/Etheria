import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../lib/socket';
import { PreloadScene } from '../../phaser/scenes/PreloadScene';
import { GameScene } from '../../phaser/scenes/GameScene';

import { PlayerFrame } from '../hud/PlayerFrame';
import { Minimap } from '../hud/Minimap';
import { SkillBar } from '../hud/SkillBar';
import { ChatBox } from '../hud/ChatBox';
import { TargetFrame } from '../hud/TargetFrame';
import { MenuBar } from '../hud/MenuBar';
import { TradeInviteModal } from '../hud/TradeInviteModal';

import { InventoryWindow } from '../windows/InventoryWindow';
import { EquipmentWindow } from '../windows/EquipmentWindow';
import { SkillsWindow } from '../windows/SkillsWindow';
import { CharacterWindow } from '../windows/CharacterWindow';
import { TradeWindow } from '../windows/TradeWindow';
import { MarketplaceWindow } from '../windows/MarketplaceWindow';
import { SpellbookWindow } from '../windows/SpellbookWindow';
import { WorldMapWindow } from '../windows/WorldMapWindow';

export function GamePage() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const { token, character, gatheringState, setGatheringState } = useGameStore();

  useEffect(() => {
    // 1. Establish Socket.IO session
    const socket = getSocket();
    if (!socket.connected) {
      socket.connect();
    }

    if (token) {
      socket.emit('auth', { token });
    }

    // Socket listeners for game events
    socket.on('trade:request', (data) => {
      useGameStore.getState().setTradeInvite(data);
    });

    socket.on('trade:update', ({ trade }) => {
      useGameStore.getState().setActiveTrade(trade);
    });

    socket.on('trade:complete', ({ message }) => {
      useGameStore.getState().setActiveTrade(null);
      useGameStore.getState().addChatMessage({
        id: Math.random().toString(),
        channel: 'system',
        content: message,
        timestamp: Date.now()
      });
    });

    socket.on('trade:cancelled', ({ reason }) => {
      useGameStore.getState().setActiveTrade(null);
      useGameStore.getState().addChatMessage({
        id: Math.random().toString(),
        channel: 'system',
        content: `Trade closed: ${reason || 'Cancelled'}`,
        timestamp: Date.now()
      });
    });

    socket.on('gather:start', ({ nodeId, duration }) => {
      setGatheringState({ nodeId, duration, startTime: Date.now() });
    });

    socket.on('gather:complete', ({ item, xp, skill }) => {
      setGatheringState(null);
      useGameStore.getState().addChatMessage({
        id: Math.random().toString(),
        channel: 'system',
        content: `Gathered ${item.quantity}x ${item.name} (+${xp} ${skill} XP)`,
        timestamp: Date.now()
      });
    });

    socket.on('gather:fail', ({ reason }) => {
      setGatheringState(null);
      useGameStore.getState().addChatMessage({
        id: Math.random().toString(),
        channel: 'system',
        content: `Gathering failed: ${reason}`,
        timestamp: Date.now()
      });
    });

    socket.on('player:stats_update', (stats) => {
      useGameStore.getState().updateStats(stats);
    });

    socket.on('player:gold_update', ({ gold }) => {
      useGameStore.getState().updateStats({ gold });
    });

    socket.on('player:inventory_update', ({ slots }) => {
      useGameStore.getState().updateInventory(slots as any);
    });

    socket.on('player:equipment_update', ({ equipSlot, item }) => {
      useGameStore.getState().updateEquipment(equipSlot, item as any);
    });

    socket.on('chat:message', (msg) => {
      useGameStore.getState().addChatMessage(msg);
    });

    // 2. Initialize Phaser Game instance
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.WEBGL,
      parent: 'phaser-container',
      width: window.innerWidth,
      height: window.innerHeight,
      pixelArt: true,
      roundPixels: true,
      backgroundColor: '#0a0d14',
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      scene: [PreloadScene, GameScene],
    };

    gameRef.current = new Phaser.Game(config);

    const handleResize = () => {
      gameRef.current?.scale.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      gameRef.current?.destroy(true);
      socket.disconnect();
    };
  }, [token, character]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Phaser Canvas Container */}
      <div id="phaser-container" style={{ width: '100%', height: '100%' }} />

      {/* Gathering Progress Bar */}
      {gatheringState && (
        <div style={{
          position: 'absolute',
          top: '42%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '200px',
          padding: '8px',
          background: 'rgba(0, 0, 0, 0.85)',
          border: '1px solid var(--color-gold)',
          borderRadius: '4px',
          textAlign: 'center',
          zIndex: 30,
        }}>
          <span style={{ fontSize: '11px', color: 'var(--color-gold)', fontWeight: 'bold' }}>
            Gathering resource...
          </span>
          <div style={{ height: '6px', background: '#222', borderRadius: '3px', marginTop: '6px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: '#4caf50',
              animation: `progress ${gatheringState.duration}ms linear forwards`,
            }} />
          </div>
          <style>{`
            @keyframes progress {
              from { width: 0%; }
              to { width: 100%; }
            }
          `}</style>
        </div>
      )}

      {/* Main HUD Overlays */}
      <PlayerFrame />
      <Minimap />
      <TargetFrame />
      <ChatBox />
      <SkillBar />
      <MenuBar />
      <TradeInviteModal />

      {/* Modals & Windows */}
      <InventoryWindow />
      <EquipmentWindow />
      <SkillsWindow />
      <CharacterWindow />
      <TradeWindow />
      <MarketplaceWindow />
      <SpellbookWindow />
      <WorldMapWindow />
    </div>
  );
}
