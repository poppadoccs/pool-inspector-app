# Phase 1: Foundation + Jobs - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a Next.js 16 web application with iPad-optimized UI that lets pool installation workers create and manage jobs. This is the foundation that all subsequent phases build on — photo capture, form rendering, AI generation, and email submission all depend on this shell and data model being solid. No login, no complex navigation, just a job list and job detail view.

</domain>

<decisions>
## Implementation Decisions

### App Shell & Layout
- Next.js 16 App Router + Tailwind 4 + shadcn/ui — research-validated stack, Vercel deploy
- Neon Postgres via Prisma for database — free tier, serverless, Vercel Marketplace
- Responsive layout supporting both landscape and portrait iPad orientations
- Single page with job list as home, tap job to open detail view — minimal nav, one level deep

### Job Management UX
- Inline "New Job" button at top of list → expands form fields (name + number) — fast, no page change
- Job list sorted most recent first, with draft jobs pinned to top
- Two status labels: Draft (not submitted) and Submitted — matches paper workflow
- "Submitted by" text field on the job — no login needed, crews share iPads

### iPad Field Constraints
- 48px minimum touch targets, 56px for primary actions — dirty/gloved hands
- Dark text on light background, high contrast, zinc/neutral palette — outdoor sunlight readability
- 16px base minimum on all inputs (prevents iOS zoom), 18px for body text

### Claude's Discretion
- Prisma schema design and migration strategy
- Exact shadcn/ui component choices for job list and detail views
- Vercel project configuration details
- File/folder structure within the Next.js app

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. Existing files (server.py, pyproject.toml) are the Lucac Vault MCP server, unrelated to this app.

### Established Patterns
- None — new Next.js project being scaffolded from scratch.

### Integration Points
- Vercel deployment (production target)
- Neon Postgres via Vercel Marketplace (database)

</code_context>

<specifics>
## Specific Ideas

- Job identification supports both name AND/OR job number (user's friend's company may use either)
- App is a favor for a friend — keep it practical and reliable, not over-engineered
- Workers are non-technical — dead simple UX is non-negotiable

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
