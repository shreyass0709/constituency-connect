# Security self-review — Phase 6

**Date:** 2026-08-07
**Method:** `docs/02-architecture.md` §8 walked row by row against the code on `main`.
**Scope:** static review of the repository. No penetration testing, no review of the
deployed environment (Vercel/Neon/Upstash config is on the going-live checklist in the
README, not here).

Each row below states what §8 promises, what the code actually does, and where they
differ. Two gaps were closed during the review; the rest are recorded as accepted risks
or follow-ups.

---

## Summary

| # | Threat | Verdict |
|---|---|---|
| 1 | Injection | ✅ Holds — via an allowlist, not the mechanism §8 describes |
| 2 | XSS | ✅ Holds |
| 3 | CSRF | ⚠️ Holds on framework defaults; depends on `BETTER_AUTH_URL` being right in prod |
| 4 | Broken access control | ✅ Holds |
| 5 | Brute force / abuse | 🔧 One declared surface was unmetered — **fixed in this pass** |
| 6 | Malicious uploads | ⚠️ Folder is signed; **size and MIME are not enforceable server-side** |
| 7 | PII exposure | 🔧 **Real leak found and fixed** — EXIF GPS on public story photos |
| 8 | Tampering / repudiation | ✅ Holds — note audit rows carry full action input |
| 9 | Secrets | ✅ Holds |
| 10 | Transport / headers | ✅ Holds |
| 11 | Session theft | ✅ Holds on framework defaults |

**Fixed in this pass:** #7 (EXIF GPS leak), #5 (unmetered `/api/v1/uploads/sign`).
**Open follow-ups:** none.
**Closed 2026-10-13:** #6 upload size/MIME. The preset route was a dead end — Cloudinary presets silently drop `max_file_size`. Instead `allowed_formats` is now part of the signed parameters (Cloudinary refuses other formats; verified with a GIF), and `attachMedia` reads the real size from the Admin API and deletes oversized assets. If Cloudinary cannot be reached the check falls back to the client-reported size rather than block a complaint.
**Closed 2026-10-13:** #6 attachment URL host allowlist (`attachMedia` rejects any URL outside our cloud); §8 rows 1, 2, 4 and 6 reworded to match the code.

---

## 1. Injection

**§8 says:** *Prisma parameterized queries only; no raw SQL string interpolation.*

**Reality:** there is raw SQL, and two sites interpolate into it. Both are safe, but the
row as written is not an accurate description of the code.

- Tagged-template `$queryRaw` — `features/analytics/queries.ts` (4), `features/complaints/queries.ts:285`, `features/complaints/lib/code.ts:12`, `api/v1/cron/monthly/route.ts:114`. These are parameterized by Prisma. Fine.
- `$queryRawUnsafe` with interpolation — `features/reports/queries.ts:35` and `:151`.

`reports/queries.ts:35` (`aggregateBy`) interpolates a **column name**, which cannot be
bound as a parameter. It is constrained twice: the parameter type is the union
`"wardId" | "departmentId" | "assignedToId"`, and line 33 re-checks membership of
`GROUPABLE` at runtime. No request value can reach it — all three callers pass a literal.

`reports/queries.ts:151` interpolates `unit` and `limit`, both derived from a `switch` on
`ReportType`. All three entry points (`office/reports/page.tsx`, `office/reports/print/page.tsx`,
`api/v1/reports/export/route.ts`) guard with `isReportType()` before calling.

**Verdict:** ✅ No injection path. The runtime allowlist on line 33 is the control that
actually carries this, and it is deliberate and commented.

**Action:** none in code. Reword the §8 row to *"parameterized queries; the two places a
column or keyword must be interpolated are constrained by a runtime allowlist"* so the
doc describes what is there.

---

## 2. XSS

**§8 says:** *React escaping; no `dangerouslySetInnerHTML` except sanitized (rehype-sanitize)
rich text; CSP headers in `next.config`.*

**Reality:** exactly one `dangerouslySetInnerHTML` in the codebase —
`components/shared/json-ld.tsx:14` — and it escapes `<` to `<` before injecting, which
is what prevents a `</script>` breakout from a representative name or story title. That was
the fix in `5a2cda0`.

There is **no rich text and no `rehype-sanitize`** in the project; story bodies and
announcements render as plain text through React. The §8 clause describes a feature that
was never built, which is the safest possible outcome but should not stay in the doc as
though it were a control we operate.

CSP is present in `next.config.ts` and reviewed under row 10.

**Verdict:** ✅ Holds.

**Action:** drop the `rehype-sanitize` clause from §8, or mark it as the requirement that
applies *if* rich text is ever introduced.

---

## 3. CSRF

**§8 says:** *Better Auth origin checks + `sameSite` cookies + Next server-action origin
validation.*

