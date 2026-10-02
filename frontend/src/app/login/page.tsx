"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Form";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const role = await login(email, password);
      router.push(role === "recruiter" ? "/recruiter" : "/candidate");
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
          <h1 className="font-display text-xl font-bold text-ink mb-1">Welcome back</h1>
          <p className="text-sm text-ink-muted mb-6">Sign in to continue to your dashboard.</p>
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
            <TextField
              id="password"
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <div className="text-right">
              <Link href="/forgot-password" className="text-sm text-brand hover:text-brand-hover">
                Forgot password?
              </Link>
            </div>
            {error && (
              <p className="text-sm text-danger bg-danger-tint border border-danger/20 rounded-lg px-3 py-2">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
        <p className="text-center text-sm text-ink-muted mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-brand font-medium hover:text-brand-hover">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
