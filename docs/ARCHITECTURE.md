# ARCHITECTURE SPECIFICATION — PROJECT ETHERIA

## 1. MONOREPO STRUCTURE
```
etheria/
  apps/
    web/                   # React 18 + Vite + Phaser 3 WebGL client
    server/                # Node.js + Express + Socket.IO server
  packages/
    shared/                # Common TypeScript types, constants & formulas
    game-data/             # Item registry (112 items), abilities & monster definitions
    protocol/              # Socket.IO typed client-server contracts
    world-generator/       # Seeded deterministic isometric chunk generator
  supabase/
    migrations/            # Sequentially numbered PostgreSQL migrations (001-008)
  docs/                    # Technical & game design documentation
```

## 2. AUTHORITATIVE NETWORKING MODEL
- **Socket.IO** powers real-time bidirectional communication.
- **Tick Rate**: 20 server simulation ticks per second (50ms).
- **Snapshot Sync**: Position sync broadcast at ~15 Hz to nearby players.
- **AOI (Area of Interest)**: Socket.IO rooms partitioned by `region:<regionId>` ensure clients only receive updates relevant to their immediate surroundings.
- **Validation**:
  - Client state is never trusted.
  - Movement distance is clamped and rate-limited.
  - Resource harvesting, cooldowns, and combat damage rolls are calculated exclusively on the server.

## 3. PERSISTENCE & DATA PIPELINE
- Realtime player positions, active combat states, and temporary session data are cached in-memory inside `GameStateManager`.
- Dirty records are automatically flushed to Supabase PostgreSQL at 30-second intervals or upon clean shutdown.
- Financial transactions (Gold changes, trades, marketplace purchases) are executed immediately and written to the immutable `currency_ledger` audit table.
