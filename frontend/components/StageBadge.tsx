interface StageBadgeProps {
  name: string;
  orderIndex?: number;
  tone?: "current" | "past" | "future" | "neutral";
  size?: "sm" | "md";
}

const toneCls: Record<NonNullable<StageBadgeProps["tone"]>, string> = {
  current: "border-accent bg-accent/10 text-accent",
  past: "border-surface-border bg-surface-muted/50 text-text-muted",
  future: "border-surface-border bg-transparent text-text",
  neutral: "border-surface-border bg-surface-muted/40 text-text",
};

export function StageBadge({
  name,
  orderIndex,
  tone = "neutral",
  size = "sm",
}: StageBadgeProps) {
  const sizeCls = size === "md" ? "px-3 py-1 text-sm" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center rounded-md border font-medium ${sizeCls} ${toneCls[tone]}`}
    >
      {orderIndex !== undefined ? (
        <span className="mr-1.5 text-[0.65rem] uppercase tracking-wide opacity-70">
          {orderIndex + 1}
        </span>
      ) : null}
      {name}
    </span>
  );
}
