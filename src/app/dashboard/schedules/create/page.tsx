"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Save,
  CalendarRange,
  Clock,
  Users,
  Globe2,
  Plus,
  X,
  ArrowLeft,
} from "lucide-react";
import {
  getBackendBase,
  createScheduleApi,
} from "../../../../api"; // adjust path if needed
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

/* ---------- Constants ---------- */

const WEEK_DAYS = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
] as const;

type WeekKey = (typeof WEEK_DAYS)[number]["key"];

type WeekRow = {
  key: string;
  day: WeekKey;
  open: boolean;
  start: string;
  end: string;
  breakStart: string;
  breakEnd: string;
};

type OverrideRow = {
  key: string;
  date: string;
  open: boolean;
  start: string;
  end: string;
  note: string;
};

type ServiceSummary = {
  _id: string;
  name: string;
  slug: string;
};

/* ---------- Small helpers ---------- */

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative rounded-2xl border border-neutral-800/80 bg-gradient-to-br from-neutral-900 via-neutral-900/95 to-neutral-950 shadow-[0_16px_40px_rgba(0,0,0,0.75)] p-[1px]">
      <div className="rounded-2xl bg-neutral-950/90 p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2 className="text-base sm:text-lg font-semibold tracking-wide text-neutral-50">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[11px] sm:text-xs text-neutral-500 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

