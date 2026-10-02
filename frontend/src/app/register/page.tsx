"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Briefcase, UserRound } from "lucide-react";
import clsx from "clsx";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Form";
import { useAuth } from "@/lib/auth-context";
import { ApiError, UserRole } from "@/lib/api";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("candidate");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register({
        email, password, full_name: fullName, role,
        ...(role === "recruiter" ? { company_name: companyName } : {}),
      });
      router.push(role === "recruiter" ? "/recruiter" : "/candidate");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-ink text-lg">Talentum</span>
        </Link>
        <div className="bg-surface border border-border rounded-2xl p-8">
          <h1 className="font-display text-xl font-bold text-ink mb-1">Create your account</h1>
          <p className="text-sm text-ink-muted mb-6">Choose how you&apos;ll use Talentum.</p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setRole("candidate")}
              className={clsx(
                "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors",
                role === "candidate" ? "border-brand bg-brand-tint text-brand" : "border-border text-ink-muted hover:border-border-strong"
              )}
            >
              <UserRound size={20} />
              Candidate
            </button>
            <button
              type="button"
              onClick={() => setRole("recruiter")}
              className={clsx(
                "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors",
                role === "recruiter" ? "border-brand bg-brand-tint text-brand" : "border-border text-ink-muted hover:border-border-strong"
              )}
            >
              <Briefcase size={20} />
              Recruiter
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              id="fullName"
              label="Full name"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
            />
            {role === "recruiter" && (
              <TextField
                id="companyName"
                label="Company name"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Acme Corp"
              />
            )}
            <TextField
              id="email"
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
            <TextField
              id="password"
              label="Password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
            {error && (
              <p className="text-sm text-danger bg-danger-tint border border-danger/20 rounded-lg px-3 py-2">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </div>
        <p className="text-center text-sm text-ink-muted mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-brand font-medium hover:text-brand-hover">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
