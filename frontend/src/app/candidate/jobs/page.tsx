"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  MapPin,
  FileText,
  CheckCircle2,
  Clock3,
  BriefcaseBusiness,
} from "lucide-react";
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
  applied: boolean | string;
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

type JobFilter = "all" | "notApplied" | "applied";

export default function CandidateJobsPage() {
  const { show } = useToast();

  const [jobs, setJobs] = useState<JobOut[] | null>(null);
  const [activity, setActivity] = useState<ActivityData | null>(null);
  const [resumeId, setResumeId] = useState<number | null>(null);
  const [applying, setApplying] = useState<number | null>(null);
  const [applied, setApplied] = useState<Set<number>>(new Set());

  // Job Activity filter
  const [jobFilter, setJobFilter] = useState<JobFilter>("all");

  useEffect(() => {
    api.listJobs().then(setJobs);

    api.myResumes().then((resumes) => {
      if (resumes.length > 0) {
        setResumeId(resumes[0].resume_id);
      }
    });

    api
      .candidateJobActivity()
      .then(setActivity)
      .catch(() => {
        // Activity is optional; don't block the Jobs page if it fails.
      });
  }, []);

  /**
   * Normalize applied value because backend may return
   * either boolean true/false or string "true"/"false".
   */
  function isJobApplied(job: JobActivity) {
    return (
      job.applied === true ||
      String(job.applied).toLowerCase() === "true"
    );
  }

  async function handleApply(jobId: number) {
    if (!resumeId) {
      show("Upload a resume before applying.", "error");
      return;
    }

    setApplying(jobId);

    try {
      await api.applyToJob(jobId, resumeId);

      setApplied((prev) => {
        const next = new Set(prev);
        next.add(jobId);
        return next;
      });

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
          description="Browse jobs and track your applications."
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
                {/* Total Jobs */}
                <Card
                  className={`p-5 transition-all ${
                    jobFilter === "all"
                      ? "border-brand ring-1 ring-brand/20"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setJobFilter("all")}
                    className="w-full text-left"
                  >
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
                  </button>
                </Card>

                {/* Applied */}
                <Card
                  className={`p-5 transition-all ${
                    jobFilter === "applied"
                      ? "border-success ring-1 ring-success/20"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setJobFilter("applied")}
                    className="w-full text-left"
                  >
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
                  </button>
                </Card>

                {/* Not Applied */}
                <Card
                  className={`p-5 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${
                    jobFilter === "notApplied"
                      ? "border-warning ring-1 ring-warning/20"
                      : ""
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setJobFilter("notApplied")}
                    className="w-full text-left"
                  >
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
                  </button>
                </Card>

                {/* Open Jobs */}
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
          ) : activity === null ? (
            jobs.length === 0 ? (
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
                  {jobs.map((job) => (
                    <AnimatedItem key={job.id}>
                      <Card className="p-6 flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover hover:border-border-strong">
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

                        <div className="flex items-center gap-3 text-xs text-ink-muted mb-4">
                          {job.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={12} />
                              {job.location}
                            </span>
                          )}

                          {job.employment_type && (
                            <span>{job.employment_type}</span>
                          )}
                        </div>

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

                        <div className="mt-auto pt-4 border-t border-border">
                          <Button
                            size="sm"
                            className="w-full"
                            disabled={!resumeId}
                            onClick={() => handleApply(job.id)}
                          >
                            Apply now
                          </Button>
                        </div>
                      </Card>
                    </AnimatedItem>
                  ))}
                </AnimatedSection>
              </>
            )
          ) : (
            <>
              {/* Filter Heading */}
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">
                    {jobFilter === "notApplied"
                      ? "Not Applied Jobs"
                      : jobFilter === "applied"
                      ? "Applied Jobs"
                      : "Available Jobs"}
                  </h2>

                  <p className="text-sm text-ink-muted">
                    {jobFilter === "notApplied"
                      ? "Jobs you have not applied to yet."
                      : jobFilter === "applied"
                      ? "Jobs you have already applied to."
                      : "Explore jobs and track your applications."}
                  </p>
                </div>

                {jobFilter !== "all" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setJobFilter("all")}
                  >
                    Show all
                  </Button>
                )}
              </div>

              {(() => {
                /*
                 * IMPORTANT:
                 * Backend can return applied as:
                 *   true / false
                 * OR
                 *   "true" / "false"
                 *
                 * So we normalize it through isJobApplied().
                 */
                const filteredActivityJobs =
                  jobFilter === "notApplied"
                    ? activity.jobs.filter(
                        (job) => !isJobApplied(job)
                      )
                    : jobFilter === "applied"
                    ? activity.jobs.filter(
                        (job) => isJobApplied(job)
                      )
                    : activity.jobs;

                if (filteredActivityJobs.length === 0) {
                  return (
                    <EmptyState
                      title={
                        jobFilter === "notApplied"
                          ? "No not-applied jobs"
                          : jobFilter === "applied"
                          ? "No applied jobs"
                          : "No jobs available"
                      }
                      description={
                        jobFilter === "notApplied"
                          ? "You have applied to all available jobs."
                          : jobFilter === "applied"
                          ? "You have not applied to any jobs yet."
                          : "Check back soon — new roles are posted regularly."
                      }
                    />
                  );
                }

                return (
                  <AnimatedSection className="grid md:grid-cols-2 gap-5">
                    {filteredActivityJobs.map((activityJob) => {
                      /*
                       * First try to get full job information from
                       * listJobs().
                       */
                      const job = jobs.find(
                        (item) => item.id === activityJob.job_id
                      );

                      /*
                       * If listJobs() doesn't contain the job
                       * (for example a closed job), we can still
                       * render it using candidateJobActivity().
                       */
                      const jobId = activityJob.job_id;

                      const jobTitle =
                        job?.title || activityJob.job_title;

                      const companyName =
                        job?.company_name ||
                        activityJob.company_name ||
                        "";

                      const location =
                        job?.location ||
                        activityJob.location ||
                        "";

                      const employmentType =
                        job?.employment_type ||
                        activityJob.employment_type ||
                        "";

                      const isApplied =
                        applied.has(jobId) ||
                        isJobApplied(activityJob);

                      const isClosed =
                        String(activityJob.status || "")
                          .toLowerCase()
                          .trim() === "closed";

                      return (
                        <AnimatedItem key={jobId}>
                          <Card className="p-6 flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-card-hover hover:border-border-strong">
                            {/* Company + Job */}
                            <div className="flex items-start gap-3 mb-3">
                              <div className="w-10 h-10 rounded-xl bg-brand-tint text-brand flex items-center justify-center font-display font-bold shrink-0">
                                {(companyName || jobTitle)
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>

                              <div className="min-w-0">
                                <h3 className="font-display font-semibold text-ink leading-snug">
                                  {jobTitle}
                                </h3>

                                {companyName && (
                                  <p className="text-sm text-ink-muted">
                                    {companyName}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Location + Employment */}
                            <div className="flex items-center gap-3 text-xs text-ink-muted mb-4">
                              {location && (
                                <span className="flex items-center gap-1">
                                  <MapPin size={12} />
                                  {location}
                                </span>
                              )}

                              {employmentType && (
                                <span>{employmentType}</span>
                              )}
                            </div>

                            {/* Skills */}
                            {job?.ai_extracted && (
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

                            {/* Job Status */}
                            <div className="mb-4 flex flex-wrap gap-2">
                              {/* Open / Closed */}
                              <div
                                className={`rounded-lg px-3 py-2 border ${
                                  isClosed
                                    ? "bg-canvas border-border text-ink-muted"
                                    : "bg-brand-tint border-brand/20 text-brand"
                                }`}
                              >
                                <span className="text-xs font-medium">
                                  {isClosed ? "Closed" : "Open"}
                                </span>
                              </div>

                              {/* Applied / Not Applied */}
                              <div
                                className={`rounded-lg px-3 py-2 border ${
                                  isApplied
                                    ? "bg-success-tint border-success/20"
                                    : "bg-warning-tint border-warning/20"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {isApplied ? (
                                    <CheckCircle2
                                      size={15}
                                      className="text-success"
                                    />
                                  ) : (
                                    <Clock3
                                      size={15}
                                      className="text-warning"
                                    />
                                  )}

                                  <span
                                    className={`text-xs font-medium ${
                                      isApplied
                                        ? "text-success"
                                        : "text-warning"
                                    }`}
                                  >
                                    {isApplied
                                      ? "Applied"
                                      : "Not Applied"}
                                  </span>

                                  {isApplied &&
                                    activityJob.application_status && (
                                      <span className="text-xs text-ink-muted">
                                        •{" "}
                                        {
                                          activityJob.application_status
                                        }
                                      </span>
                                    )}
                                </div>
                              </div>
                            </div>

                            {/* Apply / Closed */}
                            <div className="mt-auto pt-4 border-t border-border">
                              {isClosed ? (
                                <Button
                                  size="sm"
                                  className="w-full"
                                  disabled
                                >
                                  Closed
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  className="w-full"
                                  disabled={
                                    applying === jobId ||
                                    isApplied ||
                                    !resumeId
                                  }
                                  onClick={() =>
                                    handleApply(jobId)
                                  }
                                >
                                  {isApplied
                                    ? "Applied"
                                    : applying === jobId
                                    ? "Applying…"
                                    : "Apply now"}
                                </Button>
                              )}
                            </div>
                          </Card>
                        </AnimatedItem>
                      );
                    })}
                  </AnimatedSection>
                );
              })()}
            </>
          )}
        </div>
      </AppShell>
    </RequireRole>
  );
}