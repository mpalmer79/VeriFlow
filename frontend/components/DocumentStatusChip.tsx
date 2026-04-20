import type { DocumentStatus } from "@/lib/types";
import { titleCase } from "@/lib/format";

const styles: Record<DocumentStatus, { chip: string; dot: string }> = {
  uploaded: {
    chip: "border-accent/40 bg-accent/15 text-accent",
    dot: "bg-accent",
  },
  verified: {
    chip: "border-verified/40 bg-verified/15 text-verified",
    dot: "bg-verified",
  },
  rejected: {
    chip: "border-rejected/40 bg-rejected/15 text-rejected",
    dot: "bg-rejected",
  },
  expired: {
    chip: "border-severity-moderate/40 bg-severity-moderate/15 text-severity-moderate",
    dot: "bg-severity-moderate",
  },
};

export function DocumentStatusChip({ status }: { status: DocumentStatus }) {
  const { chip, dot } = styles[status];
  return (
    <span className={`chip gap-1.5 ${chip}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      {titleCase(status)}
    </span>
  );
}