**Reality:** all three are in force, and **none of them is configured in this repository.**
They are framework defaults:

- Better Auth checks the request origin against `trustedOrigins`, which defaults to
  `baseURL` — i.e. whatever `BETTER_AUTH_URL` is set to. `lib/auth/index.ts` sets no
  `trustedOrigins` and no `advanced.defaultCookieAttributes`.
- Better Auth session cookies default to `httpOnly`, `sameSite: "lax"`, and `secure` when
  the base URL is `https`.
- Next.js validates the `Origin` header against `Host` for server actions and rejects
  mismatches. `next.config.ts` sets no `serverActions.allowedOrigins`.

This is fine — the defaults are the correct ones and re-stating them would add config
without adding safety. But it means the entire CSRF posture rests on one environment
variable. If `BETTER_AUTH_URL` is left at `http://localhost:3000` in production, the
origin check protects nothing and the cookie loses `secure`.

**Verdict:** ⚠️ Holds, conditionally.

**Action:** `BETTER_AUTH_URL` is already validated as a URL by `lib/env.ts`, but nothing
checks it is the *right* URL. Treat "`BETTER_AUTH_URL` equals the production origin" as a
launch-checklist line item in the README, next to the custom-domain step.

---

## 4. Broken access control

**§8 says:** *RBAC in `actionClient` on every mutation + `requireUser` in every protected
layout; object-level checks.*

**Reality:** the wrapper is `defineAction` in `lib/safe-action.ts` (the doc's name
`actionClient` is drift, not a second thing). Its order is Zod → `requireUser` →
optional rate limit → handler → `audit`. `requireUser(permission)` throws a redirect for
anonymous and forbidden callers, so a mutation cannot run without both a session and the
declared permission.

Object-level checks are separate from the permission check and live in the handlers —
`canViewComplaint(user, complaint)` in `attachMedia` is the pattern, and the permission
matrix itself has unit coverage in `lib/auth/permissions.test.ts`.

**Verdict:** ✅ Holds.

**Action:** rename `actionClient` → `defineAction` in §8 so the doc points at a symbol
that exists.

---

## 5. Brute force / abuse

**§8 says:** *OTP 3/10 min/phone, login 10/hr/IP, complaint submit 5/day/user,
chat 10/min/user, public API 60/min/IP.*

**Reality:** all five declared limits exist.

| Declared | Where | Verified |
|---|---|---|
| OTP 3 / 10 min / phone | `lib/auth/index.ts:21` | ✅ keyed on the phone number, so many machines hammering one number still hit it |
| Login 10 / hr / IP | `api/auth/[...all]/route.ts:18` | ✅ POST only, keyed per path |
| Complaint submit 5 / day / user | `features/complaints/actions.ts:97` | ✅ via `defineAction`'s `limit` |
| Chat 10 / min / user | `api/v1/chat/route.ts:36` | ✅ falls back to IP when anonymous |
| Public API 60 / min / IP | `api/v1/public/map/route.ts:14`, `(public)/track/page.tsx:35` | ✅ |

Plus one not in §8: chat message send, 20/min/user, `api/v1/chat/threads/route.ts:108`.

**Gap found:** `api/v1/uploads/sign` had **no limit**. Every call returns a signature
authorising a write into our Cloudinary account, and — see row 6 — the signature cannot
cap bytes. An authenticated citizen could mint signatures in a loop and fill the account.

**Fixed in this pass:** 30/min/user on `upload-sign:${user.id}`, same `limitOr429` pattern
as every other route. 30 is far above a complaint wizard attaching a few photos.

Not limited, deliberately: `api/v1/notifications` (the 30 s poll is the design) and
`api/v1/notifications/token`. Cron routes are guarded by `CRON_SECRET` instead.

The limiter itself (`lib/ratelimit.ts`) is Upstash-backed when configured and in-memory
otherwise, and **fails open** — an Upstash outage degrades to per-instance counting rather
than refusing traffic. That is a deliberate availability-over-strictness call, commented at
the top of the file. Note the consequence: with `UPSTASH_*` unset in production, every
serverless instance keeps its own window, so the effective limit is *N instances × the
declared number*.

**Verdict:** 🔧 Was incomplete, now holds.

**Action:** Upstash provisioning is already on the README going-live checklist. Keep it
there — without it the numbers above are per-instance, not global.

---

## 6. Malicious uploads

**§8 says:** *Cloudinary signed uploads only; server-issued signature constrains
folder/format/size (img ≤ 10 MB, video ≤ 100 MB, audio ≤ 20 MB); allowlisted MIME; strip
EXIF on public renders.*

This row overstates what a Cloudinary signature can do. Taking it clause by clause:

