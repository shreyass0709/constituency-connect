# 01 — Requirements, Roles & Journeys

## 1. Functional requirements (by module)

### FR-1 Auth & Accounts
- Phone-OTP login (primary — citizens may not have email), Google login, role-based redirect after login.
- Cookie sessions with rotation (Better Auth), protected routes by role group, profile + settings (name, photo, language, ward, notification preferences).
- Roles assigned only by Admin/Super Admin; every role change audited.

### FR-2 Complaints (the core)
- Raise concern: multi-step form — category → description (text / **voice note** / photos / videos) → location (map picker + GPS + ward/village) → review → submit. Auto-save as draft at each step.
- Each complaint: human-readable code (`CC-2026-00042`), status, priority, category, ward, village, department, assigned officer, lat/lng, media, estimated completion, full timeline, documents.
- Workflow (each transition = timeline entry + notification):
  `DRAFT → SUBMITTED → ACKNOWLEDGED → ASSIGNED → DEPT_REVIEW → FIELD_VERIFICATION → IN_PROGRESS → COMPLETED → (citizen confirms) → CLOSED`, with `REJECTED` (reason mandatory) and `REOPENED` (citizen disputes completion) as branches. "Categorized" is an instant AI/staff timeline event, not a resting status.
- Track complaint: public status page by code (no login), full timeline for the owner.
- Citizen confirmation: on COMPLETED, citizen gets 7 days to confirm or reopen; auto-close after 7 days with a timeline note.
- Feedback: 1–5 rating + text on close; feeds satisfaction analytics.
- Duplicate handling: detected duplicates link to the original; duplicate reporters become "followers" of the original and receive its updates.

### FR-3 Office / triage (Office Staff, Admin)
- Triage queue of SUBMITTED complaints with AI-suggested category/department/priority — staff accept or override in one click.
- Assign to department + field officer; bulk actions; merge duplicates; reject with reason.
- SLA clock per category (ack + resolve targets); overdue items escalate visually and notify Admin.

### FR-4 Department Officer
- Incoming / pending / resolved / escalated queues scoped to own department; SLA tracking; accept & schedule field verification; department performance analytics.

