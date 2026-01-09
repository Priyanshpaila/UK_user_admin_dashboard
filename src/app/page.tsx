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
  AnimatePresence,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValue,
  useMotionTemplate,
} from "framer-motion";

/* ----------------- Branding (generalised / multi-tenant friendly) ----------------- */

type TenantBranding = {
  name: string;
  tagline: string;
  productLabel: string;
  supportEmail: string;
  footerBlurb: string;
  domainLabel: string;
};

const DEFAULT_BRAND: TenantBranding = {
  name: "Clinic Platform",
  tagline: "Connected Care Platform",
  productLabel: "Workflow automation platform",
  supportEmail: "info@safescript.co.uk",
  footerBlurb: "A connected platform for consultations, scheduling and operations.",
  domainLabel: "your-platform",
};

function titleCaseFromSlug(slug: string) {
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function inferBrandFromHost(): Partial<TenantBranding> {
  if (typeof window === "undefined") return {};
  const raw = window.location.hostname || "";
  const host = raw.split(":")[0].toLowerCase();
  if (!host || host === "localhost") return {};

  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return {};

  const sub = parts[0];
  const reserved = new Set([
    "www",
    "admin",
    "app",
    "api",
    "backend",
    "user",
    "portal",
    "dashboard",
  ]);
  if (!sub || reserved.has(sub)) return {};

  const inferredName = titleCaseFromSlug(sub);
  return inferredName ? { name: inferredName } : {};
}

function readBrandingFromStorage(): Partial<TenantBranding> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("tenant_branding");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Partial<TenantBranding>;
  } catch {
    return {};
  }
}

/* ----------------- UI primitives ----------------- */

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

  const dotCls =
    tone === "blue"
      ? "bg-blue-300"
      : tone === "purple"
      ? "bg-purple-300"
      : "bg-emerald-300";

  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium " +
        toneCls
      }
    >
      <span className={"h-1.5 w-1.5 rounded-full " + dotCls} />
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

/* ----------------- Mouse spotlight (UI-only) ----------------- */

function useSpotlight(ref: React.RefObject<HTMLElement | null>) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  useEffect(() => {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;

    const setCenter = () => {
      const r = el.getBoundingClientRect();
      mx.set(r.width / 2);
      my.set(r.height / 2);
    };

    setCenter();

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      mx.set(e.clientX - r.left);
      my.set(e.clientY - r.top);
    };

    const onLeave = () => setCenter();

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    window.addEventListener("resize", setCenter);

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("resize", setCenter);
    };
  }, [reduce, ref, mx, my]);

  return useMotionTemplate`
    radial-gradient(700px circle at ${mx}px ${my}px, rgba(16,185,129,0.14), transparent 58%),
    radial-gradient(900px circle at ${mx}px ${my}px, rgba(59,130,246,0.10), transparent 62%)
  `;
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

/* ----------------- Hero “screen” cards ----------------- */

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
          "bg-gradient-to-b from-slate-950/70 via-slate-950/55 to-slate-950/70",
          "backdrop-blur-md",
          "shadow-[0_28px_80px_rgba(0,0,0,0.55)]",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_55%_at_20%_10%,rgba(255,255,255,0.10),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/20 to-black/35" />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}

