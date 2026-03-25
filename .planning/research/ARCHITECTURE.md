# Architecture Research

**Domain:** iPad-first field service form app (photo capture, AI form generation, email submission)
**Researched:** 2026-03-25
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
+-----------------------------------------------------------------------+
|                         iPad Browser (Safari)                         |
|  +-------------+  +---------------+  +------------+  +-------------+  |
|  | Job Manager |  | Photo Capture |  | Form Filler|  | Submission  |  |
|  +------+------+  +-------+-------+  +------+-----+  +------+------+  |
|         |                 |                 |                |         |
+---------+-----------------+-----------------+----------------+---------+
          |                 |                 |                |
+---------+-----------------+-----------------+----------------+---------+
|                      Next.js App Router (API Routes)                  |
|  +----------------+  +-----------------+  +------------------------+  |
|  | /api/jobs      |  | /api/forms      |  | /api/submit            |  |
|  | CRUD jobs      |  | AI generation   |  | compile + email        |  |
|  +-------+--------+  +--------+--------+  +-----+----------+------+  |
|          |                    |                   |          |         |
+----------+--------------------+-------------------+----------+---------+
           |                    |                   |          |
  +--------v--------+  +-------v--------+  +-------v--+ +----v-------+
  |   Database       |  | OpenAI Vision  |  | Blob     | | Resend     |
  |   (Turso/SQLite) |  | API            |  | Storage  | | Email API  |
  +-----------------+  +----------------+  +----------+ +------------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Job Manager | Create/select jobs by name or number, list active jobs | React page with list view + create form |
| Photo Capture | Capture photos from iPad camera, preview, attach to job | HTML file input with `capture="environment"` attribute, client-side preview |
| Form Filler | Render dynamic form from AI-generated schema, collect field values | JSON-schema-driven form renderer with field type registry |
| Submission Engine | Compile form data + photos into email, send to office | Server-side API route that assembles email with Resend |
| AI Form Generator | Accept photo of paper form, return structured form schema | API route calling OpenAI Vision with structured output (JSON schema) |
| Blob Storage | Store job photos durably before and after submission | Vercel Blob with client-side upload tokens |
| Database | Persist jobs, form schemas, form responses, photo references | Turso (hosted SQLite) or Supabase Postgres |
| Email Service | Deliver compiled form + photo attachments to office email | Resend API with base64-encoded attachments |

## Recommended Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (viewport meta for iPad)
│   ├── page.tsx                # Job list / home screen
│   ├── jobs/
│   │   ├── [id]/
│   │   │   ├── page.tsx        # Single job view (photos + form + submit)
│   │   │   ├── photos/
│   │   │   │   └── page.tsx    # Photo capture/gallery for this job
│   │   │   └── form/
│   │   │       └── page.tsx    # Form filling for this job
│   │   └── new/
│   │       └── page.tsx        # Create new job
│   ├── admin/
│   │   └── form-template/
│   │       └── page.tsx        # Upload paper form photo -> AI generates template
│   ├── api/
│   │   ├── jobs/
│   │   │   └── route.ts        # Job CRUD
│   │   ├── photos/
│   │   │   ├── route.ts        # Photo metadata
│   │   │   └── upload/
│   │   │       └── route.ts    # Vercel Blob client token generation
│   │   ├── forms/
│   │   │   ├── generate/
│   │   │   │   └── route.ts    # AI form generation from photo
│   │   │   └── route.ts        # Form data save/load
│   │   └── submit/
│   │       └── route.ts        # Compile + email submission
│   └── manifest.ts             # PWA manifest
├── components/
│   ├── ui/                     # Shared UI primitives (buttons, inputs, cards)
│   ├── job-list.tsx            # Job listing component
│   ├── photo-capture.tsx       # Camera/file input + preview grid
│   ├── form-renderer.tsx       # Dynamic form renderer from JSON schema
│   ├── field-registry.tsx      # Maps field types to React components
│   └── submission-preview.tsx  # Review before sending
├── lib/
│   ├── db.ts                   # Database client + queries
│   ├── schema.ts               # Database schema (Drizzle ORM)
│   ├── ai.ts                   # OpenAI client + form generation prompt
│   ├── email.ts                # Resend client + email assembly
│   ├── blob.ts                 # Vercel Blob helpers
│   └── form-schema.ts         # Form JSON schema types + validation
├── types/
│   └── index.ts                # Shared TypeScript types
└── public/
    ├── icons/                  # PWA icons
    └── sw.js                   # Service worker (if needed)
