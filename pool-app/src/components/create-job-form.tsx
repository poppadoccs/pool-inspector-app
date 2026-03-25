"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";
import { createJob } from "@/lib/actions/jobs";
import { toast } from "sonner";

export function CreateJobForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createJob, null);

  useEffect(() => {
    if (state?.success) {
      toast.success("Job created");
      setIsOpen(false);
    }
  }, [state]);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="mt-4 w-full min-h-[56px] text-lg"
      >
        <Plus className="mr-2 size-5" />
        New Job
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-4 space-y-3 rounded-lg border border-zinc-300 bg-zinc-50 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">New Job</h2>
        <Button
          type="button"
          variant="ghost"
          className="min-h-[48px] min-w-[48px]"
          onClick={() => setIsOpen(false)}
        >
          <X className="size-5" />
        </Button>
      </div>
      <Input
        name="name"
        placeholder="Job name (e.g., Smith Residence)"
        className="min-h-[48px] text-base"
      />
      <Input
        name="jobNumber"
        placeholder="Job number (e.g., 2024-042)"
        className="min-h-[48px] text-base"
      />
      {state?.error && (
        <p className="text-base font-medium text-red-600">{state.error}</p>
      )}
      <Button
        type="submit"
        disabled={pending}
        className="w-full min-h-[56px] text-lg font-semibold"
      >
        {pending ? "Creating..." : "Create Job"}
      </Button>
    </form>
  );
}
