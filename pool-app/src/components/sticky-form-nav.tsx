"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, Save, ChevronUp, ChevronDown } from "lucide-react";
import { saveFormData } from "@/lib/actions/forms";
import type { FormData } from "@/lib/forms";
import { toast } from "sonner";

export function StickyFormNav({
  jobId,
  getValues,
  disabled,
}: {
  jobId: string;
  getValues: () => FormData;
  disabled?: boolean;
}) {
  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const scrollToSection = useCallback((direction: "up" | "down") => {
    const headings = Array.from(
      document.querySelectorAll("[data-section]")
    );
    if (headings.length === 0) return;

    const scrollY = window.scrollY + 100;

    if (direction === "down") {
      const next = headings.find(
        (el) => (el as HTMLElement).offsetTop > scrollY
      );
      (next || headings[headings.length - 1])?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else {
      const prev = [...headings]
        .reverse()
        .find((el) => (el as HTMLElement).offsetTop < scrollY - 50);
      (prev || headings[0])?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, []);

  const handleSave = useCallback(async () => {
    try {
      await saveFormData(jobId, getValues());
      toast.success("Saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Save failed"
      );
    }
  }, [jobId, getValues]);

  if (disabled) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="pointer-events-auto border-t border-zinc-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-[44px] gap-1.5 text-sm"
          onClick={scrollToTop}
        >
          <ArrowUp className="size-4" />
          Top
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-[44px] gap-1.5 text-sm"
          onClick={() => scrollToSection("up")}
        >
          <ChevronUp className="size-4" />
          Prev
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-[44px] gap-1.5 text-sm"
          onClick={() => scrollToSection("down")}
        >
          <ChevronDown className="size-4" />
          Next
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[44px] gap-1.5 text-sm font-semibold"
          onClick={handleSave}
        >
          <Save className="size-4" />
          Save
        </Button>
        </div>
      </div>
    </div>
  );
}
