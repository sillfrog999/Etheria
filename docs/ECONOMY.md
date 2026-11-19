# ECONOMY & MARKETPLACE SPECIFICATION — PROJECT ETHERIA

## 1. GOLD CURRENCY & FAUCETS/SINKS
- **Faucets (Creation)**:
  - Monster loot gold drops.
  - NPC merchant resource selling.
  - Completed quests and bounties.
- **Sinks (Destruction)**:
  - Equipment repairs (durability loss during combat/gathering).
  - Artisan crafting station access fees.
  - Marketplace transaction listing fees (5% tax).
  - Consumable purchases from NPC vendors.

---

## 2. MARKETPLACE RULES
- Active listings expire after 7 days if unpurchased.
- Escrow system: When an item is listed, it is held in escrow and removed from the seller's active inventory slots.
- Concurrency protection: Atomic row check on purchase prevents double-buying.
- Audit trail: All transactions write to `economy_transactions` and `currency_ledger`.
