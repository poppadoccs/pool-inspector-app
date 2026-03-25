# Phase 2: Photo Capture - Research

**Researched:** 2026-03-25
**Domain:** Client-side photo capture, compression, HEIC conversion, Vercel Blob upload, gallery UI
**Confidence:** HIGH

## Summary

Phase 2 adds photo capture, client-side compression, HEIC-to-JPEG conversion, Vercel Blob upload, and a thumbnail gallery with enlarge/delete to the existing job detail page. The existing codebase has a `photos Json @default("[]")` field on the Job model and a placeholder "Photos" card on `jobs/[id]/page.tsx` ready to be replaced.

The two core libraries are `@vercel/blob` (v2.3.1) for client-side upload that bypasses the 4.5MB Vercel serverless body limit, and `browser-image-compression` (v2.0.2) for Canvas-based compression. A critical finding: `browser-image-compression` does NOT handle HEIC input -- it only supports JPEG, PNG, WebP, and BMP. HEIC-to-JPEG conversion requires either (a) relying on Safari's auto-conversion behavior when `accept` does not include `image/heic`, or (b) using the `heic2any` library (v0.0.4) as a fallback for edge cases. The recommended approach is a defensive pipeline: check the file type after selection, convert HEIC if detected, then compress.

**Primary recommendation:** Use a two-step client pipeline -- detect HEIC and convert with canvas/heic2any first, then compress with browser-image-compression -- before uploading to Vercel Blob via client upload with `handleUpload` token exchange. Store blob URLs as JSON array in the existing `photos` field. Skip `onUploadCompleted` callback (unreliable in local dev) and instead save metadata to DB via a separate server action after upload completes client-side.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Native HTML `<input type="file" accept="image/*" capture="environment">` for camera -- opens iPad camera directly, most reliable on Safari
- `multiple` attribute to allow selecting several photos at once from library
- Vercel Blob via client-side upload -- bypasses 4.5MB server body limit for large iPad photos
- `browser-image-compression` library for client-side compression and HEIC-to-JPEG conversion
- Max 1MB per photo, 80% quality JPEG -- good for field documentation, keeps email under limits
- HEIC converted to JPEG client-side during compression step
- Responsive thumbnail grid (3-4 per row on iPad) for quick visual scan
- Tap thumbnail to full-screen overlay with close button for enlarging
- Delete icon on each thumbnail -- deliberate action, hard to do accidentally
- Progress bar per photo during upload -- worker knows something is happening

### Claude's Discretion
- Vercel Blob configuration and token generation
- Photo metadata storage in database (blob URL, original filename, size)
- Exact component structure for gallery and upload
- Error handling for failed uploads

### Deferred Ideas (OUT OF SCOPE)
- Photo categorization (Before/During/After) -- v2 feature
- Photo reordering -- not needed for v1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PHOT-01 | Worker can take photos using iPad camera within the app | HTML `<input type="file" accept="image/*" capture="environment">` opens native iPad camera. Verified via MDN and Apple Developer docs. |
| PHOT-02 | Worker can attach existing photos from iPad photo library | Same `<input>` with `multiple` attribute (without `capture`) allows photo library selection. Two separate inputs recommended. |
| PHOT-03 | Worker can view a photo gallery for each job (thumbnails, tap to enlarge) | Blob URLs stored in DB `photos` JSON field; render as `<img>` grid. Full-screen overlay on tap using dialog/portal. |
| PHOT-04 | Worker can delete a photo from a job before submission | Server action calls `del()` from `@vercel/blob` to remove blob, then updates DB `photos` array. |
| PHOT-05 | Photos are compressed client-side before upload (iPad photos are 5-12MB) | `browser-image-compression` v2.0.2 with `maxSizeMB: 1`, `maxWidthOrHeight: 1920`, `initialQuality: 0.8`. |
| PHOT-06 | HEIC photos are converted to JPEG for Windows compatibility | Safari auto-converts when `accept` excludes `image/heic`. Defensive check: if file.type is still `image/heic`, use Canvas `toBlob('image/jpeg')` or `heic2any` fallback. `browser-image-compression` `fileType: 'image/jpeg'` forces JPEG output. |
</phase_requirements>

