# Project Research Summary

**Project:** Pool Field Forms (lucac-vault-server)
**Domain:** iPad-first field service form app — pool installation crews, photo capture, AI form generation, email submission
**Researched:** 2026-03-25
**Confidence:** HIGH

## Executive Summary

This is a single-company, iPad-first field service forms app that replaces paper forms for pool installation crews. The proven approach for this type of product is a plain responsive web app (not a PWA for v1) built on Next.js, deployed to Vercel — crews use it in Safari, optionally add a Safari bookmark to the home screen, and submit forms by email. The competitive differentiation is radical simplicity: no logins, no configuration, no training. Open it, pick a job, fill the form, attach photos, submit. Everything else is scope creep.

The recommended architecture has a single non-negotiable spine: a JSON schema that the AI produces and the form renderer consumes. This schema is the contract between every major system. Build order is strictly sequential — jobs first, then photos, then form template (AI), then form filling, then email submission. Each phase produces a usable increment. The AI form generation feature is P2, not P1; the first working version should use a manually-defined form template so the app can be validated with real workers before adding AI complexity.

The six critical pitfalls are all iPad Safari-specific and must be addressed in Phase 1, not bolted on later: `beforeunload` does not fire on iOS (mandate auto-save), HEIC photos must be converted client-side before upload, email domain SPF/DKIM must be configured before any field testing or emails land in spam, touch targets must be 48px+ minimum for outdoor/dirty-hands use, input font sizes must be 16px+ to prevent iOS Safari auto-zoom, and client-side photo compression is required before the first photo upload. None of these are optional and all cascade to a full rework if skipped.

## Key Findings

### Recommended Stack

The full-stack is Next.js 16.2 (App Router, Server Actions) with React 19, TypeScript 5.x, and Tailwind CSS 4.2. AI integration uses Vercel AI SDK 6.x with `@ai-sdk/openai` — note that AI SDK 6 deprecated `generateObject` in favor of `generateText` with `output` setting. Schema validation with Zod 4.x serves double duty: it validates AI-generated form schema output and drives react-hook-form runtime validation. Photos upload client-side directly to Vercel Blob (bypasses the 4.5MB server function body limit), compressed first with `browser-image-compression`. Email sends via Resend with `@react-email/components`. Database is Prisma 7.x with SQLite in dev and Vercel Postgres (Neon) in production.

The key constraint is that Serwist (PWA service worker) is disabled in dev mode due to Turbopack — PWA features only activate in production builds. More importantly, per the Architecture research, v1 should not use PWA at all; add a `manifest.json` later if home-screen installation becomes a real need.

**Core technologies:**
- **Next.js 16.2**: Full-stack framework — App Router, Server Actions, first-class Vercel deployment
- **Vercel AI SDK 6.x + @ai-sdk/openai 3.x**: AI integration — structured form generation from paper form photos via GPT-4o vision
- **Zod 4.x**: Schema validation — single source of truth shared between AI output validation and form input validation
- **react-hook-form 7.x**: Form state — uncontrolled components minimize re-renders on iPad; `useFieldArray` handles AI-generated dynamic fields
- **Vercel Blob**: Photo storage — client upload path bypasses 4.5MB server limit; pool installation photos are 5-12MB each
- **Resend 6.x + React Email**: Email delivery — 3,000 free emails/month, 40MB attachment limit, SPF/DKIM domain verification required
- **Prisma 7.x + Vercel Postgres (Neon)**: Database — type-safe ORM, SQLite dev / Postgres prod via env var swap
- **browser-image-compression**: Client-side photo compression — mandatory before upload; drop 5MB photos to ~200-400KB
- **shadcn/ui (CLI v4) + Tailwind 4.2**: UI components — touch-friendly Radix primitives, no runtime dependency

**What NOT to use:** `getUserMedia` / WebRTC for camera (use native `<input capture="environment">` instead), `next-pwa` (unmaintained, use Serwist if PWA needed), Formik (replaced by react-hook-form), Nodemailer (use Resend), multer for uploads (use Vercel Blob client upload).

### Expected Features

The features research identified 8 P1 table-stakes features, 5 P2 differentiators, and 10 explicit anti-features to exclude from v1.

**Must have (P1 — table stakes):**
- Job creation/selection — workers must associate forms and photos with a named job; this is the container for all data
- Digital form filling — large touch targets, minimal typing, auto-advance; must feel as fast as paper
- Photo capture and gallery — native camera via `<input capture="environment">`, multiple photos, thumbnail grid, delete bad photos
- PDF generation from form data — industry standard; office staff forward PDFs to clients and inspectors
- Email submission — form data + photos to configured office email; this is the make-or-break feature
- Submission confirmation — workers need clear success/failure; without it they resubmit or call the office
- Form validation — required field enforcement; block submission before complete
- Job history list — "did I already submit that one?" needs a simple answered list with status

