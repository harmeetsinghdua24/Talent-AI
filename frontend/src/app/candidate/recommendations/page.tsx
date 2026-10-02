"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, FileText } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { Reveal, AnimatedSection, AnimatedItem } from "@/components/ui/Motion";
import { api } from "@/lib/api";

type Rec = { job_id: number; job_title: string; company_name?: string | null; match_score: number; missing_skills: string[] };

export default function RecommendationsPage() {
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    api.recommendedJobs().then((r) => {
      setRecs(r.results);
      setReason(r.reason ?? null);
    });
  }, []);

  return (
    <RequireRole role="candidate">
      <AppShell>
        <PageHeader title="Recommendations" description="Jobs ranked against your resume by the same matching engine recruiters use." />
        <div className="px-6 sm:px-8 pb-10">
          {recs === null ? (
            <p className="text-sm text-ink-muted">Loading recommendations…</p>
          ) : recs.length === 0 ? (
            <EmptyState
              icon={<FileText size={32} />}
              title="No recommendations yet"
              description={reason ?? "Upload a resume to see jobs matched to your profile."}
              action={
                <Link href="/candidate/resume">
                  <Button>
                    <Sparkles size={15} /> Upload resume
                  </Button>
                </Link>
              }
            />
          ) : (
            <AnimatedSection className="grid md:grid-cols-2 gap-5">
              {recs.map((rec) => (
                <AnimatedItem key={rec.job_id}>
                <Card className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-display font-semibold text-ink">{rec.job_title}</h3>
                      {rec.company_name && <p className="text-sm text-ink-muted">{rec.company_name}</p>}
                    </div>
                    <span className="font-display font-bold text-brand">{rec.match_score}%</span>
                  </div>
                  {rec.missing_skills.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium text-ink-muted mb-1.5">Skill gap</p>
                      <div className="flex flex-wrap gap-1.5">
                        {rec.missing_skills.map((s) => (
                          <span key={s} className="text-xs px-2 py-1 rounded-full bg-danger-tint text-danger">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <Link href="/candidate/jobs" className="text-sm font-medium text-brand hover:text-brand-hover">
                    View job →
                  </Link>
                </Card>
                </AnimatedItem>
              ))}
            </AnimatedSection>
          )}
        </div>
      </AppShell>
    </RequireRole>
  );
}