## Standard Stack

### Core (Phase 2 additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@vercel/blob` | 2.3.1 | Photo storage + client upload | Official Vercel storage. Client upload (`upload()` from `@vercel/blob/client`) bypasses 4.5MB serverless limit. `handleUpload()` server helper generates tokens. `del()` for deletion. `onUploadProgress` callback for progress bars. |
| `browser-image-compression` | 2.0.2 | Client-side JPEG compression | Canvas-based compression. `maxSizeMB`, `maxWidthOrHeight`, `initialQuality`, `fileType` options. Returns a File object. Uses Web Workers by default. ~12KB. |
| `heic2any` | 0.0.4 | HEIC-to-JPEG fallback conversion | Client-side HEIC decoder for edge cases where Safari does not auto-convert. Converts HEIC Blob to JPEG/PNG Blob. Last published 3 years ago but still works -- HEIC format is stable. Only needed as defensive fallback. |

### Already Installed (from Phase 1)

| Library | Version | Used For in Phase 2 |
|---------|---------|---------------------|
| `sonner` | 2.0.7 | Toast notifications for upload success/failure |
| `lucide-react` | 1.6.0 | Camera, Trash2, X, ImagePlus icons |
| `zod` | 4.3.6 | Validation of photo metadata shape |
| `shadcn/ui` components | CLI v4 | Card, Button, Dialog (for enlarge overlay) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `heic2any` | `heic-to` (newer fork) | `heic-to` is more actively maintained but less proven. `heic2any` has 400K+ weekly downloads and works for this use case. Either is acceptable. |
| `@vercel/blob` client upload | Server-side `put()` with FormData | Would hit 4.5MB body limit on Vercel. Client upload is required for iPad photos. |
| Storing photos as separate DB model | JSON array on Job model | Separate model is more normalized but overkill for v1. The `photos Json` field is already in the schema. JSON array of objects with `{url, filename, size, uploadedAt}` is sufficient. |

**Installation:**
```bash
cd pool-app
npm install @vercel/blob browser-image-compression heic2any
```

**Version verification:** `@vercel/blob` 2.3.1 (verified via npm registry 2026-03-25), `browser-image-compression` 2.0.2 (verified), `heic2any` 0.0.4 (verified).

## Architecture Patterns

### Recommended Component Structure

```
pool-app/src/
  app/
    api/
      photos/
        upload/
          route.ts          # handleUpload() token exchange + onUploadCompleted
    jobs/
      [id]/
        page.tsx            # Updated: renders PhotoGallery, fetches job with photos
  components/
    photo-upload.tsx        # "use client" - file input, compression, upload logic
    photo-gallery.tsx       # "use client" - thumbnail grid + enlarge overlay + delete
    photo-lightbox.tsx      # "use client" - full-screen overlay for enlarged photo
  lib/
    actions/
      photos.ts            # Server actions: savePhotoMetadata, deletePhoto
    photos.ts              # Shared types, compression helper, HEIC detection
```

### Pattern 1: Client-Side Compression Pipeline

**What:** A sequential pipeline that processes each selected file: detect format, convert HEIC if needed, compress to JPEG, then upload to Vercel Blob.

**When to use:** Every time a user selects or captures photos.

**Example:**
```typescript
// Source: Vercel Blob docs + browser-image-compression docs
import imageCompression from "browser-image-compression";
import { upload } from "@vercel/blob/client";

async function processAndUpload(
  file: File,
  jobId: string,
  onProgress: (pct: number) => void
) {
  // Step 1: HEIC detection and conversion
  let processableFile = file;
  if (file.type === "image/heic" || file.type === "image/heif") {
    const heic2any = (await import("heic2any")).default;
    const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
    processableFile = new File(
      [blob as Blob],
      file.name.replace(/\.heic$/i, ".jpg"),
      { type: "image/jpeg" }
    );
  }

  // Step 2: Compress
  const compressed = await imageCompression(processableFile, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    initialQuality: 0.8,
    fileType: "image/jpeg",
    useWebWorker: true,
  });

  // Step 3: Upload to Vercel Blob
  const result = await upload(compressed.name, compressed, {
    access: "public",
    handleUploadUrl: "/api/photos/upload",
    clientPayload: JSON.stringify({ jobId }),
    onUploadProgress: ({ percentage }) => onProgress(percentage),
  });

  return result; // { url, pathname, contentType, downloadUrl }
}
```

