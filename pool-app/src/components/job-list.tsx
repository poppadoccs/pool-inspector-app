import { JobCard } from "@/components/job-card";
import type { Job } from "@/generated/prisma/client";

export function JobList({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-lg text-zinc-500">
          No jobs yet. Create your first job above.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}