**Signed uploads only — ✅ true.** `lib/cloudinary.ts` signs server-side; the API secret
never reaches the browser. `api/v1/uploads/sign` requires a session.

**Folder — ✅ signed.** `folder` is inside the signed parameter string, so an upload cannot
land outside `constituency-connect/<kind>`.

**Format — ⚠️ partly.** `resource_type` is pinned by the upload URL the server hands back,
so an image signature cannot be used for a video. The MIME `accept` list in `MEDIA_RULES`
is a **browser file-picker hint only** — it is not signed and not re-checked server-side.
`attachMediaSchema.mimeType` accepts any string up to 120 chars.

**Size — ❌ not enforced.** Cloudinary has no signable max-bytes parameter;
`lib/cloudinary.ts` says so in its own comment. The only server-side check is in
`attachMedia` (`features/complaints/actions.ts:181`), against `sizeBytes` — a number the
*client* supplies, declared `.nullish()` in the schema. Omit the field and
`if (file.sizeBytes && …)` skips the check entirely. So the documented 10/100/20 MB ceilings
are advisory.

**EXIF — ❌ was not happening at all.** See row 7; fixed in this pass.

**Also noted:** `attachMediaSchema.url` is `z.url()` with no host allowlist, so an
authenticated caller can attach a URL pointing anywhere and it is stored on the complaint.
Public surfaces render media through `next/image`, whose `remotePatterns` only permits
`res.cloudinary.com`, so an off-Cloudinary URL fails to render rather than loading — but
the row is written, and staff views may render it differently.

**Verdict:** ⚠️ The control that matters (signed, folder-pinned, authenticated) holds.
Size and MIME do not, and the doc claims they do.

**Follow-ups (not done in this pass — each needs a decision, not a patch):**
1. Create a Cloudinary **upload preset** with `max_file_size` per resource type and sign
   against the preset. This is the only place the byte ceiling can actually be enforced,
   and `lib/cloudinary.ts` already names it as the upgrade path.
2. Constrain `attachMediaSchema.url` to the configured Cloudinary cloud, and derive it from
   `publicId` rather than trusting a client-supplied URL.
3. Reword §8 to claim folder and resource type — the two things a signature really pins.

---

## 7. PII exposure

**§8 says:** *Public map: jittered coords, no names; phones masked outside staff views;
private-complaint flag; citizens see officer name/designation only.*

### What holds

The public map is the strongest-built control in the review. `features/public-site/lib/pins.ts`
is a pure module with its own test (`pins.test.ts`) asserting the exact allowed key set:

- `PUBLIC_MAP_WHERE` excludes `isPrivate` rows and any status outside the public seven —
  drafts, submitted and rejected complaints never appear.
- `toComplaintPin` drops everything else. The pin's `title` is the *category*, never the
  citizen's description, because descriptions name people and houses.
- `jitterPoint` offsets each pin by up to ~50 m, seeded from the complaint id so the pin is
  stable across loads. The comment is right that random-per-request jitter would be worse
  than none — averaging repeated samples would recover the true point.

Phone numbers: the only citizen-facing render of `citizen.phone` is
`features/complaints/complaint-detail.tsx:87`, gated behind `canTriage`. Other renders are
staff queues (`features/engagement/staff-queues.tsx`) or the office's own published contact
number (`(public)/contact/page.tsx`). ✅ Holds.

### The leak

**`jitterPoint` was being undone by the photo next to the pin.**

The chain:

1. A citizen photographs a problem on their phone at the location; a field officer
   photographs the finished work at the same place. Phone cameras write GPS into EXIF, and
   the app *wants* that GPS — `attachMedia` uses it for geo-verification.
2. `publishStory` (`features/public-site/actions.ts:205`) copies the complaint's media URL
   straight onto the story: `beforeImage: before?.url`.
3. That `url` is the **original** Cloudinary delivery URL. Cloudinary serves the original
   asset byte-for-byte — EXIF intact. Only *derived* (transformed) assets drop metadata.
4. `BeforeAfter` (`features/public-site/before-after.tsx:26`) rendered it with a plain
   `<img src={before}>` — deliberately bypassing `next/image`, whose re-encode is what
   silently strips EXIF everywhere else on the public site.
5. `toComplaintPin` also put the same raw URLs into `/api/v1/public/map`, so they were
   available as JSON without even loading a page.

Net effect: the map moved the pin ~50 m to protect a family's address, and the story image
beside it carried the exact coordinate to anyone who ran `exiftool` on it. The code comment
in `before-after.tsx` asserted *"These are Cloudinary URLs, already transformed"* — they
were not.

**Fixed in this pass.** New `features/public-site/lib/public-image.ts` inserts
`f_auto,q_auto` into the delivery URL, which makes Cloudinary serve a derived asset and drop
the metadata. Applied at both exits — `toComplaintPin` (the map JSON) and `BeforeAfter` (the
only public render that bypasses `next/image`). `public-image.test.ts` covers the rewrite,
the pass-through cases, and asserts a pin never ships an untransformed original.

