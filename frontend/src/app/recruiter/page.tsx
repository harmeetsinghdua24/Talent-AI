"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Users, Star, TrendingUp, ArrowUpRight, Trophy } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { SkeletonCard, EmptyState } from "@/components/ui/Feedback";
import { StatCard } from "@/components/ui/StatCard";
import { TiltCard } from "@/components/ui/TiltCard";
import { Reveal, StaggerGrid, StaggerItem } from "@/components/ui/Motion";
import { api, DashboardData } from "@/lib/api";
import { motion } from "framer-motion";

const FUNNEL_COLORS = ["var(--brand)", "var(--info)", "var(--success)"];

function HiringFunnelPreview() {
  const [funnel, setFunnel] = useState<Awaited<ReturnType<typeof api.hiringFunnel>> | null>(null);

  useEffect(() => {
    api.hiringFunnel().then(setFunnel);
  }, []);

  if (!funnel) return null;
  const maxCount = Math.max(...funnel.stages.map((s) => s.count), 1);
  const isEmpty = funnel.stages.every((s) => s.count === 0);

  return (
    <Reveal delay={0.15}>
      <Card className="p-6 h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-ink flex items-center gap-2">
            <Trophy size={16} className="text-brand" /> Hiring funnel
          </h3>
          <Link href="/recruiter/analytics" className="text-xs text-brand hover:text-brand-hover">
            Full analytics →
          </Link>
        </div>
        {isEmpty ? (
          <EmptyState title="No applications yet" description="Your funnel fills in as candidates apply, get shortlisted, and get hired." />
        ) : (
          <div className="space-y-3">
            {funnel.stages.map((stage, i) => {
              const widthPct = Math.max(10, (stage.count / maxCount) * 100);
              return (
                <div key={stage.label} className="flex items-center gap-3">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.1, ease: "easeOut" }}
                    className="h-10 rounded-lg flex items-center px-3.5 text-white text-sm font-medium min-w-[80px]"
                    style={{ backgroundColor: FUNNEL_COLORS[i] }}
                  >
                    {stage.label}
                  </motion.div>
                  <span className="font-display font-bold text-ink">{stage.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </Reveal>
  );
}

export default function RecruiterDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .recruiterDashboard()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return (
    <RequireRole role="recruiter">
      <AppShell>
        <PageHeader
          title="Dashboard"
          description="An overview of your hiring pipeline."
          action={
            <Link
              href="/recruiter/jobs/new"
              className="inline-flex items-center gap-1.5 bg-brand text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-brand-hover transition-colors"
            >
              Post a job <ArrowUpRight size={15} />
            </Link>
          }
        />
        <div className="px-6 sm:px-8 pb-10 space-y-8">
          {loading ? (
            <div className="grid grid-cols-4 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : data ? (
            <>
              <StaggerGrid className="grid grid-cols-2 md:grid-cols-4 gap-5">
                <StaggerItem>
                  <TiltCard><StatCard icon={Briefcase} label="Active jobs" value={data.active_jobs} tone="brand" href="/recruiter/jobs" /></TiltCard>
                </StaggerItem>
                <StaggerItem>
                  <TiltCard><StatCard icon={Users} label="Total applicants" value={data.total_applicants} tone="info" href="/recruiter/candidates" /></TiltCard>
                </StaggerItem>
                <StaggerItem>
                  <TiltCard><StatCard icon={Star} label="Shortlisted" value={data.shortlisted} tone="success" href="/recruiter/shortlisted" /></TiltCard>
                </StaggerItem>
                <StaggerItem>
                  <TiltCard><StatCard icon={TrendingUp} label="Average match" value={`${data.average_match_score}%`} tone="warning" /></TiltCard>
                </StaggerItem>
              </StaggerGrid>

              <div className="grid lg:grid-cols-2 gap-6">
                <HiringFunnelPreview />

                <Reveal delay={0.2}>
                  <Card className="p-6 h-full">
                    <h3 className="font-display font-semibold text-ink mb-4">Top candidates</h3>
                    {data.top_candidates.length === 0 ? (
                      <EmptyState title="No candidates ranked yet" description="Ranked candidates will appear once resumes are matched to your jobs." />
                    ) : (
                      <ul className="space-y-3">
                        {data.top_candidates.map((c, i) => (
                          <li key={c.application_id} className="flex items-center justify-between bg-canvas rounded-xl p-3.5">
                            <div className="flex items-center gap-3">
                              <span className="w-6 h-6 rounded-full bg-brand-tint text-brand text-xs font-bold flex items-center justify-center">
                                {i + 1}
                              </span>
                              <span className="text-sm text-ink">Candidate #{c.candidate_id}</span>
                            </div>
                            <span className="font-display font-bold text-brand text-sm">{c.match_score}%</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </Reveal>
              </div>

              <Reveal delay={0.25}>
                <Card className="p-6">
                  <h3 className="font-display font-semibold text-ink mb-4">Recent applications</h3>
                  {data.recent_applications.length === 0 ? (
                    <EmptyState title="No applications yet" description="Applications will appear here once candidates apply to your jobs." />
                  ) : (
                    <ul className="divide-y divide-border">
                      {data.recent_applications.map((a) => (
                        <li key={a.application_id} className="flex items-center justify-between text-sm py-3 first:pt-0 last:pb-0">
                          <span className="text-ink">Application #{a.application_id}</span>
                          <span className="text-ink-muted capitalize">{a.status.replace("_", " ")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </Reveal>
            </>
          ) : null}
        </div>
      </AppShell>
    </RequireRole>
  );
}
