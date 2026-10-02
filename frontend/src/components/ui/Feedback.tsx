import { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {icon && <div className="mb-4 text-ink-faint">{icon}</div>}
      <h3 className="font-display font-semibold text-lg text-ink mb-1">{title}</h3>
      {description && <p className="text-sm text-ink-muted max-w-sm mb-5">{description}</p>}
      {action}
    </div>
  );
}

export function ProgressBar({ value, tone = "brand" }: { value: number; tone?: "brand" | "success" }) {
  return (
    <div className="w-full h-2 rounded-full bg-canvas border border-border overflow-hidden">
      <div
        className={tone === "success" ? "h-full bg-success" : "h-full bg-brand"}
        style={{ width: `${Math.min(100, Math.max(0, value))}%`, transition: "width 400ms ease-out" }}
      />
    </div>
  );
}

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-border/60 rounded ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="border border-border rounded-2xl p-6 bg-surface space-y-3">
      <SkeletonLine className="h-4 w-1/3" />
      <SkeletonLine className="h-8 w-1/2" />
      <SkeletonLine className="h-3 w-2/3" />
    </div>
  );
}
