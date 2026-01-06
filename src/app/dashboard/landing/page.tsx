// app/dashboard/landing/page.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Loader2,
  Save,
  RefreshCw,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  getDynamicHomePageApi,
  updateDynamicHomePageApi,
  uploadPageImageApi,
} from "../../../api";

/* ------------------------------------------------------------------ */
/*                             Types                                  */
/* ------------------------------------------------------------------ */

type NavLink = { label: string; href: string; external?: boolean };

type HeroStat = { label: string; value: string };

type SafeSecureBullet = { title: string; body: string };

type BenefitCard = { title: string; desc: string };

type FAQItem = { q: string; a: string };

type TestimonialItem = {
  name: string;
  title: string;
  content: string;
  rating?: number;
};

type FooterLink = { label: string; href: string };

type HomeBuilderState = {
  navbar: {
    logoUrl: string;
    logoAlt: string;
    companyName: string;
    supportEmail: string;
    searchPlaceholder: string;
    icon?: string;
    navLinks: NavLink[];
  };
  hero: {
    backgroundImage: string;
    kicker: string;
    titlePrefix: string;
    titleHighlight: string;
    titleSuffix: string;
    description: string;
    topPillText: string;
    topPillSub: string;
    primaryCta: { label: string; href: string };
    secondaryCta: { label: string; href: string };
    trustBadge: string;
    trustText: string;
    chips: string[];
    rightBadgeMain: string;
    rightBadgeSub: string;
    rightDescription: string;
    stats: HeroStat[];
    rightFeatureChips: string[];
  };
  safeSecure: {
    title: string;
    bullets: SafeSecureBullet[];
    cardTitle: string;
    cardBody: string;
    cardButtonLabel: string;
    cardButtonHref: string;
  };
  keyBenefits: {
    features: BenefitCard[];
  };
  faq: {
    heading: string;
    items: FAQItem[];
    footerText: string;
    footerLinkLabel: string;
    footerLinkHref: string;
  };
  contact: {
    sectionId: string;
    label: string;
    heading: string;
    fullAddress: string;
    directionsUrl: string;
    directionsLabel: string;
    copyButtonLabel: string;
    callButtonLabel: string;
    phoneHref: string;
    bottomNote: string;
    mapEmbedUrl: string;
  };
  testimonials: {
    heading: string;
    subheading: string;
    summaryText: string;
    items: TestimonialItem[];
  };
  footer: {
    brandName: string;
    brandDescription: string;
    infoLinks: FooterLink[];
    contact: {
      phoneLabel: string;
      emailLabel: string;
      addressLabel: string;
    };
    bottomLeft: string;
    bottomRight: string;
  };
};

/** Section list for side-nav & mobile chips */
const SECTION_LIST: { id: keyof HomeBuilderState | string; label: string }[] = [
  { id: "navbar", label: "Navbar" },
  { id: "hero", label: "Hero" },
  { id: "safeSecure", label: "Safe & secure" },
  { id: "keyBenefits", label: "Key benefits" },
  { id: "faq", label: "FAQs" },
  { id: "testimonials", label: "Testimonials" },
  { id: "contact", label: "Contact & map" },
  { id: "footer", label: "Footer" },
];

/* ------------------------------------------------------------------ */
/*                          Helper UI bits                            */
/* ------------------------------------------------------------------ */

