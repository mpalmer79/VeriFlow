import type { DocumentStatus } from "@/lib/types";
import { titleCase } from "@/lib/format";

const styles: Record<DocumentStatus, string> = {
  uploaded: "border-accent/40 bg-accent/15 text-accent",
  verified: "border-severity-low/40 bg-severity-low/15 text-severity-low",
  rejected: "border-severity-critical/40 bg-severity-critical/15 text-severity-critical",
  expired: "border-severity-moderate/40 bg-severity-moderate/15 text-severity-moderate",
};

export function DocumentStatusChip({ status }: { status: DocumentStatus }) {
  return <span className={`chip ${styles[status]}`}>{titleCase(status)}</span>;
}
