# Security Notes

## 1) What Firestore rules guarantee
- Anonymous users cannot write anywhere.
- Raw `tables` and `tableItems` are admin-only.
- Cafe isolation is enforced via `cafeUsers/{uid}.cafeId` checks.
- `tableActivityLogs` are append-only (no update/delete).
- `publicTables` is the only public-readable collection and excludes deleted docs.

## 2) What Firestore rules cannot guarantee
- Rules cannot enforce response field projection from a document.
- Rules cannot guarantee perfect aggregate integrity (`totalAmount`, `itemCount`) under all concurrent clients.
- Rules cannot replace trusted backend role assignment.

## 3) Why `publicTables` projection exists
- Public customers must not read raw table docs.
- Projection removes admin-only metadata and exposes token-keyed, safe read shape.

## 4) Why totals should move server-authoritative
- Current app recomputes totals in a centralized client service flow.
- Production-grade integrity should move to Cloud Functions/Admin SDK writes.

## 5) Why `cafeUsers` role assignment is backend-only
- Client-side role mutation is blocked in rules.
- Owner/manager grants must be done via trusted backend/admin tooling.

## 6) Production checklist before payments
1. Run Firebase Emulator rules tests for all role/access scenarios.
2. Move aggregate+projection sync to Cloud Functions.
3. Add token rotation audit + monitoring.
4. Validate staged env with real Auth+Firestore before enabling payments.
