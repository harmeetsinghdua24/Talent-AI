import Link from "next/link";
import clsx from "clsx";
import { ArrowUpRight } from "lucide-react";
import { Card } from "./Card";
import { AnimatedNumber } from "./AnimatedNumber";

type Tone = "brand" | "success" | "info" | "warning";

const toneClasses: Record<Tone, { gradient: string; text: string; bar: string; hoverGlow: string }> = {
  brand: { gradient: "from-brand to-[#6D5EF0]", text: "text-white", bar: "bg-brand", hoverGlow: "group-hover:shadow-[0_0_24px_-4px_rgba(67,56,202,0.55)]" },
  success: { gradient: "from-success to-[#22C55E]", text: "text-white", bar: "bg-success", hoverGlow: "group-hover:shadow-[0_0_24px_-4px_rgba(21,128,61,0.5)]" },
  info: { gradient: "from-info to-[#38BDF8]", text: "text-white", bar: "bg-info", hoverGlow: "group-hover:shadow-[0_0_24px_-4px_rgba(37,99,235,0.5)]" },
  warning: { gradient: "from-warning to-[#F59E0B]", text: "text-white", bar: "bg-warning", hoverGlow: "group-hover:shadow-[0_0_24px_-4px_rgba(180,83,9,0.5)]" },
};

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "brand",
  hint,
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone?: Tone;
  hint?: string;
  href?: string;
}) {
  const t = toneClasses[tone];

  const content = (
    <Card className="group relative overflow-hidden p-5 h-full transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover hover:border-border-strong">
      {/* Thin colored accent along the top edge - ties the card to its metric's meaning */}
      <div className={clsx("absolute inset-x-0 top-0 h-0.5", t.bar)} />
      <div className="flex items-start justify-between mb-4">
        <div
          className={clsx(
            "w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br transition-shadow duration-300",
            t.gradient, t.text, t.hoverGlow
          )}
        >
          <Icon size={19} strokeWidth={2.25} />
        </div>
        {href && (
          <ArrowUpRight
            size={16}
            className="text-ink-faint opacity-0 group-hover:opacity-100 group-hover:text-brand transition-all duration-200 -translate-x-1 group-hover:translate-x-0"
          />
        )}
      </div>
      <p className="font-display text-3xl font-bold text-ink tracking-tight leading-none tabular-nums">
        <AnimatedNumber value={value} />
      </p>
      <p className="text-sm text-ink-muted mt-2">{label}</p>
      {hint && <p className="text-xs text-ink-faint mt-1">{hint}</p>}
    </Card>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {content}
      </Link>
    );
  }

  return content;
}
