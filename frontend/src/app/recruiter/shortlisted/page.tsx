"use client";

import { useEffect, useState } from "react";
import { Star, Download } from "lucide-react";
import { motion } from "framer-motion";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, SkeletonCard } from "@/components/ui/Feedback";
import { Reveal } from "@/components/ui/Motion";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";

type ShortlistedRow = Awaited<ReturnType<typeof api.listShortlisted>>["results"][number];

export default function ShortlistedPage() {
  const { show } = useToast();
  const [rows, setRows] = useState<ShortlistedRow[] | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api.listShortlisted().then((r) => setRows(r.results));
  }, []);

  async function handleExport() {
    setExporting(true);
    try {
      await api.downloadShortlistedPdf();
    } catch {
      show("Could not generate the PDF.", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <RequireRole role="recruiter">
      <AppShell>
        <PageHeader
          title="Shortlisted"
          description="Every candidate you've ever shortlisted, across all jobs — including those since hired or rejected."
          action={
            rows && rows.length > 0 ? (
              <Button size="sm" variant="secondary" onClick={handleExport} disabled={exporting}>
                <Download size={14} /> {exporting ? "Generating…" : "Export PDF"}
              </Button>
            ) : undefined
          }
        />
        <div className="px-6 sm:px-8 pb-10">
          {rows === null ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<Star size={32} />}
              title="No shortlisted candidates yet"
              description="Shortlist strong candidates from any job's ranking page and they'll show up here — permanently, even after they're hired or rejected."
            />
          ) : (
            <Reveal>
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold text-ink-muted uppercase tracking-wide bg-canvas/50">
                    <th className="px-5 py-3">Candidate</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Job</th>
                    <th className="px-5 py-3">Match</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <motion.tr
                      key={r.application_id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="border-b border-border last:border-0 hover:bg-canvas/60 transition-colors"
                    >
                      <td className="px-5 py-4 font-medium text-ink">{r.candidate_name ?? `Candidate #${r.candidate_id}`}</td>
                      <td className="px-5 py-4 text-ink-muted">{r.candidate_email ?? "-"}</td>
                      <td className="px-5 py-4 text-ink-muted">{r.job_title}</td>
                      <td className="px-5 py-4 font-semibold text-brand">{r.match_score !== null ? `${r.match_score}%` : "-"}</td>
                      <td className="px-5 py-4">
                        <Badge tone={statusTone(r.current_status)}>{r.current_status.replace("_", " ")}</Badge>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </Card>
            </Reveal>
          )}
        </div>
      </AppShell>
    </RequireRole>
  );
}
