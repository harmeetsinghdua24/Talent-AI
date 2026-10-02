"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/Feedback";
import { Reveal } from "@/components/ui/Motion";
import { api } from "@/lib/api";

const FUNNEL_COLORS = ["var(--brand)", "var(--info)", "var(--success)"];

function HiringFunnel() {
  const [funnel, setFunnel] = useState<Awaited<ReturnType<typeof api.hiringFunnel>> | null>(null);

  useEffect(() => {
    api.hiringFunnel().then(setFunnel);
  }, []);

  if (!funnel) return null;
  const maxCount = Math.max(...funnel.stages.map((s) => s.count), 1);
  const isEmpty = funnel.stages.every((s) => s.count === 0);

  return (
    <Reveal>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-semibold text-ink">Hiring funnel</h3>
          {!isEmpty && (
            <span className="text-xs text-ink-muted">
              {funnel.conversion_rates.applied_to_hired}% applied → hired
            </span>
          )}
        </div>
        {isEmpty ? (
          <EmptyState title="No applications yet" description="Your hiring funnel will fill in as candidates apply, get shortlisted, and get hired." />
        ) : (
          <div className="space-y-4">
            {funnel.stages.map((stage, i) => {
              const widthPct = Math.max(8, (stage.count / maxCount) * 100);
              const prevStage = funnel.stages[i - 1];
              const conversionLabel =
                i === 1 ? `${funnel.conversion_rates.applied_to_shortlisted}%` :
                i === 2 ? `${funnel.conversion_rates.shortlisted_to_hired}%` : null;
              return (
                <div key={stage.label}>
                  {conversionLabel && prevStage && (
                    <p className="text-xs text-ink-faint mb-1.5 pl-1">↓ {conversionLabel} conversion</p>
                  )}
                  <div className="flex items-center gap-3">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
                      className="h-11 rounded-lg flex items-center px-4 text-white text-sm font-medium min-w-[90px]"
                      style={{ backgroundColor: FUNNEL_COLORS[i] }}
                    >
                      {stage.label}
                    </motion.div>
                    <span className="font-display font-bold text-ink text-lg">{stage.count}</span>
                  </div>
                </div>
              );
            })}
            {funnel.rejected > 0 && (
              <p className="text-xs text-ink-muted pt-2 border-t border-border">
                <span className="text-danger font-medium">{funnel.rejected}</span> application{funnel.rejected !== 1 ? "s" : ""} rejected along the way
              </p>
            )}
          </div>
        )}
      </Card>
    </Reveal>
  );
}

export default function AnalyticsPage() {
  const [skills, setSkills] = useState<{ skill: string; count: number }[] | null>(null);
  const [distribution, setDistribution] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    api.skillTrends().then((r) => setSkills(r.top_candidate_skills));
    api.matchDistribution().then((r) => setDistribution(r.distribution));
  }, []);

  const distData = distribution
    ? Object.entries(distribution).map(([bucket, count]) => ({ bucket, count }))
    : [];

  return (
    <RequireRole role="recruiter">
      <AppShell>
        <PageHeader title="Analytics" description="Trends across your candidate pipeline." />
        <div className="px-6 sm:px-8 pb-10 space-y-6">
          <HiringFunnel />
          <div className="grid lg:grid-cols-2 gap-6">
          <Reveal>
          <Card className="p-6">
            <h3 className="font-display font-semibold text-ink mb-5">Match score distribution</h3>
            {distData.every((d) => d.count === 0) ? (
              <EmptyState title="No scored applications yet" description="Once candidates apply, their match scores will appear here." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={distData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 12, fill: "var(--ink-muted)" }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 13 }} />
                  <Bar dataKey="count" fill="var(--brand)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
          </Reveal>

          <Reveal delay={0.1}>
          <Card className="p-6">
            <h3 className="font-display font-semibold text-ink mb-5">Top candidate skills</h3>
            {!skills || skills.length === 0 ? (
              <EmptyState title="No skill data yet" description="Skill trends appear once candidates upload resumes." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={skills} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 12, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="skill" type="category" tick={{ fontSize: 12, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--border)", fontSize: 13 }} />
                  <Bar dataKey="count" fill="var(--info)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
          </Reveal>
          </div>
        </div>
      </AppShell>
    </RequireRole>
  );
}
