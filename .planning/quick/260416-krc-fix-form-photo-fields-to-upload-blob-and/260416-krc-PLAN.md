---
quick_id: 260416-krc
description: fix form photo fields to upload blob and populate job photos
date: 2026-04-16
status: ready
must_haves:
  truths:
    - Tapping a photo field in the job form uploads the photo to Vercel Blob
    - savePhotoMetadata is called so job.photos is populated
    - form field value stores the blob URL (truthy — keeps "(photo attached)" display in PDF)
    - Loading spinner shown during upload, input disabled while uploading
    - Upload error shows toast and leaves field empty so user can retry
    - Existing PhotoUpload component unchanged
    - All other field types unchanged
  artifacts:
    - pool-app/src/components/job-form.tsx (modified)
---

# Quick Task 260416-krc: Fix Form Photo Fields to Upload to Blob

## Root Cause

`job-form.tsx` photo case (line ~449) only runs `rhf.onChange(file.name)` — stores filename
in formData, never uploads to Vercel Blob, never calls `savePhotoMetadata`. So `job.photos`
stays `[]` and the PDF photo appendix (which reads `job.photos`) never fires.

## Task 1: Extract PhotoFieldInput component and wire real upload

**File:** `pool-app/src/components/job-form.tsx`

### New imports to add at top:
```typescript
import imageCompression from "browser-image-compression";
import { COMPRESSION_OPTIONS } from "@/lib/photos";
import { savePhotoMetadata } from "@/lib/actions/photos";
import { toast } from "sonner";
```

### Add `jobId` to FieldRenderer props:
```typescript
function FieldRenderer({
  field,
  register,
  control,
  errors,
  disabled = false,
  jobId,
}: {
  field: FormField;
  register: UseFormRegister<FormData>;
  control: Control<FormData>;
  errors: FieldErrors<FormData>;
  disabled?: boolean;
  jobId: string;
})
```

### Pass jobId in the fields.map() call inside JobForm:
```tsx
<FieldRenderer
  field={field}
  register={register}
  control={control}
  errors={errors}
  disabled={disabled}
  jobId={jobId}
/>
```

### Add PhotoFieldInput component (BEFORE FieldRenderer in the file):

```typescript
function PhotoFieldInput({
  field,
  control,
  errors,
  disabled,
  jobId,
}: {
  field: FormField;
  control: Control<FormData>;
  errors: FieldErrors<FormData>;
  disabled: boolean;
  jobId: string;
}) {
  const [uploading, setUploading] = useState(false);
  const error = errors[field.id]?.message as string | undefined;
  const fieldId = `field-${field.id}`;

  return (
    <Controller
      name={field.id}
      control={control}
      render={({ field: rhf }) => (
        <div className="space-y-2">
          <Label htmlFor={fieldId} className="text-base">
            {field.label}
            {field.required && <span className="ml-0.5 text-red-500">*</span>}
          </Label>
          {rhf.value ? (
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-green-700">
              <Camera className="size-4" />
              Photo captured
            </div>
          ) : (
            <label className="flex min-h-[100px] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 p-6 active:bg-zinc-100">
              {uploading ? (
                <>
                  <Loader2 className="size-8 text-zinc-400 animate-spin" />
                  <span className="text-sm text-zinc-500">Uploading...</span>
                </>
              ) : (
                <>
                  <Camera className="size-8 text-zinc-400" />
                  <span className="text-sm text-zinc-500">Tap to take photo</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                disabled={disabled || uploading}
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
                    const fd = new FormData();
                    fd.append("file", compressed);
                    fd.append("filename", file.name.replace(/[^a-zA-Z0-9._-]/g, "_"));
                    const resp = await fetch("/api/photos/upload", { method: "POST", body: fd });
                    if (!resp.ok) throw new Error("Upload failed");
                    const { url } = await resp.json();
                    rhf.onChange(url);
                    await savePhotoMetadata(jobId, { url, filename: file.name, size: compressed.size });
                  } catch (err) {
                    toast.error(`Photo upload failed: ${err instanceof Error ? err.message : "Unknown error"}`);
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    />
  );
}
```

### Update photo case in FieldRenderer switch:
```typescript
case "photo":
  return (
    <PhotoFieldInput
      field={field}
      control={control}
      errors={errors}
      disabled={disabled}
      jobId={jobId}
    />
  );
```

**done:** Form photo fields now upload to Vercel Blob, call savePhotoMetadata, and store the URL as the field value — so job.photos is populated at submit time and the PDF appendix renders real photos.

## Notes

- `imageCompression` and `COMPRESSION_OPTIONS` are already in the project (used by PhotoUpload)
- `savePhotoMetadata` is already in `@/lib/actions/photos`
- The `toast` import: check if sonner is already imported — if not, add it
- React hook rules: `useState` cannot be in a switch-case. The `PhotoFieldInput` is a separate component that satisfies this.
- Old jobs with `formData[photoFieldId] = "some-filename"` (not a URL): still show "(photo attached)" in PDF form section — that's fine, no data migration needed
- Do NOT touch PhotoUpload component, generate-pdf.ts, or any other file