export default function CreateSchedulePage() {
  const router = useRouter();

  /* ------------ Basic form state ------------ */

  const [name, setName] = useState("");
  const [serviceMode, setServiceMode] = useState<"global" | "service">(
    "global"
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");

  const [timezone, setTimezone] = useState("Europe/London");
  const [slotMinutes, setSlotMinutes] = useState("15");
  const [capacity, setCapacity] = useState("1");

  /* ------------ Services list (for dropdown) ------------ */

  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  useEffect(() => {
    const loadServices = async () => {
      try {
        setServicesLoading(true);
        const base = getBackendBase();
        const res = await fetch(`${base}/services`);
        if (!res.ok) throw new Error("Failed to load services");
        const json = await res.json();

        const list: ServiceSummary[] = (json?.data || json || []).map(
          (s: any) => ({
            _id: s._id,
            name: s.name,
            slug: s.slug,
          })
        );
        setServices(list);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load services list");
      } finally {
        setServicesLoading(false);
      }
    };

    loadServices();
  }, []);

  const selectedService = useMemo(
    () => services.find((s) => s._id === selectedServiceId),
    [services, selectedServiceId]
  );

  const serviceSlugDisplay =
    serviceMode === "global" ? "global" : selectedService?.slug ?? "";

  /* ------------ Week rows (Mon–Sun) ------------ */

  const [weekRows, setWeekRows] = useState<WeekRow[]>(() => {
    const now = Date.now();
    return WEEK_DAYS.map((day, idx) => {
      const weekdayDefaults =
        day.key === "sat" || day.key === "sun"
          ? { open: false, start: "09:00", end: "13:00" }
          : { open: true, start: "09:00", end: "17:00" };

      return {
        key: `${now}-${day.key}-${idx}`,
        day: day.key,
        open: weekdayDefaults.open,
        start: weekdayDefaults.start,
        end: weekdayDefaults.end,
        breakStart: "",
        breakEnd: "",
      };
    });
  });

  const updateWeekRow = (key: string, patch: Partial<WeekRow>) => {
    setWeekRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  };

  /* ------------ Overrides ------------ */

  const [overrideRows, setOverrideRows] = useState<OverrideRow[]>([]);

  const addOverrideRow = () => {
    setOverrideRows((prev) => [
      ...prev,
      {
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: "",
        open: true,
        start: "",
        end: "",
        note: "",
      },
    ]);
  };

  const updateOverrideRow = (
    key: string,
    patch: Partial<OverrideRow>
  ) => {
    setOverrideRows((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row))
    );
  };

  const removeOverrideRow = (key: string) => {
    setOverrideRows((prev) => prev.filter((r) => r.key !== key));
  };

  /* ------------ Submit ------------ */

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      if (!name.trim()) {
        toast.error("Schedule name is required");
        return;
      }

      if (serviceMode === "service" && !selectedService) {
        toast.error("Please select a service or switch to Global");
        return;
      }

      setSubmitting(true);

      const week = weekRows.map((row) => {
        const base: any = {
          day: row.day,
          open: row.open,
        };

        if (row.open) {
          base.start = row.start || "09:00";
          base.end = row.end || "17:00";

          if (row.breakStart && row.breakEnd) {
            base.break_start = row.breakStart;
            base.break_end = row.breakEnd;
          }
        }

        return base;
      });

      const overrides = overrideRows
        .filter((o) => o.date)
        .map((o) => {
          const base: any = {
            date: o.date,
            open: o.open,
          };
          if (o.note) base.note = o.note;
          if (o.open && o.start && o.end) {
            base.start = o.start;
            base.end = o.end;
          }
          return base;
        });

      const payload = {
        name: name.trim(),
        service_slug:
          serviceMode === "global"
            ? "global"
            : selectedService?.slug ?? "global",
        service_id: serviceMode === "service" ? selectedService?._id ?? null : null,
        timezone,
        slot_minutes: Number(slotMinutes || 15),
        capacity: Number(capacity || 1),
        week,
        overrides,
      };

      await createScheduleApi(payload as any);

      toast.success("Schedule created");
      router.push("/dashboard/schedules");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create schedule");
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------ Render ------------ */

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <Link
            href="/dashboard/schedules"
            className="inline-flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-neutral-100"
          >
            <ArrowLeft size={14} />
            Back to schedules
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-wide text-neutral-50">
              Create Schedule
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Define weekly availability and special days for bookings.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/dashboard/schedules")}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs sm:text-sm font-medium text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-lg shadow-blue-900/40 hover:bg-blue-500 disabled:opacity-60 transition-colors"
          >
            <Save size={16} />
            {submitting ? "Creating..." : "Create schedule"}
          </button>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1.1fr)]">
        {/* Left column */}
        <div className="space-y-5">
          {/* Basic info */}
          <SectionCard
            title="Basic details"
            subtitle="Name your schedule and decide if it’s global or tied to a specific service."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-[11px] font-medium text-neutral-300">
                  Schedule name<span className="text-red-400">*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Travel Clinic"
                  className="mt-1 w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"></input>
                
              </div>

              {/* Global / per service toggle */}
              <div>
                <label className="text-[11px] font-medium text-neutral-300">
                  Schedule type
                </label>
                <div className="mt-1 inline-flex rounded-full bg-neutral-900/90 border border-neutral-700 p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setServiceMode("global")}
                    className={`flex-1 px-3 py-1.5 rounded-full flex items-center justify-center gap-1 ${
                      serviceMode === "global"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-neutral-400 hover:text-neutral-100"
                    }`}
                  >
                    <Globe2 size={13} />
                    Global
                  </button>
                  <button
                    type="button"
                    onClick={() => setServiceMode("service")}
                    className={`flex-1 px-3 py-1.5 rounded-full flex items-center justify-center gap-1 ${
                      serviceMode === "service"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-neutral-400 hover:text-neutral-100"
                    }`}
                  >
                    <CalendarRange size={13} />
                    Specific service
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-neutral-500">
                  Global schedules are used when no service-specific schedule is
                  assigned.
                </p>
              </div>

              {/* Service select */}
              <div>
                <label className="text-[11px] font-medium text-neutral-300">
                  Service (optional for global)
                </label>
                <select
                  value={serviceMode === "global" ? "" : selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  disabled={serviceMode === "global" || servicesLoading}
                  className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${
                    serviceMode === "global"
                      ? "bg-neutral-900/50 border-neutral-800 text-neutral-500 cursor-not-allowed"
                      : "bg-neutral-900/80 border-neutral-700 text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  }`}
                >
                  {serviceMode === "global" ? (
                    <option value="">Global schedule (no service)</option>
                  ) : (
                    <>
                      <option value="">
                        {servicesLoading
                          ? "Loading services..."
                          : "Select service..."}
                      </option>
                      {services.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name} {s.slug ? `• ${s.slug}` : ""}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <p className="mt-1 text-[11px] text-neutral-500">
                  Service key:{" "}
                  <span className="font-mono text-xs text-neutral-300">
                    {serviceSlugDisplay || "—"}
                  </span>
                </p>
              </div>

              {/* Timezone */}
              <div>
                <label className="text-[11px] font-medium text-neutral-300">
                  Timezone
                </label>
                <div className="mt-1 flex items-center gap-2 rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30">
                  <Clock size={14} className="text-neutral-500" />
                  <input
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full bg-transparent outline-none"
                    placeholder="Europe/London"
                  />
                </div>
              </div>

              {/* Slot length */}
              <div>
                <label className="text-[11px] font-medium text-neutral-300">
                  Slot length (minutes)
                  <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={slotMinutes}
                  min={5}
                  onChange={(e) => setSlotMinutes(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              {/* Capacity */}
              <div>
                <label className="text-[11px] font-medium text-neutral-300">
                  Capacity per slot<span className="text-red-400">*</span>
                </label>
                <div className="mt-1 flex items-center gap-2 rounded-lg bg-neutral-900/80 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30">
                  <Users size={14} className="text-neutral-500" />
                  <input
                    type="number"
                    min={1}
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full bg-transparent outline-none"
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Weekly pattern */}
          <SectionCard
            title="Weekly hours (Mon–Sun)"
            subtitle="Set regular working hours and optional mid-day breaks."
          >
            <div className="space-y-3">
              {weekRows.map((row) => {
                const dayMeta = WEEK_DAYS.find((d) => d.key === row.day)!;
                const disabled = !row.open;

                return (
                  <div
                    key={row.key}
                    className="rounded-xl border border-neutral-800 bg-neutral-900/85 px-4 py-3 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">
                        {dayMeta.label}
                      </span>

                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-neutral-400">Open?</span>
                        <button
                          type="button"
                          onClick={() =>
                            updateWeekRow(row.key, { open: !row.open })
                          }
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            row.open ? "bg-blue-500" : "bg-neutral-700"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-neutral-950 shadow transform transition-transform ${
                              row.open ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Time inputs including break */}
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_repeat(4,minmax(0,1fr))] md:items-end">
                      {/* Day selector */}
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                          Day<span className="text-red-400">*</span>
                        </label>
                        <select
                          value={row.day}
                          onChange={(e) =>
                            updateWeekRow(row.key, {
                              day: e.target.value as WeekKey,
                            })
                          }
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                        >
                          {WEEK_DAYS.map((d) => (
                            <option key={d.key} value={d.key}>
                              {d.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Start */}
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                          Start (HH:MM)
                          {row.open && (
                            <span className="text-red-400"> *</span>
                          )}
                        </label>
                        <input
                          type="time"
                          value={row.start}
                          disabled={disabled}
                          onChange={(e) =>
                            updateWeekRow(row.key, { start: e.target.value })
                          }
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 disabled:opacity-40"
                        />
                      </div>

                      {/* End */}
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                          End (HH:MM)
                          {row.open && (
                            <span className="text-red-400"> *</span>
                          )}
                        </label>
                        <input
                          type="time"
                          value={row.end}
                          disabled={disabled}
                          onChange={(e) =>
                            updateWeekRow(row.key, { end: e.target.value })
                          }
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 disabled:opacity-40"
                        />
                      </div>

                      {/* Break start */}
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                          Break start (HH:MM)
                        </label>
                        <input
                          type="time"
                          value={row.breakStart}
                          disabled={disabled}
                          onChange={(e) =>
                            updateWeekRow(row.key, {
                              breakStart: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 disabled:opacity-40"
                        />
                      </div>

                      {/* Break end */}
                      <div>
                        <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                          Break end (HH:MM)
                        </label>
                        <input
                          type="time"
                          value={row.breakEnd}
                          disabled={disabled}
                          onChange={(e) =>
                            updateWeekRow(row.key, {
                              breakEnd: e.target.value,
                            })
                          }
                          className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 disabled:opacity-40"
                        />
                        <p className="mt-1 text-[10px] text-neutral-500">
                          Leave empty if no break.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Overrides */}
          <SectionCard
            title="Date overrides (holidays, short days, blackouts)"
            subtitle="Add exceptions for specific days such as holidays or special opening hours."
          >
            <div className="space-y-4">
              {overrideRows.length === 0 && (
                <div className="rounded-lg border border-dashed border-neutral-700 bg-neutral-900/70 px-4 py-3 text-xs text-neutral-500">
                  No overrides yet. Use{" "}
                  <span className="font-semibold text-neutral-200">
                    “Add override”
                  </span>{" "}
                  to add holidays or special days.
                </div>
              )}

              {overrideRows.map((row) => (
                <div
                  key={row.key}
                  className="rounded-xl border border-neutral-800 bg-neutral-900/85 px-4 py-3 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium text-neutral-300">
                      Override
                    </span>
                    <button
                      type="button"
                      onClick={() => removeOverrideRow(row.key)}
                      className="inline-flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20"
                    >
                      <X size={12} />
                      Remove
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1.1fr)_auto_repeat(2,minmax(0,1fr))] sm:items-end">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                        Date
                      </label>
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) =>
                          updateOverrideRow(row.key, { date: e.target.value })
                        }
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                      />
                    </div>

                    <div className="flex items-center gap-2 sm:justify-center sm:pb-1">
                      <span className="text-[11px] text-neutral-400">
                        Open?
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateOverrideRow(row.key, { open: !row.open })
                        }
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          row.open ? "bg-blue-500" : "bg-neutral-700"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-neutral-950 shadow transform transition-transform ${
                            row.open ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                        Start (HH:MM)
                      </label>
                      <input
                        type="time"
                        value={row.start}
                        disabled={!row.open}
                        onChange={(e) =>
                          updateOverrideRow(row.key, {
                            start: e.target.value,
                          })
                        }
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 disabled:opacity-40"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                        End (HH:MM)
                      </label>
                      <input
                        type="time"
                        value={row.end}
                        disabled={!row.open}
                        onChange={(e) =>
                          updateOverrideRow(row.key, { end: e.target.value })
                        }
                        className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 disabled:opacity-40"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                      Reason / note (optional)
                    </label>
                    <input
                      value={row.note}
                      onChange={(e) =>
                        updateOverrideRow(row.key, { note: e.target.value })
                      }
                      className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                      placeholder="e.g. Christmas Day, staff training, etc."
                    />
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addOverrideRow}
                className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-100 hover:bg-neutral-800"
              >
                <Plus size={14} />
                Add override
              </button>
            </div>
          </SectionCard>
        </div>

        {/* Right column – summary */}
        <div className="space-y-5">
          <SectionCard
            title="Schedule summary"
            subtitle="Quick overview of what you’re creating."
          >
            <div className="space-y-3 text-sm text-neutral-300">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Type</span>
                <span className="font-medium">
                  {serviceMode === "global"
                    ? "Global schedule"
                    : "Service-specific"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Service key</span>
                <span className="font-mono text-[11px] text-blue-300">
                  {serviceSlugDisplay || "global"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Slot length</span>
                <span>{slotMinutes || 15} min</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Capacity / slot</span>
                <span>{capacity || 1}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-neutral-500">Timezone</span>
                <span>{timezone}</span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
