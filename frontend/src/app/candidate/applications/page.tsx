"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  CalendarClock,
  Video,
  MapPin,
  Phone,
  Download,
} from "lucide-react";

import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge, statusTone } from "@/components/ui/Badge";
import {
  EmptyState,
  SkeletonCard,
} from "@/components/ui/Feedback";
import { Reveal } from "@/components/ui/Motion";
import { api, InterviewData } from "@/lib/api";

type AppRow =
  Awaited<ReturnType<typeof api.myApplications>>[number];

const modeIcon = {
  online: Video,
  in_person: MapPin,
  phone: Phone,
};

export default function MyApplicationsPage() {
  const [rows, setRows] = useState<AppRow[] | null>(null);

  const [interviews, setInterviews] = useState<
    (InterviewData & {
      job_title: string;
      company_name?: string | null;
    })[]
  >([]);

  const [downloadingOffer, setDownloadingOffer] =
    useState<number | null>(null);

  useEffect(() => {
    api.myApplications().then(setRows);
    api.myInterviews().then(setInterviews);
  }, []);

  const handleDownloadOffer = async (
    applicationId: number
  ) => {
    try {
      setDownloadingOffer(applicationId);

      await api.downloadOfferLetter(applicationId);
    } catch (error) {
      console.error(
        "Failed to download offer letter:",
        error
      );

      alert(
        error instanceof Error
          ? error.message
          : "Could not download offer letter."
      );
    } finally {
      setDownloadingOffer(null);
    }
  };

  return (
    <RequireRole role="candidate">
      <AppShell>
        <PageHeader
          title="Applications"
          description="Track every role you've applied to."
        />

        <div className="px-6 sm:px-8 pb-10 space-y-6">

          {/* Upcoming Interviews */}
          {interviews.length > 0 && (
            <Reveal>
              <Card className="p-6">
                <h3 className="font-display font-semibold text-ink mb-4 flex items-center gap-2">
                  <CalendarClock
                    size={16}
                    className="text-brand"
                  />
                  Upcoming Interviews
                </h3>

                <div className="grid md:grid-cols-2 gap-3">
                  {interviews.map((iv) => {
                    const Icon =
                      modeIcon[
                        iv.mode as keyof typeof modeIcon
                      ] ?? Video;

                    return (
                      <div
                        key={iv.id}
                        className="bg-canvas rounded-lg p-4"
                      >
                        <p className="font-medium text-ink">
                          {iv.job_title}
                        </p>

                        {iv.company_name && (
                          <p className="text-xs text-ink-muted">
                            {iv.company_name}
                          </p>
                        )}

                        <p className="text-sm text-ink-muted mt-1">
                          {new Date(
                            iv.scheduled_at
                          ).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </p>

                        <p className="text-xs text-ink-muted mt-1 flex items-center gap-1.5 capitalize">
                          <Icon size={12} />
                          {iv.mode.replace("_", " ")} ·{" "}
                          {iv.duration_minutes} min
                        </p>

                        {iv.location_or_link && (
                          <p className="text-xs text-brand mt-1 truncate">
                            {iv.location_or_link}
                          </p>
                        )}

                        {iv.notes && (
                          <p className="text-xs text-ink-muted mt-2">
                            <span className="font-medium text-ink">
                              Notes:
                            </span>{" "}
                            {iv.notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </Reveal>
          )}

          {/* Applications */}
          {rows === null ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map(
                (_, i) => (
                  <SkeletonCard key={i} />
                )
              )}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<FileText size={32} />}
              title="No applications yet"
              description="Browse open jobs and apply to see your status and match score here."
            />
          ) : (
            <Reveal>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs font-semibold text-ink-muted uppercase tracking-wide bg-canvas/50">
                        <th className="px-5 py-3">
                          Job
                        </th>

                        <th className="px-5 py-3">
                          Match score
                        </th>

                        <th className="px-5 py-3">
                          Status
                        </th>

                        <th className="px-5 py-3">
                          Applied
                        </th>

                        <th className="px-5 py-3">
                          Offer Letter
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((r) => {
                        // Handles hired / HIRED / Hired
                        const isHired =
                          String(r.status).toLowerCase() ===
                          "hired";

                        const isDownloading =
                          downloadingOffer ===
                          r.application_id;

                        return (
                          <tr
                            key={r.application_id}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-5 py-4 font-medium text-ink">
                              {r.job_title}

                              {r.company_name && (
                                <span className="block text-xs text-ink-muted font-normal">
                                  {r.company_name}
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4 font-semibold text-brand">
                              {r.match_score !== null
                                ? `${r.match_score}%`
                                : "—"}
                            </td>

                            <td className="px-5 py-4">
                              <Badge
                                tone={statusTone(
                                  r.status
                                )}
                              >
                                {r.status.replace(
                                  "_",
                                  " "
                                )}
                              </Badge>
                            </td>

                            <td className="px-5 py-4 text-ink-muted">
                              {new Date(
                                r.applied_at
                              ).toLocaleDateString()}
                            </td>

                            <td className="px-5 py-4">
                              {isHired ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDownloadOffer(
                                      r.application_id
                                    )
                                  }
                                  disabled={
                                    isDownloading
                                  }
                                  className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                  <Download size={14} />

                                  {isDownloading
                                    ? "Downloading..."
                                    : "Download Offer"}
                                </button>
                              ) : (
                                <span className="text-xs text-ink-muted">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </Reveal>
          )}
        </div>
      </AppShell>
    </RequireRole>
  );
}