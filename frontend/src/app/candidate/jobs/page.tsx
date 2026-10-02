"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, FileText, CheckCircle2, Clock3, BriefcaseBusiness } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { AnimatedSection, AnimatedItem } from "@/components/ui/Motion";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, JobOut } from "@/lib/api";

type JobActivity = {
  job_id: number;
  job_title: string;
  company_name?: string | null;
  status: string;
  applied: boolean;
  application_status?: string | null;
  applied_at?: string | null;
  created_at?: string | null;
  location?: string | null;
  employment_type?: string | null;
};

type ActivityData = {
  total_jobs: number;
  applied_jobs: number;
  not_applied_jobs: number;
  open_jobs: number;
  closed_jobs: number;
  jobs: JobActivity[];
};

export default function CandidateJobsPage() {
  const { show } = useToast();

  const [jobs, setJobs] = useState<JobOut[] | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [resumeId, setResumeId] = useState<number | null>(null);
  const [applying, setApplying] = useState<number | null>(null);
  const [applied, setApplied] = useState<Set<number>>(new Set());
  

  useEffect(() => {
    api.listJobs().then(setJobs);

    api.myResumes().then((resumes) => {
      if (resumes.length > 0) {
        setResumeId(resumes[0].resume_id);
      }
    });

    api.candidateJobActivity().then(setActivity).catch(() => {
      // Activity is optional; don't block the Jobs page if it fails.
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

      // Refresh activity after successful application
      try {
        const updatedActivity = await api.candidateJobActivity();
        setActivity(updatedActivity);
      } catch {
        // Application itself succeeded, so activity refresh failure is ignored.
      }

      show(
        "Application submitted — your match score has been computed.",
        "success"
      );
    } catch (err) {
      show(
        err instanceof ApiError ? err.message : "Could not apply.",
        "error"
      );
    } finally {
      setApplying(null);
    }
  }

  return (
    <RequireRole role="candidate">
      <AppShell>
        <PageHeader
          title="Jobs"
          description="Open roles matched to your profile."
        />

        <div className="px-6 sm:px-8 pb-10">

          {/* Resume Warning */}
          {!resumeId && jobs !== null && jobs.length > 0 && (
            <div className="mb-6 flex items-center justify-between rounded-xl border border-warning/20 bg-warning-tint px-5 py-3.5">
              <div className="flex items-center gap-2 text-sm text-warning">
                <FileText size={15} />
                Upload a resume to apply to jobs and get a match score.
              </div>

              <Link
                href="/candidate/resume"
                className="text-sm font-medium text-warning underline"
              >
                Upload now
              </Link>
            </div>
          )}

          {/* Job Activity */}
          {activity && (
            <div className="mb-8">
              <div className="mb-4">
                <h2 className="font-display text-lg font-semibold text-ink">
                  Job Activity
                </h2>
                <p className="text-sm text-ink-muted">
                  Track your applications and available opportunities.
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-ink-muted">
                        Total Jobs
                      </p>
                      <p className="mt-1 text-2xl font-display font-bold text-ink">
                        {activity.total_jobs}
                      </p>
                    </div>

                    <BriefcaseBusiness
                      size={20}
                      className="text-brand"
                    />
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-ink-muted">
                        Applied
                      </p>
                      <p className="mt-1 text-2xl font-display font-bold text-ink">
                        {activity.applied_jobs}
                      </p>
                    </div>

                    <CheckCircle2
                      size={20}
                      className="text-success"
                    />
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-ink-muted">
                        Not Applied
                      </p>
                      <p className="mt-1 text-2xl font-display font-bold text-ink">
                        {activity.not_applied_jobs}
                      </p>
                    </div>

                    <Clock3
                      size={20}
                      className="text-warning"
                    />
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-ink-muted">
                        Open Jobs
                      </p>
                      <p className="mt-1 text-2xl font-display font-bold text-ink">
                        {activity.open_jobs}
                      </p>
                    </div>

                    <BriefcaseBusiness
                      size={20}
                      className="text-brand"
                    />
                  </div>
                </Card>

              </div>
            </div>
          )}

          {/* Jobs */}
          {jobs === null ? (
            <p className="text-sm text-ink-muted">
              Loading jobs…
            </p>
          ) : jobs.length === 0 ? (
            <EmptyState
              title="No open jobs right now"
              description="Check back soon — new roles are posted regularly."
            />
          ) : (
            <>
              <div className="mb-4">
                <h2 className="font-display text-lg font-semibold text-ink">
                  Available Jobs
                </h2>
                <p className="text-sm text-ink-muted">
                  Explore open positions and apply using your resume.
                </p>
              </div>

              <AnimatedSection className="grid md:grid-cols-2 gap-5">
                {jobs.map((job) => {
                  const activityJob = activity?.jobs.find(
                    (item) => item.job_id === job.id
                  );

                  const isApplied =
                    applied.has(job.id) || activityJob?.applied === true;

                  return (
                    <AnimatedItem key={job.id}>
                      <Card className="p-6 flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover hover:border-border-strong">

                        {/* Company + Job */}
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl bg-brand-tint text-brand flex items-center justify-center font-display font-bold shrink-0">
                            {(job.company_name || job.title)
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <h3 className="font-display font-semibold text-ink leading-snug">
                              {job.title}
                            </h3>

                            {job.company_name && (
                              <p className="text-sm text-ink-muted">
                                {job.company_name}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-3 text-xs text-ink-muted mb-4">
                          {job.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={12} />
                              {job.location}
                            </span>
                          )}

                          {job.employment_type && (
                            <span>
                              {job.employment_type}
                            </span>
                          )}
                        </div>

                        {/* Skills */}
                        {job.ai_extracted && (
                          <div className="flex flex-wrap gap-1.5 mb-5">
                            {job.ai_extracted.must_have_skills
                              .slice(0, 5)
                              .map((s) => (
                                <span
                                  key={s}
                                  className="text-xs px-2 py-1 rounded-full bg-canvas border border-border text-ink-muted"
                                >
                                  {s}
                                </span>
                              ))}
                          </div>
                        )}

                        {/* Application Status */}
                        {activityJob?.applied && (
                          <div className="mb-4 rounded-lg bg-success-tint border border-success/20 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <CheckCircle2
                                size={15}
                                className="text-success"
                              />

                              <span className="text-xs font-medium text-success">
                                Applied
                              </span>

                              {activityJob.application_status && (
                                <span className="text-xs text-ink-muted">
                                  • {activityJob.application_status}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Apply */}
                        <div className="mt-auto pt-4 border-t border-border">
                          <Button
                            size="sm"
                            className="w-full"
                            disabled={
                              applying === job.id ||
                              isApplied ||
                              !resumeId
                            }
                            onClick={() => handleApply(job.id)}
                          >
                            {isApplied
                              ? "Applied"
                              : applying === job.id
                              ? "Applying…"
                              : "Apply now"}
                          </Button>
                        </div>

                      </Card>
                    </AnimatedItem>
                  );
                })}
              </AnimatedSection>
            </>
          )}
        </div>
      </AppShell>
    </RequireRole>
  );
}