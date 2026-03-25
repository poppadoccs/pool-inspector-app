---
phase: 01-foundation-jobs
plan: 02
subsystem: ui
tags: [nextjs, react, server-actions, prisma, zod, shadcn, ipad, touch-targets, date-fns]

# Dependency graph
requires:
  - phase: 01-foundation-jobs plan 01
    provides: Next.js 16 app shell, Prisma Job model, iPad CSS tokens, Zod job validation schema
provides:
  - createJob server action with Zod validation and revalidatePath
  - CreateJobForm expandable inline client component with useActionState
  - JobCard component linking to detail route with status badge and timestamp
  - JobList server component with empty state
  - StatusBadge component for Draft/Submitted display
  - Home page with sorted job query (drafts pinned, then newest first)
  - Job detail page with metadata, back navigation, and Phase 2/3 placeholders
affects: [01-03, 02-photo-capture, 03-form-renderer]

# Tech tracking
tech-stack:
  added: []
  patterns: [server-actions-with-useActionState, force-dynamic-pages, promise-params-next16]

key-files:
  created:
    - pool-app/src/lib/actions/jobs.ts
    - pool-app/src/components/create-job-form.tsx
    - pool-app/src/components/status-badge.tsx
    - pool-app/src/components/job-card.tsx
    - pool-app/src/components/job-list.tsx
    - pool-app/src/app/jobs/[id]/page.tsx
  modified:
    - pool-app/src/app/page.tsx

key-decisions:
  - "Added export const dynamic = 'force-dynamic' to home page to prevent prerendering (DB query cannot run at build time)"
  - "Import Job type from @/generated/prisma/client (Prisma 7 generated path) instead of @prisma/client"

patterns-established:
  - "Server actions in src/lib/actions/ with 'use server' directive and useActionState pattern in client components"
  - "Dynamic pages use export const dynamic = 'force-dynamic' when querying database"
  - "Next.js 16 dynamic route params are Promise-based: const { id } = await params"
  - "Job type imported from @/generated/prisma/client for Prisma 7 compatibility"

requirements-completed: [JOBS-01, JOBS-02, JOBS-03]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 1 Plan 2: Job Management UI Summary

**Job list with inline create form, status badges, sorted display (drafts first), and job detail page with metadata and back navigation -- all iPad-optimized with 48px/56px touch targets**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T16:20:10Z
- **Completed:** 2026-03-25T16:24:46Z
- **Tasks:** 2/2
- **Files modified:** 7

## Accomplishments

- Server action `createJob` with Zod validation, Prisma job creation, and path revalidation
- Expandable inline "New Job" form with useActionState pending state, toast notifications, and validation error display
- Job list on home page sorted with drafts pinned to top (status ASC), then newest first (createdAt DESC)
- Job cards with name/number display, relative timestamps (date-fns), and Draft/Submitted status badges
- Job detail page with dynamic metadata (generateMetadata), back navigation, status, timestamps, and Phase 2/3 placeholder cards
- All interactive elements meet iPad touch target requirements (48px inputs/close, 56px primary buttons)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Server Action, job components, and home page** - `2a6a838` (feat)
2. **Task 2: Create job detail page with metadata display** - `3b2f2f8` (feat)

## Files Created/Modified

- `pool-app/src/lib/actions/jobs.ts` - Server action for job creation with Zod validation
- `pool-app/src/components/create-job-form.tsx` - Client component with expandable inline form, useActionState
- `pool-app/src/components/status-badge.tsx` - Draft/Submitted badge using shadcn Badge
- `pool-app/src/components/job-card.tsx` - Job card with link, timestamp, status badge
- `pool-app/src/components/job-list.tsx` - Job list with empty state message
- `pool-app/src/app/page.tsx` - Home page composing CreateJobForm + JobList with sorted DB query
- `pool-app/src/app/jobs/[id]/page.tsx` - Job detail page with metadata, back nav, placeholders

## Decisions Made

- **force-dynamic on home page:** The home page queries `db.job.findMany` which cannot run at build time. Added `export const dynamic = "force-dynamic"` to prevent Next.js from attempting to prerender it as a static page. This is correct for the previous caching model (cacheComponents not enabled).
- **Prisma 7 Job type import path:** Used `import type { Job } from "@/generated/prisma/client"` instead of `@prisma/client` because Prisma 7 generates types to a project-local directory. Consistent with the db.ts pattern established in Plan 01.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added force-dynamic to prevent build-time prerendering failure**
- **Found during:** Task 1 (build verification)
- **Issue:** `npx next build` failed with prerender error on `/` because `db.job.findMany` attempted to connect to the database during static generation, but DATABASE_URL is a placeholder.
- **Fix:** Added `export const dynamic = "force-dynamic"` to `pool-app/src/app/page.tsx`.
- **Files modified:** pool-app/src/app/page.tsx
- **Verification:** `npx next build` completes successfully, `/` shown as dynamic route
- **Committed in:** 2a6a838 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for build to pass. No scope creep. The page must be server-rendered anyway since it reads from DB on every request.

## Known Stubs

- `pool-app/src/app/jobs/[id]/page.tsx` line 80: "Photo capture coming in Phase 2" -- intentional placeholder for Phase 2
- `pool-app/src/app/jobs/[id]/page.tsx` line 87: "Form fields coming in Phase 3" -- intentional placeholder for Phase 3

## Issues Encountered

None beyond the deviation documented above.

## User Setup Required

Same as Plan 01: DATABASE_URL must be set in `pool-app/.env` with a valid Neon Postgres connection string, and `npx prisma db push` must be run before the app can create or display jobs.

## Next Phase Readiness

- Job management UI is complete: create, list, and detail views all functional
- Ready for Plan 03: Vercel deployment configuration
- Ready for Phase 2: Photo capture can be added to the job detail page placeholder
- Ready for Phase 3: Form fields can replace the job detail page placeholder

## Self-Check: PASSED

All 7 files verified present. Both commit hashes (2a6a838, 3b2f2f8) found in git log.

---
*Phase: 01-foundation-jobs*
*Completed: 2026-03-25*