**Should have (P2 — differentiators, add after validation):**
- AI form template generation — the "killer feature"; boss photographs paper form, AI generates digital template; defer to P2 so app is validated first with a manual template
- Draft auto-save — mandatory given iOS Safari's lack of `beforeunload` support; likely needed before first field test
- Photo categorization (Before/During/After) — low complexity, high office value for photo organization
- Branded PDF output — company logo on PDFs; quick win for professional appearance

**Defer (v2+):**
- Multiple form templates, form template visual editor, photo annotation/markup, digital signatures, web dashboard

**Anti-features — do not build:**
- Office admin dashboard (email is the dashboard; dashboard doubles scope for a favor-for-a-friend project)
- Worker login/accounts (login friction reverts workers to paper; use a "submitted by" name field instead)
- Approval/rejection workflow (office uses email replies and phone calls, as they do now)
- Real-time GPS tracking (privacy concerns, not needed; EXIF data provides location if needed)
- Offline mode with sync (iOS PWA storage is 50MB with 7-day expiry; defer unless connectivity proves to be a real field problem)
- Multiple form templates (one company, one form; add later only if business actually needs it)
- Scheduling/dispatch (this becomes ServiceTitan; boss assigns via phone/text as today)
- Payment processing (pool installations invoice separately; out of scope entirely)
- Complex conditional form logic (flat forms with all fields visible; worker skips non-applicable fields)
- Real-time collaboration (one crew, one form, one submission)

**Core insight:** Simplicity IS the feature. Every added feature moves the app toward generic forms platform territory. The competitive advantage is zero-config, zero-training, zero-accounts.

### Architecture Approach

The architecture is a standard Next.js monolith with five clearly-separated concerns. The most important architectural decision is to start as a plain responsive web app — not a PWA — because iOS PWA has real limitations (50MB storage cap, 7-day cache expiry, camera permission quirks in standalone mode) and v1 has no requirements that need offline support or home-screen installation.

The JSON schema is the architectural spine. It is the contract between AI form generation and the form renderer. If this contract breaks, the app breaks. Type it strictly and test both sides against it.

**Major components:**
1. **Job Manager** — create/select jobs by name or number; the container for all other data; first thing to build
2. **Photo Capture** — `<input type="file" accept="image/jpeg,image/png" capture="environment">`, client-side HEIC conversion, client-side compression, direct upload to Vercel Blob with server-issued tokens
3. **Form Renderer** — JSON-schema-driven dynamic renderer; field registry maps field types (text, number, date, checkbox, select, textarea, photo) to React components; extensible without modifying the renderer
4. **AI Form Generator** — admin-only route; GPT-4o vision + Zod structured output; produces `FormSchema` JSON saved to DB; build after form renderer is working
5. **Submission Engine** — server-side: loads form data, fetches blob URLs, converts photos to base64, renders HTML email, sends via Resend; single route, multiple service calls

**Build order is strictly sequential (each phase enables the next):**
```
Phase 1: Database schema + Job CRUD
  ↓ (everything else needs jobs to exist)
Phase 2: Photo capture + Blob upload + gallery
  ↓ (needed for both submission and as input to AI)
Phase 3: Form template (manual first, then AI)
  ↓ (must exist before workers can fill forms)
Phase 4: Form filling + form data persistence + auto-save
  ↓ (must exist before submission)
Phase 5: Email assembly + Resend submission + confirmation
```

**State management:** No Redux, no Zustand. Server Components for read-heavy pages (job list, job detail), Client Components with `useState`/`useActionState` for photo capture and form filling. Job ID in the URL is the primary state selector.

### Critical Pitfalls

All six critical pitfalls map to Phase 1 and must be addressed before field testing begins. Deferring any of these creates a rework, not a fix.

1. **iPad Safari does not fire `beforeunload`** — auto-save to `localStorage` on every field change (debounced 1-2s) is mandatory, not optional. Use `pagehide` and `visibilitychange` events instead. Display a "saved" indicator. Also add `overscroll-behavior-x: none` to prevent swipe-back from losing data.

2. **HEIC photo format will break office attachments on Windows** — iPads default to HEIC. Safari's auto-conversion to JPEG is inconsistent across versions. Always convert to JPEG client-side via `canvas.toBlob('image/jpeg', quality)` before upload. Validate and convert server-side as a second layer. Do not rely on the `accept` attribute alone.