function BrowserCard({
  title,
  subtitle,
  badge,
  domainLabel,
}: {
  title: string;
  subtitle: string;
  badge?: string;
  domainLabel: string;
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
          <span className="text-[10px] text-neutral-400">{domainLabel}</span>
        )}
      </div>

      <div className="p-5">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-2 text-xs text-neutral-300 leading-relaxed">
          {subtitle}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { k: "Sites", v: "24", c: "text-emerald-300" },
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

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-neutral-200">
              Today’s schedule
            </p>
            <span className="text-[10px] text-neutral-400">Live</span>
          </div>

          <div className="mt-2 space-y-2">
            {[
              {
                t: "Follow-up Review",
                at: "14:10",
                s: "In progress",
                dot: "bg-emerald-400",
              },
              { t: "Walk-in Clinic", at: "14:30", s: "Next", dot: "bg-sky-400" },
              {
                t: "Triage Check",
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
        <span className="text-[10px] text-neutral-200">Client portal</span>
        <span className="text-[10px] text-neutral-400">Secure</span>
      </div>

      <div className="p-5 space-y-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-semibold text-white">Book an appointment</p>
          <p className="mt-1 text-[11px] text-neutral-300">
            Choose a service, complete triage, confirm a slot.
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
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoSent, setDemoSent] = useState(false);
  const [demoErrors, setDemoErrors] = useState<Record<string, string>>({});
  const [demoForm, setDemoForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    clinic: "",
    date: "",
    time: "",
    notes: "",
  });
const [pricingExpandedId, setPricingExpandedId] = useState<
  null | "essentials" | "managed" | "buyout"
>(null);

const essentialsExpanded = pricingExpandedId === "essentials";


  const demoTimes = useMemo(
    () => [
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "11:30",
      "12:00",
      "12:30",
      "13:00",
      "13:30",
      "14:00",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
      "16:30",
      "17:00",
    ],
    []
  );

  function openDemo() {
    setDemoSent(false);
    setDemoErrors({});
    setDemoOpen(true);
  }

  function closeDemo() {
    setDemoOpen(false);
  }

  function updateDemoField<K extends keyof typeof demoForm>(
    key: K,
    value: (typeof demoForm)[K]
  ) {
    setDemoForm((prev) => ({ ...prev, [key]: value }));
    setDemoErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!demoOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDemo();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [demoOpen]);

  function handleDemoSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nextErrors: Record<string, string> = {};
    const fullName = demoForm.fullName.trim();
    const email = demoForm.email.trim();
    const notes = demoForm.notes.trim();

    if (!fullName) nextErrors.fullName = "Full name is required";
    if (!email) nextErrors.email = "Email address is required";
    if (email && !email.includes("@")) nextErrors.email = "Enter a valid email";
    if (!notes) nextErrors.notes = "This field is required";

    if (Object.keys(nextErrors).length) {
      setDemoErrors(nextErrors);
      return;
    }

    const subject = `Demo request${
      demoForm.clinic.trim() ? ` - ${demoForm.clinic.trim()}` : ""
    }`;
    const lines = [
      "Demo request details",
      "",
      `Full name: ${fullName}`,
      `Email: ${email}`,
      `Phone: ${demoForm.phone.trim() || ""}`,
      `Clinic or practice: ${demoForm.clinic.trim() || ""}`,
      `Preferred demo date: ${demoForm.date || ""}`,
      `Preferred time: ${demoForm.time || ""}`,
      "",
      "Notes",
      notes,
    ];

    const body = lines.join("\n");
    const to = brand.supportEmail || "info@safescript.co.uk";

    setDemoSent(true);

    if (typeof window !== "undefined") {
      window.location.href = `mailto:${encodeURIComponent(
        to
      )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
  }

  const [brand, setBrand] = useState<TenantBranding>(DEFAULT_BRAND);

  useEffect(() => {
    const fromStorage = readBrandingFromStorage();
    const fromHost = inferBrandFromHost();
    setBrand((prev) => ({
      ...prev,
      ...fromHost,
      ...fromStorage,
    }));
  }, []);

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
        q: "What is the platform built for",
        a: "End to end clinic operations including onboarding, triage RAF, booking, payments, documentation, follow ups and reporting across one or many sites.",
      },
      {
        id: "faq2",
        q: "Who is it for",
        a: "Private clinics and provider groups who want fewer manual steps, consistent workflows, and a smoother patient journey from first contact to outcome.",
      },
      {
        id: "faq3",
        q: "How do you support security and compliance",
        a: "Role based access, audit trails, and structured data capture designed to support safer decisions and cleaner records.",
      },
      {
        id: "faq4",
        q: "Can we customise workflows and integrations",
        a: "Yes. Configure service flows and forms per treatment and integrate with your existing tools where needed.",
      },
      {
        id: "faq5",
        q: "What makes it feel different",
        a: "It is built for real teams. Fast to use, consistent by default, and designed around the day to day reality of clinics.",
      },
    ],
    []
  );

  /* ----------------- Page-level parallax + spotlight (UI only) ----------------- */

  const pageRef = useRef<HTMLDivElement | null>(null);
  const spotlightBg = useSpotlight(pageRef);

  const { scrollY } = useScroll();
  const orbY1 = useSpring(
    useTransform(scrollY, [0, 1400], reduce ? [0, 0] : [0, -140]),
    { stiffness: 80, damping: 26, mass: 0.8 }
  );
  const orbY2 = useSpring(
    useTransform(scrollY, [0, 1400], reduce ? [0, 0] : [0, 160]),
    { stiffness: 80, damping: 26, mass: 0.8 }
  );
  const orbY3 = useSpring(
    useTransform(scrollY, [0, 1400], reduce ? [0, 0] : [0, -90]),
    { stiffness: 80, damping: 26, mass: 0.8 }
  );
  const orbY4 = useSpring(
    useTransform(scrollY, [0, 1400], reduce ? [0, 0] : [0, 120]),
    { stiffness: 80, damping: 26, mass: 0.8 }
  );

  return (
    <LazyMotion features={domAnimation}>
      <div
        ref={pageRef}
        className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-[#05091c] via-[#050313] to-[#020617] text-white"
      >
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

          .sheen {
            position: relative;
            overflow: hidden;
          }
          .sheen::after {
            content: "";
            position: absolute;
            inset: -40% -70%;
            background: linear-gradient(
              110deg,
              transparent,
              rgba(255, 255, 255, 0.1),
              transparent
            );
            transform: translateX(-60%) skewX(-12deg);
            opacity: 0;
            transition: opacity 180ms ease;
          }
          .sheen:hover::after {
            opacity: 1;
            animation: sheenMove 0.85s ease;
          }
          @keyframes sheenMove {
            0% {
              transform: translateX(-60%) skewX(-12deg);
            }
            100% {
              transform: translateX(60%) skewX(-12deg);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .float-a,
            .float-b,
            .float-c {
              animation: none !important;
            }
            .sheen::after {
              animation: none !important;
            }
          }
        `}</style>

        {/* Spotlight overlay (UI only) */}
        <m.div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-70"
          style={{ background: spotlightBg }}
        />

        {/* Demo modal (same logic; better enter/exit) */}
        <AnimatePresence>
          {demoOpen ? (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8"
              aria-modal="true"
              role="dialog"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeDemo();
              }}
            >
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

              <m.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.985 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-950/85 via-slate-950/75 to-slate-950/85 shadow-[0_30px_90px_rgba(0,0,0,0.75)]"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_60%_at_20%_0%,rgba(16,185,129,0.10),transparent_60%)]" />

                <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
                  <div>
                    <p className="text-lg font-semibold text-white">
                      Schedule Your Demo
                    </p>
                    <p className="mt-1 text-sm text-neutral-300">
                      Share a few details and we will tailor the walkthrough to
                      your needs.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={closeDemo}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-200 hover:border-white/30 hover:bg-white/10 transition
                    active:scale-[0.99] active:translate-y-[1px]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/25"
                  >
                    Close
                  </button>
                </div>

                <div className="grid gap-6 p-6 lg:grid-cols-[1.05fr,0.95fr]">
                  <form onSubmit={handleDemoSubmit} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-neutral-200">
                          Full Name *
                        </label>
                        <input
                          value={demoForm.fullName}
                          onChange={(e) =>
                            updateDemoField("fullName", e.target.value)
                          }
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/15"
                          placeholder=""
                        />
                        {demoErrors.fullName ? (
                          <p className="mt-2 text-[11px] text-rose-300">
                            {demoErrors.fullName}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-neutral-200">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          value={demoForm.email}
                          onChange={(e) =>
                            updateDemoField("email", e.target.value)
                          }
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/15"
                          placeholder=""
                        />
                        {demoErrors.email ? (
                          <p className="mt-2 text-[11px] text-rose-300">
                            {demoErrors.email}
                          </p>
                        ) : null}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-neutral-200">
                          Phone Number
                        </label>
                        <input
                          value={demoForm.phone}
                          onChange={(e) =>
                            updateDemoField("phone", e.target.value)
                          }
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/15"
                          placeholder=""
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-neutral-200">
                          Clinic Practice Name
                        </label>
                        <input
                          value={demoForm.clinic}
                          onChange={(e) =>
                            updateDemoField("clinic", e.target.value)
                          }
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/15"
                          placeholder=""
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-neutral-200">
                          Preferred Demo Date
                        </label>
                        <input
                          type="date"
                          value={demoForm.date}
                          onChange={(e) => {
                            updateDemoField("date", e.target.value);
                            if (!e.target.value) updateDemoField("time", "");
                          }}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/15"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-neutral-200">
                          Preferred Time
                        </label>
                        <select
                          value={demoForm.time}
                          onChange={(e) => updateDemoField("time", e.target.value)}
                          disabled={!demoForm.date}
                          className="mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/15 disabled:opacity-60"
                        >
                          <option value="">
                            {demoForm.date
                              ? "Select a time"
                              : "Select a date first"}
                          </option>
                          {demoTimes.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-neutral-200">
                        Tell us about your practice and specific interests *
                      </label>
                      <textarea
                        value={demoForm.notes}
                        onChange={(e) => updateDemoField("notes", e.target.value)}
                        rows={5}
                        className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/15"
                        placeholder="Please describe your healthcare practice, number of staff, current challenges, and what features you're most interested in seeing..."
                      />
                      {demoErrors.notes ? (
                        <p className="mt-2 text-[11px] text-rose-300">
                          {demoErrors.notes}
                        </p>
                      ) : null}
                    </div>

                    {demoSent ? (
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                        Your email client should open with the demo request filled in.
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_34px_rgba(37,99,235,0.35)] hover:opacity-95 transition
                      active:scale-[0.99] active:translate-y-[1px]
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/25"
                    >
                      Request Demo
                    </button>

                    <p className="text-center text-[12px] text-neutral-400">
                      Questions before booking{" "}
                      <a
                        href={`mailto:${brand.supportEmail}`}
                        className="text-emerald-300 hover:text-emerald-200 transition"
                      >
                        Contact our team →
                      </a>
                    </p>
                  </form>

                  <div className="space-y-5">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                      <p className="text-sm font-semibold text-white">What to Expect</p>
                      <ul className="mt-4 space-y-3 text-sm text-neutral-200">
                        {[
                          "30-45 minute personalised demonstration",
                          "Live walkthrough of core platform features",
                          "Customised to your practice's specific needs",
                          "Q&A session with our healthcare technology experts",
                          "Custom pricing proposal for your practice",
                        ].map((t) => (
                          <li key={t} className="flex gap-3">
                            <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15">
                              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                            </span>
                            <span className="text-neutral-200">{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-blue-500/10 p-6">
                      <p className="text-sm font-semibold text-white">
                        Key Features We'll Show
                      </p>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-neutral-200">
                        {[
                          { t: "Patient Management", dot: "bg-blue-400" },
                          { t: "Smart Scheduling", dot: "bg-emerald-400" },
                          { t: "Pharmacy Services", dot: "bg-purple-400" },
                          { t: "Clinical Workflows", dot: "bg-orange-400" },
                        ].map((x) => (
                          <div key={x.t} className="flex items-center gap-3">
                            <span className={"h-2.5 w-2.5 rounded-full " + x.dot} />
                            <span>{x.t}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </m.div>
            </m.div>
          ) : null}
        </AnimatePresence>

        {/* Background orbs (scroll-parallax only; no logic changes) */}
        <div className="pointer-events-none fixed inset-0 -z-20">
          <m.div
            style={{ y: orbY1 }}
            className="absolute -top-44 left-1/2 h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-600/40 via-emerald-500/22 to-purple-600/32 blur-[140px]"
          />
          <m.div
            style={{ y: orbY2 }}
            className="absolute top-[520px] left-[-240px] h-[520px] w-[520px] rounded-full bg-blue-500/16 blur-[160px]"
          />
          <m.div
            style={{ y: orbY3 }}
            className="absolute top-[1020px] right-[-260px] h-[520px] w-[520px] rounded-full bg-emerald-500/12 blur-[170px]"
          />
          <m.div
            style={{ y: orbY4 }}
            className="absolute bottom-[-220px] left-1/2 h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-purple-700/20 blur-[160px]"
          />
        </div>

        <div className="pointer-events-none fixed inset-0 -z-10 opacity-[0.14]">
          <div className="h-full w-full bg-[linear-gradient(to_right,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:120px_120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-8 lg:px-10">
          {/* Header */}
          <header className="sticky top-0 z-40 mb-10">
            <div
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/25 px-5 py-4 shadow-[0_18px_55px_rgba(0,0,0,0.55)] backdrop-blur-md
              before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(120%_80%_at_20%_0%,rgba(59,130,246,0.18),transparent_60%)] before:opacity-70
              after:pointer-events-none after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-white/20 after:to-transparent"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-emerald-300" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold tracking-tight">
                      {brand.name}
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      {brand.tagline}
                    </div>
                  </div>
                </div>

                <nav className="hidden items-center gap-8 text-sm text-neutral-300 md:flex">
                  <a href="#about" className="hover:text-white transition">
                    Overview
                  </a>
                  <a href="#solutions" className="hover:text-white transition">
                    Modules
                  </a>
                  <a href="#pricing" className="hover:text-white transition">
                    Pricing
                  </a>
                  <a href="#contact" className="hover:text-white transition">
                    Demo
                  </a>
                </nav>

                <div className="flex items-center gap-3">
                  <Link
                    href={authHref}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2 text-xs font-medium text-neutral-200 hover:border-white/35 hover:bg-white/10 transition
                    active:scale-[0.99] active:translate-y-[1px]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/25"
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
                  Run your private clinic on{" "}
                  <span className="bg-gradient-to-r from-blue-400 via-emerald-400 to-purple-400 bg-clip-text text-transparent">
                    one seamless platform
                  </span>
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
                    operations intelligence
                  </span>
                </m.h1>

                <m.p
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0 },
                  }}
                  className="max-w-xl text-sm leading-relaxed text-neutral-200 sm:text-base"
                >
                  Bookings, patient records, clinical forms, payments and reporting in one place.
                  Configure flows per service, keep teams consistent, and give patients a smooth self booking experience.
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
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-emerald-600 px-5 py-2.5 text-xs font-semibold shadow-[0_0_34px_rgba(37,99,235,0.45)] hover:opacity-95 transition
                    active:scale-[0.99] active:translate-y-[1px]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/25"
                  >
                    Explore Modules
                    <ArrowRight className="h-4 w-4" />
                  </a>

                  <button
                    type="button"
                    onClick={openDemo}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-xs font-semibold text-neutral-100 hover:border-white/30 hover:bg-white/10 transition
                    active:scale-[0.99] active:translate-y-[1px]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/25"
                  >
                    Request a demo
                  </button>
                </m.div>

                <m.div
                  variants={{
                    hidden: { opacity: 0, y: 8 },
                    show: { opacity: 1, y: 0 },
                  }}
                  className="mt-2 grid max-w-xl grid-cols-3 gap-4"
                >
                  {[
                    { k: "Less admin", v: "Automate routine tasks" },
                    { k: "Fewer no shows", v: "Smart reminders and nudges" },
                    { k: "Clear insights", v: "Live reporting across services" },
                  ].map((s) => (
                    <div
                      key={s.k}
                      className="sheen group relative rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-4 text-center shadow-[0_14px_34px_rgba(0,0,0,0.45)]
                      transition will-change-transform hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.055]"
                    >
                      <div className="text-lg font-semibold text-white">{s.k}</div>
                      <div className="mt-1 text-[11px] text-neutral-300">{s.v}</div>
                    </div>
                  ))}
                </m.div>
              </m.div>

              {/* Right */}
              <div className="relative">
                <div className="pointer-events-none absolute -inset-2 rounded-[38px] bg-gradient-to-br from-blue-500/28 via-purple-500/16 to-emerald-500/16 blur-[22px]" />

                <div className="relative h-[520px] sm:h-[560px] lg:h-[600px]">
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
                          title="One platform for every workflow"
                          subtitle="Templates, triage, booking, orders and documentation—built to keep your team consistent and fast."
                          badge={brand.productLabel}
                          domainLabel={brand.domainLabel}
                        />
                      </m.div>
                    </div>
                  </m.div>

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
                        <span className="text-neutral-300">Review 16:00</span>
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
                  <Pill tone="purple">About the platform</Pill>
                </div>
                <h2 className="mt-5 text-balance text-3xl font-semibold sm:text-4xl">
                  Built for{" "}
                  <span className="bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                    clinics
                  </span>{" "}
                  that want speed and clarity
                </h2>
                <p className="mt-4 text-sm text-neutral-300 leading-relaxed">
                  The platform is designed to reduce admin, standardise delivery, and keep every step clear.
                  From triage to outcomes, your team gets a workflow that is easy to follow and easy to audit.
                </p>
              </div>
            </Reveal>

            <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr,0.95fr] lg:items-start">
              <Reveal className="rounded-3xl border border-white/10 bg-black/25 p-6 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-300" />
                  <p className="text-sm font-semibold text-white">
                    Designed for busy clinic teams
                  </p>
                </div>
                <p className="mt-3 text-sm text-neutral-300 leading-relaxed">
                  From triage and booking to structured notes and follow ups, the platform keeps the journey consistent.
                  That means fewer mistakes, less back and forth, and a better patient experience.
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    {
                      icon: <CheckCircle2 className="h-4 w-4 text-emerald-300" />,
                      t: "Bookings and reminders",
                      d: "Simple scheduling with confirmations and nudges.",
                    },
                    {
                      icon: <BarChart3 className="h-4 w-4 text-blue-300" />,
                      t: "Patient records",
                      d: "Documents, signatures, notes and audit trail.",
                    },
                    {
                      icon: <ShieldCheck className="h-4 w-4 text-purple-300" />,
                      t: "Compliance support",
                      d: "Role based access with consistent data capture.",
                    },
                    {
                      icon: <CalendarClock className="h-4 w-4 text-emerald-300" />,
                      t: "Forms and workflows",
                      d: "Per service flows that teams can follow.",
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
              <h3 className="text-xl font-semibold text-white">Our core values</h3>
              <p className="mt-2 text-sm text-neutral-400">
                Principles that keep the product simple, safe, and fast.
              </p>
            </Reveal>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {[
                {
                  icon: Zap,
                  title: "Speed by design",
                  desc: "Clear flows that reduce clicks and remove avoidable admin.",
                },
                {
                  icon: Lock,
                  title: "Trust and security",
                  desc: "Controls and records that help teams stay compliant and confident.",
                },
                {
                  icon: Sparkles,
                  title: "Built for adoption",
                  desc: "A familiar experience for staff and patients so it is easy to roll out.",
                },
              ].map((c, idx) => {
                const Icon = c.icon;
                return (
                  <Reveal key={c.title} delay={0.03 * idx}>
                    <div className="sheen group relative overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-6 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.55)]
                      transition will-change-transform hover:-translate-y-0.5 hover:bg-black/28 hover:border-white/20
                      before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(90%_70%_at_0%_0%,rgba(59,130,246,0.12),transparent_60%)] before:opacity-0 before:transition-opacity group-hover:before:opacity-100"
                    >
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
                Modular features that connect triage, booking, records, payments and reporting.
              </p>
            </Reveal>

            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Cloud,
                  title: "Multi site operations",
                  desc: "One system across locations with shared reporting and consistent workflows.",
                },
                {
                  icon: ShieldCheck,
                  title: "GDPR and governance",
                  desc: "Audit trail, permissions, and structured records that support safer delivery.",
                },
                {
                  icon: CalendarClock,
                  title: "Bookings and calendar",
                  desc: "Availability matching, confirmations, reminders and fewer no shows.",
                },
                {
                  icon: Sparkles,
                  title: "AI assistant",
                  desc: "Automation for messages, follow ups and workflow triggers where it helps.",
                },
                {
                  icon: Puzzle,
                  title: "Clinical forms",
                  desc: "Digital forms and templates that match your services and processes.",
                },
                {
                  icon: BarChart3,
                  title: "Analytics and reports",
                  desc: "Track demand, utilisation and outcomes across services.",
                },
              ].map((s, idx) => {
                const Icon = s.icon;
                return (
                  <Reveal key={s.title} delay={0.02 * idx}>
                    <div className="sheen group relative overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-6 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.55)]
                      transition will-change-transform hover:-translate-y-1 hover:bg-black/28 hover:border-emerald-500/35
                      before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(90%_70%_at_0%_0%,rgba(16,185,129,0.14),transparent_60%)] before:opacity-0 before:transition-opacity group-hover:before:opacity-100"
                    >
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
                        Built to be adopted quickly without disrupting daily operations.
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </section>

{/* PRICING */}
<section id="pricing" className="mt-20 sm:mt-24">
  <Reveal className="text-center">
    <h2 className="text-3xl font-semibold sm:text-4xl">
      Clear{" "}
      <span className="bg-gradient-to-r from-blue-400 via-emerald-400 to-purple-400 bg-clip-text text-transparent">
        pricing
      </span>{" "}
      for clinics
    </h2>
    <p className="mt-3 text-sm text-neutral-300">
      Start simple and expand as your workflows grow.
    </p>
  </Reveal>

  {/* Section backdrop (UI only) */}
  <div className="relative mt-10">
    <div className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -top-16 left-1/2 h-56 w-[72%] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600/18 via-emerald-600/12 to-purple-600/16 blur-[60px]" />
      <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(80%_70%_at_50%_0%,rgba(255,255,255,0.06),transparent_55%)]" />
    </div>

    {/* Responsive grid: 1 -> 2 -> 3 columns */}
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-7">
      {/* ---------------- Plan 1 ---------------- */}
      <Reveal>
        <m.div
          whileHover={reduce ? undefined : { y: -6, rotate: -0.2 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className={[
            "sheen group relative rounded-3xl border border-purple-500/35 bg-black/20",
            "p-5 sm:p-7 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.55)]",
            "flex flex-col overflow-hidden",
            // fixed card height ONLY on large screens, so expansion doesn't stretch other cards
            "lg:h-[720px]",
          ].join(" ")}
        >
          {/* accents */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-300/40 to-transparent" />
          <div className="pointer-events-none absolute -top-24 -right-20 h-56 w-56 rounded-full bg-purple-500/10 blur-[40px]" />

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Platform Essentials</p>
              <p className="mt-1 text-[12px] text-neutral-400">
                Ideal for launching quickly with core modules.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold text-neutral-200">
              Starter
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              £199
            </p>
            <p className="text-sm text-neutral-300 whitespace-nowrap">per month</p>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-sm text-neutral-300 leading-relaxed">
              Everything you need to launch your own branded clinic platform with essential
              features and integrations.
            </p>
          </div>

          {/* Feature area: scrolls on lg so expansion doesn't increase card height */}
          <div className="mt-6 flex min-h-0 flex-1 flex-col">
            <p className="text-[11px] font-semibold text-neutral-200">Includes</p>

            <div
              className={[
                "mt-3 space-y-3",
                // key: only scroll on large screens (desktop)
                "lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-2",
              ].join(" ")}
            >
              {[
                "Your own branded subdomain or domain mapping",
                "Your own homepage and service landing pages",
                "Add and manage your services products and prices",
                "Online bookings with appointment slots and confirmations",
                "Patient accounts so customers can return and manage bookings",
              ].map((t) => (
                <div
                  key={t}
                  className="flex items-start gap-3 text-sm text-neutral-200"
                >
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10">
                    <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  </span>
                  <span className="min-w-0 leading-relaxed">{t}</span>
                </div>
              ))}

              {essentialsExpanded ? (
                <m.div
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={reduce ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="pt-4"
                >
                  <div className="mb-4 h-px w-full bg-gradient-to-r from-white/0 via-white/12 to-white/0" />

                  <div className="space-y-3">
                    {[
                      "Patient records with a timeline of orders bookings and consultations",
                      "Consultation journey with step based clinical questions",
                      "Clinical forms and PGDs attached to your services",
                      "Order and consultation admin dashboard for your team",
                      "Staff access with roles and permissions per tenant",
                      "Reports for sales bookings and consultation outcomes",
                      "Secure hosting SSL and platform updates included",
                      "Email integration",
                      "Click and Drop integration",
                      "Video call integration for online consultations",
                      "Payment integration",
                    ].map((t) => (
                      <div
                        key={t}
                        className="flex items-start gap-3 text-sm text-neutral-200"
                      >
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10">
                          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                        </span>
                        <span className="min-w-0 leading-relaxed">{t}</span>
                      </div>
                    ))}
                  </div>
                </m.div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() =>
                setPricingExpandedId((prev) =>
                  prev === "essentials" ? null : "essentials"
                )
              }
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-semibold text-neutral-200 hover:border-white/30 hover:bg-white/10 transition
              active:scale-[0.99] active:translate-y-[1px]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/25"
            >
              {essentialsExpanded ? "Show less" : "See all features"}
            </button>
          </div>

          <button
            type="button"
            onClick={openDemo}
            className="mt-6 w-full rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_34px_rgba(147,51,234,0.30)] hover:opacity-95 transition
            active:scale-[0.99] active:translate-y-[1px]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/25"
          >
            Get Started
          </button>

          <p className="mt-4 text-center text-[11px] text-neutral-500">
            Recommended for new clinics and single-site teams.
          </p>
        </m.div>
      </Reveal>

      {/* ---------------- Plan 2 ---------------- */}
      <Reveal delay={0.03}>
        <m.div
          whileHover={reduce ? undefined : { y: -8, rotate: 0.15 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className={[
            "group relative rounded-3xl border border-white/20 bg-white/[0.04]",
            "p-5 sm:p-7 backdrop-blur-md shadow-[0_24px_70px_rgba(0,0,0,0.60)]",
            "flex flex-col overflow-hidden",
            "lg:h-[720px]",
          ].join(" ")}
        >
          <div className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-br from-blue-500/35 via-emerald-500/20 to-purple-500/25 blur-[18px]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[45px]" />

          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Managed Website and Forms</p>
                <p className="mt-1 text-[12px] text-neutral-400">
                  Hands-off setup with a polished launch experience.
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                Most popular
              </span>
            </div>

            <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                £299
              </p>
              <p className="text-sm text-neutral-300 whitespace-nowrap">per month</p>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm text-neutral-300 leading-relaxed">
                We build and configure your website and forms for you, so you can focus on
                delivering care.
              </p>
            </div>

            <div className="mt-6 flex min-h-0 flex-1 flex-col">
              <p className="text-[11px] font-semibold text-neutral-200">
                Everything in Essentials, plus
              </p>

              <div className="mt-3 space-y-3 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
                {[
                  "Everything in Platform Essentials",
                  "Website built by our team for your brand",
                  "Risk assessment forms built by us using your details",
                  "Clinic advice forms built by us using your details",
                  "Record of supply form built by us using your details",
                  "Email integration",
                  "Click and Drop integration",
                  "Video call integration for online consultations",
                  "Payment integration",
                ].map((t) => (
                  <div key={t} className="flex items-start gap-3 text-sm text-neutral-200">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/10">
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                    </span>
                    <span className="min-w-0 leading-relaxed">{t}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={openDemo}
              className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_34px_rgba(16,185,129,0.25)] hover:opacity-95 transition
              active:scale-[0.99] active:translate-y-[1px]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/25"
            >
              Get Started
            </button>

            <p className="mt-4 text-center text-[11px] text-neutral-500">
              Best for clinics that want a high-quality launch with minimal internal effort.
            </p>
          </div>
        </m.div>
      </Reveal>

      {/* ---------------- Plan 3 ---------------- */}
      <Reveal delay={0.06}>
        <m.div
          whileHover={reduce ? undefined : { y: -6, rotate: 0.2 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className={[
            "sheen group relative rounded-3xl border border-white/10 bg-black/20",
            "p-5 sm:p-7 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.55)]",
            "flex flex-col overflow-hidden",
            "lg:h-[720px]",
            // Center this card on tablets (2-column layout) so it doesn't look misaligned
            "md:col-span-2 md:max-w-[560px] md:justify-self-center",
            "lg:col-span-1 lg:max-w-none lg:justify-self-auto",
          ].join(" ")}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-300/35 to-transparent" />
          <div className="pointer-events-none absolute -top-24 -left-20 h-56 w-56 rounded-full bg-blue-500/10 blur-[40px]" />

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Buy outright</p>
              <p className="mt-1 text-[12px] text-neutral-400">
                Ownership model with deployment and handover.
              </p>
            </div>
            <span className="shrink-0 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[11px] font-semibold text-blue-100">
              One-time
            </span>
          </div>

          <p className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            One off payment
          </p>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <p className="text-sm text-neutral-300 leading-relaxed">
              Own the tenant platform outright with a one off purchase. We deploy, configure
              and hand over a complete system with no monthly subscription.
            </p>
          </div>

          <div className="mt-6 flex min-h-0 flex-1 flex-col">
            <p className="text-[11px] font-semibold text-neutral-200">Includes</p>

            <div className="mt-3 space-y-3 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
              {[
                "One off licence and setup",
                "Annual service charge for updates and support",
                "Tenant configuration and deployment",
                "Service setup and workflow configuration",
                "Onboarding and training for your team",
                "Email integration",
                "Click and Drop integration",
                "Video call integration for online consultations",
                "Payment integration",
              ].map((t) => (
                <div key={t} className="flex items-start gap-3 text-sm text-neutral-200">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-blue-500/25 bg-blue-500/10">
                    <CheckCircle2 className="h-4 w-4 text-blue-200" />
                  </span>
                  <span className="min-w-0 leading-relaxed">{t}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={openDemo}
            className="mt-6 w-full rounded-xl border border-blue-500/35 bg-blue-500/10 px-5 py-3 text-sm font-semibold text-blue-100 hover:bg-blue-500/15 hover:border-blue-400/50 transition
            active:scale-[0.99] active:translate-y-[1px]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/25"
          >
            Discuss buyout
          </button>

          <p className="mt-4 text-center text-[11px] text-neutral-500">
            Suitable for organisations that prefer ownership and internal control.
          </p>
        </m.div>
      </Reveal>
    </div>

    <Reveal delay={0.08} className="mt-8">
      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-sm text-neutral-300 backdrop-blur-md shadow-[0_18px_55px_rgba(0,0,0,0.45)]">
        Pricing is indicative. We will confirm the right plan and modules during your demo.
      </div>
    </Reveal>
  </div>
</section>



          {/* CONTACT / CTA */}
          <section id="contact" className="mt-20 sm:mt-24">
            <Reveal className="rounded-3xl border border-white/10 bg-black/25 p-8 text-center backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
              <div className="flex justify-center">
                <Pill>Get started</Pill>
              </div>
              <h2 className="mt-4 text-balance text-2xl font-semibold sm:text-3xl">
                Request a live demo
              </h2>
              <p className="mt-3 text-sm text-neutral-300">
                See the key modules in action and get a walkthrough tailored to your clinic.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={openDemo}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-blue-600 px-6 py-2.5 text-xs font-semibold shadow-[0_0_34px_rgba(16,185,129,0.35)] hover:opacity-95 transition
                  active:scale-[0.99] active:translate-y-[1px]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/25"
                >
                  Request a demo
                  <ArrowRight className="h-4 w-4" />
                </button>
                <Link
                  href={authHref}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-2.5 text-xs font-semibold text-neutral-100 hover:border-white/30 hover:bg-white/10 transition
                  active:scale-[0.99] active:translate-y-[1px]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/25"
                >
                  {authLabel}
                </Link>
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
                  <div className="text-sm font-semibold">{brand.name}</div>
                </div>
                <p className="mt-3 max-w-sm text-sm text-neutral-400">
                  {brand.footerBlurb}
                </p>
                <p className="mt-4 text-[11px] text-neutral-500">
                  © {new Date().getFullYear()} {brand.name}. All rights reserved.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold text-neutral-200">Product</p>
                  <ul className="mt-3 space-y-2 text-sm text-neutral-400">
                    <li>
                      <a className="hover:text-white transition" href="#about">
                        Overview
                      </a>
                    </li>
                    <li>
                      <a className="hover:text-white transition" href="#solutions">
                        Solutions
                      </a>
                    </li>
                    <li>
                      <a className="hover:text-white transition" href="#pricing">
                        Pricing
                      </a>
                    </li>
                    <li>
                      <Link className="hover:text-white transition" href={authHref}>
                        Dashboard
                      </Link>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-200">Company</p>
                  <ul className="mt-3 space-y-2 text-sm text-neutral-400">
                    <li>
                      <a className="hover:text-white transition" href="#about">
                        About
                      </a>
                    </li>
                    <li>
                      <a className="hover:text-white transition" href="#contact">
                        Contact
                      </a>
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-200">Support</p>
                  <ul className="mt-3 space-y-2 text-sm text-neutral-400">
                    <li className="text-neutral-500">
                      Email{" "}
                      <span className="text-neutral-300">{brand.supportEmail}</span>
                    </li>
                    <li className="text-neutral-500">
                      Hours{" "}
                      <span className="text-neutral-300">Mon–Fri (9am - 5pm) </span>
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
