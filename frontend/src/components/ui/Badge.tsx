import { HTMLAttributes } from "react";
import clsx from "clsx";

type BadgeTone = "neutral" | "success" | "danger" | "warning" | "info" | "brand";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-canvas text-ink-muted border border-border",
  success: "bg-success-tint text-success border border-success/20",
  danger: "bg-danger-tint text-danger border border-danger/20",
  warning: "bg-warning-tint text-warning border border-warning/20",
  info: "bg-info-tint text-info border border-info/20",
  brand: "bg-brand-tint text-brand border border-brand/20",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "shortlisted":
    case "hired":
      return "success";
    case "rejected":
      return "danger";
    case "under_review":
      return "warning";
    default:
      return "neutral";
  }
}

export function SkillPill({
  label,
  matched,
}: {
  label: string;
  matched: boolean;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        matched
          ? "bg-success-tint text-success border-success/20"
          : "bg-danger-tint text-danger border-danger/20"
      )}
    >
      {matched ? "✓" : "×"} {label}
    </span>
  );
}
