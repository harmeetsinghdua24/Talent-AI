"use client";

import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Reveal } from "@/components/ui/Motion";
import { useAuth } from "@/lib/auth-context";

export default function CandidateSettingsPage() {
  const { user } = useAuth();
  return (
    <RequireRole role="candidate">
      <AppShell>
        <PageHeader title="Settings" description="Your account details." />
        <div className="px-6 sm:px-8 pb-10 max-w-lg">
          <Reveal><Card className="p-6 space-y-4">
            <div>
              <p className="text-xs font-medium text-ink-muted mb-1">Full name</p>
              <p className="text-sm text-ink">{user?.full_name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted mb-1">Email</p>
              <p className="text-sm text-ink">{user?.email}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-ink-muted mb-1">Role</p>
              <p className="text-sm text-ink capitalize">{user?.role}</p>
            </div>
          </Card></Reveal>
        </div>
      </AppShell>
    </RequireRole>
  );
}
