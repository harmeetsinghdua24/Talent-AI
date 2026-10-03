const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("talentum_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;

  if (token) {
    window.localStorage.setItem("talentum_token", token);
  } else {
    window.localStorage.removeItem("talentum_token");
  }
}

export function getStoredRole(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("talentum_role");
}

export function setStoredRole(role: string | null) {
  if (typeof window === "undefined") return;

  if (role) {
    window.localStorage.setItem("talentum_role", role);
  } else {
    window.localStorage.removeItem("talentum_role");
  }
}

async function request<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {}
): Promise<T> {
  const { auth = true, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string>),
  };

  if (rest.body && !(rest.body instanceof FormData)) {
    finalHeaders["Content-Type"] = "application/json";
  }

  if (auth) {
    const token = getToken();

    if (token) {
      finalHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
  });

  if (!res.ok) {
    let detail = res.statusText;

    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* no JSON body */
    }

    throw new ApiError(
      res.status,
      typeof detail === "string" ? detail : JSON.stringify(detail)
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}

// ---- Types ----

export type UserRole = "recruiter" | "candidate" | "admin";

export interface UserOut {
  id: number;
  email: string;
  full_name: string | null;
  role: UserRole;
  company_name?: string | null;
}

export interface JobOut {
  id: number;
  title: string;
  department: string | null;
  description: string;
  experience_min: number;
  experience_max: number;
  education: string | null;
  location: string | null;
  employment_type: string | null;
  status: string;
  company_name?: string | null;

  ai_extracted: {
    must_have_skills: string[];
    good_to_have_skills: string[];
    experience_min_years: number;
    experience_max_years: number;
    education_requirement: string | null;
  } | null;
}

export interface RankedCandidate {
  rank: number;
  application_id: number;
  candidate_id: number;
  candidate_name: string | null;
  match_score: number;
  ml_shortlist_probability: number | null;
  experience_years: number;
  status: string;
}

export interface DashboardData {
  active_jobs: number;
  total_applicants: number;
  shortlisted: number;
  average_match_score: number;

  recent_applications: {
    application_id: number;
    job_id: number;
    status: string;
    applied_at: string;
  }[];

  top_candidates: {
    application_id: number;
    candidate_id: number;
    match_score: number;
  }[];
}

export interface ScreeningResultData {
  filename: string;
  candidate_name: string | null;
  email: string | null;
  experience_years: number;
  match_score: number;
  ml_shortlist_probability: number | null;
  matched_skills: string[];
  missing_critical: string[];
  missing_secondary: string[];
}

export interface ScreeningSessionSummary {
  id: number;
  title: string;
  job_description_preview: string;
  resume_count: number;
  created_at: string;
  top_score: number;
}

export interface InterviewCreatePayload {
  scheduled_at: string;
  duration_minutes?: number;
  mode?: "online" | "in_person" | "phone";
  location_or_link?: string;
  notes?: string;
}

export interface InterviewData {
  id: number;
  application_id: number;
  scheduled_at: string;
  duration_minutes: number;
  mode: string;
  location_or_link: string | null;
  notes: string | null;
  status: string;
}