3. **Email domain without SPF/DKIM/DMARC lands in spam** — a 200 OK from the Resend API means "accepted," not "delivered to inbox." Configure SPF, DKIM, and DMARC DNS records for the sending domain before any field testing. Without this, the crew submits successfully and the office never receives anything. This is 30 minutes of DNS setup that prevents weeks of debugging phantom delivery failures.

4. **Photo payload exceeds email size limits** — pool crews take 10-20+ photos at 5-10MB each; 15 photos = 75MB before Base64 encoding (+33% = ~100MB encoded), well over Resend's 40MB limit and Gmail's 25MB receive limit. Compress photos client-side to ~200-400KB each before upload. Set a hard pre-submission warning if total payload exceeds 20MB. Long-term pattern: store photos in Vercel Blob and email links/thumbnails rather than raw attachments.

5. **UI unusable in field conditions** — outdoor use with dirty/wet hands requires: minimum 48px touch targets (54px preferred) with 8px+ spacing between targets; minimum 16px font on all form inputs (smaller than 16px triggers iOS Safari auto-zoom on focus, which disorients users); high-contrast color palette testable under direct sunlight; one-column layout only; large obvious primary action buttons. Test on an actual iPad outdoors — no substitute.

6. **AI form template generation produces imperfect output** — photocopied construction forms with handwritten annotations and abbreviations cause AI accuracy to drop from ~99% on clean text. Treat AI generation as a starting point that requires human review, not finished output. Build the form editor first; AI is an accelerator, not the feature itself. Have a manual fallback: developer can define the template in ~30 minutes if AI output is bad.

## Implications for Roadmap

Based on the combined research, the phase structure follows the strict architectural dependency chain identified in ARCHITECTURE.md, with pitfall prevention baked into each phase.

### Phase 1: Foundation + Jobs

**Rationale:** Jobs are the container for all data. Nothing else can be built without them. This phase also establishes the iPad-first UI foundation — layout decisions cascade to every screen. Do it right here or rework everything later.

**Delivers:** Working job creation/selection, iPad-optimized layout foundation, database schema, project setup

**Features (from FEATURES.md):** Job creation/selection, job history list, iPad-optimized UI constraint

**Stack used:** Next.js 16.2, Prisma 7.x + SQLite, Tailwind 4.2, shadcn/ui, plain responsive web app (no PWA)

**Pitfalls to address:**
- Set 48px+ touch targets and 16px+ input fonts as design tokens from day one
- High-contrast color palette established in this phase
- API keys in server-side routes only — never in client-side code
- Use unguessable URL paths or simple shared PIN as lightweight gate (no auth system required)

### Phase 2: Photo Capture + Storage

**Rationale:** Photos must be in Vercel Blob with HEIC handling and compression working before the submission pipeline can be built. This is also an independent vertical slice that field workers can test early.

**Delivers:** Camera capture, HEIC-to-JPEG conversion, client-side compression, Vercel Blob upload, photo gallery per job, thumbnail display

**Features (from FEATURES.md):** Photo capture and gallery, photo categorization (Before/During/After) as a P2 add-on to this phase

**Stack used:** Vercel Blob (client upload with server tokens), `browser-image-compression`, native `<input type="file" capture="environment">`

**Pitfalls to address:**
- HEIC conversion via `canvas.toBlob('image/jpeg')` before upload — do not rely on `accept` attribute
- Client-side compression to ~200-400KB per photo before upload
- Generate thumbnails (200px wide) for gallery display; load originals only for submission
- Upload progress indicator ("Uploading 3 of 12...") to prevent double-tap resubmit

### Phase 3: Form Template + Manual Definition

**Rationale:** A manually-defined form template should ship before AI generation. This lets the app be validated with real workers using the actual paper form fields, without depending on AI accuracy. The form renderer is the most architecturally significant component and needs to be solid before AI generates schemas for it.

**Delivers:** JSON schema-driven form renderer, field registry (text, number, date, checkbox, select, textarea), form template stored in DB, one active template

**Features (from FEATURES.md):** Digital form filling (core), form validation

**Stack used:** react-hook-form 7.x, Zod 4.x, `@hookform/resolvers`, JSON FormSchema type

**Pitfalls to address:**
- Auto-save to `localStorage` on every field change using `pagehide` and `visibilitychange` events (NOT `beforeunload`)
- Restore from `localStorage` on page load — show "restored" indicator
- `overscroll-behavior-x: none` on form container to block Safari swipe-back
- 16px+ font on all inputs — prevents iOS auto-zoom

**Research flag:** This phase is well-documented for react-hook-form + Zod patterns. Skip additional research phase.

