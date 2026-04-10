# Functions Scaffold (Future Server-Authoritative Security)

This folder is a boundary for moving security-critical logic out of trusted clients.

Planned handlers:
- `recomputeTableAggregates(tableId, cafeId)`
- `syncPublicTableProjection(tableId, cafeId)`
- `rotatePublicToken(tableId, actorUid)` (owner-only)

Current app already calls matching service functions from `lib/firestore.ts`.
Migration path:
1. Implement Cloud Functions handlers.
2. Replace client direct aggregate/projection writes with callable functions.
3. Keep Firestore rules strict and block direct aggregate mutation from client.
