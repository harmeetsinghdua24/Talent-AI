"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Form";
import { api, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
          {sent ? (
            <div className="text-center">
              <CheckCircle2 size={32} className="mx-auto text-success mb-4" />
              <h1 className="font-display text-xl font-bold text-ink mb-2">Check your email</h1>
              <p className="text-sm text-ink-muted leading-relaxed">
                If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to reset your password.
                It expires in 30 minutes.
              </p>
            </div>
          ) : (
            <>
              <h1 className="font-display text-xl font-bold text-ink mb-1">Forgot your password?</h1>
              <p className="text-sm text-ink-muted mb-6">Enter your email and we&apos;ll send you a reset link.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <TextField
                  id="email"
                  label="Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
                {error && (
                  <p className="text-sm text-danger bg-danger-tint border border-danger/20 rounded-lg px-3 py-2">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            </>
          )}
        </div>
        <p className="text-center text-sm text-ink-muted mt-6">
          Remembered it?{" "}
          <Link href="/login" className="text-brand font-medium hover:text-brand-hover">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
