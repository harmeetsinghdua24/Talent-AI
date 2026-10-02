"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, FileText } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { AnimatedSection, AnimatedItem } from "@/components/ui/Motion";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, JobOut } from "@/lib/api";

export default function CandidateJobsPage() {
  const { show } = useToast();
  const [jobs, setJobs] = useState<JobOut[] | null>(null);
  const [resumeId, setResumeId] = useState<number | null>(null);
  const [applying, setApplying] = useState<number | null>(null);
  const [applied, setApplied] = useState<Set<number>>(new Set());

  useEffect(() => {
    api.listJobs().then(setJobs);
    api.myResumes().then((resumes) => {
      if (resumes.length > 0) setResumeId(resumes[0].resume_id);
    });
  }, []);

  async function handleApply(jobId: number) {
    if (!resumeId) {
      show("Upload a resume before applying.", "error");
      return;
    }
    setApplying(jobId);
    try {
      await api.applyToJob(jobId, resumeId);
      setApplied((prev) => new Set(prev).add(jobId));
      show("Application submitted — your match score has been computed.", "success");
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Could not apply.", "error");
    } finally {
      setApplying(null);
    }
  }

  return (
    <RequireRole role="candidate">
      <AppShell>
        <PageHeader title="Jobs" description="Open roles matched to your profile." />
        <div className="px-6 sm:px-8 pb-10">
          {!resumeId && jobs !== null && jobs.length > 0 && (
            <div className="mb-6 flex items-center justify-between rounded-xl border border-warning/20 bg-warning-tint px-5 py-3.5">
              <div className="flex items-center gap-2 text-sm text-warning">
                <FileText size={15} />
                Upload a resume to apply to jobs and get a match score.
              </div>
              <Link href="/candidate/resume" className="text-sm font-medium text-warning underline">
                Upload now
              </Link>
            </div>
          )}
          {jobs === null ? (
            <p className="text-sm text-ink-muted">Loading jobs…</p>
          ) : jobs.length === 0 ? (
            <EmptyState title="No open jobs right now" description="Check back soon — new roles are posted regularly." />
          ) : (
            <AnimatedSection className="grid md:grid-cols-2 gap-5">
              {jobs.map((job) => (
                <AnimatedItem key={job.id}>
                <Card className="p-6 flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover hover:border-border-strong">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-tint text-brand flex items-center justify-center font-display font-bold shrink-0">
                      {(job.company_name || job.title).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-semibold text-ink leading-snug">{job.title}</h3>
                      {job.company_name && <p className="text-sm text-ink-muted">{job.company_name}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-ink-muted mb-4">
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {job.location}
                      </span>
                    )}
                    {job.employment_type && <span>{job.employment_type}</span>}
                  </div>
                  {job.ai_extracted && (
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {job.ai_extracted.must_have_skills.slice(0, 5).map((s) => (
                        <span key={s} className="text-xs px-2 py-1 rounded-full bg-canvas border border-border text-ink-muted">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto pt-4 border-t border-border">
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={applying === job.id || applied.has(job.id) || !resumeId}
                      onClick={() => handleApply(job.id)}
                    >
                      {applied.has(job.id) ? "Applied" : applying === job.id ? "Applying…" : "Apply now"}
                    </Button>
                  </div>
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