### Pattern 2: Token Exchange Route (Server)

**What:** API route that generates upload tokens and handles upload completion callbacks.

**When to use:** Required by `@vercel/blob` client upload flow.

**Example:**
```typescript
// Source: Vercel Blob client upload docs (verified 2026-03-25)
// app/api/photos/upload/route.ts
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: 5 * 1024 * 1024, // 5MB after compression
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({}),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // NOTE: This callback does NOT work in local dev (requires public URL).
        // Database update is handled client-side via server action instead.
        console.log("Upload completed:", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
```

### Pattern 3: Server Action for Photo Metadata (Bypassing onUploadCompleted)

**What:** After client upload succeeds, call a server action to persist the blob URL to the database. This avoids reliance on the `onUploadCompleted` webhook which does not work in local development.

**When to use:** After every successful upload, called from the client component.

**Example:**
```typescript
// Source: Existing server action pattern from lib/actions/jobs.ts
// lib/actions/photos.ts
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";

export async function savePhotoMetadata(
  jobId: string,
  photo: { url: string; filename: string; size: number }
) {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");

  const photos = (job.photos as Array<Record<string, unknown>>) || [];
  photos.push({
    url: photo.url,
    filename: photo.filename,
    size: photo.size,
    uploadedAt: new Date().toISOString(),
  });

  await db.job.update({
    where: { id: jobId },
    data: { photos },
  });

  revalidatePath(`/jobs/${jobId}`);
}

export async function deletePhoto(jobId: string, photoUrl: string) {
  // Delete from Vercel Blob
  await del(photoUrl);

  // Remove from DB
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");

  const photos = (job.photos as Array<{ url: string }>) || [];
  const filtered = photos.filter((p) => p.url !== photoUrl);

  await db.job.update({
    where: { id: jobId },
    data: { photos: filtered },
  });

  revalidatePath(`/jobs/${jobId}`);
}
```

### Anti-Patterns to Avoid

- **getUserMedia / WebRTC for camera:** Do NOT use `navigator.mediaDevices.getUserMedia()`. iPad Safari in web app mode has persistent camera permission issues. The native `<input type="file" capture="environment">` opens the familiar camera UI, handles permissions automatically, and works reliably.
- **Server-side upload for photos:** Do NOT upload photos through server actions or API routes using FormData. iPad photos are 5-12MB, Vercel's serverless body limit is 4.5MB. Must use client-side upload to Vercel Blob.
- **Relying on onUploadCompleted for DB updates:** This webhook does NOT work in local development (Vercel cannot reach localhost). Save metadata via server action from the client after upload succeeds.
- **Storing base64 in database:** Do NOT store photo data in the database. Store blob URLs only. Photos would bloat the DB (10 photos at 1MB each = 10MB per job).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Image compression | Canvas-based compression loop | `browser-image-compression` | Handles quality iteration, web workers, max dimension scaling, output format conversion. 100+ edge cases in browser canvas APIs. |
| HEIC decoding | HEIC binary parser | `heic2any` (fallback only) | HEIC container format is complex (based on ISOBMFF). Safari usually auto-converts but edge cases exist. |
| File upload with progress | XMLHttpRequest / fetch with ReadableStream | `@vercel/blob` client `upload()` with `onUploadProgress` | Handles token exchange, multipart splitting, retry logic, progress reporting. |
| Lightbox / image overlay | Custom portal + scroll lock + gesture handling | shadcn Dialog component | Already in the project. Handles scroll lock, focus trap, escape key, overlay backdrop. |
| Photo deletion from blob store | Custom HTTP DELETE to blob URL | `del()` from `@vercel/blob` | Handles authentication, retries. One-liner. |

## Common Pitfalls

### Pitfall 1: HEIC Files Reaching the Server/Email

