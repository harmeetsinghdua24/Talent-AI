"use client";

import { useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { RequireRole } from "@/components/RequireRole";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/Form";
import { Reveal } from "@/components/ui/Motion";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";

export default function RecruiterSettingsPage() {
  const { user, refreshUser } = useAuth();
  const { show } = useToast();
  const [editing, setEditing] = useState(false);
  const [companyName, setCompanyName] = useState(user?.company_name ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!companyName.trim()) return;
    setSaving(true);
    try {
      await api.updateProfile({ company_name: companyName.trim() });
      await refreshUser();
      show("Company name updated — it will now show on your job listings.", "success");
      setEditing(false);
    } catch (err) {
      show(err instanceof ApiError ? err.message : "Could not update company name.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <RequireRole role="recruiter">
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
            <div>
              <p className="text-xs font-medium text-ink-muted mb-1.5">Company name</p>
              {editing ? (
                <div className="flex items-center gap-2">
                  <TextField
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Corp"
                    className="flex-1"
                  />
                  <Button size="sm" onClick={handleSave} disabled={saving}>
                    <Check size={14} />
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => { setEditing(false); setCompanyName(user?.company_name ?? ""); }}>
                    <X size={14} />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-ink">{user?.company_name || "Not set"}</p>
                  <button onClick={() => setEditing(true)} className="text-ink-faint hover:text-brand transition-colors" aria-label="Edit company name">
                    <Pencil size={14} />
                  </button>
                </div>
              )}
              <p className="text-xs text-ink-muted mt-1.5">Shown to candidates on your job listings and in their notifications.</p>
            </div>
          </Card></Reveal>
        </div>
      </AppShell>
    </RequireRole>
  );
}
