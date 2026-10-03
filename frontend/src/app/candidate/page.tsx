"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  FileText,
  Sparkles,
  Briefcase,
  Star,
  TrendingUp,
  Target,
  CalendarClock,
  ArrowUpRight,
  Video,
  MapPin,
  Phone,
} from "lucide-react";

import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import {
  EmptyState,
  SkeletonCard,
} from "@/components/ui/Feedback";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { TiltCard } from "@/components/ui/TiltCard";
import {
  Reveal,
  StaggerGrid,
  StaggerItem,
} from "@/components/ui/Motion";
import { api, InterviewData } from "@/lib/api";

type DashboardData =
  Awaited<ReturnType<typeof api.candidateDashboard>>;

type Rec = {
  job_id: number;
  job_title: string;
  company_name?: string | null;
  match_score: number;
  missing_skills: string[];
};

const STATUS_COLORS: Record<string, string> = {
  Shortlisted: "var(--success)",
  "Under review": "var(--warning)",
  Rejected: "var(--danger)",
  Hired: "var(--brand)",
};

const modeIcon = {
  online: Video,
  in_person: MapPin,
  phone: Phone,
};

export default function CandidateDashboardPage() {
  const [data, setData] =
    useState<DashboardData | null>(null);

  const [interviews, setInterviews] = useState<
    (InterviewData & {
      job_title: string;
      company_name?: string | null;
    })[]
  >([]);

  const [recommendations, setRecommendations] =
    useState<Rec[]>([]);

  useEffect(() => {
    const loadDashboard = async () => {
      // ---------------------------------------------
      // Candidate Dashboard
      // ---------------------------------------------
      try {
        const dashboard =
          await api.candidateDashboard();

        setData(dashboard);
      } catch (error) {
        console.error(
          "Candidate dashboard failed:",
          error
        );

        // Prevent infinite skeleton loading
        setData({
          total_applications: 0,
          shortlisted: 0,
          rejected: 0,
          under_review: 0,
          hired: 0,
          opportunities_count: 0,
          average_match_score: 0,
          status_breakdown: [],
          applications_timeline: [],
        });
      }

      // ---------------------------------------------
      // Interviews
      // ---------------------------------------------
      try {
        const interviewData =
          await api.myInterviews();

        setInterviews(interviewData);
      } catch (error) {
        console.error(
          "Interviews failed:",
          error
        );

        setInterviews([]);
      }

      // ---------------------------------------------
      // Recommendations
      // ---------------------------------------------
      try {
        const recommendationData =
          await api.recommendedJobs();

        setRecommendations(
          recommendationData.results?.slice(0, 3) ?? []
        );
      } catch (error) {
        console.error(
          "Recommendations failed:",
          error
        );

        setRecommendations([]);
      }
    };

    loadDashboard();
  }, []);

  const hasApplications =
    (data?.total_applications ?? 0) > 0;

  const pieData =
    data?.status_breakdown.filter(
      (s) => s.count > 0
    ) ?? [];

  return (
    <RequireRole role="candidate">
      <AppShell>
        <PageHeader
          title="Dashboard"
          description="Your profile and application activity at a glance."
        />

        <div className="px-6 sm:px-8 pb-10 space-y-8">
          {/* Loading state */}
          {data === null ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {Array.from({ length: 4 }).map(
                (_, i) => (
                  <SkeletonCard key={i} />
                )
              )}
            </div>
          ) : (
            <>
              {/* --------------------------------------- */}
              {/* Stats */}
              {/* --------------------------------------- */}

              <StaggerGrid className="grid grid-cols-2 md:grid-cols-4 gap-5">
                <StaggerItem>
                  <TiltCard>
                    <StatCard
                      icon={Briefcase}
                      label="Jobs applied to"
                      value={data.total_applications}
                      tone="brand"
                      href="/candidate/applications"
                    />
                  </TiltCard>
                </StaggerItem>

                <StaggerItem>
                  <TiltCard>
                    <StatCard
                      icon={Star}
                      label="Shortlisted"
                      value={data.shortlisted}
                      tone="success"
                      href="/candidate/applications"
                    />
                  </TiltCard>
                </StaggerItem>

                <StaggerItem>
                  <TiltCard>
                    <StatCard
                      icon={Target}
                      label="Opportunities open"
                      value={data.opportunities_count}
                      tone="info"
                      href="/candidate/jobs"
                    />
                  </TiltCard>
                </StaggerItem>

                <StaggerItem>
                  <TiltCard>
                    <StatCard
                      icon={TrendingUp}
                      label="Average match"
                      value={`${data.average_match_score}%`}
                      tone="warning"
                    />
                  </TiltCard>
                </StaggerItem>
              </StaggerGrid>

              {/* --------------------------------------- */}
              {/* Application Analytics */}
              {/* --------------------------------------- */}

              {!hasApplications ? (
                <Reveal>
                  <Card className="p-8">
                    <EmptyState
                      icon={<FileText size={32} />}
                      title="Upload your resume to get started"
                      description="Once your resume is processed and you apply to roles, your application activity and match scores will appear here."
                      action={
                        <Link href="/candidate/resume">
                          <Button>
                            <Sparkles size={15} />
                            Upload resume
                          </Button>
                        </Link>
                      }
                    />
                  </Card>
                </Reveal>
              ) : (
                <div className="grid lg:grid-cols-2 gap-6">
                  {/* Status Breakdown */}
                  <Reveal>
                    <Card className="p-6">
                      <h3 className="font-display font-semibold text-ink mb-4">
                        Application status breakdown
                      </h3>

                      <ResponsiveContainer
                        width="100%"
                        height={260}
                      >
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={90}
                            paddingAngle={3}
                          >
                            {pieData.map(
                              (entry) => (
                                <Cell
                                  key={entry.status}
                                  fill={
                                    STATUS_COLORS[
                                      entry.status
                                    ] ??
                                    "var(--ink-faint)"
                                  }
                                />
                              )
                            )}
                          </Pie>

                          <Tooltip
                            contentStyle={{
                              borderRadius: 10,
                              border:
                                "1px solid var(--border)",
                              fontSize: 13,
                            }}
                          />

                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            formatter={(value) => (
                              <span
                                style={{
                                  color:
                                    "var(--ink-muted)",
                                  fontSize: 12,
                                }}
                              >
                                {value}
                              </span>
                            )}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Card>
                  </Reveal>

                  {/* Match Score */}
                  <Reveal delay={0.1}>
                    <Card className="p-6">
                      <h3 className="font-display font-semibold text-ink mb-4">
                        Match score per application
                      </h3>

                      <ResponsiveContainer
                        width="100%"
                        height={260}
                      >
                        <BarChart
                          data={
                            data.applications_timeline
                          }
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--border)"
                            vertical={false}
                          />

                          <XAxis
                            dataKey="job_title"
                            tick={{
                              fontSize: 11,
                              fill: "var(--ink-muted)",
                            }}
                            axisLine={{
                              stroke:
                                "var(--border)",
                            }}
                            tickLine={false}
                            interval={0}
                            angle={-15}
                            textAnchor="end"
                            height={50}
                          />

                          <YAxis
                            tick={{
                              fontSize: 12,
                              fill: "var(--ink-muted)",
                            }}
                            axisLine={false}
                            tickLine={false}
                            domain={[0, 100]}
                          />

                          <Tooltip
                            contentStyle={{
                              borderRadius: 10,
                              border:
                                "1px solid var(--border)",
                              fontSize: 13,
                            }}
                            formatter={(value) => [
                              `${value}%`,
                              "Match score",
                            ]}
                          />

                          <Bar
                            dataKey="match_score"
                            fill="var(--brand)"
                            radius={[
                              6,
                              6,
                              0,
                              0,
                            ]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </Card>
                  </Reveal>
                </div>
              )}

              {/* --------------------------------------- */}
              {/* Interviews + Recommendations */}
              {/* --------------------------------------- */}

              <div className="grid lg:grid-cols-2 gap-6">
                {/* Upcoming Interviews */}
                <Reveal delay={0.15}>
                  <Card className="p-6 h-full">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display font-semibold text-ink flex items-center gap-2">
                        <CalendarClock
                          size={16}
                          className="text-brand"
                        />
                        Upcoming interviews
                      </h3>

                      {interviews.length > 0 && (
                        <Link
                          href="/candidate/applications"
                          className="text-xs text-brand hover:text-brand-hover flex items-center gap-0.5"
                        >
                          View all
                          <ArrowUpRight size={12} />
                        </Link>
                      )}
                    </div>

                    {interviews.length === 0 ? (
                      <EmptyState
                        icon={
                          <CalendarClock size={28} />
                        }
                        title="No interviews scheduled"
                        description="Interviews you're invited to will show up here."
                      />
                    ) : (
                      <div className="space-y-3">
                        {interviews
                          .slice(0, 3)
                          .map((iv) => {
                            const Icon =
                              modeIcon[
                                iv.mode as keyof typeof modeIcon
                              ] ?? Video;

                            return (
                              <div
                                key={iv.id}
                                className="flex items-center gap-3 bg-canvas rounded-xl p-3.5"
                              >
                                <div className="w-10 h-10 rounded-lg bg-brand-tint text-brand flex items-center justify-center shrink-0">
                                  <Icon size={16} />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-ink truncate">
                                    {iv.job_title}
                                  </p>

                                  <p className="text-xs text-ink-muted">
                                    {iv.company_name
                                      ? `${iv.company_name} · `
                                      : ""}
                                    {new Date(
                                      iv.scheduled_at
                                    ).toLocaleString(
                                      undefined,
                                      {
                                        dateStyle:
                                          "medium",
                                        timeStyle:
                                          "short",
                                      }
                                    )}
                                  </p>

                                  {iv.notes && (
                                    <p className="text-xs text-ink-muted mt-1">
                                      <span className="font-medium text-ink">
                                        Notes:
                                      </span>{" "}
                                      {iv.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </Card>
                </Reveal>

                {/* Top Job Matches */}
                <Reveal delay={0.2}>
                  <Card className="p-6 h-full">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display font-semibold text-ink flex items-center gap-2">
                        <Sparkles
                          size={16}
                          className="text-brand"
                        />
                        Top job matches
                      </h3>

                      {recommendations.length > 0 && (
                        <Link
                          href="/candidate/recommendations"
                          className="text-xs text-brand hover:text-brand-hover flex items-center gap-0.5"
                        >
                          View all
                          <ArrowUpRight size={12} />
                        </Link>
                      )}
                    </div>

                    {recommendations.length === 0 ? (
                      <EmptyState
                        icon={<Sparkles size={28} />}
                        title="No recommendations yet"
                        description="Upload a resume to get jobs matched to your profile."
                      />
                    ) : (
                      <div className="space-y-3">
                        {recommendations.map(
                          (rec) => (
                            <div
                              key={rec.job_id}
                              className="flex items-center justify-between bg-canvas rounded-xl p-3.5"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-ink truncate">
                                  {rec.job_title}
                                </p>

                                {rec.company_name && (
                                  <p className="text-xs text-ink-muted truncate">
                                    {rec.company_name}
                                  </p>
                                )}
                              </div>

                              <span className="font-display font-bold text-brand text-sm shrink-0 ml-3">
                                {rec.match_score}%
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </Card>
                </Reveal>
              </div>
            </>
          )}
        </div>
      </AppShell>
    </RequireRole>
  );
}