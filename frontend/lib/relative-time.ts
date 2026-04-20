// Short relative-time formatter ("2 minutes ago", "3 days ago", "just now").
// Absolute timestamps stay the canonical record; relative is the at-a-glance
// affordance paired with them in the UI.

const UNITS: Array<{ label: string; seconds: number }> = [
  { label: "year", seconds: 31_536_000 },
  { label: "month", seconds: 2_592_000 },
  { label: "week", seconds: 604_800 },
  { label: "day", seconds: 86_400 },
  { label: "hour", seconds: 3_600 },
  { label: "minute", seconds: 60 },
];

export function formatRelativeTime(
  input: string | Date,
  now: Date = new Date(),
): string {
  const then = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(then.getTime())) return "—";
  const deltaSec = Math.round((now.getTime() - then.getTime()) / 1000);
  if (deltaSec < 10) return "just now";
  if (deltaSec < 60) return `${deltaSec} seconds ago`;
  for (const unit of UNITS) {
    const value = Math.floor(deltaSec / unit.seconds);
    if (value >= 1) {
      return `${value} ${unit.label}${value === 1 ? "" : "s"} ago`;
    }
  }
  return "just now";
}
