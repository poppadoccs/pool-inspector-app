"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { FormData } from "@/lib/forms";

// Autosave writer for the job-form RHF state. See plan 260417-mpf §AUTOSAVE-PRESERVE.
//
// Invariants this function enforces:
//   1. Fresh DB read on every call — the source of truth for reserved `__` keys
//      is the database, never a client-held snapshot or the RHF state.
//   2. Submitted-job immunity — a status flip between page-load and autosave
//      MUST NOT corrupt the submitted record. Guarded by `updateMany` with
//      `status: "DRAFT"`, so the guard is atomic with the write.
//   3. Reserved keys (prefix `__`) are owned by dedicated server actions
//      (assignMultiFieldPhotos, savePhotoAssignments, saveSummaryItems).
//      This channel strips any `__` key from the client payload before merge,
//      so RHF can never overwrite them even if something in the client
//      accidentally serialized one.
//   4. `undefined` RHF values are filtered (never written), so a missing RHF
//      key can't delete a DB value.
export async function saveFormData(jobId: string, formData: FormData) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { template: true },
  });
  if (!job) throw new Error("Job not found");
  if (job.status !== "DRAFT") {
    throw new Error("Job is no longer editable");
  }

  // Structural integrity: verify expected field IDs are present in the payload.
  // RHF initializes all keys, so a mismatch means the form was loaded with
  // the wrong template or the payload was corrupted in transit.
  const templateFields = Array.isArray(job.template?.fields)
    ? (job.template.fields as { id: string }[])
    : [];
  const payloadKeys = new Set(Object.keys(formData));
  const missingIds = templateFields
    .map((f) => f.id)
    .filter((id) => !payloadKeys.has(id));

  console.log(
    `[save] Job ${jobId}: ${payloadKeys.size} keys, template expects ${templateFields.length}, missing ${missingIds.length}`,
  );

  if (
    templateFields.length >= 20 &&
    missingIds.length > templateFields.length * 0.5
  ) {
    const msg = `Data integrity error: ${missingIds.length}/${templateFields.length} expected field IDs missing from payload. Aborting save.`;
    console.error(`[save] ${msg}`);
    throw new Error(msg);
  }

  // Filter the client payload: drop `undefined` values (can't delete a DB key
  // by accident) and strip `__`-prefixed keys (reserved-key channel; client is
  // never trusted through autosave). A stripped reserved key is a bug signal.
  const cleanedRhf: Record<string, unknown> = {};
  const strippedReservedKeys: string[] = [];
  for (const [k, v] of Object.entries(formData)) {
    if (v === undefined) continue;
    if (k.startsWith("__")) {
      strippedReservedKeys.push(k);
      continue;
    }
    cleanedRhf[k] = v;
  }
  if (strippedReservedKeys.length > 0) {
    console.warn(
      `[save] Job ${jobId}: stripped ${strippedReservedKeys.length} __-prefixed keys from client payload: ${strippedReservedKeys.join(", ")}. Dedicated server actions own these keys — autosave must not write them.`,
    );
  }

  // Merge: DB state first (reserved `__` keys survive unchanged), then the
  // cleaned RHF state overwrites template-field keys RHF owns.
  const freshDbFormData = (job.formData ?? {}) as Record<string, unknown>;
  const merged = { ...freshDbFormData, ...cleanedRhf };

  // Atomic draft-guard: if the status flipped between the read above and
  // this write, `count` will be 0 and we refuse silently by throwing.
  const result = await db.job.updateMany({
    where: { id: jobId, status: "DRAFT" },
    data: { formData: merged as unknown as object },
  });
  if (result.count === 0) {
    throw new Error("Job is no longer editable");
  }

  revalidatePath(`/jobs/${jobId}`);
}