```

### Structure Rationale

- **app/jobs/[id]/:** Feature-based routing. Each job is the central unit of work. Photos and form are sub-pages of a job, keeping the mental model simple: pick a job, then do things to it.
- **app/admin/form-template/:** Separated from the field worker flow. The boss uploads a paper form photo once; workers never touch this. Could be password-gated later.
- **app/api/:** Thin API routes that call into `lib/` functions. Keeps route handlers clean and business logic testable.
- **components/form-renderer.tsx + field-registry.tsx:** The form renderer is the most architecturally significant component. It takes a JSON schema and renders fields dynamically. The registry pattern maps field types (text, number, checkbox, date, signature, photo) to React components, making it extensible without modifying the renderer.
- **lib/:** All external service integrations isolated here. Easy to mock in tests, easy to swap implementations.

## Architectural Patterns

### Pattern 1: JSON Schema-Driven Form Rendering

**What:** Forms are defined as JSON schemas that describe field types, labels, validation rules, and layout. A single renderer component interprets the schema at runtime. The AI generates this same schema format when analyzing paper form photos.

**When to use:** Whenever the form structure is not known at build time -- which is the entire point of this app. The boss photographs a paper form, AI produces a schema, workers fill it out.

**Trade-offs:** More flexible than hardcoded forms, but requires building and testing the renderer. For this project, the trade-off is clearly worth it since the form structure literally comes from AI at runtime.

**Example:**
```typescript
// Form schema shape (what AI produces, what renderer consumes)
interface FormSchema {
  title: string;
  fields: FormField[];
}

interface FormField {
  id: string;
  type: "text" | "number" | "date" | "checkbox" | "select" | "textarea" | "photo";
  label: string;
  required: boolean;
  options?: string[];         // for select fields
  placeholder?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

// Renderer maps field.type -> React component via registry
const fieldRegistry: Record<FormField["type"], React.ComponentType<FieldProps>> = {
  text: TextField,
  number: NumberField,
  date: DateField,
  checkbox: CheckboxField,
  select: SelectField,
  textarea: TextAreaField,
  photo: PhotoField,
};
```

### Pattern 2: Client-Side Photo Upload with Server Tokens

**What:** Photos upload directly from the iPad to Vercel Blob storage. The browser requests a short-lived upload token from the server, then uploads directly to blob storage -- bypassing the 4.5MB Vercel serverless function body limit entirely.

**When to use:** Always for photo uploads in this app. Pool installation photos can be large (8-12MB from iPad cameras). Server-side upload would hit Vercel's body size limit.

**Trade-offs:** Slightly more complex than server upload (two-step: get token, then upload), but necessary for the file sizes involved. Vercel Blob handles multipart splitting automatically.

**Example:**
```typescript
// 1. Server: generate upload token (app/api/photos/upload/route.ts)
import { handleUpload } from "@vercel/blob/client";

export async function POST(request: Request) {
  const body = await request.json();
  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: ["image/jpeg", "image/png", "image/heic"],
      maximumSizeInBytes: 20 * 1024 * 1024, // 20MB
    }),
    onUploadCompleted: async ({ blob }) => {
      // Save blob URL to database, associate with job
    },
  });
  return Response.json(jsonResponse);
}

// 2. Client: upload photo directly to blob storage
import { upload } from "@vercel/blob/client";

const blob = await upload(file.name, file, {
  access: "public",
  handleUploadUrl: "/api/photos/upload",
  multipart: true,
});
```

### Pattern 3: Server Action for Email Submission

**What:** When the worker hits "Submit," a server action (or API route) fetches the form data and all photo blobs, assembles them into an email with attachments, and sends via Resend. This is purely server-side -- the client just triggers it with a job ID.

**When to use:** For the final submission step. Compiling photos as base64 attachments should happen server-side where there are no browser memory constraints and direct access to blob URLs.

**Trade-offs:** Submission may take a few seconds for jobs with many large photos. Show a progress indicator. Resend has a 40MB attachment limit per email, which should be sufficient for most jobs (plan for compression if needed).

## Data Flow

### Core Data Flows

```
[1] CREATE JOB
    Worker taps "New Job" → enters name/number → POST /api/jobs → DB insert → redirect to job page

[2] CAPTURE PHOTOS
    Worker taps camera icon → <input type="file" capture="environment"> → iPad camera opens
        → photo selected → client requests upload token from /api/photos/upload
        → client uploads directly to Vercel Blob → onUploadCompleted saves URL to DB
        → photo thumbnail appears in gallery

[3] GENERATE FORM TEMPLATE (one-time, by boss)
    Boss photographs paper form → uploads image → POST /api/forms/generate
        → server sends image to OpenAI Vision API with structured output prompt
        → AI returns FormSchema JSON → server saves to DB as the form template
        → boss previews/edits template fields if needed

