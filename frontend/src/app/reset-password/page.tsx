"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Form";
import { api, ApiError } from "@/lib/api";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      await api.resetPassword(token, password);
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-sm text-danger">
          This link is missing its reset token. Please request a new password reset link.
        </p>
        <Link href="/forgot-password" className="text-brand font-medium text-sm hover:text-brand-hover mt-4 inline-block">
          Request a new link →
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <CheckCircle2 size={32} className="mx-auto text-success mb-4" />
        <h1 className="font-display text-xl font-bold text-ink mb-2">Password reset</h1>
        <p className="text-sm text-ink-muted">Redirecting you to sign in…</p>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-display text-xl font-bold text-ink mb-1">Set a new password</h1>
      <p className="text-sm text-ink-muted mb-6">Choose a strong password for your account.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField
          id="password"
          label="New password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
        <TextField
          id="confirmPassword"
          label="Confirm new password"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your new password"
        />
        {error && (
          <p className="text-sm text-danger bg-danger-tint border border-danger/20 rounded-lg px-3 py-2">{error}</p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Resetting…" : "Reset password"}
        </Button>
      </form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-ink text-lg">Talentum</span>
        </Link>
        <div className="bg-surface border border-border rounded-2xl p-8">
          <Suspense fallback={<p className="text-sm text-ink-muted text-center">Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
