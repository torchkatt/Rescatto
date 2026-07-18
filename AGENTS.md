## graphify

This project has a graphify knowledge graph at `graphify-out/`.

Rules:
- Before answering architecture or codebase questions, read `graphify-out/GRAPH_REPORT.md`
- After modifying code files, run `graphify . --backend deepseek` to keep the graph current (requires DEEPSEEK_API_KEY)

## Context Navigation

1. `AI_CONTEXT.md` — full architecture guide
2. `graphify-out/GRAPH_REPORT.md` — module map
3. `.ai-context/memory.json` — session history and ADRs

## Architecture Overview

**Rescatto** is a general-purpose Colombian marketplace:

| Component | Tech |
|-----------|------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| Backend | Firebase (Firestore, Auth, Functions Gen2, Messaging, Storage) |
| Payments | Wompi (widget + webhook) |
| AI Chat | DeepSeek v4 Flash/Pro (21 tools, 5 security layers) |
| Subscription | Hybrid: Free 10% / Seller Pass 5% (dynamic from Firestore) |
| Tests | Vitest (883 tests) |

## Key Data Collections

- `sellers` — vendor profiles with `commissionRate` and `subscription`
- `listings` — products/services/digital with dynamic categories
- `transactions` — purchases with `sellerEarnings` and `commission`
- `bookings` — service appointments
- `categories` — hierarchical tree (4 roots, 19 subcategories)
- `subscription_plans` — dynamic plans (Free/Pass Monthly/Pass Annual)

## Cloud Functions

| Function | File | Description |
|----------|------|-------------|
| `createTransaction` | `marketplace.js` | Creates PENDING transaction with seller's commissionRate |
| `createBooking` | `marketplace.js` | Creates service booking |
| `cancelTransaction` | `marketplace.js` | Cancels PENDING transaction |
| `seedCategories` | `marketplace.js` | Seeds default categories |
| `createSellerSubscription` | `seller-pass.js` | Upgrades seller subscription plan |
| `handleWompiSellerSubscription` | `seller-pass.js` | Wompi webhook for subscription payment |

## Development Rules

1. **NO hardcoded data** — everything from Firestore (plans, pricing, features)
2. **Use `planService`** for subscription plan reads (not direct Firestore)
3. **Commission is dynamic** — read from `seller.commissionRate` (default 0.10)
4. **Firestore rules** — `create: if false` on transactions/bookings (only via CF)
5. **Admin tables** — use `useAdminTable` + `DataTable` (no manual pagination)
6. **Tests** — run `npm run test` and `npx tsc --noEmit` before finalizing
7. **Security** — all CFs must have `context.auth` check + input validation
8. **Plans** — stored in `subscription_plans` collection, editable via Firebase Console