[4] FILL OUT FORM
    Worker opens job → form page loads → GET /api/forms?jobId=X
        → if form response exists, load it; otherwise load blank template
        → form-renderer.tsx renders fields from schema
        → worker fills fields → auto-save or manual save → PUT /api/forms
        → form data saved to DB as JSON

[5] SUBMIT JOB
    Worker taps "Submit" → confirmation dialog → POST /api/submit
        → server loads job, form data, form schema, and photo blob URLs
        → server fetches each photo blob, converts to base64
        → server renders form data into HTML email body
        → server sends email via Resend with photo attachments
        → marks job as submitted in DB → worker sees confirmation
```

### State Management

This app is simple enough that server state (via React Query / SWR or just Next.js server components with revalidation) is sufficient. There is no complex client-side state to manage.

```
Server Components (default)
    ↓ (fetch data at render time)
Job list, job detail, form template display

Client Components (where interactivity needed)
    ↓ (useState / useActionState for local form state)
Photo capture, form filling, submission button
    ↓ (mutations via API routes or server actions)
Server → Database / Blob / Email
```

No Redux, no Zustand, no global state store needed. The job ID in the URL is the primary state selector.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-5 crews (target) | Monolith on Vercel. Single Turso DB. Vercel Blob for photos. Resend free tier (100 emails/day). This is the design point. |
| 5-20 crews | Same architecture holds. May want to add a job status filter. Resend paid tier if >100 submissions/day. |
| 20+ crews | Consider adding worker auth (Clerk or simple PIN codes). Consider job archival to keep list manageable. Still same architecture. |

### Scaling Priorities

1. **First bottleneck (unlikely):** Email sending rate. Resend free tier is 100 emails/day, 3000/month. If the crew submits more than ~3 jobs/day, upgrade to paid tier ($20/month for 50k emails).
2. **Second bottleneck (very unlikely):** Blob storage costs. Vercel Blob charges for storage + bandwidth. At ~5MB average per photo, 10 photos per job, 5 jobs/day = 250MB/day = ~7.5GB/month. Well within reasonable costs.

## Anti-Patterns

### Anti-Pattern 1: getUserMedia for Photo Capture

**What people do:** Use the WebRTC `getUserMedia()` API to access the camera, render a live video feed, then capture frames with a canvas element.
**Why it's wrong:** On iPad Safari (especially in PWA mode), getUserMedia has persistent permission issues -- permissions are not remembered between sessions, and the camera can fail silently. It also requires building custom camera UI (shutter button, preview, retake) that the native camera already handles perfectly.
**Do this instead:** Use `<input type="file" accept="image/*" capture="environment">`. This opens the native iPad camera app, which handles permissions, autofocus, HDR, and the full camera experience. The worker takes the photo in the familiar camera UI, and it returns to your app as a file. Simpler, more reliable, better UX.

### Anti-Pattern 2: Storing Photos in the Database

**What people do:** Convert photos to base64 and store them in the database, or store binary blobs directly.
**Why it's wrong:** Photos from iPad cameras are 3-12MB each. Base64 encoding adds 33% overhead. A job with 10 photos would bloat the DB by 40-160MB. Database queries slow down, backups become expensive, and you lose CDN delivery benefits.
**Do this instead:** Store photos in blob storage (Vercel Blob). Store only the URL reference in the database. Blob storage is purpose-built for large binary files, provides CDN delivery, and keeps the database lean.

### Anti-Pattern 3: Building a Custom Form Builder UI

**What people do:** Invest weeks building a drag-and-drop form builder so the boss can manually define form fields.
**Why it's wrong:** The boss already has the form -- it is printed on paper. The AI form generation feature exists specifically to avoid manual form building. A form builder adds massive complexity for a use case that is better served by "take a photo of the paper form."
**Do this instead:** Let AI generate the form schema from a photo. Provide a simple review/edit screen where the boss can tweak field labels, add/remove fields, or change field types after AI generation. This is 10% of the effort of a full builder and covers the real need.

### Anti-Pattern 4: Over-engineering Offline Support

**What people do:** Build complex sync engines with conflict resolution, IndexedDB caching, service worker queuing from day one.
**Why it's wrong:** The project explicitly scopes offline mode out ("can add later if field connectivity is an issue"). iOS PWA storage is limited to 50MB with aggressive 7-day cache expiry. Building offline-first on iOS Safari is fighting the platform.
**Do this instead:** Build online-first. If connectivity becomes a real problem in the field, add targeted offline support later: queue form submissions in localStorage for retry, cache the current job's form schema. Do not build a general-purpose sync engine.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OpenAI Vision API | Server-side only. API route sends base64 image + structured output schema. Returns form field definitions as JSON. | Use `gpt-4o` or `gpt-4o-mini` with `response_format` for reliable JSON. Vision + structured outputs are compatible. Cost: ~$0.01-0.05 per form generation. |
| Resend Email API | Server-side only. Assemble HTML email body from form data, attach photos as base64 buffers. | 40MB max per email. Free tier: 100 emails/day, 3000/month. Attachments passed as `{ filename, content: Buffer }`. |
| Vercel Blob | Client-side upload with server-generated tokens. Store URLs in DB. Fetch server-side for email attachment assembly. | 20MB per file limit (configurable). Supports HEIC from iPad. Public URLs for display, server fetch for email assembly. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Client pages <-> API routes | HTTP fetch / server actions | Standard Next.js pattern. Form data as JSON, photos as FormData or client upload. |
| API routes <-> lib/ services | Direct function calls | API routes are thin wrappers. Business logic lives in lib/. Testable without HTTP. |
| Form schema <-> Form renderer | JSON contract (FormSchema type) | The schema is the contract between AI generation and form rendering. Type it strictly. Breaking this contract breaks the app. |
| Submission <-> Email | Server-side assembly | The submit route orchestrates: load data, fetch blobs, format HTML, send email. Single responsibility but multiple service calls. |

## Critical Architectural Decision: PWA vs Plain Web App

**Recommendation: Start as a plain responsive web app. Add PWA incrementally if needed.**

Rationale:
- The v1 requirements do not need offline support, push notifications, or home screen installation.
- iOS/iPad PWA has real limitations: 50MB storage cap, 7-day cache expiry, camera permission quirks in standalone mode, and no background sync.
- A responsive web app in Safari works perfectly for camera capture, form filling, and submission.
- The boss can add a Safari bookmark to the home screen -- it opens in Safari with full functionality.
- If home screen presence becomes important later, adding a `manifest.json` and basic service worker is a small step, not an architectural change.

## Build Order (Dependency Chain)

The components have clear dependencies that dictate build order:

```
Phase 1: Foundation
  Database schema + Job CRUD
  ↓ (everything else needs jobs to exist)

