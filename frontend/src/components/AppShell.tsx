"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Briefcase, Users, Star, BarChart3, Settings,
  FileText, Sparkles, LogOut, ScanSearch, ChevronDown, Menu, X, Building2,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/lib/auth-context";
import { NotificationBell } from "@/components/ui/NotificationBell";

const recruiterNav = [
  { href: "/recruiter", label: "Dashboard", icon: LayoutDashboard },
  { href: "/recruiter/jobs", label: "Jobs", icon: Briefcase },
  { href: "/recruiter/screening", label: "Screening", icon: ScanSearch },
  { href: "/recruiter/candidates", label: "Candidates", icon: Users },
  { href: "/recruiter/shortlisted", label: "Shortlisted", icon: Star },
  { href: "/recruiter/analytics", label: "Analytics", icon: BarChart3 },
];

const candidateNav = [
  { href: "/candidate", label: "Dashboard", icon: LayoutDashboard },
  { href: "/candidate/jobs", label: "Jobs", icon: Briefcase },
  { href: "/candidate/applications", label: "Applications", icon: FileText },
  { href: "/candidate/resume", label: "Resume", icon: FileText },
  { href: "/candidate/recommendations", label: "Recommendations", icon: Sparkles },
];

function UserMenu() {
  const { user, role, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const settingsHref = role === "recruiter" ? "/recruiter/settings" : "/candidate/settings";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-1.5 pr-2 py-1.5 rounded-full hover:bg-canvas transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center font-semibold text-xs">
          {user?.full_name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <ChevronDown size={14} className={clsx("text-ink-faint transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-60 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-medium text-ink truncate">{user?.full_name}</p>
              <p className="text-xs text-ink-muted truncate">{user?.email}</p>
              {user?.company_name && (
                <p className="text-xs text-ink-muted mt-1.5 flex items-center gap-1.5">
                  <Building2 size={11} /> {user.company_name}
                </p>
              )}
              <span className="inline-block mt-2 text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-brand-tint text-brand">
                {role}
              </span>
            </div>
            <Link
              href={settingsHref}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-muted hover:bg-canvas hover:text-ink transition-colors"
            >
              <Settings size={15} /> Settings
            </Link>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-danger hover:bg-danger-tint transition-colors"
            >
              <LogOut size={15} /> Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role } = useAuth();
  const nav = role === "recruiter" ? recruiterNav : candidateNav;
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string) {
    // Exact match for the dashboard root, prefix match for nested sections
    // (so /recruiter/jobs/5/candidates still highlights "Jobs").
    if (href === "/recruiter" || href === "/candidate") return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8 min-w-0">
            <Link href={role === "recruiter" ? "/recruiter" : "/candidate"} className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center">
                <Sparkles size={15} className="text-white" />
              </div>
              <span className="font-display font-bold text-ink tracking-tight">Talentum</span>
            </Link>

            <nav className="hidden lg:flex items-center gap-1">
              {nav.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(
                      "relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      active ? "text-brand" : "text-ink-muted hover:text-ink hover:bg-canvas"
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute inset-0 bg-brand-tint rounded-lg"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                    <Icon size={15} className="relative z-10" />
                    <span className="relative z-10">{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell />
            <UserMenu />
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-canvas transition-colors"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden border-t border-border overflow-hidden"
            >
              <div className="px-4 py-3 space-y-1">
                {nav.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={clsx(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      isActive(href) ? "bg-brand-tint text-brand" : "text-ink-muted hover:bg-canvas hover:text-ink"
                    )}
                  >
                    <Icon size={16} /> {label}
                  </Link>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      <main className="max-w-7xl mx-auto">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 px-6 sm:px-8 pt-8 pb-6 overflow-hidden">
      {/* Decorative gradient blob - purely visual, sits behind the text, clipped to this header */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-16 w-72 h-72 rounded-full opacity-[0.07] blur-3xl"
        style={{ background: "radial-gradient(circle, var(--brand) 0%, transparent 70%)" }}
      />
      <div className="relative">
        <h1 className="font-display text-2xl font-bold text-ink tracking-tight">{title}</h1>
        {description && <p className="text-sm text-ink-muted mt-1.5">{description}</p>}
      </div>
      {action && <div className="relative flex items-center gap-3 shrink-0">{action}</div>}
    </div>
  );
}