export interface NotificationData {
  id: number;
  type: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface DuplicateCheck {
  is_duplicate: boolean;
  matches_candidate_name?: string | null;
  matches_candidate_email?: string | null;
}

// ---- Auth ----

export const api = {
  register: (
    payload: {
      email: string;
      password: string;
      full_name: string;
      role: UserRole;
      company_name?: string;
    }
  ) =>
    request<UserOut>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
      auth: false,
    }),

  updateProfile: (
    payload: {
      full_name?: string;
      company_name?: string;
    }
  ) =>
    request<UserOut>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  forgotPassword: (email: string) =>
    request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
      auth: false,
    }),

  resetPassword: (token: string, new_password: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({
        token,
        new_password,
      }),
      auth: false,
    }),

  login: (payload: {
    email: string;
    password: string;
  }) =>
    request<{
      access_token: string;
      role: UserRole;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
      auth: false,
    }),

  me: () => request<UserOut>("/auth/me"),

  // ---- Jobs ----

  listJobs: () => request<JobOut[]>("/jobs"),

  candidateJobActivity: () =>
    request<{
      total_jobs: number;
      applied_jobs: number;
      not_applied_jobs: number;
      open_jobs: number;
      closed_jobs: number;

      jobs: {
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
      }[];
    }>("/jobs/candidate/activity"),

  getJob: (id: number) =>
    request<JobOut>(`/jobs/${id}`),

  createJob: (payload: {
    title: string;
    department?: string;
    description: string;
    experience_min?: number;
    experience_max?: number;
    education?: string;
    location?: string;
    employment_type?: string;
  }) =>
    request<JobOut>("/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateJob: (
    id: number,
    payload: Partial<JobOut>
  ) =>
    request<JobOut>(`/jobs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  deleteJob: (id: number) =>
    request<void>(`/jobs/${id}`, {
      method: "DELETE",
    }),

  duplicateJob: (id: number) =>
    request<JobOut>(`/jobs/${id}/duplicate`, {
      method: "POST",
    }),

  // ---- Resumes / Applications ----

  myResumes: () =>
    request<
      {
        resume_id: number;
        filename: string;
        uploaded_at: string;
      }[]
    >("/resumes/mine"),

  uploadResume: (file: File) => {
    const formData = new FormData();

    formData.append("file", file);

    return request<{
      resume_id: number;
      filename: string;
      extracted_profile: unknown;
      status: string;
      duplicate_check: DuplicateCheck;
    }>("/resumes/upload", {
      method: "POST",
      body: formData,
    });
  },

  applyToJob: (
    jobId: number,
    resumeId: number
  ) =>
    request<{
      application_id: number;
      status: string;
    }>(
      `/applications/apply/${jobId}?resume_id=${resumeId}`,
      {
        method: "POST",
      }
    ),

  myApplications: () =>
    request<
      {
        application_id: number;
        job_id: number;
        job_title: string;
        company_name?: string | null;
        status: string;
        match_score: number | null;
        applied_at: string;
      }[]
    >("/applications/mine"),

  candidateDashboard: () =>
    request<{
      total_applications: number;
      shortlisted: number;
      rejected: number;
      under_review: number;
      hired: number;
      opportunities_count: number;
      average_match_score: number;
      status_breakdown: {
        status: string;
        count: number;
      }[];
      applications_timeline: {
        job_title: string;
        match_score: number;
        applied_at: string;
      }[];
    }>("/analytics/candidate-dashboard"),

  recommendedJobs: () =>
    request<{
      results: {
        job_id: number;
        job_title: string;
        company_name?: string | null;
        match_score: number;
        missing_skills: string[];
      }[];
      reason?: string;
    }>("/recommendations/jobs-for-me"),

  // ---- Bulk Screening ----

  previewRequirements: (jobDescription: string) => {
    const qs = new URLSearchParams({
      job_description: jobDescription,
    });

    return request<{
      must_have_skills: string[];
      good_to_have_skills: string[];
      experience_min_years: number;
      experience_max_years: number;
      education_requirement: string | null;
    }>(`/screening/must-have-preview?${qs.toString()}`);
  },

  scanOneResume: (
    jobDescription: string,
    file: File
  ) => {
    const formData = new FormData();

    formData.append("job_description", jobDescription);
    formData.append("file", file);

    return request<{
      filename: string;
      candidate_name: string | null;
      email: string | null;
      experience_years: number;
      match_score: number;
      ml_shortlist_probability: number | null;
      matched_skills: string[];
      missing_critical: string[];
      missing_secondary: string[];
    }>("/screening/scan-one", {
      method: "POST",
      body: formData,
    });
  },

  // ---- Screening History ----

  saveScreeningSession: (payload: {
    job_description: string;
    title?: string;
    results: ScreeningResultData[];
  }) =>
    request<{
      session_id: number;
    }>("/screening/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listScreeningSessions: () =>
    request<ScreeningSessionSummary[]>(
      "/screening/sessions"
    ),

  getScreeningSession: (id: number) =>
    request<{
      id: number;
      title: string;
      job_description: string;
      resume_count: number;
      created_at: string;
      results: ScreeningResultData[];
    }>(`/screening/sessions/${id}`),

  deleteScreeningSession: (id: number) =>
    request<void>(`/screening/sessions/${id}`, {
      method: "DELETE",
    }),

  exportSessionUrl: (
    id: number,
    format: "excel" | "pdf"
  ) =>
    `${API_URL}/screening/sessions/${id}/export/${format}`,

  downloadSessionExport: async (
    id: number,
    format: "excel" | "pdf",
    filename: string
  ) => {
    const token = getToken();

    const res = await fetch(
      `${API_URL}/screening/sessions/${id}/export/${format}`,
      {
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : {},
      }
    );

    if (!res.ok) {
      throw new ApiError(
        res.status,
        "Could not generate export"
      );
    }

    const blob = await res.blob();

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  },

  // ---- Interviews ----

  scheduleInterview: (
    jobId: number,
    applicationId: number,
    payload: InterviewCreatePayload
  ) =>
    request<InterviewData>(
      `/jobs/${jobId}/candidates/${applicationId}/interview`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  listInterviewsForApplication: (
    jobId: number,
    applicationId: number
  ) =>
    request<InterviewData[]>(
      `/jobs/${jobId}/candidates/${applicationId}/interviews`
    ),

  updateInterview: (
    interviewId: number,
    payload: Partial<InterviewCreatePayload> & {
      status?: string;
    }
  ) =>
    request<InterviewData>(
      `/interviews/${interviewId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  myInterviews: () =>
    request<
      (InterviewData & {
        job_title: string;
        company_name?: string | null;
      })[]
    >("/interviews/mine"),

  // ---- Notifications ----

  myNotifications: () =>
    request<{
      unread_count: number;
      notifications: NotificationData[];
    }>("/notifications/mine"),

  markNotificationRead: (id: number) =>
    request<NotificationData>(
      `/notifications/${id}/read`,
      {
        method: "POST",
      }
    ),

  markAllNotificationsRead: () =>
    request<{
      status: string;
    }>("/notifications/read-all", {
      method: "POST",
    }),

  // ---- Hiring funnel ----

  hiringFunnel: () =>
    request<{
      stages: {
        label: string;
        count: number;
      }[];

      rejected: number;

      conversion_rates: {
        applied_to_shortlisted: number;
        shortlisted_to_hired: number;
        applied_to_hired: number;
      };
    }>("/analytics/hiring-funnel"),

  // ---- Offer letter ----

  generateOfferLetter: async (
    jobId: number,
    applicationId: number,
    payload: {
      salary: string;
      joining_date: string;
      additional_terms?: string;
      mark_as_hired?: boolean;
    }
  ) => {
    const token = getToken();

    const res = await fetch(
      `${API_URL}/jobs/${jobId}/candidates/${applicationId}/offer-letter`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          ...(token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {}),
        },

        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      let detail = res.statusText;

      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch {
        /* no JSON body */
      }

      throw new ApiError(
        res.status,
        typeof detail === "string"
          ? detail
          : JSON.stringify(detail)
      );
    }

    const blob = await res.blob();

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `offer-letter-${applicationId}.pdf`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  },

  // ---------------------------------------------------------
  // Candidate: Download own offer letter
  // ---------------------------------------------------------

  downloadOfferLetter: async (
    applicationId: number,
    filename?: string
  ) => {
    const token = getToken();

    const res = await fetch(
      `${API_URL}/applications/${applicationId}/offer-letter`,
      {
        method: "GET",

        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      }
    );

    if (!res.ok) {
      let detail = res.statusText;

      try {
        const body = await res.json();
        detail = body.detail || detail;
      } catch {
        /* no JSON body */
      }

      throw new ApiError(
        res.status,
        typeof detail === "string"
          ? detail
          : JSON.stringify(detail)
      );
    }

    const blob = await res.blob();

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download =
      filename ||
      `offer-letter-${applicationId}.pdf`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  },

  // ---- Ranking ----

  rankCandidates: (
    jobId: number,
    params?: {
      min_score?: number;
      status?: string;
      sort_by?: string;
    }
  ) => {
    const qs = new URLSearchParams();

    if (params?.min_score) {
      qs.set(
        "min_score",
        String(params.min_score)
      );
    }

    if (params?.status) {
      qs.set("status", params.status);
    }

    if (params?.sort_by) {
      qs.set("sort_by", params.sort_by);
    }

    const suffix = qs.toString()
      ? `?${qs.toString()}`
      : "";

    return request<{
      total: number;
      page: number;
      page_size: number;
      results: RankedCandidate[];
    }>(
      `/jobs/${jobId}/candidates${suffix}`
    );
  },

  shortlist: (
    jobId: number,
    applicationId: number
  ) =>
    request<{
      application_id: number;
      status: string;
    }>(
      `/jobs/${jobId}/candidates/${applicationId}/shortlist`,
      {
        method: "POST",
      }
    ),

  reject: (
    jobId: number,
    applicationId: number
  ) =>
    request<{
      application_id: number;
      status: string;
    }>(
      `/jobs/${jobId}/candidates/${applicationId}/reject`,
      {
        method: "POST",
      }
    ),

  candidateDetail: (
    jobId: number,
    applicationId: number
  ) =>
    request<{
      application_id: number;
      status: string;
      applied_at: string;

      candidate: {
        name: string | null;
        email: string | null;
        experience_years: number;
        education: string[];
        projects: string[];
        certifications: string[];
      };

      score_breakdown: {
        overall: number;
        skill_match: number;
        semantic_match: number;
        experience: number;
        projects: number;
        education: number;
        certifications: number;
        ml_shortlist_probability: number | null;
      };

      skill_gap: {
        matched: string[];
        missing_critical: string[];
        missing_secondary: string[];
      };

      duplicate_check: DuplicateCheck;
    }>(
      `/jobs/${jobId}/candidates/${applicationId}/detail`
    ),

  compareCandidates: (
    applicationIds: number[]
  ) => {
    const qs = applicationIds
      .map(
        (id) => `application_ids=${id}`
      )
      .join("&");

    return request<{
      comparison: Record<string, unknown>[];
    }>(
      `/candidates/compare?${qs}`
    );
  },

  listShortlisted: () =>
    request<{
      results: {
        application_id: number;
        candidate_id: number;
        candidate_name: string | null;
        candidate_email: string | null;
        job_title: string;
        job_id: number;
        match_score: number | null;
        experience_years: number;
        current_status: string;
        shortlisted_at: string;
      }[];
    }>("/candidates/shortlisted"),

  downloadShortlistedPdf: async () => {
    const token = getToken();

    const res = await fetch(
      `${API_URL}/candidates/shortlisted/export/pdf`,
      {
        headers: token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {},
      }
    );

    if (!res.ok) {
      throw new ApiError(
        res.status,
        "Could not generate export"
      );
    }

    const blob = await res.blob();

    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download =
      "shortlisted-candidates.pdf";

    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(url);
  },

  listAllCandidates: () =>
    request<{
      results: {
        application_id: number;
        candidate_id: number;
        candidate_name: string | null;
        job_title: string;
        job_id: number;
        match_score: number;
        experience_years: number;
        status: string;
      }[];
    }>("/candidates/all"),

  // ---- Analytics ----

  recruiterDashboard: () =>
    request<DashboardData>(
      "/analytics/recruiter-dashboard"
    ),

  skillTrends: () =>
    request<{
      top_candidate_skills: {
        skill: string;
        count: number;
      }[];
    }>("/analytics/skill-trends"),

  matchDistribution: () =>
    request<{
      distribution: Record<string, number>;
    }>("/analytics/match-distribution"),
};