"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { PhotoMetadata } from "@/lib/photos";
import type { FormData, FormField } from "@/lib/forms";

const Q108_ID = "108_additional_photos";
const UNASSIGNED = "UNASSIGNED";
const REVIEWED_FLAG = "__photoAssignmentsReviewed";

// Payload contract (v1):
//   key   = photo blob URL (stable per upload; legacy data may contain
//           duplicate filenames, so URL is the only reliable identity).
//   value = target field id | "UNASSIGNED" | "108_additional_photos"
//
// Persisted truth on save:
//   formData[<each non-Q108 photo field>] = assigned URL, or "" if unassigned
//   formData["__photoAssignmentsReviewed"] = true
// Q108 and UNASSIGNED are NOT persisted as field mappings — those photos
// drain into Q108 naturally via Pass 3 in generate-pdf.ts.
export type PhotoAssignments = Record<string, string>;

export async function savePhotoAssignments(
  jobId: string,
  assignments: PhotoAssignments,
): Promise<{ success: boolean; error?: string }> {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { template: true },
  });
  if (!job) return { success: false, error: "Job not found" };
  if (job.status !== "DRAFT") {
    return { success: false, error: "Only draft jobs can assign photos" };
  }

  const photos = (job.photos as PhotoMetadata[] | null) ?? [];
  const fields = (job.template?.fields as FormField[] | null) ?? [];
  const photoFieldIds = fields
    .filter((f) => f.type === "photo" && f.id !== Q108_ID)
    .map((f) => f.id);
  const photoFieldSet = new Set(photoFieldIds);
  const photoUrlSet = new Set(photos.map((p) => p.url));

  for (const [url, target] of Object.entries(assignments)) {
    if (!photoUrlSet.has(url)) {
      return { success: false, error: "Unknown photo in payload" };
    }
    if (
      target !== UNASSIGNED &&
      target !== Q108_ID &&
      !photoFieldSet.has(target)
    ) {
      return { success: false, error: `Unknown assignment target: ${target}` };
    }
  }

  // Invert: field → url. First assignment wins if UI ever produces a collision.
  const fieldToUrl = new Map<string, string>();
  for (const [url, target] of Object.entries(assignments)) {
    if (target === UNASSIGNED || target === Q108_ID) continue;
    if (fieldToUrl.has(target)) continue;
    fieldToUrl.set(target, url);
  }

  // Deterministic rewrite: every non-Q108 photo field gets the chosen URL or "".
  // Preserves non-photo formData entries untouched.
  const existing = (job.formData as FormData | null) ?? {};
  const next: FormData = { ...existing };
  for (const fieldId of photoFieldIds) {
    next[fieldId] = fieldToUrl.get(fieldId) ?? "";
  }
  next[REVIEWED_FLAG] = true;

  const updated = await db.job.updateMany({
    where: { id: jobId, status: "DRAFT" },
    data: { formData: next as unknown as object },
  });
  if (updated.count === 0) {
    return { success: false, error: "Job is no longer editable" };
  }

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin");
  return { success: true };
}