**What goes wrong:** iPad cameras default to HEIC. If conversion fails silently, HEIC files get stored and later attached to emails that Windows PCs cannot open.
**Why it happens:** `browser-image-compression` does NOT decode HEIC. It can only set `fileType: 'image/jpeg'` on files it CAN read (JPEG, PNG, WebP, BMP). If a raw HEIC file is passed, compression will fail or produce garbage.
**How to avoid:** Defensive pipeline: (1) Check `file.type` after selection, (2) if HEIC/HEIF, convert with `heic2any` or canvas first, (3) then compress. Also set `accept="image/jpeg,image/png"` on the file input (Safari will auto-convert from HEIC in most cases when HEIC is not in accept). Validate file type BEFORE upload.
**Warning signs:** `.heic` extensions in blob storage, office staff reporting broken photo attachments.

### Pitfall 2: onUploadCompleted Not Firing in Development

**What goes wrong:** The `onUploadCompleted` webhook in `handleUpload()` is called by Vercel's servers BACK to your app. In local dev, Vercel cannot reach `localhost:3000`.
**Why it happens:** This is by design -- Vercel Blob sends an HTTP request to your callback URL, which must be publicly accessible.
**How to avoid:** Do NOT rely on `onUploadCompleted` for critical operations (like saving to DB). Instead, after the client `upload()` promise resolves, call a server action to save the blob URL to the database. The `onUploadCompleted` can be a no-op or a logging step.
**Warning signs:** Photos upload successfully but never appear in the gallery in local development.

### Pitfall 3: No Upload Progress on Cellular

**What goes wrong:** Workers on job sites often have slow cellular (3G/LTE). A 1MB photo upload takes 5-15 seconds with no visible feedback. Workers tap the button again, creating duplicates, or assume the app is broken.
**Why it happens:** Default upload implementations show no progress indicator.
**How to avoid:** Use the `onUploadProgress` callback from `@vercel/blob` client `upload()`. Show a per-photo progress bar. Disable the upload button during active uploads. Show a count ("Uploading 2 of 5...").
**Warning signs:** Duplicate photos in gallery, workers complaining app is "slow" or "stuck."

### Pitfall 4: Memory Pressure When Processing Multiple Large Photos

**What goes wrong:** Worker selects 10 photos at once (each 8-12MB). Browser-image-compression processes them all simultaneously, each creating a canvas element. iPad Safari runs out of memory and reloads the tab, losing all progress.
**Why it happens:** `Promise.all()` on 10 concurrent compression operations. Each canvas for a 12MP image uses ~48MB of memory.
**How to avoid:** Process photos sequentially, not in parallel. Use a queue that compresses and uploads one photo at a time (or at most 2-3 concurrent). Show individual progress for each photo in the queue.
**Warning signs:** Safari tab reloading during multi-photo upload, "A problem occurred with this webpage" error on iPad.

### Pitfall 5: File Input `accept` Attribute and HEIC Behavior

**What goes wrong:** Using `accept="image/*"` or including `image/heic` in the accept list causes Safari 17+ to sometimes deliver HEIC files that other browsers cannot display. Conversely, being too restrictive prevents photo selection entirely.
**Why it happens:** Safari 17+ changed HEIC auto-conversion behavior. When `image/heic` is in the `accept` attribute, Safari delivers HEIC as-is. When only `image/jpeg,image/png` is listed, Safari auto-converts to JPEG.
**How to avoid:** Use `accept="image/jpeg,image/png,image/webp"` (explicitly exclude HEIC). Safari will auto-convert captured photos to JPEG. Still add defensive HEIC detection in code as a safety net. For the camera input with `capture="environment"`, this works reliably.
**Warning signs:** `file.type === "image/heic"` appearing in logs despite accept attribute.

## Code Examples

### Photo Upload Component (Client)

