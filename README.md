# Cafe Bill Management MVP

A production-minded MVP for QR-ready cafe table bill management built with **Next.js App Router + TypeScript + Firebase + Tailwind CSS**.

## MVP Scope

Two separate interfaces in one app:

- **Customer interface (public):** `/t/[tableId]`
- **Admin interface (protected):** `/admin`

This MVP supports:

- Table creation, rename, delete
- Table status updates (active/occupied)
- Admin table detail management
- Add/edit/remove bill items
- Live total and item count recalculation
- Realtime updates via Firestore listeners
- Public table bill page for QR link readiness

## Environment Variables

Create `.env.local` and set:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

If these are missing, app runs in **mock fallback mode** using localStorage:

- Admin login: `demo@cafe.com` / `admin123`
- Demo route: `/t/demo-table-1`

## Firebase Setup

1. Create a Firebase project.
2. Enable **Authentication > Email/Password**.
3. Enable **Firestore Database** (Native mode).
4. Add a web app and copy config into `.env.local`.
5. (Recommended) Add Firestore security rules that allow public read for specific table docs and admin writes via authenticated role checks.

## Local Development

```bash
npm install
npm run dev
```

Open:

- `http://localhost:3000/admin/login`
- `http://localhost:3000/admin`
- `http://localhost:3000/t/<tableId>`

## Route Structure

- `/` – landing page with quick links
- `/admin/login` – admin sign-in
- `/admin` – dashboard for all tables
- `/admin/tables/[tableId]` – per-table bill management
- `/t/[tableId]` – public customer bill page

## Firestore Data Model (MVP)

Collections used:

- `cafes` (reserved for one-cafe-first extension)
- `tables`
- `tableItems`
- `users`

### `tables` fields

- `name`
- `code`
- `status` (`active | occupied`)
- `totalAmount`
- `itemCount`
- `createdAt`
- `updatedAt`

### `tableItems` fields

- `tableId`
- `name`
- `quantity`
- `unitPrice`
- `totalPrice`
- `createdAt`
- `updatedAt`

### `users` fields

- `uid`
- `email`
- `role` (`admin`)

## MVP Limitations

Intentionally not included yet:

- Payment integration
- POS integration
- Menu browsing / customer ordering
- Multi-cafe tenant isolation
- QR image generation