### Phase 4: AI Form Generation

**Rationale:** AI form generation is P2 — a differentiator, not table stakes. By this phase, the manual form template is working and real workers have validated the form renderer. AI generation can now be built as an accelerator that modifies an already-working system.

**Delivers:** Admin route for paper form photo upload, GPT-4o vision + structured output, generated FormSchema stored to DB, form editor UI for correcting AI output

**Features (from FEATURES.md):** AI form template generation (P2)

**Stack used:** Vercel AI SDK 6.x, `@ai-sdk/openai` 3.x, Zod 4.x (shared schema), `generateText` with `output` setting (not deprecated `generateObject`)

**Pitfalls to address:**
- Always include a human review/edit step between AI output and deployment — never use raw AI output as the live template
- Build the form editor before the AI generator (editor is the fallback and the correction tool)
- Validate generated schemas against FormSchema type before saving to DB
- Use structured output with Zod schema to constrain AI to valid field types

**Research flag:** Prompt engineering for form field extraction from photocopied construction forms may need experimentation. Flag for per-phase research when planning this phase.

### Phase 5: Email Submission

**Rationale:** Email is the final integration point — it depends on working jobs, photos in Blob, and a filled form. Build it last to avoid integrating against moving targets. This is also where the deliverability configuration (SPF/DKIM) must be locked in before any real-world testing.

**Delivers:** Server-side submission assembly, photo attachment handling, React Email template, Resend delivery, submission confirmation, submission log, duplicate-submit prevention

**Features (from FEATURES.md):** Email submission, submission confirmation, PDF generation (coupled with email)

**Stack used:** Resend 6.x, `@react-email/components` 1.x, Vercel Blob (server-side fetch for attachment assembly)

**Pitfalls to address:**
- Configure SPF, DKIM, DMARC DNS records before first test send to actual office email
- Pre-submission payload size check — warn user if total photos exceed 20MB after compression
- Disable submit button during processing; show full-screen success state after completion
- Store every submission to DB with status — email delivery log is the recovery path if something fails
- Test with actual office email address on Windows PC — not developer Gmail

**Research flag:** Attachment assembly pattern (Blob URL fetch → base64 → Resend) is well-documented. Standard implementation. Skip additional research phase.

### Phase 6: Polish + Field Hardening

**Rationale:** First four phases produce a working app. This phase makes it field-ready based on real crew feedback. Do not over-engineer before this feedback exists.

**Delivers:** Error message specificity ("Photos too large — remove some" vs. "Something went wrong"), loading states, submission history screen, branded PDF output, outdoor usability fixes, production deployment

**Features (from FEATURES.md):** Branded PDF output (P2), submission confirmation improvements, job history refinements

**Pitfalls to address:**
- Conduct actual outdoor field test before calling it done — wet hands, bright sunlight, cellular data
- Test with 15+ photos in one session on actual iPad (memory pressure can cause Safari tab reload)
- Test cellular submission (not just WiFi)
- Verify no duplicate email on double-tap submit

### Phase Ordering Rationale

- Jobs come first because they are the container for all other data — nothing can be built without them
- Photos come before form rendering because Blob upload and HEIC handling must be solid before the submission pipeline depends on them
- Manual form template comes before AI generation so workers can validate the app against real form fields without AI accuracy risk
- AI form generation is explicitly P2 — after workers validate the manual form, not before
- Email submission comes last because it integrates all previous phases; building it early means integrating against incomplete systems
- Offline mode, multiple templates, and the office dashboard are explicitly excluded from v1 — they each represent a scope doubling

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 4 (AI Form Generation):** Prompt engineering for extracting field definitions from photocopied/handwritten construction forms. Photo quality coaching for the boss. Expected accuracy on real forms vs. clean printed text.

**Standard patterns — skip research phase:**
- **Phase 1 (Foundation + Jobs):** Next.js App Router + Prisma CRUD is thoroughly documented.
- **Phase 2 (Photos):** Vercel Blob client upload pattern is documented in official Vercel docs.
- **Phase 3 (Form Renderer):** react-hook-form + Zod + dynamic field rendering is a well-established pattern with abundant examples.
- **Phase 5 (Email):** Resend + React Email + base64 attachment assembly is documented. Deliverability configuration (SPF/DKIM) is standard DNS setup.
- **Phase 6 (Polish):** No novel integrations; user feedback drives the work.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified via npm and official changelogs. AI SDK 6 breaking change (generateObject → generateText with output) confirmed in migration guide. Version compatibility table verified. |
| Features | HIGH | Features derived from competitor analysis (GoFormz, Jotform, Housecall Pro, FastField) and field service domain research. Anti-features grounded in explicit PROJECT.md out-of-scope statements and domain-specific reasoning. |
| Architecture | HIGH | Build order and component boundaries derived from clear dependency analysis. PWA-vs-web-app recommendation backed by documented iOS Safari limitations. JSON schema pattern is the standard approach for dynamic form rendering. |
| Pitfalls | HIGH | `beforeunload` iOS Safari behavior confirmed in Apple Developer Forums. HEIC conversion behavior confirmed across multiple sources. Touch target and font size requirements from WCAG and NNg. Email deliverability from transactional email provider documentation. |

