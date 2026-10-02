"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextField, TextArea } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError, JobOut } from "@/lib/api";

export default function NewJobPage() {
  const router = useRouter();
  const { show } = useToast();
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("Full-time");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<JobOut["ai_extracted"] | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const job = await api.createJob({ title, department, location, employment_type: employmentType, description });
      setPreview(job.ai_extracted);
      show("Job posted — AI extracted the requirements below.", "success");
      setTimeout(() => router.push(`/recruiter/jobs/${job.id}/candidates`), 1400);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Could not create job.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <RequireRole role="recruiter">
      <AppShell>
        <PageHeader title="Post a job" description="Talentum analyzes the description as you save it." />
        <div className="px-6 sm:px-8 pb-10 grid lg:grid-cols-3 gap-6 max-w-5xl">
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-5">
            <Card className="p-6 space-y-5">
              <TextField id="title" label="Job title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Python Developer" />
              <div className="grid grid-cols-2 gap-4">
                <TextField id="department" label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Engineering" />
                <TextField id="location" label="Location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Remote" />
              </div>
              <TextField
                id="employmentType"
                label="Employment type"
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                placeholder="Full-time"
              />
              <TextArea
                id="description"
                label="Job description"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={"e.g.\nRequired: Python, SQL, FastAPI.\nGood to have: Docker, AWS.\n1-3 years experience. Bachelor's degree required."}
                className="min-h-[220px]"
              />
              <Button type="submit" disabled={submitting || !title || !description}>
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Analyzing & posting…
                  </>
                ) : (
                  "Post job"
                )}
              </Button>
            </Card>
          </form>

          <Card className="p-6 h-fit sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-brand" />
              <h3 className="font-display font-semibold text-ink text-sm">AI Job Intelligence</h3>
            </div>
            {preview ? (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-medium text-ink-muted mb-1.5">Must have</p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.must_have_skills.map((s) => (
                      <span key={s} className="px-2 py-1 rounded-full bg-brand-tint text-brand text-xs font-medium">{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-muted mb-1.5">Good to have</p>
                  <div className="flex flex-wrap gap-1.5">
                    {preview.good_to_have_skills.map((s) => (
                      <span key={s} className="px-2 py-1 rounded-full bg-canvas border border-border text-ink-muted text-xs font-medium">{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-ink-muted mb-1">Experience</p>
                  <p className="text-ink">{preview.experience_min_years}–{preview.experience_max_years} years</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-muted leading-relaxed">
                Write a description on the left — once you post the job, Talentum will classify skills into
                must-have and good-to-have, and extract the experience range automatically.
              </p>
            )}
          </Card>
        </div>
      </AppShell>
    </RequireRole>
  );
}