```typescript
// Source: Vercel Blob docs (upload + onUploadProgress) + browser-image-compression docs
// components/photo-upload.tsx
"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { upload } from "@vercel/blob/client";
import imageCompression from "browser-image-compression";
import { savePhotoMetadata } from "@/lib/actions/photos";
import { toast } from "sonner";

type UploadStatus = {
  filename: string;
  progress: number;
  status: "compressing" | "uploading" | "done" | "error";
};

export function PhotoUpload({ jobId }: { jobId: string }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<UploadStatus[]>([]);

  async function handleFiles(files: FileList) {
    // Process sequentially to avoid memory pressure
    for (const file of Array.from(files)) {
      const status: UploadStatus = {
        filename: file.name,
        progress: 0,
        status: "compressing",
      };
      setUploads((prev) => [...prev, status]);

      try {
        // Step 1: HEIC conversion if needed
        let processable = file;
        if (file.type === "image/heic" || file.type === "image/heif") {
          const heic2any = (await import("heic2any")).default;
          const blob = await heic2any({
            blob: file,
            toType: "image/jpeg",
            quality: 0.8,
          });
          processable = new File(
            [blob as Blob],
            file.name.replace(/\.heic$/i, ".jpg"),
            { type: "image/jpeg" }
          );
        }

        // Step 2: Compress
        const compressed = await imageCompression(processable, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          initialQuality: 0.8,
          fileType: "image/jpeg",
          useWebWorker: true,
        });

        // Step 3: Upload
        updateStatus(file.name, { status: "uploading" });
        const result = await upload(compressed.name, compressed, {
          access: "public",
          handleUploadUrl: "/api/photos/upload",
          clientPayload: JSON.stringify({ jobId }),
          onUploadProgress: ({ percentage }) => {
            updateStatus(file.name, { progress: percentage });
          },
        });

        // Step 4: Save metadata via server action
        await savePhotoMetadata(jobId, {
          url: result.url,
          filename: file.name,
          size: compressed.size,
        });

        updateStatus(file.name, { status: "done", progress: 100 });
      } catch (err) {
        updateStatus(file.name, { status: "error" });
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  }

  function updateStatus(
    filename: string,
    update: Partial<UploadStatus>
  ) {
    setUploads((prev) =>
      prev.map((u) => (u.filename === filename ? { ...u, ...update } : u))
    );
  }

  return (
    <div className="space-y-3">
      {/* Hidden file inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex-1 min-h-[56px] text-lg gap-2"
        >
          <Camera className="size-5" />
          Take Photo
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => libraryRef.current?.click()}
          className="flex-1 min-h-[56px] text-lg gap-2"
        >
          <ImagePlus className="size-5" />
          From Library
        </Button>
      </div>

      {/* Upload progress */}
      {uploads.filter((u) => u.status !== "done").map((u) => (
        <div key={u.filename} className="text-base text-zinc-600">
          <p>{u.filename}: {u.status}</p>
          {u.status === "uploading" && (
            <div className="h-2 w-full rounded-full bg-zinc-200">
              <div
                className="h-2 rounded-full bg-zinc-900 transition-all"
                style={{ width: `${u.progress}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Photo Deletion (Server Action)

```typescript
// Source: @vercel/blob del() docs (verified 2026-03-25)
import { del } from "@vercel/blob";

// del() accepts a single URL string or array of URL strings
// Returns void. Does not throw if blob URL does not exist.
await del(photoUrl);

// For batch deletion:
await del([url1, url2, url3]);
```

### Photo Type for JSON Field

