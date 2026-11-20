
import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getSocket } from '../../lib/socket';
import { ThreeWorld } from '../../three/ThreeWorld';

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
  const gameRef = useRef<ThreeWorld | null>(null);
  const worldContainerRef = useRef<HTMLDivElement | null>(null);
  const { token, character } = useGameStore();

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
      const resourceId = String(nodeId ?? '').split('_').slice(3).join('_');
      const resourceNames: Record<string, string> = {
        wood: 'Gỗ', ancient_wood: 'Gỗ cổ đại', copper_ore: 'Quặng đồng',
        tin_ore: 'Quặng thiếc', iron_ore: 'Quặng sắt', coal: 'Than',
        silver_ore: 'Quặng bạc', gold_ore: 'Quặng vàng', mithril_ore: 'Mithril',
        crystal_shards: 'Mảnh tinh thể', herbs: 'Thảo mộc', rare_herbs: 'Thảo mộc hiếm',
        fiber: 'Sợi', fish: 'Cá', hide: 'Da thú',
      };
      const resource = resourceNames[resourceId] ?? (resourceId.replace(/_/g, ' ') || 'tài nguyên');
      useGameStore.getState().addChatMessage({
        id: `gather-start-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        senderId: 'system',
        senderName: 'Hệ thống',
        channel: 'system',
        content: `Bắt đầu thu thập ${resource} · ${Math.ceil((duration || 0) / 1000)} giây`,
        timestamp: Date.now(),
      } as any);
    };

    const onGatherComplete = ({ item, xp, skill }: any) => {
      useGameStore.getState().addChatMessage({
        id: Math.random().toString(),
        senderId: 'system',
        senderName: 'Hệ thống',
        channel: 'system',
        content: `Đã thu thập ${item?.quantity ?? 1}x ${item?.name ?? 'tài nguyên'} (+${xp ?? 0} ${skill ?? ''} XP)`,
        timestamp: Date.now()
      } as any);
    };

    const onGatherFail = ({ reason }: any) => {
      useGameStore.getState().addChatMessage({
        id: Math.random().toString(),
        senderId: 'system',
        senderName: 'Hệ thống',
        channel: 'system',
        content: `Thu thập thất bại: ${reason ?? 'Không thể thu thập tài nguyên.'}`,
        timestamp: Date.now()
      } as any);
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

    // Initialize the Three.js world and register its world listeners before auth.
    const container = worldContainerRef.current;
    if (!container) return;

    const world = new ThreeWorld(container, socket);
    gameRef.current = world;

    // Authenticate only after the renderer has subscribed to connect:ack/world events.
    if (token) {
      if (socket.connected) {
        socket.emit('auth', { token });
      } else {
        socket.once('connect', () => socket.emit('auth', { token }));
        socket.connect();
      }
    }

    return () => {
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

      gameRef.current?.dispose();
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
        ref={worldContainerRef}
        id="three-world-container"
        style={{ width: '100%', height: '100%' }}
      />

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
