# Security Notes (Starter)

## Intent
- Public users should only access table bills through unpredictable `publicToken` links.
- Anonymous writes are disallowed.
- Admin users are cafe-scoped via `cafeUsers` mapping and role checks (`owner` / `manager`).
- Soft-deleted tables/items are excluded by client queries.

## Important limitations before production
1. Firestore rules cannot safely validate token-only filtered queries without a public projection strategy.
2. `totalAmount` and `itemCount` are recalculated in controlled client flow now; move to Cloud Functions for hard enforcement.
3. Role assignment in Auth custom claims/cafeUsers docs must be finalized in Firebase Console/backend.
4. Rules in `firestore.rules` are starter scaffolding; test with Firebase Emulator Suite before go-live.
