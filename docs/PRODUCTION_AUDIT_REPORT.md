# Story Time — Production Audit Report

**Date:** 2026-07-03  
**Scope:** Full-platform architectural audit (creator pipeline, marketplace stakeholders, viewer, legal, App Store / Play readiness)  
**Status:** Continuous hardening in progress — this report reflects the current baseline after the latest remediation pass.

---

## 1. Architecture overview

Story Time is a multi-role production SaaS built on:

| Layer | Stack |
| --- | --- |
| App | Next.js (App Router), React, TypeScript |
| Auth | NextAuth (credentials + OAuth providers), role matrix via `User` + `UserRole` |
| Data | Prisma → Neon Postgres |
| Media | S3-compatible object storage |
| Payments | PayFast (viewer subscriptions, card consent, marketplace bookings) |
| AI / tools | Creator pipeline tools (script, breakdown, budget, schedule, production, post) |

**Primary account types**

- **VIEWER** — browse, profiles, subscriptions, PPV
- **CONTENT_CREATOR** / **MUSIC_CREATOR** — projects, catalogue, pipeline tools, payouts
- **Marketplace stakeholders** — equipment, location, crew, casting, catering (and related dashboards)
- **ADMIN** — moderation, originals, platform ops

**Creator production pipeline (intended flow)**

```
Idea → Development → Script → Breakdown → Casting / Locations / Crew / Equipment
  → Budget → Schedule → Call sheets → Production (shoot, dailies, continuity)
  → Post (footage, music, reviews) → Distribution / catalogue
```

Core project entity: `OriginalProject` with phase-linked tools (`ProjectToolProgress`, scripts, scenes, breakdown tables, budgets, shoot days, contracts, etc.).

---

## 2. Problems found (by severity)

### Critical (P0)

| ID | Area | Issue |
| --- | --- | --- |
| P0-1 | App Store / legal | Account deletion and data export were not available in-product for all roles (Apple Guideline 5.1.1(v) / Play account deletion). |
| P0-2 | Script import | PDF import produced binary/garbled text or over-strict 422s; content lost on navigation. |
| P0-3 | Breakdown | Scene details empty; draft not synced; unlinked rows invisible. |
| P0-4 | Schedule / shoot | Adding shoot days raced with stale refetch; UI required manual refresh. |
| P0-5 | Cast on schedule | Cast not appearing on shoot days (only crew); casting roles not linked to breakdown characters/scenes. |

### High (P1)

| ID | Area | Issue |
| --- | --- | --- |
| P1-1 | Budget | VA auto-filled budgets without explicit consent. |
| P1-2 | Active project | Tools did not consistently default to newest / active project. |
| P1-3 | Locations | Creators could not easily register owned locations for scenes (marketplace-only path). |
| P1-4 | Account export | Export payload was thin (profile only + few relations). |
| P1-5 | Account delete | No rate limiting; subscription cancel status set incomplete (`TRIAL_ACTIVE` missed). |

### Medium (P2)

| ID | Area | Issue |
| --- | --- | --- |
| P2-1 | Privacy policy | Did not document in-app export/delete paths. |
| P2-2 | Stakeholder UX | Crew / casting / catering had profile pages but no account deletion UI. |
| P2-3 | Creator vault | “Future-ready roadmap” section is still placeholder notes (not product blockers). |
| P2-4 | Wallet | Some environments may lack wallet migrations (`prisma migrate deploy` required). |
| P2-5 | PDF import | Image-only / scanned PDFs still cannot yield text without OCR. |

### Low (P3) / technical debt

| ID | Area | Issue |
| --- | --- | --- |
| P3-1 | Monolith pages | Pre-production / production tool pages are very large client modules (maintainability). |
| P3-2 | Rate limits | In-memory rate limits (not distributed) — fine for single-node, weak under multi-instance. |
| P3-3 | Escrow | Marketplace payments are booking-oriented; full escrow / dispute workflow is not a complete financial product. |
| P3-4 | Abuse tooling | Legal policies exist; dedicated in-app block/report UI is limited vs policy language. |
| P3-5 | Funder role | Role exists in auth map; dedicated funder dashboard surface is thinner than other stakeholders. |

---

## 3. What was fixed (this audit pass + recent pipeline work)

### App Store / privacy (this pass)

- **`POST /api/account/delete`** — confirmation `DELETE`, password when `passwordHash` present, admin self-delete blocked, subscription cancel, session/account wipe, hard delete with anonymization fallback, rate limiting.
- **`GET /api/account/export`** — JSON export of profile, roles, pitches, project memberships, catalogue content, music tracks, subscriptions, access, rosters, message metadata, watchlist, ratings, comments; rate limited.
- **Shared UI** — `AccountPrivacyControls` wired into:
  - Viewer: `/browse/settings`
  - Creators / music creators: Account → Security
  - Equipment / location: company account pages
  - Crew, casting, catering: profile pages
- **Privacy Policy** updated to describe self-service export/delete and anonymization fallback.

### Creator pipeline (prior + uncommitted work in branch)

