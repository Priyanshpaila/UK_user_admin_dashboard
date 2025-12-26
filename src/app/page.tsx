"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Cloud,
  Lock,
  Puzzle,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";

/* ----------------- Small UI primitives ----------------- */

const Pill = ({
  children,
  tone = "emerald",
}: {
  children: React.ReactNode;
  tone?: "emerald" | "blue" | "purple";
}) => {
  const toneCls =
    tone === "blue"
      ? "border-blue-500/25 bg-blue-500/10 text-blue-100"
      : tone === "purple"
      ? "border-purple-500/25 bg-purple-500/10 text-purple-100"
      : "border-emerald-500/25 bg-emerald-500/10 text-emerald-100";

  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium " +
        toneCls
      }
    >
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      {children}
    </span>
  );
};

function Reveal({
  children,
  className = "",
  delay = 0,
  y = 18,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();

  return (
    <m.div
      className={className}
      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      whileInView={reduce ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.6,
        ease: [0.21, 0.8, 0.21, 1],
        delay,
      }}
    >
      {children}
    </m.div>
  );
}

/* ----------------- Accordion ----------------- */

function FAQAccordion({
  items,
  defaultOpenId,
}: {
  items: { id: string; q: string; a: string }[];
  defaultOpenId?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId || null);
  const reduce = useReducedMotion();

  return (
    <div className="space-y-2">
      {items.map((it) => {
        const open = openId === it.id;

        return (
          <div
            key={it.id}
            className="rounded-2xl border border-white/10 bg-white/[0.04]"
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : it.id)}
              className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
            >
              <span className="text-sm font-medium text-white">{it.q}</span>
              <m.span
                animate={reduce ? undefined : { rotate: open ? 180 : 0 }}
                transition={{ duration: 0.18 }}
                className="text-neutral-300"
              >
                <ChevronDown className="h-4 w-4" />
              </m.span>
            </button>

            <m.div
              initial={false}
              animate={
                reduce
                  ? { height: "auto", opacity: 1 }
                  : open
                  ? { height: "auto", opacity: 1 }
                  : { height: 0, opacity: 0 }
              }
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 text-sm text-neutral-300 leading-relaxed">
                {it.a}
              </div>
            </m.div>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------- Hero “screen” cards (no empty boxes) ----------------- */

function GlassShell({
  children,
  tint = "violet",
}: {
  children: React.ReactNode;
  tint?: "violet" | "cyan";
}) {
  const glow =
    tint === "cyan"
      ? "from-cyan-400/18 via-blue-500/10 to-emerald-400/12"
      : "from-purple-400/18 via-fuchsia-500/10 to-blue-500/12";

  return (
    <div className={"relative rounded-3xl p-[1px] bg-gradient-to-br " + glow}>
      <div
        className={[
          "relative rounded-3xl border border-white/10 overflow-hidden",
          // Slightly more opaque + more consistent base to stop bleed-through
          "bg-gradient-to-b from-slate-950/70 via-slate-950/55 to-slate-950/70",
          // Blur helps separate layers (keep moderate for performance)
          "backdrop-blur-md",
          "shadow-[0_28px_80px_rgba(0,0,0,0.55)]",
        ].join(" ")}
      >
        {/* Inner highlight (keeps the premium glass feel) */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_20%_10%,rgba(255,255,255,0.10),transparent_60%)]" />

        {/* Content scrim (this is the key readability layer) */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/20 to-black/35" />

        {/* Real content */}
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

function BrowserCard({
  title,
  subtitle,
  badge,
}: {
  title: string;
  subtitle: string;
  badge?: string;
}) {
  return (
    <GlassShell tint="violet">
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </div>
        {badge ? (
          <span className="text-[10px] text-neutral-200 rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
            {badge}
          </span>
        ) : (
          <span className="text-[10px] text-neutral-400">pharmacyexpress</span>
        )}
      </div>

      <div className="p-5">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-2 text-xs text-neutral-300 leading-relaxed">
          {subtitle}
        </p>

        {/* KPI row (replaces empty boxes) */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { k: "Clinics", v: "24", c: "text-emerald-300" },
            { k: "Booked", v: "18", c: "text-sky-300" },
            { k: "No-shows", v: "2", c: "text-purple-300" },
          ].map((x) => (
            <div
              key={x.k}
              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
            >
              <p className="text-[10px] text-neutral-400">{x.k}</p>
              <p className={"mt-1 text-sm font-semibold " + x.c}>{x.v}</p>
            </div>
          ))}
        </div>

        {/* “Queue” list */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-neutral-200">
              Today’s queue
            </p>
            <span className="text-[10px] text-neutral-400">Live</span>
          </div>

          <div className="mt-2 space-y-2">
            {[
              {
                t: "Hypertension Review",
                at: "14:10",
                s: "In progress",
                dot: "bg-emerald-400",
              },
              { t: "Travel Clinic", at: "14:30", s: "Next", dot: "bg-sky-400" },
              {
                t: "Pharmacy First",
                at: "15:00",
                s: "Triage",
                dot: "bg-purple-400",
              },
            ].map((r) => (
              <div
                key={r.t}
                className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={"h-2 w-2 rounded-full " + r.dot} />
                    <p className="text-[11px] font-medium text-white truncate">
                      {r.t}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[10px] text-neutral-400">
                    Slot {r.at}
                  </p>
                </div>
                <span className="text-[10px] text-neutral-200 rounded-full border border-white/10 bg-black/25 px-2 py-0.5">
                  {r.s}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Mini chart */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-neutral-200">
              Utilisation
            </p>
            <span className="text-[10px] text-neutral-400">All sites</span>
          </div>
          <div className="mt-2 flex h-10 items-end gap-1">
            {[52, 68, 44, 76, 90, 63].map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-full bg-gradient-to-t from-white/10 via-sky-400/45 to-emerald-400/55"
                style={{ height: `${Math.max(18, v)}%` }}
              />
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] text-neutral-400">
            Templates • Booking • Notes • Outcomes
          </span>
          <span className="text-[11px] text-emerald-300">Active</span>
        </div>
      </div>
    </GlassShell>
  );
}

function MobileCard() {
  return (
    <GlassShell tint="cyan">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <span className="text-[10px] text-neutral-200">Patient portal</span>
        <span className="text-[10px] text-neutral-400">Secure</span>
      </div>

      <div className="p-5 space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-semibold text-white">
            Book an appointment
          </p>
          <p className="mt-1 text-[11px] text-neutral-300">
            Choose a service, complete triage, confirm slot.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-neutral-400">Flow:</span>
            <span className="text-[10px] text-neutral-200 rounded-full border border-white/10 bg-black/25 px-2 py-0.5">
              Treatments → RAF → Calendar
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-neutral-400">Status</p>
            <p className="mt-1 text-xs font-semibold text-emerald-300">
              Approved
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-neutral-400">Next slot</p>
            <p className="mt-1 text-xs font-semibold text-white">15:30</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-[11px] text-neutral-400">Reminders</p>
          <div className="mt-2 h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-emerald-400/80 via-sky-400/70 to-purple-400/80" />
          </div>
          <p className="mt-2 text-[11px] text-neutral-300">
            Automated SMS/email enabled.
          </p>
        </div>
      </div>
    </GlassShell>
  );
}

/* ----------------- Page ----------------- */

export default function Home() {
  const reduce = useReducedMotion();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("session_token");
    const user = localStorage.getItem("user");
    setIsLoggedIn(Boolean(token && user));
  }, []);

  const authHref = isLoggedIn ? "/dashboard" : "/login";
  const authLabel = isLoggedIn ? "Go to dashboard" : "Login";

  const heroRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start end", "end start"],
  });

  // Parallax values (smoothed) — no jank
  const rawY1 = useTransform(
    scrollYProgress,
    [0, 1],
    reduce ? [0, 0] : [16, -16]
  );
  const rawY2 = useTransform(
    scrollYProgress,
    [0, 1],
    reduce ? [0, 0] : [26, -26]
  );

  const parallaxY = useSpring(rawY1, { stiffness: 90, damping: 22, mass: 0.7 });
  const parallaxY2 = useSpring(rawY2, {
    stiffness: 90,
    damping: 22,
    mass: 0.7,
  });

  const faqs = useMemo(
    () => [
      {
        id: "faq1",
        q: "What does Pharmacy Express specialise in?",
        a: "Pharmacy Express is built for modern pharmacy workflows: patient onboarding, triage (RAF), appointment booking, order handling, consultation documentation, follow-ups and reporting—across NHS and private services.",
      },
      {
        id: "faq2",
        q: "Who is the platform for?",
        a: "Independent pharmacies, groups and PCNs who need consistent clinical workflows, fewer manual steps, reliable patient communication and better visibility across sites.",
      },
      {
        id: "faq3",
        q: "How do you handle security and compliance?",
        a: "Role-based access, audit trails, standards-aligned architecture, and a UI designed to support safer decisions with structured prompts and consistent documentation.",
      },
      {
        id: "faq4",
        q: "Do you support custom workflows and integrations?",
        a: "Yes. Configure booking flows (Treatments → Login → RAF → Calendar → Payment) per service, and integrate with existing systems as required.",
      },
      {
        id: "faq5",
        q: "What makes Pharmacy Express different?",
        a: "It is pharmacy-first: real-world clinic operations, multi-site visibility, patient safety prompts, automation where it matters, and clean operator UX for busy teams.",
      },
    ],
    []
  );

  return (
    <LazyMotion features={domAnimation}>
      <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-[#05091c] via-[#050313] to-[#020617] text-white">
        {/* Keyframes for smooth float (CSS, not JS) */}
        <style jsx global>{`
          .float-a {
            will-change: transform;
            animation: floatA 7.5s ease-in-out infinite;
          }
          .float-b {
            will-change: transform;
            animation: floatB 9.2s ease-in-out infinite;
          }
          .float-c {
            will-change: transform;
            animation: floatC 8.4s ease-in-out infinite;
          }
          @keyframes floatA {
            0%,
            100% {
              transform: translate3d(0, 0, 0);
            }
            50% {
              transform: translate3d(0, -10px, 0);
            }
          }
          @keyframes floatB {
            0%,
            100% {
              transform: translate3d(0, 0, 0);
            }
            50% {
              transform: translate3d(0, 12px, 0);
            }
          }
          @keyframes floatC {
            0%,
            100% {
              transform: translate3d(0, 0, 0);
            }
            50% {
              transform: translate3d(0, -8px, 0);
            }
          }
          @media (prefers-reduced-motion: reduce) {
            .float-a,
            .float-b,
            .float-c {
              animation: none !important;
            }
          }
        `}</style>

        {/* Background glows (keep, but lighter) */}
        <div className="pointer-events-none fixed inset-0 -z-20">
          <div className="absolute -top-44 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-600/40 via-emerald-500/22 to-purple-600/32 blur-[140px]" />
          <div className="absolute top-[520px] left-[-240px] h-[520px] w-[520px] rounded-full bg-blue-500/16 blur-[160px]" />
          <div className="absolute top-[1020px] right-[-260px] h-[520px] w-[520px] rounded-full bg-emerald-500/12 blur-[170px]" />
          <div className="absolute bottom-[-220px] left-1/2 h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-purple-700/20 blur-[160px]" />
        </div>

        {/* Subtle grid overlay */}
        <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.14]">
          <div className="h-full w-full bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:120px_120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-8 lg:px-10">
          {/* Header */}
          <header className="sticky top-0 z-40 mb-10">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 shadow-[0_18px_55px_rgba(0,0,0,0.55)] backdrop-blur-md">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-emerald-300" />
                  </div>
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
                  <a href="#solutions" className="hover:text-white transition">
                    Solutions
                  </a>
                  <a href="#contact" className="hover:text-white transition">
                    Contact
                  </a>
                </nav>

                <div className="flex items-center gap-3">
                  <Link
                    href={authHref}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs font-medium text-neutral-200 hover:border-white/35 hover:bg-white/10 transition"
                  >
                    {authLabel}
                  </Link>
                </div>
              </div>
            </div>
          </header>

          {/* HERO */}
          <section ref={heroRef} className="relative">
            <div className="grid gap-10 lg:grid-cols-[1.05fr,0.95fr] lg:items-center">
              {/* Left */}
              <m.div
                initial="hidden"
                animate="show"
                variants={{
                  hidden: { opacity: 0, y: 14 },
                  show: {
                    opacity: 1,
                    y: 0,
                    transition: {
                      duration: 0.6,
                      ease: [0.21, 0.8, 0.21, 1],
                      staggerChildren: 0.06,
                    },
                  },
                }}
                className="space-y-6"
              >
                <m.div
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0 },
                  }}
                  className="flex items-center gap-2"
                >
                  <Pill tone="blue">
                    AI + workflow automation for pharmacies
                  </Pill>
                </m.div>

                <m.h1
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0 },
                  }}
                  className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]"
                >
                  Powering the future of{" "}
                  <span className="bg-gradient-to-r from-blue-400 via-emerald-400 to-purple-400 bg-clip-text text-transparent">
                    pharmacy intelligence
                  </span>
                </m.h1>

                <m.p
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0 },
                  }}
                  className="max-w-xl text-sm leading-relaxed text-neutral-200 sm:text-base"
                >
                  Deliver cutting-edge consultations, triage and booking flows
                  that integrate seamlessly with real-world pharmacy
                  operations—helping teams move faster with safer, consistent
                  outcomes.
                </m.p>

                <m.div
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0 },
                  }}
                  className="flex flex-wrap items-center gap-3"
                >
                  <a
                    href="#solutions"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-emerald-600 px-5 py-2.5 text-xs font-semibold shadow-[0_0_34px_rgba(37,99,235,0.45)] hover:opacity-95 transition"
                  >
                    Explore solutions
                    <ArrowRight className="h-4 w-4" />
                  </a>

                  <a
                    href="#about"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-xs font-semibold text-neutral-100 hover:border-white/30 hover:bg-white/10 transition"
                  >
                    Learn more
                  </a>
                </m.div>

                {/* Stats row */}
                <m.div
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0 },
                  }}
                  className="mt-2 grid max-w-xl grid-cols-3 gap-4"
                >
                  {[
                    { k: "40%", v: "Efficiency boost" },
                    { k: "3.5×", v: "Retention increase" },
                    { k: "75%", v: "Automation coverage" },
                  ].map((s) => (
                    <div
                      key={s.k}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center shadow-[0_14px_34px_rgba(0,0,0,0.45)]"
                    >
                      <div className="text-lg font-semibold text-white">
                        {s.k}
                      </div>
                      <div className="mt-1 text-[11px] text-neutral-300">
                        {s.v}
                      </div>
                    </div>
                  ))}
                </m.div>
              </m.div>

              {/* Right: stacked “screens” — smooth + not sticker */}
              <div className="relative">
                <div className="pointer-events-none absolute -inset-2 rounded-[38px] bg-gradient-to-br from-blue-500/28 via-purple-500/16 to-emerald-500/16 blur-[22px]" />

                <div className="relative h-[520px] sm:h-[560px] lg:h-[600px]">
                  {/* Top browser (parallax outer, float inner) */}
                  <m.div
                    style={{ y: parallaxY }}
                    className="absolute right-0 top-6 w-[88%] sm:w-[82%] transform-gpu"
                  >
                    <div className="float-a transform-gpu">
                      <m.div
                        initial={{ opacity: 0, y: 12, rotate: 1.6 }}
                        animate={{ opacity: 1, y: 0, rotate: 1.6 }}
                        transition={{
                          duration: 0.55,
                          ease: [0.21, 0.8, 0.21, 1],
                        }}
                        className="origin-bottom-left"
                      >
                        <BrowserCard
                          title="One platform for every clinic workflow"
                          subtitle="Templates, triage, booking, orders and documentation—built to keep your team consistent and fast."
                          badge="Clinic suite"
                        />
                      </m.div>
                    </div>
                  </m.div>

                  {/* Mobile (parallax outer, float inner) */}
                  <m.div
                    style={{ y: parallaxY2 }}
                    className="absolute left-0 bottom-0 w-[72%] sm:w-[66%] transform-gpu"
                  >
                    <div className="float-b transform-gpu">
                      <m.div
                        initial={{ opacity: 0, y: 14, rotate: -1.8 }}
                        animate={{ opacity: 1, y: 0, rotate: -1.8 }}
                        transition={{
                          duration: 0.6,
                          delay: 0.05,
                          ease: [0.21, 0.8, 0.21, 1],
                        }}
                        className="origin-bottom-right"
                      >
                        <MobileCard />
                      </m.div>
                    </div>
                  </m.div>

                  {/* Floating status pill */}
                  <m.div
                    className="absolute right-10 bottom-16 hidden sm:block transform-gpu"
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.45, delay: 0.12 }}
                  >
                    <div className="float-c rounded-2xl border border-white/10 bg-black/30 px-4 py-3 backdrop-blur-md shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
                      <div className="flex items-center gap-2 text-xs text-neutral-200">
                        <CalendarClock className="h-4 w-4 text-emerald-300" />
                        <span className="font-medium">Next session</span>
                        <span className="text-neutral-400">•</span>
                        <span className="text-neutral-300">
                          Flu clinic 16:00
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-neutral-400">
                        Auto-reminders enabled • Capacity balanced
                      </div>
                    </div>
                  </m.div>
                </div>
              </div>
            </div>
          </section>

          {/* ABOUT + FAQ */}
          <section id="about" className="mt-20 sm:mt-24">
            <Reveal>
              <div className="mx-auto max-w-4xl text-center">
                <div className="flex justify-center">
                  <Pill tone="purple">About Pharmacy Express</Pill>
                </div>
                <h2 className="mt-5 text-balance text-3xl font-semibold sm:text-4xl">
                  Empowering{" "}
                  <span className="bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                    pharmacies
                  </span>{" "}
                  with smart automation
                </h2>
                <p className="mt-4 text-sm text-neutral-300 leading-relaxed">
                  We believe technology should amplify clinical teams—not
                  replace them. Our workflows reduce manual work, standardise
                  care and provide clear visibility across sites.
                </p>
              </div>
            </Reveal>

            <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr,0.95fr] lg:items-start">
              <Reveal className="rounded-3xl border border-white/10 bg-black/25 p-6 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-300" />
                  <p className="text-sm font-semibold text-white">
                    Faster workflows, safer outcomes
                  </p>
                </div>
                <p className="mt-3 text-sm text-neutral-300 leading-relaxed">
                  From triage and appointment selection to structured notes and
                  follow-ups, Pharmacy Express keeps the entire journey
                  consistent—reducing rework and improving the patient
                  experience.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      icon: (
                        <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      ),
                      t: "Standardised clinical flows",
                      d: "Evidence-based templates and prompts.",
                    },
                    {
                      icon: <BarChart3 className="h-4 w-4 text-blue-300" />,
                      t: "Real-time visibility",
                      d: "Know capacity, outcomes and utilisation.",
                    },
                    {
                      icon: <ShieldCheck className="h-4 w-4 text-purple-300" />,
                      t: "Compliance-first design",
                      d: "Audit trails and role-based access.",
                    },
                    {
                      icon: (
                        <CalendarClock className="h-4 w-4 text-emerald-300" />
                      ),
                      t: "Patient self-booking",
                      d: "Less phone work, fewer no-shows.",
                    },
                  ].map((x) => (
                    <div
                      key={x.t}
                      className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        {x.icon}
                        {x.t}
                      </div>
                      <p className="mt-2 text-[12px] text-neutral-300">{x.d}</p>
                    </div>
                  ))}
                </div>
              </Reveal>

              <Reveal delay={0.05}>
                <FAQAccordion items={faqs} defaultOpenId="faq1" />
              </Reveal>
            </div>
          </section>

          {/* CORE VALUES */}
          <section className="mt-20 sm:mt-24">
            <Reveal className="text-center">
              <h3 className="text-xl font-semibold text-white">
                Our core values
              </h3>
              <p className="mt-2 text-sm text-neutral-400">
                What guides how we design workflows and experiences.
              </p>
            </Reveal>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {[
                {
                  icon: Zap,
                  title: "Innovation first",
                  desc: "We ship practical automation that removes friction from everyday clinic operations.",
                },
                {
                  icon: Lock,
                  title: "Reliability built-in",
                  desc: "Predictable workflows, consistent data and an operator UX designed for real clinics.",
                },
                {
                  icon: Sparkles,
                  title: "Human-centred design",
                  desc: "We design for speed and clarity—so teams can focus on patients, not clicks.",
                },
              ].map((c, idx) => {
                const Icon = c.icon;
                return (
                  <Reveal key={c.title} delay={0.03 * idx}>
                    <div className="rounded-3xl border border-white/10 bg-black/25 p-6 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.55)] hover:bg-black/30 transition">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                        <Icon className="h-5 w-5 text-emerald-300" />
                      </div>
                      <h4 className="mt-4 text-sm font-semibold text-white">
                        {c.title}
                      </h4>
                      <p className="mt-2 text-sm text-neutral-300 leading-relaxed">
                        {c.desc}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </section>

          {/* SOLUTIONS */}
          <section id="solutions" className="mt-20 sm:mt-24">
            <Reveal className="text-center">
              <h2 className="text-3xl font-semibold sm:text-4xl">
                Powerful{" "}
                <span className="bg-gradient-to-r from-blue-400 via-emerald-400 to-purple-400 bg-clip-text text-transparent">
                  solutions
                </span>
              </h2>
              <p className="mt-3 text-sm text-neutral-300">
                Modules that work together across triage, booking, orders and
                outcomes.
              </p>
            </Reveal>

            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Cloud,
                  title: "Cloud operations",
                  desc: "Multi-site visibility with consistent workflows and shared reporting.",
                },
                {
                  icon: ShieldCheck,
                  title: "Security",
                  desc: "Role-based access, audit trails and governance-first architecture.",
                },
                {
                  icon: Zap,
                  title: "Performance",
                  desc: "Fast operator UX for busy teams—optimised flows, fewer steps.",
                },
                {
                  icon: BarChart3,
                  title: "Analytics",
                  desc: "Track utilisation, demand and outcomes across services and sites.",
                },
                {
                  icon: Sparkles,
                  title: "Automation",
                  desc: "Reminders, follow-ups, notes generation and workflow triggers.",
                },
                {
                  icon: Puzzle,
                  title: "Customisation",
                  desc: "Per-service flows (Treatments → RAF → Calendar → Payment) and templates.",
                },
              ].map((s, idx) => {
                const Icon = s.icon;
                return (
                  <Reveal key={s.title} delay={0.02 * idx}>
                    <div className="group rounded-3xl border border-white/10 bg-black/25 p-6 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.55)] hover:-translate-y-1 hover:bg-black/30 hover:border-emerald-500/35 transition">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                        <Icon className="h-5 w-5 text-emerald-300" />
                      </div>
                      <h3 className="mt-4 text-sm font-semibold text-white">
                        {s.title}
                      </h3>
                      <p className="mt-2 text-sm text-neutral-300 leading-relaxed">
                        {s.desc}
                      </p>
                      <div className="mt-4 h-px w-full bg-gradient-to-r from-white/0 via-white/10 to-white/0" />
                      <p className="mt-3 text-[12px] text-neutral-400">
                        Built to be adopted quickly without disrupting daily
                        operations.
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </section>

          {/* CONTACT / CTA */}
          <section id="contact" className="mt-20 sm:mt-24">
            <Reveal className="rounded-3xl border border-white/10 bg-black/25 p-8 text-center backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
              <div className="flex justify-center">
                <Pill>Get started</Pill>
              </div>
              <h2 className="mt-4 text-balance text-2xl font-semibold sm:text-3xl">
                Ready to streamline consultations and bookings?
              </h2>
              <p className="mt-3 text-sm text-neutral-300">
                Use the dashboard to configure services, flows and
                schedules—then go live.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={authHref}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-blue-600 px-6 py-2.5 text-xs font-semibold shadow-[0_0_34px_rgba(16,185,129,0.35)] hover:opacity-95 transition"
                >
                  {isLoggedIn ? "Open dashboard" : "Login to dashboard"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#solutions"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-xs font-semibold text-neutral-100 hover:border-white/30 hover:bg-white/10 transition"
                >
                  View solutions
                </a>
              </div>
            </Reveal>
          </section>

          {/* Footer */}
          <footer className="mt-20 border-t border-white/10 pt-10">
            <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-emerald-300" />
                  </div>
                  <div className="text-sm font-semibold">Pharmacy Express</div>
                </div>
                <p className="mt-3 max-w-sm text-sm text-neutral-400">
                  A connected platform for consultations, scheduling and clinic
                  operations.
                </p>
                <p className="mt-4 text-[11px] text-neutral-500">
                  © {new Date().getFullYear()} Pharmacy Express. All rights
                  reserved.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold text-neutral-200">
                    Product
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-neutral-400">
                    <li>
                      <a
                        className="hover:text-white transition"
                        href="#features"
                      >
                        Features
                      </a>
                    </li>
                    <li>
                      <a
                        className="hover:text-white transition"
                        href="#solutions"
                      >
                        Solutions
                      </a>
                    </li>
                    <li>
                      <Link
                        className="hover:text-white transition"
                        href={authHref}
                      >
                        Dashboard
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-200">
                    Company
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-neutral-400">
                    <li>
                      <a className="hover:text-white transition" href="#about">
                        About
                      </a>
                    </li>
                    <li>
                      <a
                        className="hover:text-white transition"
                        href="#contact"
                      >
                        Contact
                      </a>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-200">
                    Support
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-neutral-400">
                    <li className="text-neutral-500">
                      Email: <span className="text-neutral-300">support@…</span>
                    </li>
                    <li className="text-neutral-500">
                      Hours: <span className="text-neutral-300">Mon–Fri</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </LazyMotion>
  );
}
