"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, Variants } from "framer-motion";
import { ArrowLeft, Mail, Briefcase, GraduationCap, FolderGit2, Award, Star, X, CalendarPlus, Video, MapPin, Phone, Clock, FileCheck, AlertTriangle } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, statusTone, SkillPill } from "@/components/ui/Badge";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { TiltCard } from "@/components/ui/TiltCard";
import { ProgressBar } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import { TextField, TextArea } from "@/components/ui/Form";
import { useToast } from "@/components/ui/Toast";
import { api, InterviewData } from "@/lib/api";

type Detail = Awaited<ReturnType<typeof api.candidateDetail>>;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.35, ease: "easeOut" } }),
};

const modeIcon = { online: Video, in_person: MapPin, phone: Phone };

export default function CandidateDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { show } = useToast();
  const jobId = Number(params.id);
  const applicationId = Number(params.applicationId);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [interviews, setInterviews] = useState<InterviewData[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [form, setForm] = useState({
    date: "", time: "", duration_minutes: 30,
    mode: "online" as "online" | "in_person" | "phone",
    location_or_link: "", notes: "",
  });

  function loadInterviews() {
    api.listInterviewsForApplication(jobId, applicationId).then(setInterviews);
  }

  useEffect(() => {
    api.candidateDetail(jobId, applicationId).then(setDetail);
    loadInterviews();
  }, [jobId, applicationId]);

  async function handleShortlist() {
    await api.shortlist(jobId, applicationId);
    show("Candidate shortlisted.", "success");
    api.candidateDetail(jobId, applicationId).then(setDetail);
  }

  async function handleReject() {
    await api.reject(jobId, applicationId);
    show("Candidate rejected.", "info");
    api.candidateDetail(jobId, applicationId).then(setDetail);
  }

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date || !form.time) return;
    setScheduling(true);
    try {
      await api.scheduleInterview(jobId, applicationId, {
        scheduled_at: `${form.date}T${form.time}:00`,
        duration_minutes: form.duration_minutes,
        mode: form.mode,
        location_or_link: form.location_or_link || undefined,
        notes: form.notes || undefined,
      });
      show("Interview scheduled — the candidate has been notified.", "success");
      setScheduleOpen(false);
      loadInterviews();
    } catch {
      show("Could not schedule the interview.", "error");
    } finally {
      setScheduling(false);
    }
  }

  async function handleCancelInterview(interviewId: number) {
    await api.updateInterview(interviewId, { status: "cancelled" });
    show("Interview cancelled.", "info");
    loadInterviews();
  }

  const [offerOpen, setOfferOpen] = useState(false);
  const [generatingOffer, setGeneratingOffer] = useState(false);
  const [offerForm, setOfferForm] = useState({ salary: "", joining_date: "", additional_terms: "", mark_as_hired: true });

  async function handleGenerateOffer(e: React.FormEvent) {
    e.preventDefault();
    if (!offerForm.salary || !offerForm.joining_date) return;
    setGeneratingOffer(true);
    try {
      await api.generateOfferLetter(jobId, applicationId, {
        salary: offerForm.salary,
        joining_date: offerForm.joining_date,
        additional_terms: offerForm.additional_terms || undefined,
        mark_as_hired: offerForm.mark_as_hired,
      });
      show("Offer letter generated and downloaded — candidate notified.", "success");
      setOfferOpen(false);
      api.candidateDetail(jobId, applicationId).then(setDetail);
    } catch {
      show("Could not generate the offer letter.", "error");
    } finally {
      setGeneratingOffer(false);
    }
  }

  if (!detail) {
    return (
      <RequireRole role="recruiter">
        <AppShell>
          <div className="px-6 sm:px-8 pb-10 text-sm text-ink-muted">Loading candidate profile…</div>
        </AppShell>
      </RequireRole>
    );
  }

  const sb = detail.score_breakdown;
  const factors: [string, number][] = [
    ["Skill match", sb.skill_match],
    ["Semantic match", sb.semantic_match],
    ["Experience", sb.experience],
    ["Project relevance", sb.projects],
    ["Education", sb.education],
    ["Certifications", sb.certifications],
  ];

  return (
    <RequireRole role="recruiter">
      <AppShell>
        <div className="px-8 py-5 border-b border-border bg-surface flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors">
            <ArrowLeft size={15} /> Back to candidates
          </button>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setScheduleOpen(true)}>
              <CalendarPlus size={13} /> Schedule Interview
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setOfferOpen(true)}>
              <FileCheck size={13} /> Generate Offer
            </Button>
            <Button size="sm" variant="secondary" onClick={handleShortlist} disabled={detail.status === "shortlisted"}>
              <Star size={13} /> Shortlist
            </Button>
            <Button size="sm" variant="danger" onClick={handleReject} disabled={detail.status === "rejected"}>
              <X size={13} /> Reject
            </Button>
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-10 grid lg:grid-cols-3 gap-6 max-w-5xl">
          {detail.duplicate_check?.is_duplicate && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-3 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-tint px-5 py-3.5"
            >
              <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
              <p className="text-sm text-warning">
                <strong>Possible duplicate resume.</strong> This exact resume content was also submitted by{" "}
                <strong>{detail.duplicate_check.matches_candidate_name ?? "another candidate"}</strong>
                {detail.duplicate_check.matches_candidate_email ? ` (${detail.duplicate_check.matches_candidate_email})` : ""}.
              </p>
            </motion.div>
          )}
          <motion.div initial="hidden" animate="show" custom={0} variants={fadeUp} className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h1 className="font-display text-xl font-bold text-ink">{detail.candidate.name ?? "Unnamed candidate"}</h1>
                  {detail.candidate.email && (
                    <p className="text-sm text-ink-muted flex items-center gap-1.5 mt-1">
                      <Mail size={13} /> {detail.candidate.email}
                    </p>
                  )}
                </div>
                <Badge tone={statusTone(detail.status)}>{detail.status.replace("_", " ")}</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <Briefcase size={14} /> {detail.candidate.experience_years} years experience
              </div>
            </Card>

            <motion.div initial="hidden" animate="show" custom={1} variants={fadeUp}>
              <Card className="p-6">
                <h3 className="font-display font-semibold text-ink mb-4">Score breakdown</h3>
                <div className="space-y-4">
                  {factors.map(([label, val]) => (
                    <div key={label}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-ink-muted">{label}</span>
                        <span className="font-medium text-ink">{val}%</span>
                      </div>
                      <ProgressBar value={val} />
                    </div>
                  ))}
                </div>
                {sb.ml_shortlist_probability !== null && (
                  <div className="mt-5 pt-5 border-t border-border flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink">ML shortlist probability</p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        A separately trained classifier&apos;s estimate — shown alongside, not instead of, the score above.
                      </p>
                    </div>
                    <span className="font-display font-bold text-brand text-lg">{sb.ml_shortlist_probability}%</span>
                  </div>
                )}
              </Card>
            </motion.div>

            <motion.div initial="hidden" animate="show" custom={2} variants={fadeUp}>
              <Card className="p-6">
                <h3 className="font-display font-semibold text-ink mb-4">Skill analysis</h3>
                <div className="flex flex-wrap gap-2">
                  {detail.skill_gap.matched.map((s) => (
                    <SkillPill key={s} label={s} matched />
                  ))}
                  {detail.skill_gap.missing_critical.map((s) => (
                    <SkillPill key={s} label={s} matched={false} />
                  ))}
                </div>
                {detail.skill_gap.missing_secondary.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="text-xs font-medium text-ink-muted mb-2">Good-to-have gaps</p>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.skill_gap.missing_secondary.map((s) => (
                        <span key={s} className="text-xs px-2 py-1 rounded-full bg-canvas border border-border text-ink-muted">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </motion.div>

            {(detail.candidate.projects.length > 0 || detail.candidate.certifications.length > 0) && (
              <motion.div initial="hidden" animate="show" custom={3} variants={fadeUp} className="grid md:grid-cols-2 gap-6">
                {detail.candidate.projects.length > 0 && (
                  <Card className="p-6">
                    <h3 className="font-display font-semibold text-ink mb-3 flex items-center gap-2">
                      <FolderGit2 size={16} className="text-brand" /> Projects
                    </h3>
                    <ul className="space-y-2 text-sm text-ink-muted">
                      {detail.candidate.projects.map((p, i) => (
                        <li key={i}>• {p}</li>
                      ))}
                    </ul>
                  </Card>
                )}
                {detail.candidate.certifications.length > 0 && (
                  <Card className="p-6">
                    <h3 className="font-display font-semibold text-ink mb-3 flex items-center gap-2">
                      <Award size={16} className="text-brand" /> Certifications
                    </h3>
                    <ul className="space-y-2 text-sm text-ink-muted">
                      {detail.candidate.certifications.map((c, i) => (
                        <li key={i}>• {c}</li>
                      ))}
                    </ul>
                  </Card>
                )}
              </motion.div>
            )}
          </motion.div>

          <motion.div initial="hidden" animate="show" custom={1} variants={fadeUp}>
            <div className="sticky top-6">
            <TiltCard>
            <Card className="p-6 flex flex-col items-center text-center">
              <ScoreRing score={sb.overall} size={140} strokeWidth={11} label="Overall match" />
              {detail.candidate.education.length > 0 && (
                <div className="mt-6 pt-5 border-t border-border w-full text-left">
                  <p className="text-xs font-medium text-ink-muted mb-2 flex items-center gap-1.5">
                    <GraduationCap size={13} /> Education
                  </p>
                  <ul className="space-y-1.5 text-sm text-ink">
                    {detail.candidate.education.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
              {interviews.filter((i) => i.status === "scheduled").length > 0 && (
                <div className="mt-6 pt-5 border-t border-border w-full text-left">
                  <p className="text-xs font-medium text-ink-muted mb-2 flex items-center gap-1.5">
                    <CalendarPlus size={13} /> Scheduled Interviews
                  </p>
                  <div className="space-y-3">
                    {interviews.filter((i) => i.status === "scheduled").map((iv) => {
                      const Icon = modeIcon[iv.mode as keyof typeof modeIcon] ?? Video;
                      return (
                        <div key={iv.id} className="bg-canvas rounded-lg p-3 text-sm">
                          <p className="font-medium text-ink flex items-center gap-1.5">
                            <Clock size={12} />
                            {new Date(iv.scheduled_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                          <p className="text-xs text-ink-muted mt-1 flex items-center gap-1.5 capitalize">
                            <Icon size={12} /> {iv.mode.replace("_", " ")} · {iv.duration_minutes} min
                          </p>
                          {iv.location_or_link && <p className="text-xs text-brand mt-1 truncate">{iv.location_or_link}</p>}
                          <button
                            onClick={() => handleCancelInterview(iv.id)}
                            className="text-xs text-danger hover:underline mt-2"
                          >
                            Cancel
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
            </TiltCard>
            </div>
          </motion.div>
        </div>

        <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Schedule Interview">
          <form onSubmit={handleSchedule} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                id="date" label="Date" type="date" required
                value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
              <TextField
                id="time" label="Time" type="time" required
                value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-ink">Mode</label>
                <select
                  value={form.mode}
                  onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as typeof f.mode }))}
                  className="rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                >
                  <option value="online">Online</option>
                  <option value="in_person">In person</option>
                  <option value="phone">Phone</option>
                </select>
              </div>
              <TextField
                id="duration" label="Duration (min)" type="number" min={15} step={15}
                value={form.duration_minutes}
                onChange={(e) => setForm((f) => ({ ...f, duration_minutes: Number(e.target.value) }))}
              />
            </div>
            <TextField
              id="location" label="Location / meeting link"
              placeholder="https://meet.google.com/..."
              value={form.location_or_link}
              onChange={(e) => setForm((f) => ({ ...f, location_or_link: e.target.value }))}
            />
            <TextArea
              id="notes" label="Notes (optional)"
              placeholder="Technical round, focus on system design..."
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="min-h-[80px]"
            />
            <Button type="submit" className="w-full" disabled={scheduling}>
              {scheduling ? "Scheduling…" : "Schedule & notify candidate"}
            </Button>
          </form>
        </Modal>

        <Modal open={offerOpen} onClose={() => setOfferOpen(false)} title="Generate Offer Letter">
          <form onSubmit={handleGenerateOffer} className="space-y-4">
            <TextField
              id="salary" label="Salary / Compensation" required
              placeholder="e.g. 12 LPA"
              value={offerForm.salary} onChange={(e) => setOfferForm((f) => ({ ...f, salary: e.target.value }))}
            />
            <TextField
              id="joining_date" label="Joining date" type="date" required
              value={offerForm.joining_date} onChange={(e) => setOfferForm((f) => ({ ...f, joining_date: e.target.value }))}
            />
            <TextArea
              id="additional_terms" label="Additional terms (optional)"
              placeholder="Probation period, benefits, reporting manager..."
              value={offerForm.additional_terms}
              onChange={(e) => setOfferForm((f) => ({ ...f, additional_terms: e.target.value }))}
              className="min-h-[80px]"
            />
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={offerForm.mark_as_hired}
                onChange={(e) => setOfferForm((f) => ({ ...f, mark_as_hired: e.target.checked }))}
                className="rounded border-border accent-brand"
              />
              Mark this application as &quot;Hired&quot;
            </label>
            <Button type="submit" className="w-full" disabled={generatingOffer}>
              {generatingOffer ? "Generating…" : "Generate PDF & notify candidate"}
            </Button>
          </form>
        </Modal>
      </AppShell>
    </RequireRole>
  );
}
