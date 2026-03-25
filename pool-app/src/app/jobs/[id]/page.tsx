import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const job = await db.job.findUnique({ where: { id } });

  if (!job) {
    return { title: "Job Not Found" };
  }

  return {
    title: `${job.name || "Job #" + job.jobNumber} | Pool Field Forms`,
  };
}

export default async function JobDetailPage({ params }: Props) {
  const { id } = await params;
  const job = await db.job.findUnique({ where: { id } });

  if (!job) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/">
        <Button
          variant="ghost"
          className="min-h-[48px] gap-2 text-base"
        >
          <ArrowLeft className="size-5" />
          Back to Jobs
        </Button>
      </Link>

      <div className="mt-4 space-y-2">
        <h1 className="text-2xl font-bold text-zinc-900">
          {job.name || `Job #${job.jobNumber}`}
        </h1>
        {job.name && job.jobNumber && (
          <p className="text-lg text-zinc-600">#{job.jobNumber}</p>
        )}
        <div className="flex items-center gap-3">
          <StatusBadge status={job.status} />
        </div>
        <p className="text-base text-zinc-500">
          Created {format(job.createdAt, "PPP 'at' p")}
        </p>
        {job.submittedBy && (
          <p className="text-base text-zinc-600">
            Submitted by: {job.submittedBy}
          </p>
        )}
      </div>

      <Separator className="my-6" />

      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold text-zinc-900">Photos</h2>
            <p className="mt-1 text-base text-zinc-500">
              Photo capture coming in Phase 2
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="text-lg font-semibold text-zinc-900">Form</h2>
            <p className="mt-1 text-base text-zinc-500">
              Form fields coming in Phase 3
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
