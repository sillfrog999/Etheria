# PROJECT ETHERIA — LIVING SANDBOX MMORPG

A persistent, browser-based, isometric 2D Sandbox MMORPG built with modern Web technologies.

---

## 🌟 KEY HIGHLIGHTS
- **Engine**: Phaser 3 WebGL isometric rendering (`screenX = (x-y)*32`, `screenY = (x+y)*16 - z`) with camera zoom, smooth depth sorting, and particle feedback.
- **Procedural Streaming**: Deterministic 32x32 chunk generator powered by seeded Mulberry32 PRNG and Fractal Brownian Motion (FBM) noise.
- **Authoritative Backend**: 20 ticks/sec Node.js + Express + Socket.IO server enforcing movement limits, server-side cooldowns, gathering timers, and combat damage.
- **Classes**: Mage, Fighter, Assassin, Ranger with specialized abilities mapped to a 12-slot action hotbar (`Q`, `W`, `E`, `R`, `T`, `Y`, `A`, `S`, `D`, `F`, `G`, `H`).
- **Economy & Trading**:
  - Secure two-phase mutual confirmation trading between players.
  - Aurelia Central Marketplace with listing escrow and atomic purchasing.
  - Immutable `currency_ledger` audit trail preventing gold duplication or tampering.
- **Expanded Item Registry**: 112 fully defined items spanning Resources, Materials, Tools, Melee/Magic/Ranged Weapons, Armors, Accessories, Consumables, and Mythic Relics.
- **Skills**: 15 independent skills leveling from 1 to 99 following action-based RuneScape progression.

---

## 🚀 QUICK START

### 1. Prerequisites
- Node.js 20+
- `pnpm` (`npm install -g pnpm`)
- Free Supabase PostgreSQL project

### 2. Setup Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Apply the database migrations in `supabase/migrations/` (001 through 008) in your Supabase SQL editor.

### 3. Install Dependencies & Build
```bash
pnpm install
pnpm build
```

### 4. Run Development Servers
```bash
# Starts both frontend (http://localhost:5173) and backend (http://localhost:3001)
pnpm dev
```

---

## 📦 MONOREPO STRUCTURE
- `apps/web`: React 18, Vite, Phaser 3, Zustand, CSS Modules
- `apps/server`: Express, Socket.IO, Supabase Client, Authoritative Game Loop
- `packages/shared`: Data models, XP tables, Region coordinates, Combat types
- `packages/game-data`: 112 Items, 23 Abilities, 15 Monsters
- `packages/protocol`: Socket.IO client-server event contracts
- `packages/world-generator`: Deterministic chunk & terrain generator
- `supabase/migrations`: SQL migrations (001-008)
- `docs/`: Technical and design specifications
