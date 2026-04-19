import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-md border border-dashed border-surface-border bg-surface-muted/40 px-6 py-10 text-center">
      <div className="text-sm font-medium text-text">{title}</div>
      {description ? (
        <p className="max-w-sm text-xs text-text-muted">{description}</p>
      ) : null}
      {children}
    </div>
  );
}
