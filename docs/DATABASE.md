# DATABASE SCHEMA & MIGRATIONS — PROJECT ETHERIA

## 1. ARCHITECTURE OVERVIEW
The database layer uses Supabase PostgreSQL with strict Row Level Security (RLS) policies and foreign key constraints.

## 2. MIGRATION DIRECTORY
1. `001_auth_profiles.sql`: User profiles bound to `auth.users`, automated trigger on registration.
2. `002_characters.sql`: Player characters with level, region coordinates, appearance JSON, and class restrictions.
3. `003_character_stats.sql`: Vitals (HP, Mana, Stamina), combat ratings, and 15 character skill levels with XP.
4. `004_items.sql`: Item instances (durability, quality, enchantments), 28 inventory slots, 9 equipment slots, and bank storage.
5. `005_trading.sql`: Trade sessions, offer item staging, gold staging, and append-only `currency_ledger` audit table.
6. `006_marketplace.sql`: Public marketplace listings, expiration timestamps, and economy transaction logs.
7. `007_world_chat.sql`: Persistent world modifications, resource node respawn timers, and chat log storage.
8. `008_combat_quests.sql`: Combat logs, PvP ratings, and quest tracking tables.

## 3. AUDIT & CONCURRENCY SAFETY
- **Currency Ledger**: Uses PostgreSQL rules (`no_update_ledger`, `no_delete_ledger`) to guarantee records cannot be modified or purged.
- **Atomicity**: Trade transfers and marketplace purchases update inventory slots and currency balances within single atomic database transactions.
