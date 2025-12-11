"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Users,
  PlayCircle,
} from "lucide-react";

const Pill = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-200 backdrop-blur-sm">
    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
    {children}
  </span>
);

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("session_token");
    const user = localStorage.getItem("user");
    setIsLoggedIn(Boolean(token && user));
  }, []);

  const authHref = isLoggedIn ? "/dashboard" : "/login";
  const authLabel = isLoggedIn ? "Go to dashboard" : "Login";

  return (
    <div className="relative min-h-screen overflow-y-auto bg-gradient-to-b from-[#05091c] via-[#050313] to-[#020617] text-white">
      {/* Big colourful background gradients */}
      <div className="pointer-events-none fixed inset-0 -z-20">
        {/* Top glow */}
        <div className="absolute -top-40 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-600/45 via-emerald-500/25 to-purple-600/40 blur-[140px]" />
        {/* Subtle band in middle */}
        <div className="absolute inset-x-0 top-[380px] h-[360px] bg-gradient-to-r from-[#020617]/0 via-[#020617]/80 to-[#020617]/0" />
        {/* Very soft bottom glow */}
        <div className="absolute bottom-[-180px] left-1/2 h-[420px] w-[600px] -translate-x-1/2 rounded-full bg-purple-700/25 blur-[150px]" />
      </div>

      {/* Subtle grid overlay to avoid flat black */}
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.18]">
        <div className="h-full w-full bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:120px_120px]" />
      </div>

      {/* Page wrapper – more padding to feel roomy */}
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-24 pt-8 sm:px-8 lg:px-10">
        {/* Top strip */}
        <div className="mb-6 flex items-center justify-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200 backdrop-blur">
            <Sparkles className="h-3 w-3" />
            Built for NHS & private pharmacy services
          </span>
        </div>

        {/* Nav */}
        <header className="sticky top-0 z-30 mb-10 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/40 px-6 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
          <div className="flex items-center gap-3">

            <div>
              <div className="text-sm font-semibold tracking-tight">
                Pharmacy Express
              </div>
              <div className="text-[11px] text-neutral-400">
                Connected Pharmacy Platform
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm text-neutral-300 md:flex">
            <a href="#features" className="hover:text-white transition">
              Features
            </a>
            <a href="#workflow" className="hover:text-white transition">
              How it works
            </a>
            <a href="#benefits" className="hover:text-white transition">
              For pharmacies
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href={authHref}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs font-medium text-neutral-200 shadow-[0_0_25px_rgba(15,23,42,0.9)] hover:border-white/40 hover:bg-white/10"
            >
              {authLabel}
            </Link>
          </div>
        </header>

        {/* HERO – bigger padding & gap */}
        <main className="flex-1">
          <div className="flex flex-col items-center gap-12 rounded-[32px] border border-white/10 bg-gradient-to-br from-[#050918]/95 via-[#020617]/95 to-[#060015]/95 px-6 py-10 shadow-[0_28px_90px_rgba(0,0,0,0.85)] backdrop-blur-2xl lg:flex-row lg:items-start lg:gap-16 lg:px-14 lg:py-14">
            {/* Left side */}
            <section className="w-full max-w-xl space-y-8">
              <div className="space-y-4">
                <Pill>All-in-one practice & patient management</Pill>
                <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-[3.1rem] lg:leading-[1.15]">
                  Redefine how your
                  <span className="bg-gradient-to-r from-blue-400 via-emerald-400 to-purple-400 bg-clip-text text-transparent">
                    {" "}
                    pharmacy delivers care
                  </span>
                  .
                </h1>
                <p className="text-sm leading-relaxed text-neutral-200 sm:text-base">
                  Pharmacy Express brings consultations, appointments, patients,
                  workflows and analytics into one secure platform—purpose-built
                  for modern NHS and private pharmacy services.
                </p>
              </div>

              {/* Stats */}
              <div className="mt-4 grid grid-cols-3 gap-5">
                <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-4 text-center text-xs shadow-[0_16px_40px_rgba(16,185,129,0.45)] transition hover:-translate-y-1">
                  <div className="text-lg font-semibold text-emerald-300">
                    50%
                  </div>
                  <div className="text-[11px] text-emerald-50/80">
                    Less admin time
                  </div>
                </div>
                <div className="rounded-2xl border border-blue-500/40 bg-blue-500/10 px-4 py-4 text-center text-xs shadow-[0_16px_40px_rgba(37,99,235,0.45)] transition hover:-translate-y-1">
                  <div className="text-lg font-semibold text-blue-300">3×</div>
                  <div className="text-[11px] text-blue-50/80">
                    More services launched
                  </div>
                </div>
                <div className="rounded-2xl border border-purple-500/40 bg-purple-500/10 px-4 py-4 text-center text-xs shadow-[0_16px_40px_rgba(147,51,234,0.45)] transition hover:-translate-y-1">
                  <div className="text-lg font-semibold text-purple-300">
                    24/7
                  </div>
                  <div className="text-[11px] text-purple-50/80">
                    Online booking & triage
                  </div>
                </div>
              </div>

              {/* CTAs */}
              <div className="mt-4 flex flex-wrap items-center gap-4">

                <Link
                  href={authHref}
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2 text-xs font-medium text-neutral-100 hover:border-white/45 hover:bg-white/10"
                >
                  <PlayCircle className="h-4 w-4" />
                  {isLoggedIn ? "Open dashboard" : "Login to dashboard"}
                </Link>
              </div>

              <p className="text-xs text-neutral-300">
                Built for independent pharmacies, groups and PCNs who want
                safer consultations, less paperwork and happier patients.
              </p>
            </section>

            {/* Right side: mock dashboard card */}
            <section className="w-full max-w-xl">
              <div className="relative">
                <div className="pointer-events-none absolute -inset-1 rounded-[32px] bg-gradient-to-br from-blue-500/60 via-purple-500/40 to-emerald-500/40 opacity-90 blur-[22px]" />
                <div className="relative rounded-[28px] border border-white/15 bg-[#020617]/95 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.9)] backdrop-blur-xl lg:p-7">
                  {/* Top bar */}
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-neutral-200">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                      <div>
                        <div className="font-medium">Today&apos;s Clinics</div>
                        <div className="text-[11px] text-neutral-400">
                          Real-time snapshot across all sites
                        </div>
                      </div>
                    </div>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] text-neutral-300">
                      NHS &amp; private
                    </span>
                  </div>

                  {/* Fake dashboard: left list + right insights */}
                  <div className="flex flex-col gap-5 lg:flex-row">
                    {/* Sessions list */}
                    <div className="w-full space-y-3 lg:w-7/12">
                      {[
                        {
                          name: "Hypertension Review",
                          patients: "8 patients",
                          status: "In progress",
                          color: "text-emerald-300",
                        },
                        {
                          name: "Travel Clinic",
                          patients: "5 patients",
                          status: "Starting 14:00",
                          color: "text-sky-300",
                        },
                        {
                          name: "NHS Pharmacy First",
                          patients: "11 patients",
                          status: "Online triage live",
                          color: "text-purple-300",
                        },
                      ].map((row, idx) => (
                        <div
                          key={row.name}
                          className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs font-medium">
                              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              {row.name}
                            </div>
                            <div className="text-[11px] text-neutral-400">
                              {row.patients}
                            </div>
                          </div>
                          <div className="text-right text-[11px]">
                            <div className={`font-medium ${row.color}`}>
                              {row.status}
                            </div>
                            <div className="text-[10px] text-neutral-500">
                              Site {idx + 1}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Insights */}
                    <div className="w-full space-y-3 lg:w-5/12">
                      <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-xs">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-medium text-emerald-50">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Today&apos;s impact
                          </span>
                          <span className="text-[10px] text-emerald-100/80">
                            +32% vs last week
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-50/90">
                          24 consultations completed, 7 GP notifications sent
                          and 3 patients recalled automatically.
                        </p>
                      </div>

                      <div className="space-y-2 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-neutral-100">
                            <BarChart3 className="h-3.5 w-3.5" />
                            Live utilisation
                          </span>
                          <span className="text-[10px] text-neutral-400">
                            All sites
                          </span>
                        </div>
                        <div className="flex h-16 items-end gap-1.5">
                          {[60, 85, 45, 70, 92].map((v) => (
                            <div
                              key={v}
                              className="flex-1 rounded-full bg-gradient-to-t from-neutral-700 to-blue-500"
                              style={{ height: `${Math.max(20, v)}%` }}
                            />
                          ))}
                        </div>
                        <p className="text-[11px] text-neutral-400">
                          Identify under-used clinics and balance workload in
                          real time.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                    <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                      <CalendarClock className="h-3.5 w-3.5" />
                      <span>Next: Flu clinic full from 16:00–18:00</span>
                    </div>
                    <span className="text-[10px] text-neutral-500">
                      Auto-reminders ON
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>

        {/* FEATURES CARD – more margin & padding */}
        <section id="features" className="mt-24">
          <div className="rounded-3xl border border-white/10 bg-black/55 px-6 py-10 shadow-[0_22px_70px_rgba(0,0,0,0.75)] backdrop-blur-2xl sm:px-8 lg:px-10">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <Pill>Everything your clinical team needs</Pill>
                <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                  One platform for consultations, appointments, patients & data.
                </h2>
                <p className="mt-3 max-w-2xl text-sm text-neutral-300">
                  Replace spreadsheets and siloed tools with a single,
                  pharmacy-first system that keeps your teams aligned and your
                  data in sync.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {/* Consultation engine */}
              <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:-translate-y-1 hover:border-blue-500/60 hover:bg-white/10 hover:shadow-[0_18px_40px_rgba(0,0,0,0.7)]">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                  <span className="text-[18px]">⚕️</span>
                </div>
                <h3 className="text-sm font-semibold">Consultation engine</h3>
                <p className="mt-1.5 text-xs text-neutral-300">
                  Structured clinical templates, integrated PGDs and dynamic
                  prompts that standardise every consultation.
                </p>
                <ul className="mt-3 space-y-1.5 text-[11px] text-neutral-300">
                  <li>• Evidence-based flows for NHS & private services</li>
                  <li>• Built-in red-flag checks and safety prompts</li>
                  <li>• Auto-generated notes, letters & outcomes</li>
                </ul>
              </div>

              {/* Smart scheduling */}
              <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:-translate-y-1 hover:border-purple-500/60 hover:bg-white/10 hover:shadow-[0_18px_40px_rgba(0,0,0,0.7)]">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300">
                  <CalendarClock className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold">Smart scheduling</h3>
                <p className="mt-1.5 text-xs text-neutral-300">
                  Real-time rota, multi-site calendars and self-booking that
                  keep staff and patients in sync.
                </p>
                <ul className="mt-3 space-y-1.5 text-[11px] text-neutral-300">
                  <li>• Drag-and-drop clinics & sessions</li>
                  <li>• Automated SMS/email confirmations & reminders</li>
                  <li>• Hub-and-spoke and PCN ready</li>
                </ul>
              </div>

              {/* Patient hub */}
              <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:-translate-y-1 hover:border-emerald-500/60 hover:bg-white/10 hover:shadow-[0_18px_40px_rgba(0,0,0,0.7)]">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                  <Users className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold">Unified patient hub</h3>
                <p className="mt-1.5 text-xs text-neutral-300">
                  A single, longitudinal record with everything you need to make
                  safer decisions, faster.
                </p>
                <ul className="mt-3 space-y-1.5 text-[11px] text-neutral-300">
                  <li>• Consultation history, meds, allergies & notes</li>
                  <li>• NHS-ready coding & interoperability</li>
                  <li>• Attachments, forms and documents in one place</li>
                </ul>
              </div>

              {/* Workflow automation */}
              <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:-translate-y-1 hover:border-emerald-500/60 hover:bg-white/10 hover:shadow-[0_18px_40px_rgba(0,0,0,0.7)]">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold">Workflow automation</h3>
                <p className="mt-1.5 text-xs text-neutral-300">
                  From triage to follow-up, let the platform handle the
                  repetitive work behind the scenes.
                </p>
                <ul className="mt-3 space-y-1.5 text-[11px] text-neutral-300">
                  <li>• Digital pre-assessment forms</li>
                  <li>• Auto GP notifications & summary letters</li>
                  <li>• Recalls, aftercare and billing triggers</li>
                </ul>
              </div>

              {/* Analytics */}
              <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:-translate-y-1 hover:border-blue-500/60 hover:bg-white/10 hover:shadow-[0_18px_40px_rgba(0,0,0,0.7)]">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold">Real-time analytics</h3>
                <p className="mt-1.5 text-xs text-neutral-300">
                  See performance across sites, services and clinicians with
                  live dashboards.
                </p>
                <ul className="mt-3 space-y-1.5 text-[11px] text-neutral-300">
                  <li>• Service utilisation & revenue trends</li>
                  <li>• Patient demand & capacity planning</li>
                  <li>• Export-ready reports for commissioners</li>
                </ul>
              </div>

              {/* Compliance */}
              <div className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:-translate-y-1 hover:border-purple-500/60 hover:bg-white/10 hover:shadow-[0_18px_40px_rgba(0,0,0,0.7)]">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold">Compliance-first design</h3>
                <p className="mt-1.5 text-xs text-neutral-300">
                  Security, governance and accessibility built in from day one.
                </p>
                <ul className="mt-3 space-y-1.5 text-[11px] text-neutral-300">
                  <li>• Role-based access & full audit trails</li>
                  <li>• Standards-aligned, NHS-integrated architecture</li>
                  <li>• WCAG-aligned UI for your whole team</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS CARD */}
        <section id="workflow" className="mt-24">
          <div className="rounded-3xl border border-white/10 bg-black/55 px-6 py-10 shadow-[0_22px_70px_rgba(0,0,0,0.75)] backdrop-blur-2xl sm:px-8 lg:px-10">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <Pill>From interest to impact</Pill>
                <h2 className="mt-3 text-xl font-semibold sm:text-2xl">
                  Get up and running in weeks, not months.
                </h2>
                <p className="mt-3 max-w-2xl text-sm text-neutral-300">
                  We work with you to configure services, train your team and
                  connect to your existing systems—without disrupting daily
                  operations.
                </p>
              </div>
            </div>

            <ol className="mt-8 grid gap-5 md:grid-cols-3">
              <li className="relative rounded-2xl border border-blue-500/40 bg-blue-500/10 p-5 text-xs transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(37,99,235,0.6)]">
                <span className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/30 text-[11px] text-blue-50">
                  1
                </span>
                <h3 className="text-sm font-semibold">Discovery & demo</h3>
                <p className="mt-1.5 text-neutral-100">
                  We map your current clinics, services and workflows, then show
                  you how they live inside the platform.
                </p>
              </li>
              <li className="relative rounded-2xl border border-purple-500/40 bg-purple-500/10 p-5 text-xs transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(147,51,234,0.6)]">
                <span className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-purple-500/30 text-[11px] text-purple-50">
                  2
                </span>
                <h3 className="text-sm font-semibold">
                  Configuration & training
                </h3>
                <p className="mt-1.5 text-neutral-100">
                  We configure templates, schedulers and user roles, and deliver
                  focused training sessions for your teams.
                </p>
              </li>
              <li className="relative rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-xs transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(16,185,129,0.6)]">
                <span className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/30 text-[11px] text-emerald-50">
                  3
                </span>
                <h3 className="text-sm font-semibold">Launch & optimise</h3>
                <p className="mt-1.5 text-neutral-100">
                  Go live with priority services, then use analytics and our
                  support team to continually optimise performance.
                </p>
              </li>
            </ol>
          </div>
        </section>

        {/* BENEFITS / SEGMENTS CARD */}
        <section id="benefits" className="mt-24">
          <div className="grid gap-6 rounded-3xl border border-white/10 bg-black/55 px-6 py-10 shadow-[0_22px_70px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:px-8 lg:px-10 lg:grid-cols-[1.4fr,1fr]">
            <div>
              <Pill>Designed for every type of pharmacy</Pill>
              <h2 className="mt-3 text-xl font-semibold sm:text-2xl">
                Whether you&apos;re a single site or a multi-site group, Pharmacy
                Express scales with you.
              </h2>
              <p className="mt-3 max-w-xl text-sm text-neutral-300">
                Use one platform across NHS and private services, telehealth and
                in-person clinics, with a configuration that fits the way your
                teams actually work.
              </p>

              <div className="mt-6 grid gap-4 text-xs sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-semibold">
                    Independent & small groups
                  </h3>
                  <p className="mt-1.5 text-neutral-300">
                    Launch new services quickly, keep oversight simple and
                    reduce reliance on paper and spreadsheets.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-semibold">Larger groups & PCNs</h3>
                  <p className="mt-1.5 text-neutral-300">
                    Cross-site visibility, standardised care pathways and
                    dashboards for central teams & commissioners.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/20 via-neutral-900/95 to-neutral-950/95 p-6 text-xs shadow-[0_20px_60px_rgba(0,0,0,0.9)]">
              <p className="text-[11px] uppercase tracking-[0.15em] text-emerald-200">
                What partners say
              </p>
              <p className="mt-4 text-sm leading-relaxed text-neutral-50">
                “We&apos;ve cut manual admin almost in half and doubled the number
                of clinics we run each week—without adding headcount. The team
                finally feels ahead of demand instead of constantly catching up.”
              </p>
              <div className="mt-5">
                <div className="font-medium text-neutral-100">
                  Superintendent Pharmacist
                </div>
                <div className="text-[11px] text-neutral-400">
                  Multi-site community pharmacy group
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA CARD
        <section id="demo" className="mt-24">
          <div className="flex justify-center">
            <div className="inline-flex max-w-2xl flex-col items-center rounded-3xl border border-white/10 bg-black/60 px-8 py-9 text-center shadow-[0_22px_70px_rgba(0,0,0,0.85)] backdrop-blur-2xl sm:px-10 sm:py-10">
              <Pill>See it in action</Pill>
              <h2 className="mt-4 text-balance text-xl font-semibold sm:text-2xl">
                Ready to see how Pharmacy Express could work in your pharmacy?
              </h2>
              <p className="mt-3 text-sm text-neutral-300">
                Share a few details about your sites and current services, and
                we&apos;ll set up a tailored walkthrough for your team.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-7 py-2.5 text-sm font-semibold shadow-[0_0_35px_rgba(37,99,235,0.7)] hover:opacity-95"
                >
                  Book your demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="mailto:sales@pharmacyexpress.com"
                  className="text-xs text-neutral-300 underline-offset-4 hover:underline"
                >
                  Or email sales@pharmacyexpress.com
                </a>
              </div>
            </div>
          </div>
        </section> */}
      </div>
    </div>
  );
}
