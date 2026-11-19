# SECURE TWO-PHASE TRADING — PROJECT ETHERIA

## 1. PROTOCOL STATE MACHINE
```
[PENDING]  ──(Target accepts)──> [ACTIVE]
    │                               │ (Offer modified: resets confirmation)
    ├──(Target declines)            ▼
    ▼                          [CONFIRMING] (Both have clicked confirm)
[CANCELLED]                         │
                                    ▼
                              [COMPLETED] (Server transfers assets atomically)
```

## 2. TWO-PHASE CONFIRMATION RULES
1. **Phase 1 (Staging)**:
   - Players place items and gold into their respective offer slots.
   - Live updates are broadcast to the counterpart socket.
2. **Phase 2 (Mutual Lock & Execution)**:
   - When a player confirms, their offer locks.
   - If either player modifies offered items or gold while in `CONFIRMING`, **both player confirmations are reset to false** and the state returns to `ACTIVE`.
   - Once both players confirm the identical offers:
     - The server validates both players are online and within 5 tiles.
     - The server validates that both players currently own the offered items and hold sufficient gold.
     - An atomic database transaction swaps ownership of the items and transfers gold balances.
     - Immutable records are appended to `currency_ledger` and `trade_sessions`.
     - Confirmation notifications are broadcast to both clients.