- Script PDF/format extract, layout repair, import vault, immediate save to `CreatorScript`.
- Breakdown draft sync, auto-seed from screenplay, scene-row matching for unlinked rows.
- Budget VA consent prompt (no silent auto-fill).
- Active project preference (`storytime-active-project-id`) across tools.
- Casting ↔ breakdown character/scene linking; schedule day preview includes cast.
- Creator-owned locations in location marketplace workspace.
- Schedule mutations return full payload; shoot progress optimistic updates and continuity links.

### Pipeline auto-connections + security hardening (deep-dive pass)

- **Casting auto-sync after breakdown** — `src/lib/casting-sync.ts`; every full AI breakdown re-run now re-creates and re-links casting roles server-side (breakdown wipes used to SetNull all role links silently). Runs inside `executeScriptBreakdown`, so the API route, Modoc VA actions and extended actions all benefit.
- **Shared pipeline invalidation** — `src/lib/project-pipeline-invalidation.ts` maps each pipeline stage (script, scenes, breakdown, casting, crew, locations, schedule…) to every downstream React Query consumer; wired into breakdown/schedule/casting/location mutations in the tool page and into the Modoc action → query-key map (`modoc-tool-sync.ts`) with cascade key sets.
- **Call sheet staleness** — call sheets API now flags `stale: true` when the shoot day changed after the sheet was generated; the generator UI shows an amber "Schedule changed — regenerate" action per saved version.
- **Dailies → post-production** — `POST /api/creator/projects/[id]/footage/promote-dailies` promotes approved/circle-take dailies clips to `FootageAsset` (idempotent by source clip id); "Import approved dailies" button added to Footage Ingestion.
- **AI endpoint lockdown** — `vision-ocr` and `parse-receipt` now require project membership (not just any session); breakdown auto-populate and vision OCR are rate limited per user.
- **Generic checkout server pricing** — `/api/payments/checkout` no longer trusts a client-supplied amount; it prices marketplace entities via `resolveMarketplaceSettlement` and rejects unknown reference types.
- **Email sign-in fail-closed** — NextAuth `EmailProvider` is registered only when `EMAIL_SERVER` + `EMAIL_FROM` are configured (previously fell back to localhost:25 and silently swallowed magic links).
- **Upload + AI rate limits** — per-user limits on content-media presign/upload (120/h), KYC docs (20/h), account docs (30/h), Modoc chat (60 / 5 min), breakdown auto-populate (10/h), vision OCR (30/h) via `src/lib/api-rate-limit.ts`.
- **Nav gaps** — `/legal/content-standards` added to the legal hub nav; catering portal gained an "Account & privacy" nav item anchored to its privacy controls.
- **Access dedup** — call-sheets and casting sync routes now use the shared `ensureProjectAccess` (ACCEPTED members only) instead of local copies that admitted INVITED members.

---

## 4. Migrations created

| Migration | Purpose |
| --- | --- |
| `prisma/migrations/20260703120000_creator_script_imports/` | `CreatorScriptImport` vault for imported screenplay files / extract metadata |

**Deploy note:** run `npx prisma migrate deploy` (and `npx prisma generate`) in every environment.

No new migration was required for account delete/export (uses existing `User` relations and soft anonymization fields).

---

## 5. New relationships / data flows

| Producer | Consumer | Connection |
| --- | --- | --- |
| Screenplay / script import | Breakdown | Seed characters & locations; import vault retention |
| Breakdown characters | Casting roles | Name/scene link (`casting-scene-link`) |
| Casting + breakdown | Schedule / shoot days | Cast appears on day requirements |
| Breakdown locations | Location tool | Creator-owned locations + primary scene location |
| Breakdown / engine | Budget | VA build only after explicit consent |
| Project create / visit | All tools | Active project id in localStorage |
| Schedule mutations | Shoot progress UI | Full payload apply (no stale race) |
| AI breakdown (full) | Casting roles | Server-side auto-sync + re-link (`casting-sync.ts`) |
| Schedule / shoot day edits | Call sheets | `stale` flag + one-click regenerate |
| Approved dailies clips | Post footage assets | `promote-dailies` endpoint + Footage Ingestion import |
| Any pipeline mutation | Downstream tools | `invalidateProjectPipeline` cascade invalidation |

---

## 6. Security improvements

- Account delete requires explicit confirmation and password when applicable.
- Admin accounts cannot self-delete.
- Rate limits on export (10/hour) and delete (5/hour) per user+IP key.
- Failed password attempts on delete recorded separately.
- Export omits message bodies (metadata only) to protect counterparties.
- Sessions and OAuth accounts cleared on delete; anonymization fallback if FK graph blocks hard delete.
- Existing auth rate limits on signup / sign-in / password reset remain in place.
- Generic payments checkout amounts are priced server-side from the referenced entity (client amounts are never trusted).
- Vision OCR / receipt parsing require project membership; heavy AI endpoints and all uploads are rate limited per user.
- Email magic-link provider disabled unless SMTP is configured (no localhost fail-open in production).

---

## 7. Performance improvements

