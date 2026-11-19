
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
    const socket = getSocket();

    // Socket listeners
    const onTradeRequest = (data: any) => {
      useGameStore.getState().setTradeInvite(data);
    };

    const onTradeUpdate = ({ trade }: any) => {
      useGameStore.getState().setActiveTrade(trade);
    };

    const onTradeComplete = ({ message }: any) => {
      useGameStore.getState().setActiveTrade(null);
      useGameStore.getState().addChatMessage({
        id: Math.random().toString(),
        channel: 'system',
        content: message,
        timestamp: Date.now()
      });
    };

    const onTradeCancelled = ({ reason }: any) => {
      useGameStore.getState().setActiveTrade(null);
      useGameStore.getState().addChatMessage({
        id: Math.random().toString(),
        channel: 'system',
        content: `Trade closed: ${reason || 'Cancelled'}`,
        timestamp: Date.now()
      });
    };

    const onGatherStart = ({ nodeId, duration }: any) => {
      setGatheringState({ nodeId, duration, startTime: Date.now() });
    };

    const onGatherComplete = ({ item, xp, skill }: any) => {
      setGatheringState(null);
      useGameStore.getState().addChatMessage({
        id: Math.random().toString(),
        channel: 'system',
        content: `Gathered ${item.quantity}x ${item.name} (+${xp} ${skill} XP)`,
        timestamp: Date.now()
      });
    };

    const onGatherFail = ({ reason }: any) => {
      setGatheringState(null);
      useGameStore.getState().addChatMessage({
        id: Math.random().toString(),
        channel: 'system',
        content: `Gathering failed: ${reason}`,
        timestamp: Date.now()
      });
    };

    const onStatsUpdate = (stats: any) => {
      useGameStore.getState().updateStats(stats);
    };

    const onGoldUpdate = ({ gold }: any) => {
      useGameStore.getState().updateStats({ gold });
    };

    const onInventoryUpdate = ({ slots }: any) => {
      useGameStore.getState().updateInventory(slots as any);
    };

    const onEquipmentUpdate = ({ equipSlot, item }: any) => {
      useGameStore.getState().updateEquipment(equipSlot, item as any);
    };

    const onChatMessage = (msg: any) => {
      useGameStore.getState().addChatMessage(msg);
    };

    socket.on('trade:request', onTradeRequest);
    socket.on('trade:update', onTradeUpdate);
    socket.on('trade:complete', onTradeComplete);
    socket.on('trade:cancelled', onTradeCancelled);
    socket.on('gather:start', onGatherStart);
    socket.on('gather:complete', onGatherComplete);
    socket.on('gather:fail', onGatherFail);
    socket.on('player:stats_update', onStatsUpdate);
    socket.on('player:gold_update', onGoldUpdate);
    socket.on('player:inventory_update', onInventoryUpdate);
    socket.on('player:equipment_update', onEquipmentUpdate);
    socket.on('chat:message', onChatMessage);

    // Initialize Phaser before connecting/authenticating the socket.
    // GameScene registers its world listeners before it starts authentication.
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
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

      socket.off('trade:request', onTradeRequest);
      socket.off('trade:update', onTradeUpdate);
      socket.off('trade:complete', onTradeComplete);
      socket.off('trade:cancelled', onTradeCancelled);
      socket.off('gather:start', onGatherStart);
      socket.off('gather:complete', onGatherComplete);
      socket.off('gather:fail', onGatherFail);
      socket.off('player:stats_update', onStatsUpdate);
      socket.off('player:gold_update', onGoldUpdate);
      socket.off('player:inventory_update', onInventoryUpdate);
      socket.off('player:equipment_update', onEquipmentUpdate);
      socket.off('chat:message', onChatMessage);

      gameRef.current?.destroy(true);
      gameRef.current = null;

      socket.disconnect();
    };
  }, [token, character, setGatheringState]);

  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden'
    }}>
      <div
        id="phaser-container"
        style={{ width: '100%', height: '100%' }}
      />

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
          <span style={{
            fontSize: '11px',
            color: 'var(--color-gold)',
            fontWeight: 'bold'
          }}>
            Gathering resource...
          </span>

          <div style={{
            height: '6px',
            background: '#222',
            borderRadius: '3px',
            marginTop: '6px',
            overflow: 'hidden'
          }}>
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

      <PlayerFrame />
      <Minimap />
      <TargetFrame />
      <ChatBox />
      <SkillBar />
      <MenuBar />
      <TradeInviteModal />

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
