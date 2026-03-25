import { z } from "zod";

export const createJobSchema = z
  .object({
    name: z.string().min(1, "Job name is required").max(200).optional(),
    jobNumber: z.string().max(50).optional(),
  })
  .refine((data) => data.name || data.jobNumber, {
    message: "Either job name or job number is required",
  });