**Overall confidence:** HIGH

### Gaps to Address

- **Prompt engineering for AI form extraction:** Accuracy on real pool installation forms (photocopied, potentially handwritten) is unknown until tested. Mitigation: build the form editor first and treat AI as the starting point.
- **`@hookform/resolvers` + Zod 4 compatibility:** Likely compatible but verify at install time — the resolvers package must explicitly support Zod 4.x.
- **Vercel Postgres free tier limits:** 60 compute hours on the Hobby plan. For a small pool crew this should be ample, but monitor in production and consider Neon direct connection if limits are hit.
- **Photo attachment size budget in practice:** Theoretical maximum is 20 compressed photos at ~300KB = ~6MB, well under 40MB. But aggressive photo-takers sending 20+ photos at high quality need the pre-submission size check as a hard safety net.
- **Office email provider spam filters:** SPF/DKIM/DMARC eliminate the main risk, but the actual office email provider (unknown) may have additional filters. Test with the real address early in Phase 5.

## Sources

### Primary (HIGH confidence)

- [Next.js 16.2 Blog Post](https://nextjs.org/blog/next-16-2) — version, App Router, Turbopack
- [Next.js PWA Guide](https://nextjs.org/docs/app/guides/progressive-web-apps) — official PWA patterns
- [AI SDK 6 Blog Post](https://vercel.com/blog/ai-sdk-6) — migration from generateObject
- [AI SDK Migration Guide 5.x to 6.0](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0) — breaking changes confirmed
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) — vision + structured output compatibility
- [Vercel Blob Client Uploads](https://vercel.com/docs/vercel-blob/client-upload) — client-side upload token pattern
- [Resend API Reference](https://resend.com/docs/api-reference/emails/send-email) — 40MB attachment limit confirmed
- [Resend Pricing](https://resend.com/pricing) — free tier 3,000/month, 100/day confirmed
- [Serwist Getting Started](https://serwist.pages.dev/docs/next/getting-started) — Next.js 16 integration
- [Zod v4 Release Notes](https://zod.dev/v4) — v4.3.6 confirmed
- [Prisma 7.2.0 Blog](https://www.prisma.io/blog/announcing-prisma-orm-7-2-0) — version confirmed
- [Tailwind CSS v4.2 Release](https://tailwindcss.com/blog) — CSS-first config confirmed
- [Apple Developer Forums: beforeunload not supported on iOS Safari](https://developer.apple.com/forums/thread/744732) — critical pitfall confirmed
- [Apple Developer Forums: Safari 17+ HEIC auto-conversion](https://developer.apple.com/forums/thread/743049) — HEIC behavior confirmed
- [PWA iOS Limitations and Safari Support (2026)](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — storage limits, camera permission quirks
- [NN/g: Touch Target Sizes on Touchscreens](https://www.nngroup.com/articles/touch-target-size/) — 48px minimum confirmed
- [MDN HTML capture attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/capture) — iPad camera capture behavior

### Secondary (MEDIUM confidence)

- [GoFormz: Top 5 Mobile Form Builders Comparison 2025](https://blog.goformz.com/post/top-5-mobile-form-builders-a-comprehensive-comparison-2025-guide) — competitor feature analysis
- [ServiceTitan: 15 Best Field Service Mobile Apps for 2026](https://www.servicetitan.com/blog/best-field-service-mobile-apps) — field service domain context
- [Camera Access Issues in iOS PWA](https://kb.strich.io/article/29-camera-access-issues-in-ios-pwa) — getUserMedia problems in standalone mode
- [browser-image-compression npm](https://www.npmjs.com/package/browser-image-compression) — client-side compression capability (version not pinned)
- [Upsidelab: Handling HEIC on the Web](https://upsidelab.io/blog/handling-heic-on-the-web) — canvas conversion approach
- [Innolitics: Preventing Data Loss in Web Forms](https://innolitics.com/articles/web-form-warn-on-nav/) — pagehide/visibilitychange pattern

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*
