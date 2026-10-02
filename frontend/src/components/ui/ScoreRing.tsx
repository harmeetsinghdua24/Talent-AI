"use client";

import { useEffect, useState } from "react";

function toneForScore(score: number) {
  if (score >= 80) return "var(--success)";
  if (score >= 60) return "var(--brand)";
  if (score >= 40) return "var(--warning)";
  return "var(--danger)";
}

export function ScoreRing({
  score,
  size = 120,
  strokeWidth = 10,
  label,
}: {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(score), 80);
    return () => clearTimeout(t);
  }, [score]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;
  const color = toneForScore(score);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 700ms ease-out" }}
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className="font-display text-3xl font-bold text-ink">{Math.round(score)}%</span>
        {label && <span className="text-xs text-ink-muted mt-0.5">{label}</span>}
      </div>
    </div>
  );
}
