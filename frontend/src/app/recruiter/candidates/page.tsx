"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { motion } from "framer-motion";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import { EmptyState, SkeletonCard } from "@/components/ui/Feedback";
import { Reveal } from "@/components/ui/Motion";
import { api } from "@/lib/api";

type Row = Awaited<ReturnType<typeof api.listAllCandidates>>["results"][number];

export default function AllCandidatesPage() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    api.listAllCandidates().then((r) => setRows(r.results));
  }, []);

  return (
    <RequireRole role="recruiter">
      <AppShell>
        <PageHeader title="Candidates" description="Every candidate who has applied to any of your jobs." />
        <div className="px-6 sm:px-8 pb-10">
          {rows === null ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState icon={<Users size={32} />} title="No candidates yet" description="Applicants across all your jobs will appear here." />
          ) : (
            <Reveal>
            <Card className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-semibold text-ink-muted uppercase tracking-wide bg-canvas/50">
                    <th className="px-5 py-3">Candidate</th>
                    <th className="px-5 py-3">Job</th>
                    <th className="px-5 py-3">Match</th>
                    <th className="px-5 py-3">Experience</th>
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
                      <td className="px-5 py-4 text-ink-muted">{r.job_title}</td>
                      <td className="px-5 py-4 font-semibold text-brand">{r.match_score}%</td>
                      <td className="px-5 py-4 text-ink-muted">{r.experience_years} yrs</td>
                      <td className="px-5 py-4">
                        <Badge tone={statusTone(r.status)}>{r.status.replace("_", " ")}</Badge>
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
