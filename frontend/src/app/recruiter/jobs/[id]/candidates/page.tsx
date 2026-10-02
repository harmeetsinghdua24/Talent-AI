"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Star, X, ArrowUpDown } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, SkeletonCard } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { api, RankedCandidate, JobOut } from "@/lib/api";

export default function CandidateRankingPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = Number(params.id);
  const { show } = useToast();

  const [job, setJob] = useState<JobOut | null>(null);
  const [candidates, setCandidates] = useState<RankedCandidate[] | null>(null);
  const [minScore, setMinScore] = useState(0);
  const [debouncedMinScore, setDebouncedMinScore] = useState(0);
  const [sortBy, setSortBy] = useState<"overall_score" | "experience" | "applied_at">("overall_score");

  // The slider fires onChange on every pixel of drag - calling the API on
  // every one of those would fire dozens of requests per second (and did,
  // tripping the rate limiter). Debounce so the API is only called ~200ms
  // after the user stops moving the slider.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedMinScore(minScore), 200);
    return () => clearTimeout(t);
  }, [minScore]);

  const load = useCallback(() => {
    api.rankCandidates(jobId, { min_score: debouncedMinScore / 100, sort_by: sortBy }).then((r) => setCandidates(r.results));
  }, [jobId, debouncedMinScore, sortBy]);

  useEffect(() => {
    api.getJob(jobId).then(setJob);
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleShortlist(applicationId: number) {
    try {
      await api.shortlist(jobId, applicationId);
      show("Candidate shortlisted.", "success");
      load();
    } catch {
      show("Could not shortlist candidate.", "error");
    }
  }

  async function handleReject(applicationId: number) {
    try {
      await api.reject(jobId, applicationId);
      show("Candidate rejected.", "info");
      load();
    } catch {
      show("Could not reject candidate.", "error");
    }
  }

  return (
    <RequireRole role="recruiter">
      <AppShell>
        <PageHeader title={job ? `Candidates · ${job.title}` : "Candidates"} description="Ranked by explainable multi-factor match score." />
        <div className="px-6 sm:px-8 pb-10 space-y-5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-ink-muted">
              <span>Min match:</span>
              <input
                type="range"
                min={0}
                max={100}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="accent-brand w-32"
              />
              <span className="font-medium text-ink w-10">{minScore}%</span>
            </div>
            <button
              onClick={() => setSortBy(sortBy === "overall_score" ? "experience" : "overall_score")}
              className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
            >
              <ArrowUpDown size={14} /> Sort: {sortBy === "overall_score" ? "Match score" : "Experience"}
            </button>
          </div>

          {candidates === null ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : candidates.length === 0 ? (
            <EmptyState title="No candidates yet" description="Once candidates apply to this job, they'll appear here ranked by match score." />
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold text-ink-muted uppercase tracking-wide bg-canvas/50">
                    <th className="px-5 py-3 font-medium normal-case">Rank</th>
                    <th className="px-5 py-3 font-medium normal-case">Candidate</th>
                    <th className="px-5 py-3 font-medium normal-case">Match</th>
                    <th className="px-5 py-3 font-medium normal-case">Experience</th>
                    <th className="px-5 py-3 font-medium normal-case">Status</th>
                    <th className="px-5 py-3 font-medium normal-case text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c, i) => (
                    <motion.tr
                      key={c.application_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.25 }}
                      onClick={() => router.push(`/recruiter/jobs/${jobId}/candidates/${c.application_id}`)}
                      className="border-b border-border last:border-0 hover:bg-canvas/60 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-4 text-ink-muted">{String(c.rank).padStart(2, "0")}</td>
                      <td className="px-5 py-4 font-medium text-ink">{c.candidate_name ?? `Candidate #${c.candidate_id}`}</td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-brand">{c.match_score}%</span>
                      </td>
                      <td className="px-5 py-4 text-ink-muted">{c.experience_years} yrs</td>
                      <td className="px-5 py-4">
                        <Badge tone={statusTone(c.status)}>{c.status.replace("_", " ")}</Badge>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" variant="secondary" onClick={() => handleShortlist(c.application_id)}>
                            <Star size={13} /> Shortlist
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleReject(c.application_id)}>
                            <X size={13} /> Reject
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </AppShell>
    </RequireRole>
  );
}