- Schedule create/update no longer forces a full invalidation race (apply server payload).
- Shoot progress uses optimistic PATCH where applicable.
- Export queries are bounded (`take: 500` on messages/comments).
- Active project routing reduces unnecessary “pick a project” round-trips.

**Still open:** large tool page bundles, N+1 risk in some list endpoints, distributed rate limiting.

---

## 8. Marketplace improvements

- Account deletion/export available on stakeholder profile/account surfaces.
- Location tool supports creator-owned locations (not only marketplace listings).
- Casting roles surface on production days when linked to breakdown.

**Still open:** full escrow, standardized contracts for all booking types, unified reviews/ratings across all marketplaces, stronger verification badges.

---

## 9. Pipeline improvements

End-to-end path for a film project is navigable:

Idea → Script (import/write) → Breakdown → Casting / Locations / Crew / Equipment → Budget (consent) → Schedule (cast+crew) → Production tools → Post → Distribution.

Dead-ends reduced for: empty breakdown tabs, missing cast on days, budget surprise fill, project selection friction, shoot day refresh.

---

## 10. Legal improvements

| Item | Status |
| --- | --- |
| Privacy, Terms, Cookies, Payment, Refund, Acceptable Use, Copyright, PAIA, Content policies | Present under `/legal/*` |
| In-app data export | Implemented |
| In-app account deletion | Implemented |
| Privacy policy documents self-service rights | Updated |
| Consent timestamps (creator vault) | Manual ISO fields (operational, not automated capture everywhere) |
| DMCA / abuse reporting | Policy language; support channel — limited in-app workflow |

---

## 11. Remaining recommendations

1. **OCR path** for scanned PDF scripts (optional paid/async job).
2. **Distributed rate limiting** (Redis / Upstash) for multi-instance deploys.
3. **Automated consent capture** at signup (immutable audit log) instead of editable vault timestamps.
4. **In-app report/block** for users and listings with admin queue.
5. **Marketplace escrow** and dispute state machine before large-value bookings.
6. **Split mega tool pages** into route-level modules for maintainability and code-splitting.
7. **E2E suite** covering: signup → project → script import → breakdown → schedule → account delete.
8. **Wallet / payout** migration verification in every environment.
9. **Funder** dashboard parity if that role is marketed.
10. **Accessibility pass** (focus order, contrast, screen reader labels on tool workspaces).

---

## 12. Production readiness score

| Dimension | Score (0–10) | Notes |
| --- | --- | --- |
| Core creator pipeline | **7.5** | Usable studio path; PDF OCR and some post tools still uneven |
| Marketplace | **6.5** | Bookings/messaging exist; escrow/disputes incomplete |
| Viewer / payments | **7.0** | PayFast + plans; monitor renewal edge cases |
| Auth / roles | **8.0** | Solid role matrix; admin protections |
| Legal / privacy | **7.5** | Policies + self-service delete/export |
| Observability | **5.5** | Logging present; needs unified error/APM |
| Data integrity | **7.0** | Strong Prisma model; some soft-link patterns |
| **Overall** | **7.0 / 10** | Production-capable for controlled launch; not “billion-dollar finished” |

---

## 13. Apple App Store readiness score

| Check | Status |
| --- | --- |
| Account deletion in app | **Pass** (all major roles) |
| Data export | **Pass** |
| Privacy policy URL | **Pass** |
| No placeholder paywalls that crash | **Mostly pass** |
| Crash / empty states | **Partial** — tool empty states improved; not fully audited on device |
| Restore purchases | **N/A / partial** — web PayFast, not IAP |

**Score: 7.5 / 10** — account deletion/export gap closed; still need device QA, accessibility, and clear subscription management copy for any native shell.

---

## 14. Google Play readiness score

| Check | Status |
| --- | --- |
| Account deletion | **Pass** |
| Data safety form alignment | **Partial** — policies exist; form must match export/delete behavior |
| Foreground service / permissions | **N/A** for pure web; native shell TBD |
| Payments disclosure | **Partial** — PayFast web checkout |

**Score: 7.5 / 10** — same blockers as Apple for native packaging; web product is reviewable.

---

## 15. Remaining technical debt

- Oversized pre-production / production page modules
- In-memory rate limits
- Incomplete marketplace financial rails (escrow)
- Thin automated abuse/report tooling
- PDF OCR gap
- Creator vault “future” placeholders
- Uneven E2E / integration test coverage
- Possible wallet migration drift across environments

---

## 16. How to verify this pass

1. As **viewer**: Settings → Download my data / Delete account (type `DELETE` + password).
2. As **creator**: Account → Security → same controls; confirm sign-out after delete.
3. As **crew / casting / catering / equipment / location**: Profile or Account → privacy controls visible.
4. Export JSON includes projects, content, subscriptions as applicable.
5. Privacy policy §6 mentions in-app controls.
6. Pipeline smoke: create project → import script → breakdown shows characters → schedule shows cast → budget asks before VA build.

---

*This report should be updated after each major remediation sprint. Do not treat scores as marketing claims — they are internal engineering readiness estimates.*
