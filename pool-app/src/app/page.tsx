import { db } from "@/lib/db";
import { JobList } from "@/components/job-list";
import { CreateJobForm } from "@/components/create-job-form";
import { Separator } from "@/components/ui/separator";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const jobs = await db.job.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold text-zinc-900">Pool Field Forms</h1>
      <p className="mt-1 text-lg text-zinc-600">
        Select a job or create a new one.
      </p>
      <CreateJobForm />
      <Separator className="my-6" />
      <JobList jobs={jobs} />
    </main>
  );
}
