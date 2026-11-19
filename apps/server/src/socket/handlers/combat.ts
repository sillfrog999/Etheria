import type { GameServer, GameSocket } from '../index.js';
import type { GameStateManager } from '../../game/GameStateManager.js';
import { getMonster, MONSTER_DATABASE } from '@etheria/game-data';

const ATTACK_COOLDOWN_MS = 1200;
const lastAttack = new Map<string, number>();

function rollDamage(base: number, attackStat: number, defence: number): { damage: number; isCrit: boolean } {
  const rawDamage = base + attackStat * 0.5;
  const reduced = rawDamage * (100 / (100 + defence));
  const isCrit = Math.random() < 0.1;
  const damage = Math.max(1, Math.floor(reduced * (isCrit ? 1.5 : 1) * (0.9 + Math.random() * 0.2)));
  return { damage, isCrit };
}

export function handleCombat(io: GameServer, socket: GameSocket, gameState: GameStateManager) {
  socket.on('combat:attack', ({ targetId, abilityId }) => {
    if (!socket.data.authenticated || !socket.data.characterId) return;

    const player = gameState.getPlayer(socket.data.characterId);
    if (!player) return;

    const now = Date.now();
    const last = lastAttack.get(socket.data.characterId) ?? 0;
    if (now - last < ATTACK_COOLDOWN_MS) return;
    lastAttack.set(socket.data.characterId, now);

    // Attack a monster
    const monster = gameState.getMonster(targetId);
    if (monster && monster.state !== 'dead' && monster.region === player.region) {
      const dist = Math.sqrt(Math.pow(monster.x - player.x, 2) + Math.pow(monster.y - player.y, 2));
      if (dist > 10) {
        socket.emit('server:error', { code: 'OUT_OF_RANGE', message: 'Target is out of range.' });
        return;
      }

      const { damage, isCrit } = rollDamage(10, player.hp, monster.defence);
      monster.hp = Math.max(0, monster.hp - damage);

      io.to(`region:${player.region}`).emit('combat:damage', {
        attackerId: player.characterId,
        targetId: monster.id,
        damage,
        isCrit,
        damageType: 'physical',
      });

      if (monster.hp <= 0) {
        monster.state = 'dead';
        monster.targetPlayerId = undefined;

        // Calculate loot
        const def = MONSTER_DATABASE[monster.definitionId];
        const loot: Array<{ definitionId: string; quantity: number; name: string }> = [];
        if (def) {
          for (const entry of def.lootTable) {
            if (Math.random() < entry.chance) {
              const qty = entry.minQuantity + Math.floor(Math.random() * (entry.maxQuantity - entry.minQuantity + 1));
              loot.push({ definitionId: entry.itemId, quantity: qty, name: entry.itemId });
            }
          }
          // Gold drop
          const goldDrop = def.goldMin + Math.floor(Math.random() * (def.goldMax - def.goldMin + 1));
          gameState.updatePlayerGold(player.characterId, player.gold + goldDrop);
          socket.emit('player:gold_update', { gold: player.gold + goldDrop });
        }

        io.to(`region:${player.region}`).emit('combat:monster_death', {
          monsterId: monster.id,
          loot,
        });

        // Respawn monster after 30-60 seconds
        const respawnMs = 30000 + Math.random() * 30000;
        setTimeout(() => {
          if (def) {
            monster.hp = monster.maxHp;
            monster.state = 'idle';
            monster.x = monster.spawnX;
            monster.y = monster.spawnY;
            monster.targetPlayerId = undefined;
            io.to(`region:${monster.region}`).emit('combat:monster_spawn', { monster });
          }
        }, respawnMs);
      } else {
        // Monster aggros back
        if (monster.state !== 'attack') {
          monster.state = 'chase';
          monster.targetPlayerId = player.characterId;
        }
        io.to(`region:${player.region}`).emit('combat:monster_update', { monster });
      }
    }
  });
}