Phase 2: Photos
  Photo capture UI + Blob upload + photo gallery
  ↓ (needed for both form generation and submission)

Phase 3: AI Form Generation
  OpenAI integration + form schema storage
  ↓ (must exist before workers can fill forms)

Phase 4: Form Rendering
  Dynamic form renderer + form data persistence
  ↓ (must exist before submission)

Phase 5: Submission
  Email assembly + Resend integration
  (depends on all of the above)
```

Each phase produces a usable increment:
1. After Phase 1: workers can create and manage jobs
2. After Phase 2: workers can capture and review photos per job
3. After Phase 3: boss can generate form templates from paper forms
4. After Phase 4: workers can fill out forms for each job
5. After Phase 5: complete workflow -- fill form, attach photos, email to office

## Sources

- [PWA iOS Limitations and Safari Support 2026](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) - iOS storage limits, camera permissions
- [Camera Access Issues in iOS PWA](https://kb.strich.io/article/29-camera-access-issues-in-ios-pwa) - getUserMedia problems in standalone mode
- [Vercel Blob Client Uploads](https://vercel.com/docs/vercel-blob/client-upload) - Client-side upload pattern
- [React JSONSchema Form](https://github.com/rjsf-team/react-jsonschema-form) - Schema-driven form rendering reference
- [Schema-Driven Forms Comparison](https://dev.to/yanggmtl/schema-driven-forms-in-react-comparing-rjsf-json-forms-uniforms-formio-and-formitiva-2fg2) - Form library comparison
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) - Vision + structured output compatibility
- [SendGrid Attachments with Node.js](https://www.twilio.com/en-us/blog/sending-email-attachments-with-sendgrid) - Email attachment patterns
- [Resend Email API](https://resend.com/docs/api-reference/emails/send-email) - Attachment support docs
- [SQLite vs Supabase for Solo Developers](https://solodevstack.com/blog/sqlite-vs-supabase-solo-developers) - Database comparison
- [Salesforce Field Service Data Model](https://developer.salesforce.com/docs/atlas.en-us.field_service_dev.meta/field_service_dev/fsl_dev_soap_core.htm) - Enterprise field service reference

---
*Architecture research for: Pool Field Forms -- iPad-first field service form app*
*Researched: 2026-03-25*
