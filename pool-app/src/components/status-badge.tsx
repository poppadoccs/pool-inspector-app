import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: "DRAFT" | "SUBMITTED" }) {
  if (status === "SUBMITTED") {
    return (
      <Badge
        variant="default"
        className="min-h-[32px] bg-green-600 text-sm font-medium"
      >
        Submitted
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="min-h-[32px] text-sm font-medium">
      Draft
    </Badge>
  );
}
