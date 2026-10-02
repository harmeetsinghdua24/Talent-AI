"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, FileText, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";

interface ExtractedProfile {
  name: string | null;
  email: string | null;
  phone: string | null;
  total_experience_years: number;
  skills: { skill: string; matched_text: string }[];
  education: string[];
  projects: string[];
}

export default function ResumeUploadPage() {
  const { show } = useToast();
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ filename: string; extracted_profile: ExtractedProfile; resume_id: number; duplicate_check?: { is_duplicate: boolean } } | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const res = await api.uploadResume(file);
        setResult(res as unknown as { filename: string; extracted_profile: ExtractedProfile; resume_id: number; duplicate_check?: { is_duplicate: boolean } });
        show("Resume processed successfully.", "success");
      } catch (err) {
        show(err instanceof ApiError ? err.message : "Could not process resume.", "error");
      } finally {
        setUploading(false);
      }
    },
    [show]
  );

  return (
    <RequireRole role="candidate">
      <AppShell>
        <PageHeader title="Resume" description="Upload your resume — Talentum extracts your profile automatically." />
        <div className="px-6 sm:px-8 pb-10 max-w-2xl space-y-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            className={`rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
              dragging ? "border-brand bg-brand-tint" : "border-border-strong bg-surface"
            }`}
          >
            {uploading ? (
              <>
                <Loader2 size={32} className="mx-auto text-brand animate-spin mb-4" />
                <p className="text-sm font-medium text-ink">Processing resume…</p>
                <p className="text-xs text-ink-muted mt-1">Extracting skills, experience and education</p>
              </>
            ) : (
              <>
                <UploadCloud size={32} className="mx-auto text-ink-faint mb-4" />
                <p className="text-sm font-medium text-ink mb-1">Drop your resume here</p>
                <p className="text-xs text-ink-muted mb-4">PDF or DOCX, up to 10MB</p>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-hover cursor-pointer">
                  <span className="underline">Browse files</span>
                  <input
                    type="file"
                    accept=".pdf,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                </label>
              </>
            )}
          </div>

          {result && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-4">
            {result.duplicate_check?.is_duplicate && (
              <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-tint px-5 py-3.5">
                <AlertTriangle size={16} className="text-warning shrink-0 mt-0.5" />
                <p className="text-sm text-warning">
                  This resume&apos;s content matches another profile already on file. If this isn&apos;t expected, please
                  double check which account you meant to use.
                </p>
              </div>
            )}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <CheckCircle2 size={18} className="text-success" />
                <h3 className="font-display font-semibold text-ink">{result.filename}</h3>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-5 text-sm">
                <div className="flex items-center gap-2 text-ink-muted">
                  <FileText size={14} />
                  {result.extracted_profile.name ?? "Name not detected"}
                </div>
                <div className="text-ink-muted">{result.extracted_profile.total_experience_years} years experience</div>
              </div>
              <p className="text-xs font-medium text-ink-muted mb-2">Skills detected</p>
              <div className="flex flex-wrap gap-1.5">
                {result.extracted_profile.skills.map((s) => (
                  <Badge key={s.skill} tone="brand">
                    {s.skill}
                  </Badge>
                ))}
              </div>
            </Card>
            </motion.div>
          )}
        </div>
      </AppShell>
    </RequireRole>
  );
}
