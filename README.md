# Cafe Bill Management MVP (Security-Hardened)

Next.js + TypeScript + Tailwind + Firebase-first architecture for QR table bill management.

## Current architecture
- Admin routes: `/admin`, `/admin/login`, `/admin/tables/[tableId]`
- Public route: `/t/[publicToken]`
- Public reads now use `publicTables/{publicToken}` projection (not raw `tables` docs)

## Collections
- `cafes`
- `cafeUsers`
- `tables` (admin-only)
- `tableItems` (admin-only)
- `tableActivityLogs` (admin-only read, append-only)
- `publicTables` (public read projection)
- `payments` (locked scaffold)

## Security highlights
- No anonymous writes anywhere.
- Raw table docs are not publicly readable.
- Role and cafe isolation enforced via `cafeUsers`.
- Soft delete respected in active selectors and public projection.
- Owner-only token rotation support.

## Totals and projection sync
Client service layer centralizes:
- `recomputeTableAggregates(tableId, cafeId)`
- `syncPublicTableProjection(tableId, cafeId)`

This is the migration boundary for Cloud Functions.

## Demo mode (no Firebase required)
Missing Firebase env vars triggers localStorage mock mode.
Demo login:
- `owner@cafe.com` / `admin123`
- `manager@cafe.com` / `admin123`

## Environment templates
- `.env.example`
- `.env.staging.example`
- `.env.production.example`

## Next security steps
1. Import `firestore.rules` into Firebase.
2. Run Emulator Suite tests for owner/manager/anonymous scenarios.
3. Move aggregate + projection sync into Cloud Functions (`functions/README.md`).
4. Keep `cafeUsers` role assignment backend/admin-only.

See also: `SECURITY_NOTES.md`.
