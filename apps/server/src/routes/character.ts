import { Router, type Request, type Response } from 'express';
import type { GameStateManager } from '../game/GameStateManager.js';
import type { Env } from '../config/env.js';
import { getSupabaseAdmin } from '../db/supabase.js';
import { STARTING_POSITION, STARTING_REGION } from '@etheria/shared';

export function createCharacterRouter(gameState: GameStateManager, env: Env): Router {
  const router = Router();

  // Middleware to authenticate user token
  const authenticate = async (req: Request, res: Response, next: () => void) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid token' });
    }
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });

    const supabase = getSupabaseAdmin(env);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    (req as any).user = user;
    next();
  };

  // List all characters for current account
  router.get('/', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const supabase = getSupabaseAdmin(env);
      const { data: characters, error } = await supabase
        .from('characters')
        .select(`
          *,
          character_stats (*),
          character_skills (*)
        `)
        .eq('account_id', user.id);

      if (error) throw error;
      return res.json({ characters });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Create character
  router.post('/', authenticate, async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const { name, characterClass, appearance } = req.body;

      if (!name || !characterClass) {
        return res.status(400).json({ error: 'Name and class are required' });
      }

      const validClasses = ['mage', 'fighter', 'assassin', 'ranger'];
      if (!validClasses.includes(characterClass)) {
        return res.status(400).json({ error: 'Invalid class' });
      }

      const supabase = getSupabaseAdmin(env);

      // Check max characters (e.g. 5)
      const { count } = await supabase
        .from('characters')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', user.id);

      if ((count ?? 0) >= 5) {
        return res.status(400).json({ error: 'Max character limit reached (5)' });
      }

      // Insert character
      const { data: char, error: charErr } = await supabase
        .from('characters')
        .insert({
          account_id: user.id,
          name,
          class: characterClass,
          level: 1,
          experience: 0,
          gold: 100,
          region: STARTING_REGION,
          pos_x: STARTING_POSITION.x,
          pos_y: STARTING_POSITION.y,
          appearance: appearance || {},
        })
        .select()
        .single();

      if (charErr) {
        if (charErr.code === '23505') {
          return res.status(409).json({ error: 'Character name already taken' });
        }
        throw charErr;
      }

      // Create base stats
      let hp = 100, mana = 50, stamina = 100;
      let attack = 5, strength = 5, defence = 5, magicPower = 5, mobility = 5;

      if (characterClass === 'fighter') {
        hp = 140; defence = 8; strength = 8;
      } else if (characterClass === 'mage') {
        mana = 100; magicPower = 10; hp = 80;
      } else if (characterClass === 'assassin') {
        mobility = 8; attack = 8;
      } else if (characterClass === 'ranger') {
        mobility = 7; attack = 7; stamina = 120;
      }

      await supabase.from('character_stats').insert({
        character_id: char.id,
        hp, max_hp: hp,
        mana, max_mana: mana,
        stamina, max_stamina: stamina,
        attack, strength, defence, magic_power: magicPower, mobility,
        carry_weight: 0, max_carry_weight: 100
      });

      // Initialize base skills
      const skillNames = [
        'mining', 'woodcutting', 'fishing', 'farming', 'hunting',
        'smithing', 'crafting', 'cooking', 'alchemy',
        'attack', 'strength', 'defence', 'magic', 'ranged', 'agility'
      ];

      const skillInserts = skillNames.map(s => ({
        character_id: char.id,
        skill_name: s,
        level: 1,
        xp: 0
      }));

      await supabase.from('character_skills').insert(skillInserts);

      return res.status(201).json({ character: char });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
