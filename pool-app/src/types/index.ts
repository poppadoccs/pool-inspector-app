export type JobStatus = "DRAFT" | "SUBMITTED";

export type CreateJobInput = {
  name?: string;
  jobNumber?: string;
};
