
import { Router, type Request, type Response } from 'express';
import type { GameStateManager } from '../game/GameStateManager.js';
import type { Env } from '../config/env.js';
import { getSupabaseAdmin } from '../db/supabase.js';
import { STARTING_POSITION, STARTING_REGION } from '@etheria/shared';

const VALID_CHARACTER_MODELS = ['elf_female', 'elf_male', 'orc_female', 'orc_male'] as const;

export function createCharacterRouter(gameState: GameStateManager, env: Env): Router {
  const router = Router();

  const authenticate = async (
    req: Request,
    res: Response,
    next: () => void
  ) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing or invalid token' });
      }

      const token = authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({ error: 'Missing token' });
      }

      const supabase = getSupabaseAdmin(env);
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      (req as any).user = user;
      next();
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };

  const toNumber = (value: unknown, fallback: number): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const normalizeCharacter = (row: any) => {
    const statsRow = Array.isArray(row.character_stats)
      ? row.character_stats[0]
      : row.character_stats;

    const skillRows = Array.isArray(row.character_skills)
      ? row.character_skills
      : [];

    const skillNames = [
      'mining', 'woodcutting', 'fishing', 'farming', 'hunting',
      'smithing', 'crafting', 'cooking', 'alchemy',
      'attack', 'strength', 'defence', 'magic', 'ranged', 'agility'
    ];

    const skills: Record<string, number> = {};
    const skillXP: Record<string, number> = {};

    for (const skillName of skillNames) {
      const skill = skillRows.find(
        (entry: any) => entry.skill_name === skillName
      );

      skills[skillName] = toNumber(skill?.level, 1);
      skillXP[skillName] = toNumber(skill?.xp, 0);
    }

    const stats = {
      hp: toNumber(statsRow?.hp, 100),
      maxHp: toNumber(statsRow?.max_hp, 100),
      mana: toNumber(statsRow?.mana, 50),
      maxMana: toNumber(statsRow?.max_mana, 50),
      stamina: toNumber(statsRow?.stamina, 100),
      maxStamina: toNumber(statsRow?.max_stamina, 100),
      attack: toNumber(statsRow?.attack, 5),
      strength: toNumber(statsRow?.strength, 5),
      defence: toNumber(statsRow?.defence, 5),
      magicPower: toNumber(statsRow?.magic_power, 5),
      mobility: toNumber(statsRow?.mobility, 5),
      carryWeight: toNumber(statsRow?.carry_weight, 0),
      maxCarryWeight: toNumber(statsRow?.max_carry_weight, 100)
    };

    const region = row.region || STARTING_REGION;

    const position = {
      x: toNumber(
        row.pos_x ?? row.position?.x,
        STARTING_POSITION.x
      ),
      y: toNumber(
        row.pos_y ?? row.position?.y,
        STARTING_POSITION.y
      ),
      region
    };

    return {
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      class: row.class,
      level: toNumber(row.level, 1),
      experience: toNumber(row.experience, 0),
      stats,
      skills,
      skillXP,
      gold: toNumber(row.gold, 100),
      position,
      region,
      appearance: {
        bodyType: 1,
        hairStyle: 1,
        hairColor: '#8B4513',
        skinTone: '#FFD39B',
        faceStyle: 1,
        ...(row.appearance || {}),
        modelId: VALID_CHARACTER_MODELS.includes(row.appearance?.modelId)
          ? row.appearance.modelId
          : 'elf_male'
      },
      createdAt: row.created_at,
      lastLogin: row.last_login || row.created_at
    };
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

      const normalizedCharacters = (characters || []).map(
        normalizeCharacter
      );

      return res.json({
        characters: normalizedCharacters
      });
    } catch (err: any) {
      console.error('[GET /characters]', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // Create character
  router.post('/', authenticate, async (req: Request, res: Response) => {
    let createdCharacterId: string | null = null;

    try {
      const user = (req as any).user;
      const { name, characterClass, appearance } = req.body;

      if (
        typeof name !== 'string' ||
        name.trim().length < 3 ||
        name.trim().length > 24
      ) {
        return res.status(400).json({
          error: 'Character name must be 3-24 characters'
        });
      }

      if (!characterClass) {
        return res.status(400).json({
          error: 'Name and class are required'
        });
      }

      const validClasses = ['mage', 'fighter', 'assassin', 'ranger'];

      if (!validClasses.includes(characterClass)) {
        return res.status(400).json({
          error: 'Invalid class'
        });
      }

      const supabase = getSupabaseAdmin(env);

      const { count, error: countError } = await supabase
        .from('characters')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', user.id);

      if (countError) throw countError;

      if ((count ?? 0) >= 5) {
        return res.status(400).json({
          error: 'Max character limit reached (5)'
        });
      }

      const { data: char, error: charErr } = await supabase
        .from('characters')
        .insert({
          account_id: user.id,
          name: name.trim(),
          class: characterClass,
          level: 1,
          experience: 0,
          gold: 100,
          region: STARTING_REGION,
          pos_x: STARTING_POSITION.x,
          pos_y: STARTING_POSITION.y,
          appearance: {
            ...(appearance && typeof appearance === 'object' ? appearance : {}),
            modelId: VALID_CHARACTER_MODELS.includes(appearance?.modelId)
              ? appearance.modelId
              : 'elf_male'
          }
        })
        .select()
        .single();

      if (charErr) {
        if (charErr.code === '23505') {
          return res.status(409).json({
            error: 'Character name already taken'
          });
        }

        throw charErr;
      }

      createdCharacterId = char.id;

      let hp = 100;
      let mana = 50;
      let stamina = 100;
      let attack = 5;
      let strength = 5;
      let defence = 5;
      let magicPower = 5;
      let mobility = 5;

      if (characterClass === 'fighter') {
        hp = 140;
        defence = 8;
        strength = 8;
      } else if (characterClass === 'mage') {
        mana = 100;
        magicPower = 10;
        hp = 80;
      } else if (characterClass === 'assassin') {
        mobility = 8;
        attack = 8;
      } else if (characterClass === 'ranger') {
        mobility = 7;
        attack = 7;
        stamina = 120;
      }

      const { error: statsError } = await supabase
        .from('character_stats')
        .insert({
          character_id: char.id,
          hp,
          max_hp: hp,
          mana,
          max_mana: mana,
          stamina,
          max_stamina: stamina,
          attack,
          strength,
          defence,
          magic_power: magicPower,
          mobility,
          carry_weight: 0,
          max_carry_weight: 100
        });

      if (statsError) throw statsError;

      const skillNames = [
        'mining', 'woodcutting', 'fishing', 'farming', 'hunting',
        'smithing', 'crafting', 'cooking', 'alchemy',
        'attack', 'strength', 'defence', 'magic', 'ranged', 'agility'
      ];

      const skillInserts = skillNames.map(skill => ({
        character_id: char.id,
        skill_name: skill,
        level: 1,
        xp: 0
      }));

      const { error: skillsError } = await supabase
        .from('character_skills')
        .insert(skillInserts);

      if (skillsError) throw skillsError;

      return res.status(201).json({
        character: normalizeCharacter({
          ...char,
          character_stats: [{
            hp,
            max_hp: hp,
            mana,
            max_mana: mana,
            stamina,
            max_stamina: stamina,
            attack,
            strength,
            defence,
            magic_power: magicPower,
            mobility,
            carry_weight: 0,
            max_carry_weight: 100
          }],
          character_skills: skillInserts
        })
      });
    } catch (err: any) {
      console.error('[POST /characters]', err);

      // Avoid leaving an incomplete character behind if initialization fails.
      if (createdCharacterId) {
        const supabase = getSupabaseAdmin(env);

        await supabase
          .from('character_skills')
          .delete()
          .eq('character_id', createdCharacterId);

        await supabase
          .from('character_stats')
          .delete()
          .eq('character_id', createdCharacterId);

        await supabase
          .from('characters')
          .delete()
          .eq('id', createdCharacterId);
      }

      return res.status(500).json({
        error: err.message || 'Failed to create character'
      });
    }
  });

  return router;
}