```typescript
// lib/photos.ts -- shared type
export type PhotoMetadata = {
  url: string;        // Vercel Blob URL
  filename: string;   // Original filename
  size: number;       // Size in bytes (after compression)
  uploadedAt: string; // ISO date string
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server upload via FormData | Client upload via `@vercel/blob/client` `upload()` | @vercel/blob v0.x -> 2.x | Critical for this project. Server upload hits 4.5MB limit. Client upload handles token exchange automatically. |
| `addRandomSuffix` defaults to `true` | `addRandomSuffix` defaults to `false` (for `put()`) | @vercel/blob recent versions | Must explicitly pass `addRandomSuffix: true` in `handleUpload` to avoid filename collisions. Client upload via `handleUpload` still defaults to `true` in `onBeforeGenerateToken`. |
| `onUploadProgress` not available | `onUploadProgress` callback on client `upload()` | @vercel/blob 2.x | Enables per-photo progress bars without custom XHR. |
| `PutBlobResult` had no `downloadUrl` | Result now includes `downloadUrl` field | @vercel/blob 2.x | Can use `downloadUrl` for email attachments in Phase 5. |

**Deprecated/outdated:**
- `multer` / Express middleware: Not needed. Vercel Blob client upload handles everything.
- `react-webcam` / `getUserMedia`: Not needed. HTML file input with `capture` is more reliable on iPad.

## Open Questions

1. **HEIC edge case frequency in production**
   - What we know: Safari auto-converts HEIC to JPEG when `accept` excludes `image/heic`. This covers the common case.
   - What's unclear: How often does a HEIC file slip through anyway (e.g., photo library selection on older iOS versions)?
   - Recommendation: Add defensive HEIC detection. Dynamically import `heic2any` only when needed (it is ~200KB). If HEIC detection triggers in production logs, consider making the fallback more robust.

2. **Vercel Blob store setup**
   - What we know: Requires `BLOB_READ_WRITE_TOKEN` env var, created via Vercel dashboard.
   - What's unclear: Whether the Vercel project already has a Blob store provisioned.
   - Recommendation: First task in the plan should include checking/creating the Blob store and pulling the env var. Document this clearly as a manual setup step.

3. **Photo count per job**
   - What we know: Typical pool job might have 5-15 photos. JSON array in `photos` field handles this fine.
   - What's unclear: Whether any jobs might have 30+ photos.
   - Recommendation: No limit in v1, but add a soft warning at 20 photos ("This job has a lot of photos, which may slow email delivery"). Can enforce a hard limit later if needed.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + dev server | Assumed (Next.js already running from Phase 1) | -- | -- |
| Vercel Blob store | Photo storage | Needs provisioning | -- | Must create via Vercel dashboard |
| `BLOB_READ_WRITE_TOKEN` | @vercel/blob SDK | Needs env var | -- | `vercel env pull` after store creation |
| `@vercel/blob` | Photo upload/delete | Not yet installed | 2.3.1 | Must `npm install` |
| `browser-image-compression` | Client compression | Not yet installed | 2.0.2 | Must `npm install` |
| `heic2any` | HEIC fallback | Not yet installed | 0.0.4 | Must `npm install` |

**Missing dependencies with no fallback:**
- Vercel Blob store must be provisioned before photo upload works. This is a manual step in the Vercel dashboard.
- `BLOB_READ_WRITE_TOKEN` env var must exist locally (via `vercel env pull`) and in deployed environments.

**Missing dependencies with fallback:**
- None. All npm packages can be installed directly.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `pool-app/vitest.config.ts` |
| Quick run command | `cd pool-app && npm test` |
| Full suite command | `cd pool-app && npm test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PHOT-01 | Camera file input opens with capture attribute | unit (render check) | `cd pool-app && npx vitest run src/__tests__/components/photo-upload.test.ts -x` | Wave 0 |
| PHOT-02 | Library file input allows multiple selection | unit (render check) | Same file as PHOT-01 | Wave 0 |
| PHOT-03 | Gallery renders thumbnails and enlarge overlay | unit | `cd pool-app && npx vitest run src/__tests__/components/photo-gallery.test.ts -x` | Wave 0 |
| PHOT-04 | Delete action removes photo from blob + DB | unit (mock blob + db) | `cd pool-app && npx vitest run src/__tests__/actions/photos.test.ts -x` | Wave 0 |
| PHOT-05 | Compression reduces file size to under 1MB | unit (mock imageCompression) | `cd pool-app && npx vitest run src/__tests__/lib/photos.test.ts -x` | Wave 0 |
| PHOT-06 | HEIC file detected and converted before compression | unit | Same file as PHOT-05 | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd pool-app && npm test`
- **Per wave merge:** `cd pool-app && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/components/photo-upload.test.ts` -- covers PHOT-01, PHOT-02
- [ ] `src/__tests__/components/photo-gallery.test.ts` -- covers PHOT-03
- [ ] `src/__tests__/actions/photos.test.ts` -- covers PHOT-04 (mock `@vercel/blob` `del()` and Prisma)
- [ ] `src/__tests__/lib/photos.test.ts` -- covers PHOT-05, PHOT-06 (mock `browser-image-compression` and `heic2any`)

## Project Constraints (from CLAUDE.md)

- **Next.js 16.2 with breaking changes:** AGENTS.md warns that APIs differ from training data. Must verify Next.js API usage against `node_modules/next/dist/docs/` before writing code.
- **Prisma 7 with driver adapter:** Uses `@prisma/adapter-neon`, imports from `@/generated/prisma/client`.
- **Server Actions pattern:** Follow `lib/actions/jobs.ts` pattern -- `"use server"` directive, Zod validation, `revalidatePath()`.
- **useActionState for forms:** Follow `create-job-form.tsx` pattern for client components with server actions.
- **iPad design tokens:** Use `min-h-[48px]` / `min-h-[56px]` for touch targets, `text-base` / `text-lg` for readability. Already established in Phase 1 components.
- **shadcn/ui components:** Use existing `Button`, `Card`, `CardContent`, `Input`, `Separator`. May need to add `Dialog` for lightbox.
- **Vitest for testing:** Follow `__tests__/actions/jobs.test.ts` pattern -- `vi.mock()` for external deps, mock Prisma client.
- **GSD workflow enforcement:** All code changes through GSD commands, no direct edits outside workflow.
- **`force-dynamic` for DB pages:** Pages with DB queries need `export const dynamic = "force-dynamic"` (already on home page, already server component on job detail page).
- **Async params in Next.js 15+:** `params` is a Promise -- must `await params` (already done in `jobs/[id]/page.tsx`).

## Sources

### Primary (HIGH confidence)
- [Vercel Blob Client Upload Docs](https://vercel.com/docs/vercel-blob/client-upload) -- `handleUpload`, `upload()`, `onBeforeGenerateToken`, `onUploadCompleted` behavior, local dev limitation
- [Vercel Blob SDK Reference](https://vercel.com/docs/vercel-blob/using-blob-sdk) -- `put()`, `del()`, `head()`, `list()`, `copy()`, `upload()`, `handleUpload()` full API reference with parameter tables
- [@vercel/blob npm registry](https://www.npmjs.com/package/@vercel/blob) -- version 2.3.1 confirmed
- [browser-image-compression GitHub](https://github.com/Donaldcwl/browser-image-compression) -- full API: `maxSizeMB`, `maxWidthOrHeight`, `initialQuality`, `fileType`, `useWebWorker`, `onProgress`, `alwaysKeepResolution`. Does NOT support HEIC input.
- [browser-image-compression npm](https://www.npmjs.com/package/browser-image-compression) -- version 2.0.2 confirmed
- [MDN HTML capture attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/capture) -- `capture="environment"` for rear camera

### Secondary (MEDIUM confidence)
- [Apple Developer Forums: Safari 17+ HEIC auto-conversion](https://developer.apple.com/forums/thread/743049) -- Safari auto-converts HEIC to JPEG when `accept` excludes `image/heic`. Behavior changed in Safari 17+.
- [heic2any GitHub](https://github.com/alexcorvi/heic2any) -- client-side HEIC to JPEG/PNG conversion, v0.0.4
- [Vercel Storage GitHub Issues #432, #444](https://github.com/vercel/storage/issues/432) -- `onUploadCompleted` not working in local dev is a known limitation

### Tertiary (LOW confidence)
- Safari HEIC edge case frequency -- based on community reports, not measured. Defensive coding recommended.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- `@vercel/blob` and `browser-image-compression` are well-documented, verified against official docs and npm registry
- Architecture: HIGH -- follows established Phase 1 patterns (server actions, component structure, Prisma)
- Pitfalls: HIGH -- HEIC behavior verified via Apple Developer Forums, onUploadCompleted limitation verified via Vercel GitHub issues
- HEIC conversion approach: MEDIUM -- Safari auto-conversion covers most cases, `heic2any` fallback is defensive but untested on current iPad hardware

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (30 days -- libraries are stable)
