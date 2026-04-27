# Security Notes

## 1) What Firestore rules guarantee
- Anonymous users cannot write anywhere.
- Raw `tables` and `tableItems` are admin-only.
- Cafe isolation is enforced via `cafeUsers/{uid}.cafeId` checks.
- `tableActivityLogs` are append-only (no update/delete).
- `publicTables` is the only public-readable collection and excludes deleted docs.

## 2) Current write responsibilities (transition state)
### Client-writeable today
- `tableItems`: add/edit/soft delete (owner/manager).
- `tables`: name/status updates and soft-delete marker.
- `tableActivityLogs`: append-only events (minimum payload validation + cafe/table relation check).
- `publicTables`: only admin-auth writes that must mirror canonical `tables` fields (token/name/status/itemCount/totalAmount).

### Backend-controlled target (recommended)
- `tables.totalAmount` / `tables.itemCount`
- `publicTables` projection sync
- token rotation invalidation flow
- `payments`, `splitSessions`, `tableSettlements` writes

## 3) Why `publicTables` projection exists
- Public customers must not read raw table docs.
- Projection removes admin-only metadata and exposes token-keyed, safe read shape.

## 4) Backend integrity preparation completed
- `lib/backendIntegrity.ts` callable boundaries are in place:
  - `recomputeTableAggregates`
  - `syncPublicTableProjection`
  - `rotatePublicToken`
- If callable endpoints are unavailable, app falls back to existing client flow to avoid operational breakage.

## 5) Why `cafeUsers` role assignment is backend-only
- Client-side role mutation is blocked in rules.
- Owner/manager grants must be done via trusted backend/admin tooling.

## 6) Rule tightening after backend deploy
When callable integrity functions are live, tighten rules to:
1. Block direct client updates for `tables.totalAmount`, `tables.itemCount`, `tables.publicToken`.
2. Block direct client create/update for `publicTables`.
3. Move `tableActivityLogs` create to backend-only.
4. Keep `payments`, `splitSessions`, `tableSettlements` backend-only.

## 7) Suggested Firestore indexes
- `tables`: `(cafeId, deletedAt, createdAt)`
- `tableItems`: `(cafeId, tableId, deletedAt, createdAt)`
- `tableActivityLogs`: `(cafeId, tableId, createdAt desc)`

## 8) Production checklist before payment integration
1. Complete and deploy callable integrity functions.
2. Run Firebase Emulator rules tests for role/access and new collections.
3. Add audit logging/alerting for token rotation + settlement mutations.
4. Validate staging with real Auth + Firestore before payment provider rollout.
