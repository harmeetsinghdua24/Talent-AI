"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MapPin, Briefcase, Users, XCircle } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, SkeletonCard } from "@/components/ui/Feedback";
import { AnimatedSection, AnimatedItem } from "@/components/ui/Motion";
import { api, JobOut } from "@/lib/api";

export default function JobsListPage() {
  const [jobs, setJobs] = useState<JobOut[] | null>(null);
  const [closingJobId, setClosingJobId] = useState<number | null>(null);

const handleCloseJob = async (jobId: number) => {
  const confirmed = window.confirm(
    "Are you sure you want to close this job? Candidates will no longer be able to apply."
  );

  if (!confirmed) return;

  try {
    setClosingJobId(jobId);

    const updatedJob = await api.updateJob(jobId, {
      status: "closed",
    });

    setJobs((currentJobs) =>
      currentJobs
        ? currentJobs.map((job) =>
            job.id === jobId ? updatedJob : job
          )
        : currentJobs
    );
  } catch (error) {
    console.error(error);
    window.alert("Could not close the job. Please try again.");
  } finally {
    setClosingJobId(null);
  }
};

  useEffect(() => {
    api.listJobs().then(setJobs);
  }, []);

  return (
    <RequireRole role="recruiter">
      <AppShell>
        <PageHeader
          title="Jobs"
          description="Manage your open roles and see AI-extracted requirements."
          action={
            <Link
              href="/recruiter/jobs/new"
              className="inline-flex items-center gap-1.5 bg-brand text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-brand-hover transition-colors"
            >
              Post a job <ArrowUpRight size={15} />
            </Link>
          }
        />
        <div className="px-6 sm:px-8 pb-10">
          {jobs === null ? (
            <div className="grid md:grid-cols-2 gap-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <EmptyState
              icon={<Briefcase size={32} />}
              title="No jobs posted yet"
              description="Post your first role and Talentum will automatically classify must-have and good-to-have skills from the description."
              action={
                <Link href="/recruiter/jobs/new" className="text-brand font-medium text-sm hover:text-brand-hover">
                  Post a job →
                </Link>
              }
            />
          ) : (
            <AnimatedSection className="grid md:grid-cols-2 gap-5">
              {jobs.map((job) => (
                <AnimatedItem key={job.id}>
                <Card className="p-6 flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover hover:border-border-strong">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-display font-semibold text-ink">{job.title}</h3>
                    <Badge tone={job.status === "open" ? "success" : "neutral"}>{job.status}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-ink-muted mb-4">
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {job.location}
                      </span>
                    )}
                    {job.employment_type && <span>{job.employment_type}</span>}
                  </div>
                  {job.ai_extracted && (
                    <div className="flex flex-wrap gap-1.5 mb-5">
                      {job.ai_extracted.must_have_skills.slice(0, 4).map((s) => (
                        <span key={s} className="text-xs px-2 py-1 rounded-full bg-brand-tint text-brand font-medium">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-4 border-t border-border">
  <Link
    href={`/recruiter/jobs/${job.id}/candidates`}
    className="text-sm font-medium text-brand hover:text-brand-hover flex items-center gap-1"
  >
    <Users size={14} /> View candidates
  </Link>

  {job.status === "open" && (
    <button
      type="button"
      onClick={() => handleCloseJob(job.id)}
      disabled={closingJobId === job.id}
      className="text-sm font-medium text-red-600 hover:text-red-700 flex items-center gap-1 disabled:opacity-50"
    >
      <XCircle size={14} />
      {closingJobId === job.id ? "Closing..." : "Close Job"}
    </button>
  )}
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
