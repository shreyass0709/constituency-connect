# 04 — API Design

## 1. Split: Server Actions vs REST route handlers

- **Server Actions** (`features/*/actions.ts`) — every authenticated mutation from our own UI. Typed end-to-end, no REST ceremony, validated by the shared Zod schema, wrapped in `actionClient`.
- **Route Handlers** (`app/api/v1/*`) — only where a URL is genuinely needed: Better Auth, public JSON (map/stats/track), file-download exports, chat streaming, webhooks, cron, FCM token registration. RESTful, versioned under `/api/v1`.

## 2. Conventions (both surfaces)

- **Validation:** Zod schema from `features/*/schemas.ts`; parse again on the server always.
- **Response envelope (REST):**
  - Success: `{ "data": ..., "meta": { pagination? } }`
  - Error: `{ "error": { "code": "FORBIDDEN" | "NOT_FOUND" | "VALIDATION" | "RATE_LIMITED" | "CONFLICT" | "INTERNAL", "message": string, "details"?: ZodIssue[] } }` with matching HTTP status (403/404/400/429/409/500).
- **Action result:** `{ ok: true, data } | { ok: false, error }` — same error codes; UI maps them to toasts/field errors.
- **Pagination:** admin tables `?page=1&limit=25` (`meta: { page, limit, total, totalPages }`); public feeds cursor-based `?cursor=<id>&limit=20` (`meta: { nextCursor }`).
- **Filtering/sorting/search:** whitelisted params only, e.g. `?status=IN_PROGRESS&category=ROAD&wardId=…&priority=HIGH&from=2026-01-01&to=…&q=pothole&sort=createdAt:desc`. `q` hits `code`, `title`, `description` (Postgres `ILIKE` now; `tsvector` when data demands).
- **Idempotency:** status transitions re-check current status inside the transaction; repeating a transition returns `CONFLICT`, not a duplicate timeline entry.

## 3. Server Action catalog (by feature)

### complaints
| Action | Roles | Notes |
|---|---|---|
| `saveDraft(input)` | citizen+ | Upsert DRAFT row per step of the raise-form |
| `submitComplaint(draftId)` | citizen+ | Tx: status→SUBMITTED, code gen, ward resolve, timeline; `after()`: AI intake, dup check, notify |
| `confirmResolution(id)` / `reopenComplaint(id, reason)` | owner | 7-day window after COMPLETED |
| `submitFeedback(id, rating, text)` | owner | Only on CLOSED |
| `followComplaint(id)` | citizen+ | Also auto-applied to duplicate reporters |

### triage (Office Staff, Admin)
| Action | Notes |
|---|---|
| `acknowledgeComplaint(id)` | SUBMITTED→ACKNOWLEDGED |
| `categorizeComplaint(id, {category, departmentId, priority})` | Accept/override AI suggestion; timeline AI_ACTION vs COMMENT records which |
| `assignComplaint(id, {departmentId, officerId, estimatedCompletion})` | →ASSIGNED; notifies officer + citizen |
| `bulkAssign(ids, …)` | Same, batched in one tx |
| `mergeDuplicate(id, originalId)` | →REJECTED w/ MERGE timeline; reporter follows original |
| `rejectComplaint(id, reason)` | Reason mandatory |
| `escalateComplaint(id, note)` | ESCALATION timeline + Admin notify |

### officer (Department / Field)
| Action | Roles | Notes |
|---|---|---|
| `startReview(id)` / `scheduleVerification(id, date)` | dept | Scoped: complaint.departmentId must match user |
| `startWork(id)` / `updateProgress(id, note, mediaIds)` | field | Scoped to assignee |
| `completeWork(id, {note, mediaIds, signatureMediaId})` | field | →COMPLETED; geo-verify proof media (≤200 m warn) |

### engagement
`bookAppointment`, `cancelAppointment`, `updateAppointmentStatus` (staff), `requestCallback`, `resolveCallback` (staff), `votePoll`, `createSuggestion`, `voteSuggestion`, `registerVolunteer`, `updateVolunteerStatus` (staff).

### admin / content
`upsertUserRole` (SUPER_ADMIN for role grants; audited), `upsertDepartment`, `upsertWard`, `upsertVillage`, `upsertSlaPolicy`, `upsertAnnouncement`, `publishAnnouncement`, `upsertScheme`, `upsertProject`, `upsertImpactStory` (+ `generateStoryDraft` AI), `publishImpactStory`, `upsertActionStat`, `upsertFaq`, `upsertDocumentFile`, `approveTestimonial`, `upsertGalleryItem`, `updateRepresentativeProfile`.

### account
`updateProfile`, `updateNotificationPrefs`, `registerFcmToken` (also REST for the SW), `logoutAllDevices`.

## 4. REST endpoint catalog

| Method + path | Auth | Purpose |
|---|---|---|
| `ALL /api/auth/[...all]` | — | Better Auth (OTP send/verify, Google, session) |
| `GET /api/v1/public/stats` | none | Action Dashboard counters (ISR 5 min) |
| `GET /api/v1/public/map?bbox=&status=&category=` | none | Jittered public complaint pins + projects + ward GeoJSON |
| `GET /api/v1/public/track/:code` | none | Sanitized status + public timeline (no PII); rate-limited |
| `GET /api/v1/public/announcements` `…/schemes` `…/stories` | none | Cursor-paginated public feeds |
| `POST /api/v1/uploads/sign` | session | Cloudinary signed params; enforces folder/format/size by kind |
| `GET /api/v1/notifications?cursor=` | session | Bell list; `PATCH /api/v1/notifications/:id/read`, `POST …/read-all` |
| `POST /api/v1/notifications/token` | session | FCM token registration (from service worker) |
| `POST /api/v1/chat` | session | Streaming FAQ chatbot (rate-limited 10/min) |
| `GET /api/v1/reports/export?type=ward\|department\|monthly\|yearly\|officer&format=csv&…filters` | staff+ | CSV download; PDF = print-optimized page at `/office/reports/print?…` |
| `GET /api/v1/complaints?…filters` | staff+ | JSON of the admin table (powers export + future mobile) |
| `POST /api/v1/webhooks/whatsapp` | signature | Phase 3+, WhatsApp Cloud API inbound |
| `GET /api/v1/cron/(nightly\|weekly\|monthly)` | `CRON_SECRET` header | Stats recompute, auto-close, SLA sweep; hotspots; AI monthly report |
| `GET /api/v1/health` | none | Uptime probe: DB ping + version |

## 5. actionClient pipeline (one wrapper, every mutation)

```
input → Zod parse → session (requireUser) → RBAC permission check
      → object-level scope check (own/dept/assigned) → rate limit (where declared)
      → handler (Prisma tx) → AuditLog write → typed result
```

Errors thrown as `ActionError(code, message)`; anything else becomes `INTERNAL` with a
logged stack — internal details never reach the client.