### FR-5 Field Officer (mobile-first)
- Assigned list with map + navigation link (OSM/Google deep link), status updates, work notes, photo/video proof with **geo-verification** (EXIF/browser GPS must be within 200 m of complaint location — warn, don't block), digital signature pad on completion, offline-lite (PWA queue for updates when signal drops — Phase 6).

### FR-6 Citizen engagement
- Representative profile, book appointment (slots managed by staff), request callback, emergency contacts page, government schemes directory, announcements feed, public polls (one vote per user), community suggestions with upvotes, volunteer registration, downloadable documents, FAQ.

### FR-7 Public website (no login)
- Home, about/vision/achievements, **Action Dashboard** (live counters: citizens assisted, roads improved, water projects, pensions, scholarships, trees planted, women benefited, farmers helped, health camps — computed nightly + manual entries), **Transformation Map** (complaint pins by status, completed projects, before/after images, ward boundaries, heatmap layer), impact stories, announcements, schemes, gallery, media, testimonials, FAQ, contact. Public complaint pins are location-jittered ~50 m and never show citizen identity.

### FR-8 AI (assistive layer — see 02-architecture §5)
Categorization, priority detection, suggested department, sentiment, duplicate detection, suggested officer response, translation, voice→text, FAQ chatbot, monthly summary, ward analysis, predictive hotspots, impact-story draft generator.

### FR-9 Notifications
In-app (always) + push (FCM) + email (Resend); SMS and WhatsApp behind the same `notify()` interface, enabled when providers are contracted. Per-user channel preferences. Events: every status change, assignment, appointment updates, announcements (opt-in), SLA escalations.

### FR-10 Analytics & reports
- Admin real-time dashboard: today's complaints, pending, resolved, resolution rate, avg first-response time, avg resolution time, department/officer performance, ward analytics, complaint heatmap, satisfaction score, recent complaints, global search + filters.
- Exports: CSV (Excel-compatible) + print-optimized PDF views for ward / department / monthly / yearly / officer reports. AI monthly narrative report.

### FR-11 Admin & Super Admin
- Manage users/roles, departments, wards/villages, SLA policies, categories' department mapping, public-site content (announcements, schemes, stories, gallery, testimonials, FAQ, documents, action stats), audit log viewer, feature flags for phased channels (SMS/WhatsApp/chat).

## 2. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | LCP < 2.5 s on mid-range Android over 4G; public pages static/ISR; admin tables paginated (≤50 rows/page); images via Cloudinary transforms + `next/image` |
| Scale target | 1 constituency ≈ 200k–2M citizens; ~500–2,000 complaints/month; design queries for 100k+ complaint rows |
| Availability | Vercel + Neon managed HA; graceful degradation when AI/Redis/FCM are down (core complaint flow never depends on them) |
| Accessibility | WCAG 2.1 AA, full keyboard nav, visible focus, semantic landmarks, `prefers-reduced-motion` respected |
| i18n | English + one regional language at launch (next-intl, all strings externalized); AI translation for complaint content |
| Security | See 02-architecture §8: RBAC, rate limiting, audit log, input validation, signed uploads, PII minimization |
| SEO | Public site: metadata API, OG images, sitemap, JSON-LD for representative profile |
| Privacy | Citizen identity never on public surfaces; phone numbers masked outside Admin/staff; complaints can be marked private (excluded from public map) |
| Compatibility | Evergreen browsers; field-officer UI tested at 360 px width; PWA installable |

## 3. Roles & RBAC matrix

Seven **permission roles**. MLA / MP / Councillor are one permission role (`REPRESENTATIVE`) with a `type` field — identical permissions, different label. RBAC = role → permission list checked in `actionClient` middleware and route-group layouts.

| Permission | Citizen | Office Staff | Dept Officer | Field Officer | Representative | Admin | Super Admin |
|---|---|---|---|---|---|---|---|
| Raise/track own complaints, feedback | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Engagement (polls, suggestions, appointments…) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View all complaints | — | ✅ | dept only | assigned only | ✅ (read) | ✅ | ✅ |
| Triage / categorize / assign / merge / reject | — | ✅ | — | — | — | ✅ | ✅ |
| Update status: dept review, scheduling | — | — | ✅ | — | — | ✅ | ✅ |
| Field updates, proof upload, signature | — | — | — | ✅ | — | ✅ | ✅ |
| Analytics dashboards | — | ✅ | dept only | — | ✅ | ✅ | ✅ |
| Exports & reports | — | ✅ | dept only | — | ✅ | ✅ | ✅ |
| Publish public content | — | ✅ | — | — | ✅ | ✅ | ✅ |
| Manage users & roles | — | — | — | — | — | ✅ | ✅ |
| Manage wards, departments, SLA, settings | — | — | — | — | — | ✅ | ✅ |
| Audit logs, feature flags, destructive ops | — | — | — | — | — | — | ✅ |

## 4. User journeys

### J1 Citizen — pothole
Lands on public site (WhatsApp-shared link) → sees Action Dashboard credibility → "Raise a Concern" → OTP login (20 s) → 3-step form: photo + voice note, map pin auto-set from GPS, AI pre-fills category "Road" → submits → instant screen + push: *"Received. Your code is CC-2026-00187"* → next day push: *"Assigned to Roads Dept — est. 5 days"* → field officer's before/after photos appear in the timeline → *"Marked completed — confirm?"* → citizen confirms, rates 5★ → complaint becomes a pin on the public Transformation Map with before/after.

### J2 Office Staff — morning triage
Login → triage queue (12 new) → AI has pre-tagged all; accepts 10, overrides 2 → merges one duplicate (reporter auto-follows original) → bulk-assigns 6 road complaints to Roads + field officer → SLA board shows 2 near-breach items → escalates one, adds note. Under 15 minutes.

### J3 Field Officer — on site
Opens PWA on phone → today's list sorted by distance → taps navigation → arrives, taps "Start work" → uploads 2 photos (GPS auto-verified ✓) + note → later marks COMPLETED with after-photo + signature → citizen notified automatically. Never touches a desktop.

### J4 Representative — Monday review
Dashboard: resolution rate 87% (↑3), avg resolution 4.2 days, Ward 7 hotspot flagged (drainage, pre-monsoon) → opens AI monthly summary → shares two AI-drafted impact stories to the public site after review → checks satisfaction trend before a council meeting.
