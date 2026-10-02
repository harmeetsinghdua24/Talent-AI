"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, FileText, Trash2, Download, ArrowLeft } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { SkillPill } from "@/components/ui/Badge";
import { EmptyState, SkeletonCard } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { api, ScreeningSessionSummary, ScreeningResultData } from "@/lib/api";

function scoreTone(score: number) {
  if (score >= 75) return "text-success";
  if (score >= 50) return "text-brand";
  if (score >= 30) return "text-warning";
  return "text-danger";
}

export default function ScreeningHistoryPage() {
  const { show } = useToast();
  const [sessions, setSessions] = useState<ScreeningSessionSummary[] | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, { job_description: string; results: ScreeningResultData[] }>>({});
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    api.listScreeningSessions().then(setSessions);
  }, []);

  async function toggleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!detailCache[id]) {
      setLoadingDetail(id);
      try {
        const detail = await api.getScreeningSession(id);
        setDetailCache((prev) => ({ ...prev, [id]: { job_description: detail.job_description, results: detail.results } }));
      } finally {
        setLoadingDetail(null);
      }
    }
  }

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    await api.deleteScreeningSession(id);
    setSessions((prev) => prev?.filter((s) => s.id !== id) ?? null);
    show("Screening session deleted.", "info");
  }

  async function handleExport(id: number, format: "excel" | "pdf", e: React.MouseEvent) {
    e.stopPropagation();
    setExporting(`${id}-${format}`);
    try {
      await api.downloadSessionExport(id, format, `screening-${id}.${format === "excel" ? "xlsx" : "pdf"}`);
    } catch {
      show("Could not generate export.", "error");
    } finally {
      setExporting(null);
    }
  }

  return (
    <RequireRole role="recruiter">
      <AppShell>
        <PageHeader
          title="Screening History"
          description="Every job requirement you've screened, with resumes ranked by match score."
          action={
            <Link href="/recruiter/screening" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover">
              <ArrowLeft size={15} /> New screening
            </Link>
          }
        />
        <div className="px-6 sm:px-8 pb-10 space-y-3">
          {sessions === null ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState
              icon={<FileText size={32} />}
              title="No screening history yet"
              description="Run a bulk resume screening and it will show up here for you to revisit anytime."
              action={
                <Link href="/recruiter/screening" className="text-brand font-medium text-sm hover:text-brand-hover">
                  Start a screening →
                </Link>
              }
            />
          ) : (
            sessions.map((s) => {
              const isOpen = expandedId === s.id;
              const detail = detailCache[s.id];
              return (
                <Card key={s.id} className="overflow-hidden">
                  <button
                    onClick={() => toggleExpand(s.id)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-canvas/60 transition-colors"
                  >
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="font-medium text-ink truncate">{s.title}</p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {s.resume_count} resume{s.resume_count !== 1 ? "s" : ""} · {new Date(s.created_at).toLocaleDateString()} · Top match: {s.top_score}%
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={(e) => handleExport(s.id, "excel", e)}
                        disabled={exporting !== null}
                        className="text-xs text-ink-muted hover:text-brand flex items-center gap-1"
                        title="Export Excel"
                      >
                        <Download size={13} /> Excel
                      </button>
                      <button
                        onClick={(e) => handleExport(s.id, "pdf", e)}
                        disabled={exporting !== null}
                        className="text-xs text-ink-muted hover:text-brand flex items-center gap-1"
                        title="Export PDF"
                      >
                        <Download size={13} /> PDF
                      </button>
                      <button onClick={(e) => handleDelete(s.id, e)} className="text-ink-faint hover:text-danger" title="Delete">
                        <Trash2 size={14} />
                      </button>
                      <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown size={16} className="text-ink-muted" />
                      </motion.div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="border-t border-border overflow-hidden"
                      >
                        {loadingDetail === s.id ? (
                          <p className="px-6 py-4 text-sm text-ink-muted">Loading results…</p>
                        ) : detail ? (
                          <div>
                            <div className="px-6 py-3 bg-canvas/50 border-b border-border">
                              <p className="text-xs font-medium text-ink-muted mb-1">Job requirement</p>
                              <p className="text-xs text-ink whitespace-pre-line line-clamp-3">{detail.job_description}</p>
                            </div>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-left text-xs font-semibold text-ink-muted uppercase tracking-wide bg-canvas/50 border-b border-border">
                                  <th className="px-6 py-2">Rank</th>
                                  <th className="px-6 py-2">Candidate</th>
                                  <th className="px-6 py-2">Match</th>
                                  <th className="px-6 py-2">Skills</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detail.results.map((r, i) => (
                                  <tr key={r.filename} className="border-b border-border last:border-0">
                                    <td className="px-6 py-3 text-ink-muted">{String(i + 1).padStart(2, "0")}</td>
                                    <td className="px-6 py-3">
                                      <p className="font-medium text-ink">{r.candidate_name ?? r.filename}</p>
                                      <p className="text-xs text-ink-muted">{r.email}</p>
                                    </td>
                                    <td className={`px-6 py-3 font-bold ${scoreTone(r.match_score)}`}>{r.match_score}%</td>
                                    <td className="px-6 py-3">
                                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                                        {r.matched_skills.slice(0, 3).map((sk) => <SkillPill key={sk} label={sk} matched />)}
                                        {r.missing_critical.slice(0, 2).map((sk) => <SkillPill key={sk} label={sk} matched={false} />)}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              );
            })
          )}
        </div>
      </AppShell>
    </RequireRole>
  );
}
