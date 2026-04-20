import type { ReactNode } from "react";

interface PanelProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
}: PanelProps) {
  return (
    <section className={`panel animate-fade-in ${className ?? ""}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-surface-border px-4 py-3">
          <div>
            {title ? (
              <h2 className="text-sm font-semibold text-text">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-xs text-text-muted">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      )}
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}
