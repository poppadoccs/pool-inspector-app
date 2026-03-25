"use server";

import { db } from "@/lib/db";
import { createJobSchema } from "@/lib/validations/job";
import { revalidatePath } from "next/cache";

export async function createJob(prevState: unknown, formData: FormData) {
  const parsed = createJobSchema.safeParse({
    name: formData.get("name") as string | null,
    jobNumber: formData.get("jobNumber") as string | null,
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().formErrors.join(", ") };
  }

  await db.job.create({
    data: {
      name: parsed.data.name ?? null,
      jobNumber: parsed.data.jobNumber ?? null,
      status: "DRAFT",
    },
  });

  revalidatePath("/");
  return { success: true };
}
