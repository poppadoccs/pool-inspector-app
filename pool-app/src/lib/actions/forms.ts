"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { FormData } from "@/lib/forms";

export async function saveFormData(jobId: string, formData: FormData) {
  const job = await db.job.findUnique({
    where: { id: jobId },
    include: { template: true },
  });
  if (!job) throw new Error("Job not found");

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
    `[save] Job ${jobId}: ${payloadKeys.size} keys, template expects ${templateFields.length}, missing ${missingIds.length}`
  );

  if (templateFields.length >= 20 && missingIds.length > templateFields.length * 0.5) {
    const msg = `Data integrity error: ${missingIds.length}/${templateFields.length} expected field IDs missing from payload. Aborting save.`;
    console.error(`[save] ${msg}`);
    throw new Error(msg);
  }

  await db.job.update({
    where: { id: jobId },
    data: { formData },
  });

  revalidatePath(`/jobs/${jobId}`);
}
