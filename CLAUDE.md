# Constituency Connect

Citizen ↔ elected-representative platform: citizens raise civic issues, the
representative's office triages, departments and field officers resolve them, and a
public dashboard shows visible outcomes. Philosophy: **Citizen Voice + Representative
Action + Visible Outcome** — warm and citizen-centric, not a ticketing tool.

This file is the briefing for the implementing agent. **Read the docs before coding.**

## Doc map (read in this order)

| Doc | Contents |
|---|---|
| `docs/01-requirements.md` | Functional + non-functional requirements, roles, RBAC matrix, user journeys |
| `docs/02-architecture.md` | System architecture, folder structure, state mgmt, auth flow, AI, notifications, deployment, security |
| `docs/03-database.md` | Full Prisma schema, ER diagram, indexes |
| `docs/04-api.md` | Server actions + REST conventions, endpoint catalog, error/pagination envelopes |
| `docs/05-ui.md` | Design system, wireframes, component hierarchy |
| `docs/06-roadmap.md` | Phased roadmap, milestones with acceptance criteria, future enhancements |

## Locked stack decisions (do not relitigate)

| Choice | Decision | Why |
|---|---|---|
| Framework | **Next.js 16 App Router + React 19 + TypeScript strict** | Latest stable; this machine's other projects already run Next 16. **Check `node_modules/next/dist/docs/` before writing Next code — Next 16 differs from training data** (e.g. Middleware→Proxy rename). |
| Styling | Tailwind 4 + shadcn/ui + Framer Motion | As specced |
| DB | PostgreSQL (Neon) + Prisma 7 (`PrismaPg` driver adapter) | Neon branches pair with Vercel previews |
| Auth | **Better Auth** (not Clerk) | Free at citizen scale, self-hosted data (govt context), phone-OTP plugin + Google, cookie sessions with rotation |
| Maps | **Leaflet + OpenStreetMap** (not Google Maps) | No per-load billing at public-site traffic; user already knows Leaflet |
| AI | **Gemini Flash** (not OpenAI) | Cheapest structured output, strong Indic-language + audio support |
| Charts | Recharts | As specced |
| Files | Cloudinary signed uploads | As specced |
| Email | Resend + react-email | As specced |
| Push | Firebase Cloud Messaging (web push) | As specced |
| SMS OTP | Pluggable provider interface — console logger in dev, MSG91 in prod | DLT registration is a business task, not a code task |
| Rate limiting | Upstash Redis (`@upstash/ratelimit`) | Serverless-safe |
| Realtime | **None at launch.** In-app notification polling (30s) + `router.refresh()` | Vercel serverless has no websockets; SSE/Pusher is the upgrade path, listed in future enhancements |
| Tenancy | **Single-tenant**: one deployment = one representative | Multi-tenancy is the #1 over-engineering trap here; `Representative` is a one-row table. Multi-tenant is a future enhancement. |

## Implementation rules

1. Follow `docs/06-roadmap.md` phase order. Never start a phase before the previous one's acceptance criteria pass.
2. Feature-first structure (`src/features/<domain>/`) per `docs/02-architecture.md`. All mutations are server actions wrapped in `actionClient` (Zod validate → auth → RBAC → audit). No ad-hoc `fetch` from components.
3. Server Components by default; `"use client"` only for interactivity.
4. AI is **assistive, never blocking**: every AI call has a deterministic fallback (unclassified queue, manual triage).
5. Every complaint mutation writes a `TimelineEntry`. No exceptions.
6. Zod at every trust boundary. Strict TS, no `any`.
7. After schema edits: `npx prisma migrate dev`, commit the migration.
8. Per vertical slice: build passes, typecheck passes, one runnable check (test or self-check) for non-trivial logic.

## Commands (once scaffolded)

```bash
npm run dev            # next dev
npm run build          # next build (includes typecheck)
npx prisma migrate dev # apply schema changes locally
npx prisma studio      # inspect data
npm test               # vitest
```