**Verdict:** 🔧 Was leaking, now fixed.

**Residual risk:** the fix is at the *read* path, so it covers rows already in the database.
It does **not** remove EXIF from the originals in Cloudinary — anyone holding an unmodified
URL from before this change still gets the metadata. If any story URL has been shared
publicly, the originals should be re-uploaded stripped, or the account set to strip on
upload.

---

## 8. Tampering / repudiation

**§8 says:** *AuditLog on every mutation via actionClient (actor, action, entity, ip, meta);
timeline is append-only.*

**Reality:** `defineAction` calls `audit()` after every successful handler, and `audit()`
(`lib/audit.ts`) adds `ip` from `x-forwarded-for` and `userAgent` itself. A failed audit
write logs and continues rather than rolling back — correct, since a citizen who saw their
complaint submitted should not have it vanish because a log row failed.

**Noted, not a defect:** `meta` is the entire validated action input
(`meta: parsed.data`). For profile and appointment mutations that means phone numbers and
names land in `AuditLog` rows. That is defensible for an audit trail, but it makes
`AuditLog` a PII store subject to the same retention and access rules as the rest — worth
knowing before anyone grants broad read access to it or exports it.

**Verdict:** ✅ Holds.

---

## 9. Secrets

**§8 says:** *Zod-validated env, Vercel-managed, never client-bundled.*

**Reality:** `lib/env.ts` parses `process.env` with Zod at boot and throws with
`z.prettifyError` on failure. `BETTER_AUTH_SECRET` is `min(32)`. `CRON_SECRET` is
`min(16)`. The `optional()` preprocessor treats `""` as unset, which is the right call —
a blank value in a dashboard means "I don't have this", and without it one empty optional
key would take the whole app down at boot instead of disabling one feature.

Only `NEXT_PUBLIC_*` vars reach the client, per Next's own rule; nothing in `env.ts` is
imported from a client component.

**Verdict:** ✅ Holds. This row is implemented better than it is written.

---

## 10. Transport / headers

**§8 says:** *HSTS, X-Frame-Options DENY, nosniff, referrer-policy, minimal CSP — one block
in `next.config`.*

**Reality:** all present in `next.config.ts`, plus `Permissions-Policy` (camera, geolocation
and microphone limited to `self` for field proof; payment and USB off) and
`poweredByHeader: false`. HSTS is two years, `includeSubDomains`, `preload`.

CSP is reasonably tight: `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`,
`form-action 'self'`, and every allowed origin is one the app genuinely talks to.

Two documented deviations, both with reasoning in the file:

- **`script-src 'unsafe-inline'`** instead of per-request nonces. Nonces force every page
  dynamic and are incompatible with PPR. With no third-party script tags on the site, the
  XSS surface this leaves open is the one React already escapes — and row 2 confirms there
  is exactly one `dangerouslySetInnerHTML`, which escapes.
- **No `upgrade-insecure-requests`.** Redundant behind HSTS, and it broke local prefetches
  during the gate M4 Lighthouse run.

**Verdict:** ✅ Holds. `'unsafe-inline'` is an accepted risk, correctly reasoned, and should
be revisited the moment any third-party script tag is added.

---

## 11. Session theft

**§8 says:** *httpOnly + secure + rotation; logout-all-devices in settings.*

**Reality:** cookie flags are Better Auth defaults (see row 3 — `secure` follows from the
base URL being `https`). Session expiry and rolling refresh are Better Auth defaults; not
configured here, and the defaults are sane. `revokeOtherSessions()` is wired up in
`features/account/revoke-sessions.tsx`.

**Verdict:** ✅ Holds, on the same `BETTER_AUTH_URL` dependency as row 3.

---

## What this review did not cover

- The deployed environment: Vercel project settings, Neon access, Upstash config. On the
  README going-live checklist.
- Dependency vulnerabilities. `npm audit` reports 0 at the time of writing, which is a
  point-in-time result, not a control.
- Anything requiring live credentials — the Resend, FCM and Gemini paths are code-complete
  and have never made a real call.
- Penetration testing. Nothing here was verified by attacking a running instance.

## Changes made during this review

| Change | File |
|---|---|
| Strip EXIF from every public render of an uploaded photo | `features/public-site/lib/public-image.ts` (new), `lib/pins.ts`, `before-after.tsx` |
| Test that a map pin never ships an untransformed original | `features/public-site/lib/public-image.test.ts` (new) |
| Rate-limit the Cloudinary signature endpoint, 30/min/user | `app/api/v1/uploads/sign/route.ts` |
