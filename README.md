# Cafe Bill Management MVP (Production-Ready Scaffold)

Next.js App Router + TypeScript + Tailwind + Firebase-oriented architecture for QR-based cafe table bill tracking.

## What exists now
- Admin area: `/admin`, `/admin/login`, `/admin/tables/[tableId]`
- Public customer table bill: `/t/[publicToken]`
- Token-based public access (no tableId exposure)
- Soft delete for tables/items (`deletedAt`)
- Table activity logs
- Role model scaffold (`owner` | `manager`)
- Single-source total calculation utility
- Firebase-ready + local demo fallback

## Data model (scaffolded)
Collections:
- `cafes`
- `cafeUsers`
- `tables`
- `tableItems`
- `tableActivityLogs`
- `payments` (scaffold only)

## Environment setup
Use one of these env templates:
- `.env.example` (dev)
- `.env.staging.example`
- `.env.production.example`

Copy one into `.env.local` when running locally.

## Demo mode (no Firebase required)
If Firebase env variables are missing, app uses localStorage mock mode.

Demo logins:
- `owner@cafe.com` / `admin123`
- `manager@cafe.com` / `admin123`

## Firebase completion steps (after this task)
1. Create Firestore collections listed above.
2. Add `cafeUsers/{uid}` docs with `{cafeId, role}`.
3. Import and adapt `firestore.rules`.
4. Configure Auth (email/password).
5. Validate rules in Emulator Suite.
6. Move total recalculation to Cloud Functions for strict server-side trust.

## Security and production notes
See `SECURITY_NOTES.md` for assumptions and gaps requiring final Firebase-side verification.

## MVP limitations (intentional)
- No payment processing yet
- No POS integration
- No ordering/menu flow
- No heavy multi-tenant orchestration beyond cafe-scoped structure prep
