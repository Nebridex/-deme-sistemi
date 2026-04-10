# Cafe Bill Management MVP (Firebase Integrated)

Next.js + TypeScript + Tailwind + Firebase App/Firestore/Auth integration.

## Routes
- Admin login: `/admin/login`
- Admin dashboard: `/admin`
- Admin table detail: `/admin/tables/[tableId]`
- Public customer bill: `/t/[publicToken]`

## Firebase collections
- `cafes`
- `cafeUsers`
- `tables`
- `tableItems`
- `publicTables`
- `tableActivityLogs`
- `payments` (locked scaffold)

## Required environment (.env.local)
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

If these are missing, the app shows a configuration error and blocks auth/data operations.

## Firebase setup steps
1. Enable **Authentication > Email/Password**.
2. Create Firestore database (Native mode).
3. Add `cafeUsers/{uid}` docs for admins with:
   - `cafeId`
   - `email`
   - `role` = `owner` or `manager`
4. Create `tables`, `tableItems`, `publicTables`, `tableActivityLogs` collections as needed by app usage.
5. Deploy `firestore.rules`.

## Integration notes
- Firebase app initialization is single-instance (`getApps` guard).
- Admin session persistence is Firebase Auth default persistence.
- Admin routes are protected via auth listener + role lookup in `cafeUsers`.
- Realtime updates use `onSnapshot` for dashboard and public bill views.
- Service-layer functions:
  - `recomputeTableAggregates(tableId, cafeId)`
  - `syncPublicTableProjection(tableId, cafeId)`
  - `rotateTableToken(table, actor)`

## Important security boundary
Aggregate integrity is improved by centralizing writes, but full server-authoritative enforcement should still be moved into Cloud Functions/Admin SDK for production-hard guarantees.
