"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/lib/api";

export function RequireRole({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const { role: currentRole, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!currentRole) {
      router.replace("/login");
    } else if (currentRole !== role && currentRole !== "admin") {
      router.replace(currentRole === "recruiter" ? "/recruiter" : "/candidate");
    }
  }, [loading, currentRole, role, router]);

  if (loading || !currentRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
