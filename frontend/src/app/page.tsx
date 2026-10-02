"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles, ScanSearch, GitCompareArrows, ShieldCheck, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { SkillPill } from "@/components/ui/Badge";
import { AnimatedSection, AnimatedItem, Reveal } from "@/components/ui/Motion";
import { CustomCursor } from "@/components/ui/CustomCursor";
import { ParticleBackground } from "@/components/ui/ParticleBackground";
import { TiltCard } from "@/components/ui/TiltCard";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas relative isolate">
      <CustomCursor />
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <ParticleBackground />
      </div>
      <header className="border-b border-border bg-surface/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center">
              <Sparkles size={15} className="text-white" />
            </div>
            <span className="font-display font-bold text-ink tracking-tight text-lg">Talentum</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm text-ink-muted font-medium">
            <a href="#platform" className="hover:text-ink transition-colors">Platform</a>
            <a href="#how-it-works" className="hover:text-ink transition-colors">How it works</a>
            <a href="#responsible-ai" className="hover:text-ink transition-colors">Responsible AI</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link href="/register"><Button size="sm">Get Started</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28 grid md:grid-cols-2 gap-14 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          <h1 className="font-display text-[2.75rem] leading-[1.08] md:text-5xl font-bold text-ink tracking-tight">
            Hire smarter with AI-powered talent intelligence
          </h1>
          <p className="mt-6 text-lg text-ink-muted leading-relaxed max-w-lg">
            Talentum reads every resume and job description the way a great recruiter would —
            then ranks candidates with transparent, explainable scoring instead of a black box.
          </p>
          <div className="mt-9 flex items-center gap-3">
            <Link href="/register"><Button size="lg">Get Started</Button></Link>
            <a href="#platform">
              <Button variant="secondary" size="lg">
                Explore Platform <ArrowUpRight size={16} />
              </Button>
            </a>
          </div>
          <div className="mt-10 flex items-center gap-6 text-sm text-ink-faint">
            <span>Semantic candidate matching</span>
            <span className="w-1 h-1 rounded-full bg-border-strong" />
            <span>Skill-gap analysis</span>
            <span className="w-1 h-1 rounded-full bg-border-strong" />
            <span>Explainable ranking</span>
          </div>
        </motion.div>

        {/* Product preview card, not decorative gradient art */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
        >
          <TiltCard>
          <div className="bg-surface border border-border rounded-2xl shadow-float p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-sm font-semibold text-ink">Rahul Sharma</p>
                <p className="text-xs text-ink-muted">Applied for Python Developer</p>
              </div>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-success-tint text-success border border-success/20">
                Shortlisted
              </span>
            </div>
            <div className="flex items-center gap-6 border-t border-b border-border py-6">
              <ScoreRing score={92} size={92} strokeWidth={8} />
              <div className="flex-1 space-y-2.5">
                {[
                  ["Skill match", 94],
                  ["Semantic match", 91],
                  ["Experience", 88],
                ].map(([label, val], i) => (
                  <div key={label as string}>
                    <div className="flex justify-between text-xs text-ink-muted mb-1">
                      <span>{label}</span>
                      <span className="font-medium text-ink">{val}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-canvas overflow-hidden">
                      <motion.div
                        className="h-full bg-brand rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${val}%` }}
                        transition={{ duration: 0.8, delay: 0.4 + i * 0.12, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-5">
              <p className="text-xs font-medium text-ink-muted mb-2.5">Matched skills</p>
              <div className="flex flex-wrap gap-2">
                <SkillPill label="Python" matched />
                <SkillPill label="SQL" matched />
                <SkillPill label="REST API" matched />
                <SkillPill label="FastAPI" matched={false} />
              </div>
            </div>
          </div>
          </TiltCard>
        </motion.div>
      </section>

      {/* Feature grid */}
      <section id="platform" className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
        <Reveal className="max-w-xl mb-12">
          <h2 className="font-display text-3xl font-bold text-ink tracking-tight">
            Everything a hiring team needs, in one workflow
          </h2>
          <p className="mt-3 text-ink-muted">
            From the moment a resume lands to the moment you extend an offer.
          </p>
        </Reveal>
        <AnimatedSection className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: ScanSearch,
              title: "Resume & JD intelligence",
              desc: "NLP extracts skills, experience, education and projects from resumes and job descriptions — no manual tagging.",
            },
            {
              icon: GitCompareArrows,
              title: "Semantic candidate matching",
              desc: "Goes beyond keyword search: embeddings recognize that \"Django REST Framework\" satisfies a \"REST API\" requirement.",
            },
            {
              icon: ShieldCheck,
              title: "Explainable ranking",
              desc: "Every score breaks down into skill, semantic, experience and project components — never a mystery number.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <AnimatedItem key={title}>
              <div className="p-6 rounded-2xl border border-border bg-surface transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-ink/5 hover:border-border-strong h-full">
                <div className="w-10 h-10 rounded-xl bg-brand-tint flex items-center justify-center mb-4">
                  <Icon size={19} className="text-brand" />
                </div>
                <h3 className="font-display font-semibold text-ink mb-2">{title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{desc}</p>
              </div>
            </AnimatedItem>
          ))}
        </AnimatedSection>
      </section>

      {/* How it works — a genuine sequence, so numbered steps are earned here */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20 border-t border-border">
        <Reveal>
          <h2 className="font-display text-3xl font-bold text-ink tracking-tight mb-12">How it works</h2>
        </Reveal>
        <AnimatedSection className="grid md:grid-cols-3 gap-10">
          {[
            { step: "1", title: "Post a role", desc: "Paste a job description. Talentum classifies must-have vs. good-to-have skills automatically." },
            { step: "2", title: "Candidates apply", desc: "Resumes are parsed on upload — skills, experience and projects extracted in seconds." },
            { step: "3", title: "Review a ranked shortlist", desc: "See every candidate scored and explained, then shortlist, reject, or compare side by side." },
          ].map(({ step, title, desc }) => (
            <AnimatedItem key={step}>
              <div className="w-9 h-9 rounded-full border border-border-strong flex items-center justify-center font-display font-bold text-ink mb-4">
                {step}
              </div>
              <h3 className="font-display font-semibold text-ink mb-2">{title}</h3>
              <p className="text-sm text-ink-muted leading-relaxed">{desc}</p>
            </AnimatedItem>
          ))}
        </AnimatedSection>
      </section>

      <section id="responsible-ai" className="max-w-6xl mx-auto px-6 py-16 border-t border-border">
        <Reveal className="rounded-2xl bg-brand-tint border border-brand/15 p-8">
          <h3 className="font-display font-semibold text-ink mb-2">Responsible AI</h3>
          <p className="text-sm text-ink-muted max-w-3xl leading-relaxed">
            Talentum never ranks candidates using religion, caste, race, ethnicity, political affiliation, or health
            information, and avoids unnecessary use of gender, photographs, or addresses. AI-generated recommendations
            are decision-support outputs and should not be used as the sole basis for employment decisions.
          </p>
        </Reveal>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-ink-faint">
          <span>© {new Date().getFullYear()} Talentum. Built as a talent-intelligence research project.</span>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-ink transition-colors">Sign in</Link>
            <Link href="/register" className="hover:text-ink transition-colors">Get started</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
