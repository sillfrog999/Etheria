import type { GameServer, GameSocket } from '../index.js';
import type { GameStateManager } from '../../game/GameStateManager.js';
import type { Env } from '../../config/env.js';
import { getSupabaseAdmin } from '../../db/supabase.js';
import type { ChatMessage } from '@etheria/shared';

const CHAT_RATE_LIMIT_MS = 1000;
const lastChat = new Map<string, number>();
const MAX_CONTENT_LENGTH = 200;

function filterContent(content: string): string {
  return content.trim().slice(0, MAX_CONTENT_LENGTH);
}

export function handleChat(io: GameServer, socket: GameSocket, gameState: GameStateManager, env: Env) {
  socket.on('chat:send', async ({ channel, content, recipientId }) => {
    if (!socket.data.authenticated || !socket.data.characterId) return;

    const player = gameState.getPlayer(socket.data.characterId);
    if (!player) return;

    // Rate limit
    const now = Date.now();
    const last = lastChat.get(socket.data.characterId) ?? 0;
    if (now - last < CHAT_RATE_LIMIT_MS) return;
    lastChat.set(socket.data.characterId, now);

    const filtered = filterContent(content);
    if (!filtered) return;

    const message: ChatMessage = {
      id: Math.random().toString(36).slice(2),
      channel: channel as ChatMessage['channel'],
      senderId: player.characterId,
      senderName: player.name,
      content: filtered,
      timestamp: now,
      recipientId,
    };

    // Broadcast based on channel
    if (channel === 'world') {
      io.emit('chat:message', message);
    } else if (channel === 'local') {
      io.to(`region:${player.region}`).emit('chat:message', message);
    } else if (channel === 'private' && recipientId) {
      const recipient = gameState.getPlayer(recipientId);
      if (recipient) {
        const recipSocket = io.sockets.sockets.get(recipient.socketId);
        recipSocket?.emit('chat:message', message);
        socket.emit('chat:message', message);
      }
    } else {
      // Party/Guild — broadcast to region for now
      io.to(`region:${player.region}`).emit('chat:message', message);
    }

    // Persist world/local messages
    if (['world', 'local'].includes(channel)) {
      try {
        const supabase = getSupabaseAdmin(env);
        await supabase.from('chat_messages').insert({
          channel,
          sender_character_id: player.characterId,
          sender_name: player.name,
          content: filtered,
        });
      } catch (_) { /* non-critical */ }
    }
  });
}
