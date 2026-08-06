# Constituency Connect

Citizens raise civic issues, the representative's office triages them, departments and
field officers resolve them, and a public dashboard shows what actually got fixed.
**Citizen Voice + Representative Action + Visible Outcome.**

One deployment serves one representative. The design docs are the source of truth:
[requirements](docs/01-requirements.md) · [architecture](docs/02-architecture.md) ·
[database](docs/03-database.md) · [API](docs/04-api.md) · [UI](docs/05-ui.md) ·
[roadmap](docs/06-roadmap.md). `CLAUDE.md` is the briefing for anyone (or anything)
writing code here.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind 4 + shadcn/ui ·
PostgreSQL (Neon) + Prisma 7 · Better Auth (phone OTP) · Leaflet + OpenStreetMap ·
Gemini Flash · Cloudinary · Resend · Firebase Cloud Messaging · Upstash Redis · Sentry ·
next-intl (English + Hindi).

Every external service is optional at boot. Without a key, that feature switches itself
off and the complaint flow keeps working — no AI key means complaints land in the
Unclassified triage queue, no Resend key means email is skipped, and so on.

## Local setup

```bash
npm install
cp .env.example .env          # fill in DATABASE_URL and BETTER_AUTH_SECRET at minimum
npx prisma migrate dev        # create the schema
npm run db:seed               # super admin, departments, wards, SLA policies, sample data
npm run dev                   # http://localhost:3000
```

OTP codes are printed to the dev server console (`[OTP] +91… → 123456`) — no SMS
provider needed to sign in locally.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (runs typecheck) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest — pure logic, no database needed |
| `npm run smoke` | Walks a complaint draft → closed through every role against the **real** database, asserting the access rules, then deletes it |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:seed` | Reseed |
| `npm run db:studio` | Prisma Studio |

Before shipping anything: `npm run lint && npm run typecheck && npm test && npm run build`,
then `npm run smoke` against a database with the seed in it.

## Deploying (Vercel)

1. Import the repo. The build command is the default `npm run build`; `postinstall` runs
   `prisma generate`.
2. Set every variable in `.env.example` that the deployment needs. For production that
   means at least `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL`,
   `CRON_SECRET`, and the Upstash pair — without Upstash the rate limits are
   per-instance, which on serverless means barely limited at all.
3. Point a Neon branch at each Vercel environment (preview branches pair with preview
   deployments).
4. `vercel.json` already declares the three cron jobs. They authenticate with
   `CRON_SECRET`; a request without it is rejected.

| Cron | Schedule (UTC) | Does |
|---|---|---|
| `/api/v1/cron/nightly` | 18:30 | SLA sweep, auto-close after the 7-day confirm window, action-stat recompute |
| `/api/v1/cron/weekly` | Mon 02:00 | Ward hotspot detection |
| `/api/v1/cron/monthly` | 1st, 03:00 | AI monthly summary for the representative dashboard |

### Going-live checklist

- [ ] Upstash Redis provisioned and both `UPSTASH_*` vars set
- [ ] `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` set, and a test error seen in Sentry
- [ ] `SMS_PROVIDER=msg91` with DLT-approved templates (until then OTP only reaches the
      server console, which is fine for a pilot and useless for the public)
- [ ] Neon: point-in-time restore confirmed on the production branch — restore to a
      scratch branch and check a row survived. PITR that has never been exercised is not
      a backup.
- [ ] Custom domain + HTTPS (HSTS is sent preloadable, so the domain is hard to walk back)
- [ ] Seed the real representative profile, wards, villages, departments and SLA
      policies — the sample data is for development only

## How it fits together

- **Mutations** are server actions wrapped in `defineAction` (`src/lib/safe-action.ts`):
  Zod → session → RBAC → rate limit → handler → audit log. There is no other way to
  write to the database from the UI.
- **Every complaint change writes a `TimelineEntry`.** The timeline is the citizen's
  trust surface and is append-only.
- **AI is assistive, never blocking.** Each AI call has a deterministic fallback, and
  `AI_ENABLED=false` is a kill switch the smoke test exercises on purpose.
- **Feature-first layout**: `src/features/<domain>/` holds that domain's components,
  actions, queries and schemas together. Features do not reach into each other.
- **Localisation** lives in `src/i18n/`. The locale comes from a cookie written by
  onboarding and by the language switcher; a vitest suite fails if the two catalogues
  drift apart.

## Security

`docs/02-architecture.md` §8 is the threat model and doubles as the review checklist.
The short version: Prisma parameterised queries only, RBAC on every mutation and every
protected layout, object-level scoping (a department officer cannot open another
department's complaint), signed Cloudinary uploads, jittered coordinates and no names on
any public surface, rate limits on OTP, auth, complaint submission, chat and the public
API, and a CSP plus HSTS set in `next.config.ts`.

Found a security problem? Report it privately rather than in a public issue.
