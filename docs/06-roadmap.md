# 06 — Roadmap, Milestones, Future Enhancements

Ship order is chosen so the platform is *usable end-to-end after Phase 1* and every
later phase adds a layer without reworking earlier ones. Each phase ends with a
milestone gate: **build + typecheck pass, the listed flows work in the running app, and
non-trivial logic has a runnable check.** Do not start the next phase before the gate.

## Phase 0 — Foundation
Scaffold Next 16 + TS strict + Tailwind 4 + shadcn; Prisma schema (all of doc 03) +
first migration + seed (super admin, departments, wards, SLA policies, categories,
sample data); Better Auth (phone OTP w/ console SMS + Google) + onboarding + RBAC
(`permissions.ts`, `requireUser`, `actionClient` with audit); role route groups +
AppShell + theme + toasts + command palette shell; `lib/env.ts`; CI (lint, typecheck,
vitest).
**Gate M0:** all roles can log in and land on their (empty) dashboards; illegal route
access redirects; audit rows appear.

## Phase 1 — Complaint core (the product's heart)
Raise wizard (drafts, media via signed uploads, voice note attach, location picker,
ward auto-resolve); code generation; workflow engine (`workflow.ts` transition map +
one vitest suite — this is the highest-value test in the repo); triage (acknowledge,
categorize, assign, bulk, reject, merge); complaint detail + timeline (citizen + staff
views); my-complaints; public track-by-code; citizen confirm/reopen/feedback; SLA
`dueAt` + nightly sweep + auto-close cron; in-app notifications (bell, polling).
**Gate M1 (MVP):** J1 + J2 journeys (doc 01 §4) run end-to-end with two browsers;
workflow tests green; timeline shows every step.

## Phase 2 — Officer flows + notification channels
Department dashboard (queues, SLA tracking, dept analytics); field officer PWA
(assigned list, navigation links, proof capture with geo-verification, work notes,
complete + signature pad); escalations; FCM push + Resend email through `notify()`
(templates for all Phase 1 events); notification preferences.
**Gate M2:** J3 journey on a real phone; push + email received for a status change;
dept officer cannot touch another department's complaint (test).

## Phase 3 — AI layer
`lib/ai` intake pipeline (categorize/priority/department/sentiment/language in one
call) wired into submit; unclassified fallback tab; duplicate detection (SQL candidates
+ AI confirm) feeding the merge tool; voice→text transcription in the wizard; suggested
officer response; translation on demand; FAQ chatbot (streaming, grounded, rate-limited).
**Gate M3:** submit → correct auto-tagging visible in triage with confidence; kill the
AI key → complaint flow still works and lands in Unclassified (test this literally).

## Phase 4 — Public website & transparency
Public pages (home, about/vision/achievements, announcements, schemes, gallery, media,
testimonials, FAQ, contact) with ISR + SEO (metadata, OG, sitemap, JSON-LD);
Action Dashboard (ActionStat cron + manual entries, count-up animation); Transformation
Map (jittered pins, projects, before/after slider, ward boundaries, heat layer); impact
stories (+ AI draft from closed complaints, human publish gate); representative profile
editor.
**Gate M4:** Lighthouse ≥ 90 perf/SEO/a11y on home; a closed complaint becomes a
published before/after story appearing on map + stories page; no PII on any public surface.

## Phase 5 — Engagement + reports
Appointments (citizen booking + staff calendar), callback requests, polls, community
suggestions + upvotes, volunteer registration, documents, emergency contacts; live chat
(threads, staff inbox, 5 s polling); admin reports (ward/dept/monthly/yearly/officer) +
CSV export + print-PDF views; AI monthly summary + weekly hotspot cron feeding
Representative dashboard.
**Gate M5:** J4 journey; every engagement feature usable by a citizen and manageable by
staff; exports open correctly in Excel.

## Phase 6 — Hardening & launch
Rate limits on all declared surfaces; Sentry; full a11y pass (keyboard-only walk of
every journey); i18n second language complete; PWA offline-lite for field officers
(queued mutations replay on reconnect); load sanity (100k seeded complaints — admin
tables + map stay <1 s); security self-review (doc 02 §8 as checklist); real SMS
provider behind the flag; backups/PITR confirmed on Neon; `.env.example` + README
runbook.
**Gate M6 (launch):** all six gates re-verified on production infra with production env.

## Milestone summary

| # | Deliverable | You can demo |
|---|---|---|
| M0 | Skeleton + auth + RBAC | Login as any role |
| M1 | **MVP** complaint lifecycle | Citizen→office→resolution→feedback |
| M2 | Officers + push/email | Field officer closes with geo proof |
| M3 | AI assistance | Auto-triage + chatbot |
| M4 | Public transparency site | Action dashboard + transformation map |
| M5 | Engagement + reports | Appointments, polls, monthly AI report |
| M6 | Production launch | Hardened, monitored, localized |

## Deliberately cut from v1 (and when to add)

| Cut | Add when |
|---|---|
| WhatsApp notifications/bot | Business API + templates approved (Phase 3+ flag exists; `notify()` interface already takes it) |
| SMS at scale | DLT registration done — swap console provider for MSG91 behind the same interface |
| Websocket realtime | Users complain about the 30 s poll — add SSE route or Pusher |
| pgvector semantic duplicate search | Geo+category heuristic misses real duplicates in practice |
| PostGIS | Ward count or polygon complexity makes JS point-in-polygon slow |
| Full offline-first field app | Officers actually work in no-signal zones beyond the queue's ability |
| Multi-tenancy (many representatives, one deploy) | Second paying constituency — add `tenantId` scoping then, not speculatively |
| Native mobile apps | PWA install friction proves real; Better Auth bearer plugin + `/api/v1` are ready |
| Queue infra (Inngest/QStash) | Notification fan-out exceeds serverless limits |
| tsvector full-text search | `ILIKE` visibly slow on real data |

## Future enhancements (beyond the cuts)
Citizen reputation/civic points, open-data portal (anonymized CSV/JSON dumps),
grievance-redressal integrations (state portals/CPGRAMS export), IVR voice complaint
line, kiosk mode for office lobbies, budget-tracking module per project, yearly
printed "report card" generator, regional-language voice chatbot.
