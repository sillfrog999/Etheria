import { Router, type Express } from 'express';
import type { GameStateManager } from '../game/GameStateManager.js';
import type { Env } from '../config/env.js';
import { createCharacterRouter } from './character.js';
import { createMarketplaceRouter } from './marketplace.js';

export function setupRoutes(app: Express, gameState: GameStateManager, env: Env) {
  const router = Router();
  router.use('/characters', createCharacterRouter(gameState, env));
  router.use('/marketplace', createMarketplaceRouter(gameState, env));

  app.use('/api', router);
}