function SectionCard(props: {
  id: string;
  title: string;
  description?: string;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  children: React.ReactNode;
}) {
  const { id, title, description, openId, setOpenId, children } = props;
  const open = openId === id;

  return (
    <div
      className={`rounded-2xl border bg-[#050509] shadow-sm transition-all duration-200 ${
        open
          ? "border-sky-500/60 shadow-sky-900/50"
          : "border-neutral-800/70 hover:border-neutral-700/70"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpenId(open ? null : id)}
        className="flex w-full items-center justify-between gap-3 rounded-t-2xl px-4 py-3 text-left hover:bg-neutral-900/70"
      >
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-900/70 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            <span className="text-xs md:text-sm font-semibold text-sky-100">
              {title}
            </span>
          </div>
          {description && (
            <p className="text-xs md:text-sm text-neutral-400">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span className="hidden md:inline">
            {open ? "Collapse" : "Expand"}
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </button>
      {open && (
        <div className="border-t border-neutral-800 px-4 py-4 rounded-b-2xl">
          {children}
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-neutral-200 mb-1">
      {children}
    </label>
  );
}

function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }
) {
  const { label, ...rest } = props;
  return (
    <div className="space-y-1">
      {label && <Label>{label}</Label>}
      <input
        {...rest}
        className={`w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-shadow ${
          rest.className || ""
        }`}
      />
    </div>
  );
}

function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
  }
) {
  const { label, ...rest } = props;
  return (
    <div className="space-y-1">
      {label && <Label>{label}</Label>}
      <textarea
        {...rest}
        className={`w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-50 placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-shadow ${
          rest.className || ""
        }`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*                       Main Landing Builder                         */
/* ------------------------------------------------------------------ */

export default function LandingBuilderPage() {
  const [data, setData] = useState<HomeBuilderState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string | null>("navbar");
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const formattedLastSaved =
    lastSavedAt &&
    lastSavedAt.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const updateSection = <K extends keyof HomeBuilderState>(
    section: K,
    fn: (prev: HomeBuilderState[K]) => HomeBuilderState[K]
  ) => {
    setData((prev) => {
      if (!prev) return prev;
      return { ...prev, [section]: fn(prev[section]) };
    });
    setIsDirty(true);
  };

  const scrollToSection = (id: string) => {
    setOpenSection(id);
    const el = sectionRefs.current[id];
    if (el) {
      // use scroll-margin-top on section container + smooth scroll
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const res: any = await getDynamicHomePageApi("home");
      const content = res?.content ?? res ?? {};

      const state: HomeBuilderState = {
        navbar: {
          logoUrl: content.navbar?.logoUrl ?? "/logo.png",
          logoAlt: content.navbar?.logoAlt ?? "Pharmacy Express logo",
          companyName: content.navbar?.companyName ?? "Pharmacy Express",
          supportEmail: content.navbar?.supportEmail ?? "info@safescript.co.uk",
          icon: content.navbar?.icon ?? "",
          searchPlaceholder:
            content.navbar?.searchPlaceholder ??
            "Search for treatments e.g. weight loss, migraines",
          navLinks: Array.isArray(content.navbar?.navLinks)
            ? content.navbar.navLinks
            : [],
        },
        hero: {
          backgroundImage: content.hero?.backgroundImage ?? "/images/hero.jpg",
          kicker: content.hero?.kicker ?? "Pharmacy Express Management",
          titlePrefix: content.hero?.titlePrefix ?? "Lose up to",
          titleHighlight:
            content.hero?.titleHighlight ?? "25% of your body weight",
          titleSuffix:
            content.hero?.titleSuffix ?? "with clinically proven programmes.",
          description:
            content.hero?.description ??
            "Expert weight loss support from UK-trained prescribers, with discreet delivery straight to your door.",
          topPillText:
            content.hero?.topPillText ??
            "Pharmacy Express · Weight management clinic",
          topPillSub:
            content.hero?.topPillSub ?? "UK-based, GPhC-registered pharmacy",
          primaryCta: {
            label: content.hero?.primaryCta?.label ?? "Start consultation",
            href: content.hero?.primaryCta?.href ?? "/consultation",
          },
          secondaryCta: {
            label: content.hero?.secondaryCta?.label ?? "Reorder",
            href: content.hero?.secondaryCta?.href ?? "/reorder",
          },
          trustBadge: content.hero?.trustBadge ?? "★ 4.9 Trustpilot",
          trustText:
            content.hero?.trustText ?? "Rated excellent by our patients",
          chips: Array.isArray(content.hero?.chips)
            ? content.hero.chips
            : [
                "GPhC registered · UK professionals",
                "Clinically proven treatments",
                "Discreet & secure service",
              ],
          rightBadgeMain:
            content.hero?.rightBadgeMain ?? "Pharmacy-led programme",
          rightBadgeSub: content.hero?.rightBadgeSub ?? "Licensed clinic",
          rightDescription:
            content.hero?.rightDescription ??
            "Personalised weight management, monitored by UK-registered pharmacists.",
          stats: Array.isArray(content.hero?.stats)
            ? content.hero.stats
            : [
                { label: "Patients", value: "10k+" },
                { label: "Rating", value: "4.9" },
                { label: "Nationwide", value: "UK" },
              ],
          rightFeatureChips: Array.isArray(content.hero?.rightFeatureChips)
            ? content.hero.rightFeatureChips
            : ["24h appointments", "Discreet delivery", "Ongoing review"],
        },
        safeSecure: {
          title: content.safeSecure?.title ?? "Safe and secure",
          bullets: Array.isArray(content.safeSecure?.bullets)
            ? content.safeSecure.bullets
            : [
                {
                  title: "Registered UK pharmacy",
                  body: "Fully licensed and regulated by the General Pharmaceutical Council.",
                },
                {
                  title: "Approved UK-licensed treatments",
                  body: "Only genuine, MHRA-approved medications from trusted suppliers.",
                },
                {
                  title: "Secure, encrypted platform",
                  body: "We use industry-standard encryption to protect your information.",
                },
              ],
          cardTitle:
            content.safeSecure?.cardTitle ?? "General Pharmaceutical Council",
          cardBody:
            content.safeSecure?.cardBody ??
            "Pharmacy Express is registered with the GPhC, the regulator for pharmacists in the UK. They ensure we prioritise your safety and meet the highest standards.",
          cardButtonLabel: content.safeSecure?.cardButtonLabel ?? "Verify now",
          cardButtonHref:
            content.safeSecure?.cardButtonHref ??
            "https://www.pharmacyregulation.org/registers/pharmacy/registrationnumber/9012468",
        },
        keyBenefits: {
          features: Array.isArray(content.keyBenefits?.features)
            ? content.keyBenefits.features
            : [
                {
                  title: "Registered UK pharmacy",
                  desc: "Run by UK-registered pharmacists with independent clinical team.",
                },
                {
                  title: "Fully regulated service",
                  desc: "Inspected and regulated by the General Pharmaceutical Council.",
                },
                {
                  title: "Online convenience",
                  desc: "Complete assessment online – no GP appointment required.",
                },
                {
                  title: "Fast, discreet delivery",
                  desc: "Tracked delivery in plain packaging to your door.",
                },
              ],
        },
        faq: {
          heading: content.faq?.heading ?? "Frequently Asked Questions",
          items: Array.isArray(content.faq?.items)
            ? content.faq.items
            : [
                {
                  q: "Why are weight loss treatment prices changing?",
                  a: "Medication and supply costs can change based on manufacturer pricing and availability. We always display the most up to date prices before you complete your order.",
                },
                {
                  q: "Can I switch weight loss treatments?",
                  a: "This will depend on your medical history and prescriber assessment. Our clinical team will review your consultation and recommend suitable options.",
                },
                {
                  q: "Is my information safe?",
                  a: "Yes. We use industry-standard encryption and follow strict data protection laws to keep your information secure.",
                },
                {
                  q: "Will my delivery be discreet?",
                  a: "Absolutely. All orders are sent in plain, unbranded packaging with no reference to the contents.",
                },
              ],
          footerText: content.faq?.footerText ?? "More questions?",
          footerLinkLabel:
            content.faq?.footerLinkLabel ?? "Visit our help centre",
          footerLinkHref: content.faq?.footerLinkHref ?? "#contact",
        },
        contact: {
          sectionId: content.contact?.sectionId ?? "contact",
          label: content.contact?.label ?? "Visit our pharmacy",
          heading: content.contact?.heading ?? "Pharmacy Express, Unit 4",
          fullAddress:
            content.contact?.fullAddress ??
            "Pharmacy Express, Unit 4 The Office Campus, Paragon Business Park, Wakefield, West Yorkshire WF1 2UY",
          directionsUrl:
            content.contact?.directionsUrl ??
            "https://www.google.com/maps/place/53%C2%B041'57.4%22N+1%C2%B030'37.9%22W",
          directionsLabel:
            content.contact?.directionsLabel ?? "Open directions",
          copyButtonLabel: content.contact?.copyButtonLabel ?? "Copy address",
          callButtonLabel:
            content.contact?.callButtonLabel ?? "Call 01924 971414",
          phoneHref: content.contact?.phoneHref ?? "tel:01924971414",
          bottomNote:
            content.contact?.bottomNote ??
            "Free parking available on-site. Please check opening times before you travel.",
          mapEmbedUrl:
            content.contact?.mapEmbedUrl ??
            "https://www.google.com/maps/embed?pb=!1m13!1m8!1m3!1d6108.179704923851!2d-1.511364!3d53.6991!3m2!1i1024!2i768!4f13.1!3m2!1m1!2zNTPCsDQxJzU3LjQiTiAxwrAzMCczNy45Ilc!5e1!3m2!1sen!2sus!4v1764139161990!5m2!1sen!2sus",
        },
        testimonials: {
          heading:
            content.testimonials?.heading ?? "Rated excellent by our patients",
          subheading:
            content.testimonials?.subheading ??
            "Independently collected reviews from real patients.",
          summaryText:
            content.testimonials?.summaryText ??
            "★★★★★ 4.9 / 5 from 300+ reviews",
          items: Array.isArray(content.testimonials?.items)
            ? content.testimonials.items
            : [
                {
                  name: "Alice D",
                  title: "100% Excellent service",
                  content:
                    "My experience has been absolutely excellent. Professional, responsive and helpful. I switched providers and only regret not doing it sooner.",
                  rating: 5,
                },
                {
                  name: "Nicole S",
                  title: "Top notch service every time",
                  content:
                    "Every order has been easy with clear communication. Dispatch is quick and the team are always happy to help.",
                  rating: 5,
                },
                {
                  name: "Carrie H",
                  title: "Customer service that goes above and beyond",
                  content:
                    "Very efficient, with excellent communication and follow up. Best decision I have made switching to them.",
                  rating: 5,
                },
              ],
        },
        footer: {
          brandName: content.footer?.brandName ?? "Pharmacy Express",
          brandDescription:
            content.footer?.brandDescription ??
            "Experience personalised confidential care with our private pharmacy services tailored to your unique needs.",
          infoLinks: Array.isArray(content.footer?.infoLinks)
            ? content.footer.infoLinks
            : [
                { label: "About us", href: "/about" },
                { label: "Contact us", href: "/contact" },
                { label: "Terms & conditions", href: "/terms" },
                { label: "Privacy policy", href: "/privacy" },
              ],
          contact: {
            phoneLabel:
              content.footer?.contact?.phoneLabel ?? "Phone: 01924 971414",
            emailLabel:
              content.footer?.contact?.emailLabel ??
              "Email: info@pharmacy-express.co.uk",
            addressLabel:
              content.footer?.contact?.addressLabel ??
              "Address: Your pharmacy address",
          },
          bottomLeft:
            content.footer?.bottomLeft ??
            "© Pharmacy Express. All rights reserved.",
          bottomRight:
            content.footer?.bottomRight ??
            "GPhC registered pharmacy. This website does not replace medical advice.",
        },
      };

      setData(state);
      setIsDirty(false);
      setLastSavedAt(new Date());
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to load landing page content");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSave = async () => {
    if (!data) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const payload = {
        navbar: data.navbar,
        hero: data.hero,
        safeSecure: data.safeSecure,
        keyBenefits: data.keyBenefits,
        faq: data.faq,
        contact: data.contact,
        testimonials: data.testimonials,
        footer: data.footer,
      };

      await updateDynamicHomePageApi("home", payload);
      setSuccess("Landing page updated successfully.");
      setIsDirty(false);
      setLastSavedAt(new Date());
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (
    file: File,
    target: "navbar.logoUrl" | "hero.backgroundImage" | "navbar.icon"
  ) => {
    if (!file) return;
    try {
      setUploadingFor(target);
      setError(null);
      setSuccess(null);

      const res = await uploadPageImageApi(file);
      const anyRes = res as any;
      const url: string | undefined = anyRes.url || anyRes.path;

      if (!url) {
        throw new Error("Upload succeeded but no URL/path returned.");
      }

      if (target === "navbar.logoUrl") {
        updateSection("navbar", (s) => ({ ...s, logoUrl: url }));
      } else if (target === "navbar.icon") {
        updateSection("navbar", (s) => ({ ...s, icon: url })); // 👈 NEW
      } else {
        updateSection("hero", (s) => ({ ...s, backgroundImage: url }));
      }

      setSuccess("Image uploaded. Click Save changes to publish.");
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Image upload failed.");
    } finally {
      setUploadingFor(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[320px] items-center justify-center p-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/80 px-4 py-2 text-sm text-neutral-200">
          <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
          <span>Loading landing page builder…</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-sm text-red-300">
        Could not load landing page content.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto flex max-w-6xl gap-6">
        {/* ---------- Left sticky section nav (desktop) ---------- */}
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-20 space-y-3">
            <div className="rounded-2xl border border-neutral-800 bg-[#050509] px-4 py-3 text-sm text-neutral-300">
              <p className="text-sm font-semibold text-neutral-50">
                Landing page sections
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Jump to any block and edit content safely.
              </p>
            </div>

            <nav className="space-y-1">
              {SECTION_LIST.map((section) => {
                const active = openSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={`flex w-full items-center justify-between rounded-full px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "bg-sky-600/90 text-white shadow-sm shadow-sky-900"
                        : "bg-neutral-900/80 text-neutral-200 hover:bg-neutral-800"
                    }`}
                  >
                    <span className="truncate">{section.label}</span>
                    {active && (
                      <span className="ml-2 h-1.5 w-1.5 rounded-full bg-sky-200" />
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="mt-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-100">
              <p className="font-medium">
                {isDirty ? "Unsaved changes" : "All changes synced"}
              </p>
              <p className="mt-1 text-[11px] text-emerald-200/80">
                {isDirty
                  ? "Click “Save changes” on the top-right to publish to the live landing page."
                  : formattedLastSaved
                  ? `Last saved at ${formattedLastSaved}.`
                  : "Loaded latest content from the server."}
              </p>
            </div>
          </div>
        </aside>

        {/* ---------- Main content ---------- */}
        <main className="flex-1 space-y-6 text-sm text-neutral-100">
          {/* Header */}
          <div className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-950 via-neutral-950 to-neutral-900 px-4 py-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-sky-900/60 px-3 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="text-xs md:text-sm font-semibold text-sky-50">
                    Landing Page Builder
                  </span>
                </div>
                <p className="mt-2 text-sm text-neutral-300">
                  Configure the content of your public home page without
                  touching code. Text, cards, FAQs and trust content are all
                  editable here.
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {isDirty
                    ? "You have unsaved changes."
                    : formattedLastSaved
                    ? `All changes saved at ${formattedLastSaved}.`
                    : "Content loaded from the server."}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void loadData()}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loading || saving}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reload from server
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm shadow-sky-900 hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {saving ? "Saving…" : isDirty ? "Save changes" : "Saved"}
                </button>
              </div>
            </div>

            {/* Mobile section chips */}
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
              {SECTION_LIST.map((section) => {
                const active = openSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-sm transition-colors ${
                      active
                        ? "bg-sky-600 text-white"
                        : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                    }`}
                  >
                    {section.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status messages */}
          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-100">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-red-400" />
              <p className="flex-1">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <p className="flex-1">{success}</p>
            </div>
          )}

          {/* ===================== NAVBAR ===================== */}
          <div
            className="scroll-mt-24"
            ref={(el) => {
              sectionRefs.current["navbar"] = el;
            }}
          >
            <SectionCard
              id="navbar"
              title="Navbar"
              description="Logo, search placeholder and main navigation links at the top of your public site."
              openId={openSection}
              setOpenId={setOpenSection}
            >
              <div className="grid gap-4 md:grid-cols-3">
                {/* Logo URL + upload */}
                <div className="space-y-2">
                  <TextInput
                    label="Logo URL"
                    value={data.navbar.logoUrl}
                    onChange={(e) =>
                      updateSection("navbar", (s) => ({
                        ...s,
                        logoUrl: e.target.value,
                      }))
                    }
                  />
                  <div className="space-y-1">
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingFor === "navbar.logoUrl"}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          await handleImageUpload(file, "navbar.logoUrl");
                        }
                        e.target.value = "";
                      }}
                      className="block w-full text-xs text-neutral-300
                        file:mr-3 file:rounded-md file:border-0 file:bg-neutral-800
                        file:px-3 file:py-1.5 file:text-xs file:font-medium
                        file:text-neutral-100 hover:file:bg-neutral-700"
                    />
                    <div className="flex justify-between text-[11px] text-neutral-500">
                      <span className="truncate">
                        {data.navbar.logoUrl
                          ? `Current: ${data.navbar.logoUrl}`
                          : "No logo selected"}
                      </span>
                      {uploadingFor === "navbar.logoUrl" && (
                        <span className="text-sky-400">Uploading…</span>
                      )}
                    </div>
                  </div>
                </div>

                <TextInput
                  label="Logo alt text"
                  value={data.navbar.logoAlt}
                  onChange={(e) =>
                    updateSection("navbar", (s) => ({
                      ...s,
                      logoAlt: e.target.value,
                    }))
                  }
                />
                <TextInput
                  label="Search placeholder"
                  value={data.navbar.searchPlaceholder}
                  onChange={(e) =>
                    updateSection("navbar", (s) => ({
                      ...s,
                      searchPlaceholder: e.target.value,
                    }))
                  }
                />
              </div>
              {/* Favicon / browser tab icon */}
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <TextInput
                    label="Favicon / browser icon URL"
                    value={data.navbar.icon || ""}
                    onChange={(e) =>
                      updateSection("navbar", (s) => ({
                        ...s,
                        icon: e.target.value,
                      }))
                    }
                  />
                  <div className="space-y-1">
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingFor === "navbar.icon"}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          await handleImageUpload(file, "navbar.icon");
                        }
                        e.target.value = "";
                      }}
                      className="block w-full text-xs text-neutral-300
          file:mr-3 file:rounded-md file:border-0 file:bg-neutral-800
          file:px-3 file:py-1.5 file:text-xs file:font-medium
          file:text-neutral-100 hover:file:bg-neutral-700"
                    />
                    <div className="flex justify-between text-[11px] text-neutral-500">
                      <span className="truncate">
                        {data.navbar.icon
                          ? `Current: ${data.navbar.icon}`
                          : "No favicon selected"}
                      </span>
                      {uploadingFor === "navbar.icon" && (
                        <span className="text-sky-400">Uploading…</span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500">
                      This icon will be used as the browser tab icon (favicon).
                      Recommended: square PNG, 32×32 or 64×64.
                    </p>
                  </div>
                  <TextInput
                    label="Company name"
                    value={data.navbar.companyName}
                    onChange={(e) =>
                      updateSection("navbar", (s) => ({
                        ...s,
                        companyName: e.target.value,
                      }))
                    }
                  />
                  <TextInput
                    label="Support email"
                    value={data.navbar.supportEmail}
                    onChange={(e) =>
                      updateSection("navbar", (s) => ({
                        ...s,
                        supportEmail: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <Label>Navigation links</Label>
                {data.navbar.navLinks.map((link, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-2 rounded-xl border border-neutral-800 bg-neutral-900/70 p-3 md:flex-row md:items-center"
                  >
                    <TextInput
                      label="Label"
                      value={link.label}
                      onChange={(e) =>
                        updateSection("navbar", (s) => ({
                          ...s,
                          navLinks: s.navLinks.map((l, i) =>
                            i === idx ? { ...l, label: e.target.value } : l
                          ),
                        }))
                      }
                    />
                    <TextInput
                      label="URL"
                      value={link.href}
                      onChange={(e) =>
                        updateSection("navbar", (s) => ({
                          ...s,
                          navLinks: s.navLinks.map((l, i) =>
                            i === idx ? { ...l, href: e.target.value } : l
                          ),
                        }))
                      }
                    />
                    <div className="flex items-center justify-between gap-2 md:w-44 md:flex-col md:items-start">
                      <label className="flex items-center gap-2 text-xs text-neutral-300">
                        <input
                          type="checkbox"
                          checked={!!link.external}
                          onChange={(e) =>
                            updateSection("navbar", (s) => ({
                              ...s,
                              navLinks: s.navLinks.map((l, i) =>
                                i === idx
                                  ? { ...l, external: e.target.checked }
                                  : l
                              ),
                            }))
                          }
                          className="h-3 w-3 rounded border-neutral-600 bg-neutral-900"
                        />
                        Open in new tab
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          updateSection("navbar", (s) => ({
                            ...s,
                            navLinks: s.navLinks.filter((_, i) => i !== idx),
                          }))
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-900/30"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    updateSection("navbar", (s) => ({
                      ...s,
                      navLinks: [
                        ...s.navLinks,
                        { label: "New link", href: "#", external: false },
                      ],
                    }))
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
                >
                  <Plus className="h-3 w-3" />
                  Add link
                </button>
              </div>
            </SectionCard>
          </div>

          {/* ===================== HERO ===================== */}
          <div
            className="scroll-mt-24"
            ref={(el) => {
              sectionRefs.current["hero"] = el;
            }}
          >
            <SectionCard
              id="hero"
              title="Hero section"
              description="Main headline, reassurance copy and primary call-to-action above the fold."
              openId={openSection}
              setOpenId={setOpenSection}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Top kicker text"
                  value={data.hero.kicker}
                  onChange={(e) =>
                    updateSection("hero", (s) => ({
                      ...s,
                      kicker: e.target.value,
                    }))
                  }
                />

                <div className="space-y-2">
                  <TextInput
                    label="Background image URL"
                    value={data.hero.backgroundImage}
                    onChange={(e) =>
                      updateSection("hero", (s) => ({
                        ...s,
                        backgroundImage: e.target.value,
                      }))
                    }
                  />
                  <div className="space-y-1">
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploadingFor === "hero.backgroundImage"}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          await handleImageUpload(file, "hero.backgroundImage");
                        }
                        e.target.value = "";
                      }}
                      className="block w-full text-xs text-neutral-300
                        file:mr-3 file:rounded-md file:border-0 file:bg-neutral-800
                        file:px-3 file:py-1.5 file:text-xs file:font-medium
                        file:text-neutral-100 hover:file:bg-neutral-700"
                    />
                    <div className="flex justify-between text-[11px] text-neutral-500">
                      <span className="truncate">
                        {data.hero.backgroundImage
                          ? `Current: ${data.hero.backgroundImage}`
                          : "No background image selected"}
                      </span>
                      {uploadingFor === "hero.backgroundImage" && (
                        <span className="text-sky-400">Uploading…</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <TextInput
                  label="Title prefix"
                  value={data.hero.titlePrefix}
                  onChange={(e) =>
                    updateSection("hero", (s) => ({
                      ...s,
                      titlePrefix: e.target.value,
                    }))
                  }
                />
                <TextInput
                  label="Title highlight"
                  value={data.hero.titleHighlight}
                  onChange={(e) =>
                    updateSection("hero", (s) => ({
                      ...s,
                      titleHighlight: e.target.value,
                    }))
                  }
                />
                <TextInput
                  label="Title suffix"
                  value={data.hero.titleSuffix}
                  onChange={(e) =>
                    updateSection("hero", (s) => ({
                      ...s,
                      titleSuffix: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextArea
                  label="Hero description"
                  rows={3}
                  value={data.hero.description}
                  onChange={(e) =>
                    updateSection("hero", (s) => ({
                      ...s,
                      description: e.target.value,
                    }))
                  }
                />
                <div className="space-y-3">
                  <TextInput
                    label="Top pill text"
                    value={data.hero.topPillText}
                    onChange={(e) =>
                      updateSection("hero", (s) => ({
                        ...s,
                        topPillText: e.target.value,
                      }))
                    }
                  />
                  <TextInput
                    label="Top pill subtext"
                    value={data.hero.topPillSub}
                    onChange={(e) =>
                      updateSection("hero", (s) => ({
                        ...s,
                        topPillSub: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              {/* CTAs */}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Primary CTA</Label>
                  <TextInput
                    label="Label"
                    value={data.hero.primaryCta.label}
                    onChange={(e) =>
                      updateSection("hero", (s) => ({
                        ...s,
                        primaryCta: {
                          ...s.primaryCta,
                          label: e.target.value,
                        },
                      }))
                    }
                  />
                  <TextInput
                    label="URL"
                    value={data.hero.primaryCta.href}
                    onChange={(e) =>
                      updateSection("hero", (s) => ({
                        ...s,
                        primaryCta: {
                          ...s.primaryCta,
                          href: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Secondary CTA</Label>
                  <TextInput
                    label="Label"
                    value={data.hero.secondaryCta.label}
                    onChange={(e) =>
                      updateSection("hero", (s) => ({
                        ...s,
                        secondaryCta: {
                          ...s.secondaryCta,
                          label: e.target.value,
                        },
                      }))
                    }
                  />
                  <TextInput
                    label="URL"
                    value={data.hero.secondaryCta.href}
                    onChange={(e) =>
                      updateSection("hero", (s) => ({
                        ...s,
                        secondaryCta: {
                          ...s.secondaryCta,
                          href: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>

              {/* Trust + chips */}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Trust badge label"
                  value={data.hero.trustBadge}
                  onChange={(e) =>
                    updateSection("hero", (s) => ({
                      ...s,
                      trustBadge: e.target.value,
                    }))
                  }
                />
                <TextInput
                  label="Trust text"
                  value={data.hero.trustText}
                  onChange={(e) =>
                    updateSection("hero", (s) => ({
                      ...s,
                      trustText: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="mt-4 space-y-2">
                <Label>Hero chips (small reassurance pills)</Label>
                {data.hero.chips.map((chip, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <TextInput
                      value={chip}
                      onChange={(e) =>
                        updateSection("hero", (s) => ({
                          ...s,
                          chips: s.chips.map((c, i) =>
                            i === idx ? e.target.value : c
                          ),
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateSection("hero", (s) => ({
                          ...s,
                          chips: s.chips.filter((_, i) => i !== idx),
                        }))
                      }
                      className="rounded-md border border-red-500/40 p-1 text-red-300 hover:bg-red-900/40"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateSection("hero", (s) => ({
                      ...s,
                      chips: [...s.chips, "New chip"],
                    }))
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
                >
                  <Plus className="h-3 w-3" />
                  Add chip
                </button>
              </div>

              {/* Right card */}
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <TextInput
                  label="Right card main badge"
                  value={data.hero.rightBadgeMain}
                  onChange={(e) =>
                    updateSection("hero", (s) => ({
                      ...s,
                      rightBadgeMain: e.target.value,
                    }))
                  }
                />
                <TextInput
                  label="Right card sub badge"
                  value={data.hero.rightBadgeSub}
                  onChange={(e) =>
                    updateSection("hero", (s) => ({
                      ...s,
                      rightBadgeSub: e.target.value,
                    }))
                  }
                />
                <TextArea
                  label="Right card description"
                  rows={2}
                  value={data.hero.rightDescription}
                  onChange={(e) =>
                    updateSection("hero", (s) => ({
                      ...s,
                      rightDescription: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="mt-4 space-y-2">
                <Label>Hero stats</Label>
                {data.hero.stats.map((stat, idx) => (
                  <div
                    key={idx}
                    className="grid gap-2 md:grid-cols-[1fr,1fr,auto]"
                  >
                    <TextInput
                      label="Label"
                      value={stat.label}
                      onChange={(e) =>
                        updateSection("hero", (s) => ({
                          ...s,
                          stats: s.stats.map((st, i) =>
                            i === idx ? { ...st, label: e.target.value } : st
                          ),
                        }))
                      }
                    />
                    <TextInput
                      label="Value"
                      value={stat.value}
                      onChange={(e) =>
                        updateSection("hero", (s) => ({
                          ...s,
                          stats: s.stats.map((st, i) =>
                            i === idx ? { ...st, value: e.target.value } : st
                          ),
                        }))
                      }
                    />
                    <div className="flex items-end justify-end pb-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateSection("hero", (s) => ({
                            ...s,
                            stats: s.stats.filter((_, i) => i !== idx),
                          }))
                        }
                        className="rounded-md border border-red-500/40 p-1 text-red-300 hover:bg-red-900/40"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateSection("hero", (s) => ({
                      ...s,
                      stats: [...s.stats, { label: "New", value: "123" }],
                    }))
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
                >
                  <Plus className="h-3 w-3" />
                  Add stat
                </button>
              </div>

              <div className="mt-4 space-y-2">
                <Label>Right-side small feature chips</Label>
                {data.hero.rightFeatureChips.map((chip, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <TextInput
                      value={chip}
                      onChange={(e) =>
                        updateSection("hero", (s) => ({
                          ...s,
                          rightFeatureChips: s.rightFeatureChips.map((c, i) =>
                            i === idx ? e.target.value : c
                          ),
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateSection("hero", (s) => ({
                          ...s,
                          rightFeatureChips: s.rightFeatureChips.filter(
                            (_, i) => i !== idx
                          ),
                        }))
                      }
                      className="rounded-md border border-red-500/40 p-1 text-red-300 hover:bg-red-900/40"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateSection("hero", (s) => ({
                      ...s,
                      rightFeatureChips: [
                        ...s.rightFeatureChips,
                        "New feature",
                      ],
                    }))
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
                >
                  <Plus className="h-3 w-3" />
                  Add feature
                </button>
              </div>
            </SectionCard>
          </div>

          {/* ===================== SAFE & SECURE ===================== */}
          <div
            className="scroll-mt-24"
            ref={(el) => {
              sectionRefs.current["safeSecure"] = el;
            }}
          >
            <SectionCard
              id="safeSecure"
              title="Safe & secure section"
              description="Explain your safety, regulatory and GPhC credentials."
              openId={openSection}
              setOpenId={setOpenSection}
            >
              <TextInput
                label="Section title"
                value={data.safeSecure.title}
                onChange={(e) =>
                  updateSection("safeSecure", (s) => ({
                    ...s,
                    title: e.target.value,
                  }))
                }
              />

              <div className="mt-4 space-y-2">
                <Label>Bullet points</Label>
                {data.safeSecure.bullets.map((b, idx) => (
                  <div
                    key={idx}
                    className="grid gap-2 md:grid-cols-[1fr,2fr,auto]"
                  >
                    <TextInput
                      label="Title"
                      value={b.title}
                      onChange={(e) =>
                        updateSection("safeSecure", (s) => ({
                          ...s,
                          bullets: s.bullets.map((bb, i) =>
                            i === idx ? { ...bb, title: e.target.value } : bb
                          ),
                        }))
                      }
                    />
                    <TextArea
                      label="Body"
                      rows={2}
                      value={b.body}
                      onChange={(e) =>
                        updateSection("safeSecure", (s) => ({
                          ...s,
                          bullets: s.bullets.map((bb, i) =>
                            i === idx ? { ...bb, body: e.target.value } : bb
                          ),
                        }))
                      }
                    />
                    <div className="flex items-end justify-end pb-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateSection("safeSecure", (s) => ({
                            ...s,
                            bullets: s.bullets.filter((_, i) => i !== idx),
                          }))
                        }
                        className="rounded-md border border-red-500/40 p-1 text-red-300 hover:bg-red-900/40"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateSection("safeSecure", (s) => ({
                      ...s,
                      bullets: [
                        ...s.bullets,
                        { title: "New bullet", body: "Description" },
                      ],
                    }))
                  }
                  className="inline-flex items-center gap-1 rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
                >
                  <Plus className="h-3 w-3" />
                  Add bullet
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Right card title"
                  value={data.safeSecure.cardTitle}
                  onChange={(e) =>
                    updateSection("safeSecure", (s) => ({
                      ...s,
                      cardTitle: e.target.value,
                    }))
                  }
                />
                <TextArea
                  label="Right card body"
                  rows={3}
                  value={data.safeSecure.cardBody}
                  onChange={(e) =>
                    updateSection("safeSecure", (s) => ({
                      ...s,
                      cardBody: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Button label"
                  value={data.safeSecure.cardButtonLabel}
                  onChange={(e) =>
                    updateSection("safeSecure", (s) => ({
                      ...s,
                      cardButtonLabel: e.target.value,
                    }))
                  }
                />
                <TextInput
                  label="Button URL"
                  value={data.safeSecure.cardButtonHref}
                  onChange={(e) =>
                    updateSection("safeSecure", (s) => ({
                      ...s,
                      cardButtonHref: e.target.value,
                    }))
                  }
                />
              </div>
            </SectionCard>
          </div>

          {/* ===================== KEY BENEFITS ===================== */}
          <div
            className="scroll-mt-24"
            ref={(el) => {
              sectionRefs.current["keyBenefits"] = el;
            }}
          >
            <SectionCard
              id="keyBenefits"
              title="Key benefits cards"
              description="Short cards under the hero that explain why to choose your service."
              openId={openSection}
              setOpenId={setOpenSection}
            >
              <div className="space-y-3">
                {data.keyBenefits.features.map((card, idx) => (
                  <div
                    key={idx}
                    className="grid gap-2 md:grid-cols-[1fr,2fr,auto] rounded-xl border border-neutral-800 bg-neutral-900/70 p-3"
                  >
                    <TextInput
                      label="Title"
                      value={card.title}
                      onChange={(e) =>
                        updateSection("keyBenefits", (s) => ({
                          ...s,
                          features: s.features.map((f, i) =>
                            i === idx ? { ...f, title: e.target.value } : f
                          ),
                        }))
                      }
                    />
                    <TextArea
                      label="Description"
                      rows={2}
                      value={card.desc}
                      onChange={(e) =>
                        updateSection("keyBenefits", (s) => ({
                          ...s,
                          features: s.features.map((f, i) =>
                            i === idx ? { ...f, desc: e.target.value } : f
                          ),
                        }))
                      }
                    />
                    <div className="flex items-end justify-end pb-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateSection("keyBenefits", (s) => ({
                            ...s,
                            features: s.features.filter((_, i) => i !== idx),
                          }))
                        }
                        className="rounded-md border border-red-500/40 p-1 text-red-300 hover:bg-red-900/40"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  updateSection("keyBenefits", (s) => ({
                    ...s,
                    features: [
                      ...s.features,
                      { title: "New benefit", desc: "Description" },
                    ],
                  }))
                }
                className="mt-4 inline-flex items-center gap-1 rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
              >
                <Plus className="h-3 w-3" />
                Add benefit card
              </button>
            </SectionCard>
          </div>

          {/* ===================== FAQ ===================== */}
          <div
            className="scroll-mt-24"
            ref={(el) => {
              sectionRefs.current["faq"] = el;
            }}
          >
            <SectionCard
              id="faq"
              title="FAQ section"
              description="Frequently asked questions plus a link through to your help centre."
              openId={openSection}
              setOpenId={setOpenSection}
            >
              <TextInput
                label="Heading"
                value={data.faq.heading}
                onChange={(e) =>
                  updateSection("faq", (s) => ({
                    ...s,
                    heading: e.target.value,
                  }))
                }
              />

              <div className="mt-4 space-y-2">
                <Label>FAQ items</Label>
                {data.faq.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="grid gap-2 md:grid-cols-[1.2fr,2fr,auto] rounded-xl border border-neutral-800 bg-neutral-900/70 p-3"
                  >
                    <TextInput
                      label="Question"
                      value={item.q}
                      onChange={(e) =>
                        updateSection("faq", (s) => ({
                          ...s,
                          items: s.items.map((it, i) =>
                            i === idx ? { ...it, q: e.target.value } : it
                          ),
                        }))
                      }
                    />
                    <TextArea
                      label="Answer"
                      rows={2}
                      value={item.a}
                      onChange={(e) =>
                        updateSection("faq", (s) => ({
                          ...s,
                          items: s.items.map((it, i) =>
                            i === idx ? { ...it, a: e.target.value } : it
                          ),
                        }))
                      }
                    />
                    <div className="flex items-end justify-end pb-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateSection("faq", (s) => ({
                            ...s,
                            items: s.items.filter((_, i) => i !== idx),
                          }))
                        }
                        className="rounded-md border border-red-500/40 p-1 text-red-300 hover:bg-red-900/40"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  updateSection("faq", (s) => ({
                    ...s,
                    items: [
                      ...s.items,
                      { q: "New question", a: "Answer goes here." },
                    ],
                  }))
                }
                className="mt-3 inline-flex items-center gap-1 rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
              >
                <Plus className="h-3 w-3" />
                Add FAQ
              </button>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <TextInput
                  label="Footer text"
                  value={data.faq.footerText}
                  onChange={(e) =>
                    updateSection("faq", (s) => ({
                      ...s,
                      footerText: e.target.value,
                    }))
                  }
                />
                <TextInput
                  label="Footer link label"
                  value={data.faq.footerLinkLabel}
                  onChange={(e) =>
                    updateSection("faq", (s) => ({
                      ...s,
                      footerLinkLabel: e.target.value,
                    }))
                  }
                />
                <TextInput
                  label="Footer link URL"
                  value={data.faq.footerLinkHref}
                  onChange={(e) =>
                    updateSection("faq", (s) => ({
                      ...s,
                      footerLinkHref: e.target.value,
                    }))
                  }
                />
              </div>
            </SectionCard>
          </div>

          {/* ===================== TESTIMONIALS ===================== */}
          <div
            className="scroll-mt-24"
            ref={(el) => {
              sectionRefs.current["testimonials"] = el;
            }}
          >
            <SectionCard
              id="testimonials"
              title="Testimonials section"
              description="Patient reviews displayed in cards with optional star ratings."
              openId={openSection}
              setOpenId={setOpenSection}
            >
              <div className="grid gap-4 md:grid-cols-3">
                <TextInput
                  label="Heading"
                  value={data.testimonials.heading}
                  onChange={(e) =>
                    updateSection("testimonials", (s) => ({
                      ...s,
                      heading: e.target.value,
                    }))
                  }
                />
                <TextInput
                  label="Subheading"
                  value={data.testimonials.subheading}
                  onChange={(e) =>
                    updateSection("testimonials", (s) => ({
                      ...s,
                      subheading: e.target.value,
                    }))
                  }
                />
                <TextInput
                  label="Summary text"
                  value={data.testimonials.summaryText}
                  onChange={(e) =>
                    updateSection("testimonials", (s) => ({
                      ...s,
                      summaryText: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="mt-4 space-y-3">
                <Label>Testimonial cards</Label>
                {data.testimonials.items.map((t, idx) => (
                  <div
                    key={idx}
                    className="grid gap-2 md:grid-cols-[1fr,1fr,2fr,auto] rounded-xl border border-neutral-800 bg-neutral-900/70 p-3"
                  >
                    <div className="space-y-2">
                      <TextInput
                        label="Name"
                        value={t.name}
                        onChange={(e) =>
                          updateSection("testimonials", (s) => ({
                            ...s,
                            items: s.items.map((it, i) =>
                              i === idx ? { ...it, name: e.target.value } : it
                            ),
                          }))
                        }
                      />
                      <TextInput
                        label="Rating (1-5)"
                        type="number"
                        min={1}
                        max={5}
                        value={t.rating?.toString() ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          const num =
                            val === "" ? undefined : Number(e.target.value);
                          updateSection("testimonials", (s) => ({
                            ...s,
                            items: s.items.map((it, i) =>
                              i === idx ? { ...it, rating: num } : it
                            ),
                          }));
                        }}
                      />
                    </div>
                    <TextInput
                      label="Title"
                      value={t.title}
                      onChange={(e) =>
                        updateSection("testimonials", (s) => ({
                          ...s,
                          items: s.items.map((it, i) =>
                            i === idx ? { ...it, title: e.target.value } : it
                          ),
                        }))
                      }
                    />
                    <TextArea
                      label="Content"
                      rows={2}
                      value={t.content}
                      onChange={(e) =>
                        updateSection("testimonials", (s) => ({
                          ...s,
                          items: s.items.map((it, i) =>
                            i === idx ? { ...it, content: e.target.value } : it
                          ),
                        }))
                      }
                    />
                    <div className="flex items-end justify-end pb-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateSection("testimonials", (s) => ({
                            ...s,
                            items: s.items.filter((_, i) => i !== idx),
                          }))
                        }
                        className="rounded-md border border-red-500/40 p-1 text-red-300 hover:bg-red-900/40"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  updateSection("testimonials", (s) => ({
                    ...s,
                    items: [
                      ...s.items,
                      {
                        name: "New patient",
                        title: "New testimonial",
                        content: "Their feedback goes here.",
                        rating: 5,
                      },
                    ],
                  }))
                }
                className="mt-3 inline-flex items-center gap-1 rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
              >
                <Plus className="h-3 w-3" />
                Add testimonial
              </button>
            </SectionCard>
          </div>

          {/* ===================== CONTACT & MAP ===================== */}
          <div
            className="scroll-mt-24"
            ref={(el) => {
              sectionRefs.current["contact"] = el;
            }}
          >
            <SectionCard
              id="contact"
              title="Contact & map section"
              description="Address, directions button and embedded Google Map."
              openId={openSection}
              setOpenId={setOpenSection}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <TextInput
                    label="Section ID (anchor)"
                    value={data.contact.sectionId}
                    onChange={(e) =>
                      updateSection("contact", (s) => ({
                        ...s,
                        sectionId: e.target.value,
                      }))
                    }
                  />
                  <TextInput
                    label="Small label above address"
                    value={data.contact.label}
                    onChange={(e) =>
                      updateSection("contact", (s) => ({
                        ...s,
                        label: e.target.value,
                      }))
                    }
                  />
                  <TextInput
                    label="Heading"
                    value={data.contact.heading}
                    onChange={(e) =>
                      updateSection("contact", (s) => ({
                        ...s,
                        heading: e.target.value,
                      }))
                    }
                  />
                  <TextArea
                    label="Full address"
                    rows={3}
                    value={data.contact.fullAddress}
                    onChange={(e) =>
                      updateSection("contact", (s) => ({
                        ...s,
                        fullAddress: e.target.value,
                      }))
                    }
                  />
                  <TextArea
                    label="Bottom note"
                    rows={2}
                    value={data.contact.bottomNote}
                    onChange={(e) =>
                      updateSection("contact", (s) => ({
                        ...s,
                        bottomNote: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-3">
                  <TextInput
                    label="Directions button label"
                    value={data.contact.directionsLabel}
                    onChange={(e) =>
                      updateSection("contact", (s) => ({
                        ...s,
                        directionsLabel: e.target.value,
                      }))
                    }
                  />
                  <TextInput
                    label="Directions URL (Google Maps link)"
                    value={data.contact.directionsUrl}
                    onChange={(e) =>
                      updateSection("contact", (s) => ({
                        ...s,
                        directionsUrl: e.target.value,
                      }))
                    }
                  />
                  <TextInput
                    label="Copy-address button label"
                    value={data.contact.copyButtonLabel}
                    onChange={(e) =>
                      updateSection("contact", (s) => ({
                        ...s,
                        copyButtonLabel: e.target.value,
                      }))
                    }
                  />
                  <TextInput
                    label="Call button label"
                    value={data.contact.callButtonLabel}
                    onChange={(e) =>
                      updateSection("contact", (s) => ({
                        ...s,
                        callButtonLabel: e.target.value,
                      }))
                    }
                  />
                  <TextInput
                    label="Phone href"
                    value={data.contact.phoneHref}
                    onChange={(e) =>
                      updateSection("contact", (s) => ({
                        ...s,
                        phoneHref: e.target.value,
                      }))
                    }
                  />
                  <TextArea
                    label="Map embed URL (iframe src)"
                    rows={2}
                    value={data.contact.mapEmbedUrl}
                    onChange={(e) =>
                      updateSection("contact", (s) => ({
                        ...s,
                        mapEmbedUrl: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </SectionCard>
          </div>

          {/* ===================== FOOTER ===================== */}
          <div
            className="scroll-mt-24"
            ref={(el) => {
              sectionRefs.current["footer"] = el;
            }}
          >
            <SectionCard
              id="footer"
              title="Footer section"
              description="Footer brand text, information links and basic contact info."
              openId={openSection}
              setOpenId={setOpenSection}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <TextInput
                  label="Brand name"
                  value={data.footer.brandName}
                  onChange={(e) =>
                    updateSection("footer", (s) => ({
                      ...s,
                      brandName: e.target.value,
                    }))
                  }
                />
                <TextArea
                  label="Brand description"
                  rows={3}
                  value={data.footer.brandDescription}
                  onChange={(e) =>
                    updateSection("footer", (s) => ({
                      ...s,
                      brandDescription: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="mt-4 space-y-2">
                <Label>Information links</Label>
                {data.footer.infoLinks.map((l, idx) => (
                  <div
                    key={idx}
                    className="grid gap-2 md:grid-cols-[1fr,2fr,auto]"
                  >
                    <TextInput
                      label="Label"
                      value={l.label}
                      onChange={(e) =>
                        updateSection("footer", (s) => ({
                          ...s,
                          infoLinks: s.infoLinks.map((ll, i) =>
                            i === idx ? { ...ll, label: e.target.value } : ll
                          ),
                        }))
                      }
                    />
                    <TextInput
                      label="URL"
                      value={l.href}
                      onChange={(e) =>
                        updateSection("footer", (s) => ({
                          ...s,
                          infoLinks: s.infoLinks.map((ll, i) =>
                            i === idx ? { ...ll, href: e.target.value } : ll
                          ),
                        }))
                      }
                    />
                    <div className="flex items-end justify-end pb-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateSection("footer", (s) => ({
                            ...s,
                            infoLinks: s.infoLinks.filter((_, i) => i !== idx),
                          }))
                        }
                        className="rounded-md border border-red-500/40 p-1 text-red-300 hover:bg-red-900/40"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() =>
                  updateSection("footer", (s) => ({
                    ...s,
                    infoLinks: [
                      ...s.infoLinks,
                      { label: "New link", href: "#" },
                    ],
                  }))
                }
                className="mt-3 inline-flex items-center gap-1 rounded-full border border-neutral-700 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
              >
                <Plus className="h-3 w-3" />
                Add footer link
              </button>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <TextInput
                  label="Contact: phone line"
                  value={data.footer.contact.phoneLabel}
                  onChange={(e) =>
                    updateSection("footer", (s) => ({
                      ...s,
                      contact: {
                        ...s.contact,
                        phoneLabel: e.target.value,
                      },
                    }))
                  }
                />
                <TextInput
                  label="Contact: email line"
                  value={data.footer.contact.emailLabel}
                  onChange={(e) =>
                    updateSection("footer", (s) => ({
                      ...s,
                      contact: {
                        ...s.contact,
                        emailLabel: e.target.value,
                      },
                    }))
                  }
                />
                <TextInput
                  label="Contact: address line"
                  value={data.footer.contact.addressLabel}
                  onChange={(e) =>
                    updateSection("footer", (s) => ({
                      ...s,
                      contact: {
                        ...s.contact,
                        addressLabel: e.target.value,
                      },
                    }))
                  }
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextArea
                  label="Bottom left text"
                  rows={2}
                  value={data.footer.bottomLeft}
                  onChange={(e) =>
                    updateSection("footer", (s) => ({
                      ...s,
                      bottomLeft: e.target.value,
                    }))
                  }
                />
                <TextArea
                  label="Bottom right text"
                  rows={2}
                  value={data.footer.bottomRight}
                  onChange={(e) =>
                    updateSection("footer", (s) => ({
                      ...s,
                      bottomRight: e.target.value,
                    }))
                  }
                />
              </div>
            </SectionCard>
          </div>
        </main>
      </div>
    </div>
  );
}
