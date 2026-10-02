"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, Sparkles, FileWarning, Trophy, X, History } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Form";
import { SkillPill } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";

interface ScanResult {
  filename: string;
  candidate_name: string | null;
  email: string | null;
  experience_years: number;
  match_score: number;
  ml_shortlist_probability: number | null;
  matched_skills: string[];
  missing_critical: string[];
  missing_secondary: string[];
  failed?: boolean;
  error?: string;
}

const CONCURRENCY = 3;

function scoreTone(score: number) {
  if (score >= 75) return "text-success";
  if (score >= 50) return "text-brand";
  if (score >= 30) return "text-warning";
  return "text-danger";
}

export default function BulkScreeningPage() {
  const { show } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [jobDescription, setJobDescription] = useState("");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof api.previewRequirements>> | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [savedSessionId, setSavedSessionId] = useState<number | null>(null);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const valid = Array.from(incoming).filter((f) => /\.(pdf|docx)$/i.test(f.name));
    if (valid.length < incoming.length) {
      show("Some files were skipped — only PDF and DOCX are supported.", "info");
    }
    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      return [...prev, ...valid.filter((f) => !existingNames.has(f.name))];
    });
  }, [show]);

  async function handlePreview() {
    if (jobDescription.trim().length < 10) return;
    try {
      const p = await api.previewRequirements(jobDescription);
      setPreview(p);
    } catch {
      // silent - preview is a convenience, not critical
    }
  }

  async function handleScan() {
    if (!jobDescription.trim() || files.length === 0) return;
    setScanning(true);
    setCompleted(0);
    setResults([]);

    const queue = [...files];
    const collected: ScanResult[] = [];

    async function worker() {
      while (queue.length > 0) {
        const file = queue.shift();
        if (!file) return;
        try {
          const res = await api.scanOneResume(jobDescription, file);
          collected.push(res);
        } catch (err) {
          collected.push({
            filename: file.name,
            candidate_name: null,
            email: null,
            experience_years: 0,
            match_score: 0,
            ml_shortlist_probability: null,
            matched_skills: [],
            missing_critical: [],
            missing_secondary: [],
            failed: true,
            error: err instanceof ApiError ? err.message : "Could not process this file.",
          });
        } finally {
          setCompleted((c) => c + 1);
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));

    const sorted = [...collected].sort((a, b) => b.match_score - a.match_score);
    setResults(sorted);
    setScanning(false);
    show(`Scanned ${files.length} resume${files.length > 1 ? "s" : ""} — ranked by match score.`, "success");

    // Persist to history so this run can be revisited later, exported, etc.
    try {
      const validResults = sorted.filter((r) => !r.failed);
      if (validResults.length > 0) {
        const saved = await api.saveScreeningSession({ job_description: jobDescription, results: validResults });
        setSavedSessionId(saved.session_id);
      }
    } catch {
      // History saving is a convenience, not critical to the scan itself
    }
  }

  async function handleExport(format: "excel" | "pdf") {
    if (!savedSessionId) return;
    setExporting(format);
    try {
      await api.downloadSessionExport(savedSessionId, format, `screening-${savedSessionId}.${format === "excel" ? "xlsx" : "pdf"}`);
    } catch {
      show("Could not generate export.", "error");
    } finally {
      setExporting(null);
    }
  }

  function reset() {
    setFiles([]);
    setResults([]);
    setCompleted(0);
    setSavedSessionId(null);
  }

  return (
    <RequireRole role="recruiter">
      <AppShell>
        <PageHeader
          title="Bulk Resume Screening"
          description="Paste a job requirement, drop as many resumes as you like, and get an instantly ranked shortlist."
          action={
            <Link
              href="/recruiter/screening/history"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink border border-border rounded-lg px-4 py-2.5 hover:border-border-strong transition-colors"
            >
              <History size={15} /> View history
            </Link>
          }
        />
        <div className="px-6 sm:px-8 pb-10 max-w-5xl space-y-6">
          {results.length === 0 && (
            <div className="grid lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 p-6 space-y-4">
                <TextArea
                  id="jd"
                  label="Job requirement"
                  placeholder={"e.g.\nRequired: Python, SQL, FastAPI.\nGood to have: Docker, AWS.\n1-3 years experience. Bachelor's degree required."}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  onBlur={handlePreview}
                  className="min-h-[160px]"
                />

                <div>
                  <p className="text-sm font-medium text-ink mb-2">Resumes</p>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      if (e.dataTransfer.files) addFiles(e.dataTransfer.files);
                    }}
                    className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                      dragging ? "border-brand bg-brand-tint" : "border-border-strong bg-canvas"
                    }`}
                  >
                    <UploadCloud size={26} className="mx-auto text-ink-faint mb-3" />
                    <p className="text-sm font-medium text-ink mb-1">Drop multiple resumes here</p>
                    <p className="text-xs text-ink-muted mb-3">PDF or DOCX — select as many files at once as you need</p>
                    <label className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-hover cursor-pointer">
                      <span className="underline">Browse files</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.docx"
                        multiple
                        className="hidden"
                        onChange={(e) => e.target.files && addFiles(e.target.files)}
                      />
                    </label>
                  </div>

                  {files.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {files.map((f) => (
                        <span key={f.name} className="inline-flex items-center gap-1.5 text-xs bg-canvas border border-border rounded-full pl-3 pr-1.5 py-1 text-ink-muted">
                          {f.name}
                          <button
                            onClick={() => setFiles((prev) => prev.filter((x) => x.name !== f.name))}
                            className="hover:text-danger transition-colors"
                            aria-label={`Remove ${f.name}`}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {scanning ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-ink-muted">
                      <span>Scanning resume {completed} of {files.length}…</span>
                      <span>{Math.round((completed / files.length) * 100)}%</span>
                    </div>
                    <ProgressBar value={(completed / files.length) * 100} />
                  </div>
                ) : (
                  <Button
                    onClick={handleScan}
                    disabled={!jobDescription.trim() || files.length === 0}
                    className="w-full"
                  >
                    <Sparkles size={16} /> Scan {files.length > 0 ? `${files.length} resume${files.length > 1 ? "s" : ""}` : "resumes"}
                  </Button>
                )}
              </Card>

              <Card className="p-6 h-fit">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles size={16} className="text-brand" />
                  <h3 className="font-display font-semibold text-ink text-sm">Detected requirements</h3>
                </div>
                {preview && (preview.must_have_skills.length > 0 || preview.good_to_have_skills.length > 0) ? (
                  <div className="space-y-4 text-sm">
                    <div>
                      <p className="text-xs font-medium text-ink-muted mb-1.5">Must have</p>
                      <div className="flex flex-wrap gap-1.5">
                        {preview.must_have_skills.map((s) => (
                          <span key={s} className="px-2 py-1 rounded-full bg-brand-tint text-brand text-xs font-medium">{s}</span>
                        ))}
                      </div>
                    </div>
                    {preview.good_to_have_skills.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-ink-muted mb-1.5">Good to have</p>
                        <div className="flex flex-wrap gap-1.5">
                          {preview.good_to_have_skills.map((s) => (
                            <span key={s} className="px-2 py-1 rounded-full bg-canvas border border-border text-ink-muted text-xs font-medium">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {preview.experience_min_years > 0 && (
                      <div>
                        <p className="text-xs font-medium text-ink-muted mb-1">Experience</p>
                        <p className="text-ink">{preview.experience_min_years}–{preview.experience_max_years} years</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted leading-relaxed">
                    Type your requirement and click outside the box — Talentum will show what it detected here before you scan anything.
                  </p>
                )}
              </Card>
            </div>
          )}

          <AnimatePresence>
            {results.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-ink flex items-center gap-2">
                    <Trophy size={17} className="text-brand" /> Ranked results — {results.length} resumes
                  </h3>
                  <div className="flex gap-2">
                    {savedSessionId && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => handleExport("excel")} disabled={exporting !== null}>
                          {exporting === "excel" ? "Exporting…" : "Export Excel"}
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => handleExport("pdf")} disabled={exporting !== null}>
                          {exporting === "pdf" ? "Exporting…" : "Export PDF"}
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="secondary" onClick={reset}>Scan more resumes</Button>
                  </div>
                </div>

                <Card className="overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold text-ink-muted uppercase tracking-wide bg-canvas/50">
                        <th className="px-5 py-3">Rank</th>
                        <th className="px-5 py-3">Candidate</th>
                        <th className="px-5 py-3">Match</th>
                        <th className="px-5 py-3">Experience</th>
                        <th className="px-5 py-3">Skills</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => (
                        <motion.tr
                          key={r.filename}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="border-b border-border last:border-0"
                        >
                          <td className="px-5 py-4 text-ink-muted">{String(i + 1).padStart(2, "0")}</td>
                          <td className="px-5 py-4">
                            {r.failed ? (
                              <span className="flex items-center gap-1.5 text-danger text-xs">
                                <FileWarning size={13} /> {r.filename} — {r.error}
                              </span>
                            ) : (
                              <div>
                                <p className="font-medium text-ink">{r.candidate_name ?? r.filename}</p>
                                <p className="text-xs text-ink-muted">{r.email}</p>
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {!r.failed && <span className={`font-bold ${scoreTone(r.match_score)}`}>{r.match_score}%</span>}
                          </td>
                          <td className="px-5 py-4 text-ink-muted">{!r.failed && `${r.experience_years} yrs`}</td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-1.5 max-w-xs">
                              {r.matched_skills.slice(0, 4).map((s) => <SkillPill key={s} label={s} matched />)}
                              {r.missing_critical.slice(0, 2).map((s) => <SkillPill key={s} label={s} matched={false} />)}
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </AppShell>
    </RequireRole>
  );
}
