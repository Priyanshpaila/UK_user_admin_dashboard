"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar as RBC,
  dateFnsLocalizer,
  Views,
  type View,
  type ToolbarProps,
  type SlotInfo,
} from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import startOfMonth from "date-fns/startOfMonth";
import endOfMonth from "date-fns/endOfMonth";
import enUS from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  X,
  AlertTriangle,
  Loader2,
  User,
  Stethoscope,
  Mail,
  Phone,
  Hash,
  Clock,
  Link2,
  ChevronRight as ArrowRight,
} from "lucide-react";
import useEventStore, { Appointment } from "../../stores/events";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import {
  getAppointmentsCalendarSummaryApi,
  type AppointmentsCalendarSummaryDay,
  getAppointmentByIdApi,
  type AppointmentDto,
  getUserByIdApi,
  getOrderByIdApi,
  type UserDto,
  type OrderDto,
} from "../../api";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

/* ----------------- small helpers ----------------- */

function formatDateTime(value?: string | Date | null) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return format(d, "dd MMM yyyy, HH:mm");
}

function formatDateOnly(value?: string | Date | null) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return format(d, "dd MMM yyyy");
}

function formatTime(value?: string | Date | null) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return "—";
  return format(d, "HH:mm");
}

function formatMoney(minor?: number | null) {
  if (minor == null) return "—";
  return `£${(minor / 100).toFixed(2)}`;
}

/** Status → base color (for dots/badges) */
function getStatusColorHex(status: string): string {
  const s = (status || "").toLowerCase();
  switch (s) {
    case "pending":
      return "#fbbf24";
    case "confirmed":
      return "#3b82f6";
    case "cancelled":
      return "#ef4444";
    case "completed":
      return "#22c55e";
    case "no-show":
    case "no_show":
    case "noshow":
      return "#f97316";
    case "rescheduled":
      return "#a855f7";
    case "approved":
      return "#22c55e";
    case "rejected":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

/** Pills (status chips) */
function statusPillClass(status: string) {
  const s = (status || "").toLowerCase();

  if (s === "pending")
    return "bg-amber-500/15 text-amber-300 border-amber-500/40";
  if (s === "confirmed")
    return "bg-blue-500/15 text-blue-300 border-blue-500/40";
  if (s === "cancelled" || s === "rejected")
    return "bg-rose-500/15 text-rose-300 border-rose-500/40";
  if (s === "completed")
    return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
  if (s === "no-show" || s === "no_show" || s === "noshow")
    return "bg-orange-500/15 text-orange-300 border-orange-500/40";
  if (s === "rescheduled")
    return "bg-violet-500/15 text-violet-300 border-violet-500/40";

  if (s === "approved")
    return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";

  return "bg-neutral-500/10 text-neutral-200 border-neutral-500/40";
}

function mediumPillClass(medium?: string | null) {
  const m = (medium || "").toLowerCase();
  if (m === "online") return "bg-sky-500/15 text-sky-300 border-sky-500/40";
  if (m === "offline")
    return "bg-purple-500/15 text-purple-300 border-purple-500/40";
  return "bg-neutral-500/10 text-neutral-200 border-neutral-500/40";
}

function getUserInitials(user: UserDto | null): string {
  if (!user) return "PT";
  const u: any = user;
  const name =
    u.name ||
    u.fullName ||
    `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
    u.email ||
    "";
  if (!name) return "PT";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((p) => p[0].toUpperCase());
  return initials.join("") || "PT";
}

/* ------------------- Custom Toolbar (unchanged) ------------------- */

const CustomToolbar: React.FC<
  ToolbarProps<Appointment, object> & {
    onDateChange: (date: Date) => void;
    onViewChange: (view: View) => void;
  }
> = (toolbar) => {
  const current = new Date(toolbar.date);
  const currentMonth = current.getMonth();
  const currentYear = current.getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);
  const monthLabel = format(current, "MMMM yyyy");
  const isAgendaView = toolbar.view === "agenda";

  const goPrev = () => {
    if (isAgendaView) {
      const prev = new Date(current);
      prev.setDate(prev.getDate() - 1);
      toolbar.onDateChange(prev);
    } else {
      toolbar.onDateChange(
        new Date(current.getFullYear(), currentMonth - 1, 1)
      );
    }
  };

  const goNext = () => {
    if (isAgendaView) {
      const next = new Date(current);
      next.setDate(next.getDate() + 1);
      toolbar.onDateChange(next);
    } else {
      toolbar.onDateChange(
        new Date(current.getFullYear(), currentMonth + 1, 1)
      );
    }
  };

  const goToday = () => toolbar.onDateChange(new Date());

  const handleMonth = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = Number(e.target.value);
    const newDate = new Date(toolbar.date);
    newDate.setMonth(newMonth);
    toolbar.onDateChange(newDate);
  };

  const handleYear = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = Number(e.target.value);
    const newDate = new Date(toolbar.date);
    newDate.setFullYear(newYear);
    toolbar.onDateChange(newDate);
  };

  const views: View[] = ["month", "week", "day", "agenda"];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 bg-neutral-900/70 backdrop-blur-md rounded-xl border border-neutral-800 shadow-md">
      {/* Left */}
      <div className="flex items-center gap-2">
        <button
          onClick={goPrev}
          className="p-2 rounded-md bg-neutral-800 hover:bg-neutral-700 transition"
        >
          <ChevronLeft size={16} />
        </button>

        <button
          onClick={goToday}
          className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs sm:text-sm text-neutral-100 rounded-md transition font-medium"
        >
          {isAgendaView ? format(current, "dd MMM yyyy") : monthLabel}
        </button>

        <button
          onClick={goNext}
          className="p-2 rounded-md bg-neutral-800 hover:bg-neutral-700 transition"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Middle */}
      <div className="flex items-center gap-2">
        {isAgendaView ? (
          <input
            type="date"
            className="bg-neutral-800 text-neutral-200 text-xs sm:text-sm rounded-md px-2 py-1 border border-neutral-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={format(current, "yyyy-MM-dd")}
            onChange={(e) => {
              const value = e.target.value;
              if (!value) return;
              const [y, m, d] = value.split("-").map(Number);
              const picked = new Date(y, m - 1, d);
              toolbar.onDateChange(picked);
            }}
          />
        ) : (
          <>
            <select
              className="bg-neutral-800 text-neutral-200 text-xs sm:text-sm rounded-md px-2 py-1 border border-neutral-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={currentMonth}
              onChange={handleMonth}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i} value={i}>
                  {new Date(0, i).toLocaleString("default", {
                    month: "long",
                  })}
                </option>
              ))}
            </select>

            <select
              className="bg-neutral-800 text-neutral-200 text-xs sm:text-sm rounded-md px-2 py-1 border border-neutral-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={currentYear}
              onChange={handleYear}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {views.map((v) => (
          <button
            key={v}
            onClick={() => toolbar.onViewChange(v)}
            className={`capitalize text-xs sm:text-sm px-2.5 sm:px-3 py-1.5 rounded-md ${
              toolbar.view === v
                ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-sm"
                : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            } transition`}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
};

/* ------------------- Month Date Header (LESS MESSY) ------------------- */

type MonthHeaderProps = {
  label: string;
  date: Date;
  summaryByDate: Record<string, AppointmentsCalendarSummaryDay>;
};

const MonthDateHeaderCompact: React.FC<MonthHeaderProps> = ({
  label,
  date,
  summaryByDate,
}) => {
  const key = format(date, "yyyy-MM-dd");
  const day = summaryByDate[key];
  const total = day?.total || 0;
  const byStatus = (day?.byStatus || {}) as Record<string, number>;

  const top = Object.entries(byStatus)
    .filter(([, c]) => (c || 0) > 0)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .slice(0, 3);

  return (
    <div className="pt-1 px-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] sm:text-xs font-medium text-neutral-200">
          {label}
        </span>

        {total > 0 && (
          <span className="text-[10px] text-neutral-400">{total}</span>
        )}
      </div>

      {total > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {top.map(([st, c]) => (
            <span
              key={st}
              title={`${st.replace(/[-_]/g, " ")}: ${c}`}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-950/30 px-1.5 py-0.5 text-[9px] text-neutral-300"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: getStatusColorHex(st) }}
              />
              {c}
            </span>
          ))}

          {Object.entries(byStatus).filter(([, c]) => (c || 0) > 0).length >
            3 && <span className="text-[9px] text-neutral-500">…</span>}
        </div>
      )}

      {total > 0 && (
        <div className="mt-1 text-[10px] text-neutral-500">
          Click day to open list
        </div>
      )}
    </div>
  );
};

/* ------------------- Calendar Widget ------------------- */

export default function CalendarWidget() {
  const { events, setEvents } = useEventStore((s) => ({
    events: s.events,
    setEvents: s.setEvents,
  }));

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<View>(Views.MONTH);
  const [visible, setVisible] = useState(true);

  // month summary
  const [monthSummary, setMonthSummary] = useState<AppointmentsCalendarSummaryDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // day list popup (new)
  const [dayListOpen, setDayListOpen] = useState(false);
  const [dayListDate, setDayListDate] = useState<Date | null>(null);

  // detail modal state (YOUR OLD MODAL)
  const [selectedEvent, setSelectedEvent] = useState<Appointment | null>(null);
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentDto | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // map date -> summary
  const summaryByDate = useMemo(() => {
    const map: Record<string, AppointmentsCalendarSummaryDay> = {};
    monthSummary.forEach((day) => {
      map[day.date] = day;
    });
    return map;
  }, [monthSummary]);

  // 🔄 Refetch appointments when month changes
  useEffect(() => {
    let cancelled = false;

    async function loadAppointments() {
      try {
        setLoading(true);
        setFetchError(null);

        const fromDate = startOfMonth(currentDate);
        const toDate = endOfMonth(currentDate);
        const from = format(fromDate, "yyyy-MM-dd");
        const to = format(toDate, "yyyy-MM-dd");

        const res = await getAppointmentsCalendarSummaryApi({ from, to });
        if (cancelled) return;

        const summary = res.data || [];
        setMonthSummary(summary);

        // map to react-big-calendar events (for week/day/agenda)
        const mapped: Appointment[] = [];

        summary.forEach((day: AppointmentsCalendarSummaryDay) => {
          const appointmentsForDay = day.appointments || [];
          appointmentsForDay.forEach((appt) => {
            const start = new Date(appt.start_at);
            if (isNaN(start.getTime())) return;

            const end = new Date(start.getTime() + 15 * 60 * 1000);

            mapped.push({
              id: mapped.length + 1,
              title: `Appointment – ${format(start, "HH:mm")}`,
              start,
              end,
              doctor: undefined,
              type: appt.status,
              notes: undefined,
              appointmentId: appt._id,
            } as Appointment & { appointmentId: string });
          });
        });

        setEvents(mapped);
      } catch (e: any) {
        if (cancelled) return;
        setFetchError(e?.message || "Failed to load appointments.");
        setMonthSummary([]);
        setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAppointments();
    return () => {
      cancelled = true;
    };
  }, [currentDate, setEvents]);

  // Small animation
  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 120);
    return () => clearTimeout(t);
  }, [currentDate, currentView]);

  const onDateChange = (d: Date) => setCurrentDate(new Date(d));
  const onViewChange = (v: View) => setCurrentView(v);

  const isMonth = currentView === Views.MONTH;

  // On event click: fetch appointment + user + order (unchanged)
  const handleSelectEvent = (ev: Appointment) => {
    setSelectedEvent(ev);
    setSelectedAppointment(null);
    setSelectedUser(null);
    setSelectedOrder(null);
    setDetailError(null);

    const appointmentId = (ev as any).appointmentId as string | undefined;
    if (!appointmentId) return;

    setDetailLoading(true);

    (async () => {
      try {
        const appt = await getAppointmentByIdApi(appointmentId);
        setSelectedAppointment(appt);

        const [user, order] = await Promise.all([
          appt.user_id ? getUserByIdApi(appt.user_id) : Promise.resolve(null),
          appt.order_id
            ? getOrderByIdApi(appt.order_id)
            : Promise.resolve(null),
        ]);

        setSelectedUser(user);
        setSelectedOrder(order || null);
      } catch (e: any) {
        setDetailError(e?.message || "Failed to load appointment details.");
      } finally {
        setDetailLoading(false);
      }
    })();
  };

  // Month: clicking a day opens the list dialog (instead of showing pills)
  const onSelectSlot = (slot: SlotInfo) => {
    if (!isMonth) return;
    const d = new Date(slot.start);
    setDayListDate(d);
    setDayListOpen(true);
  };

  const dayKey = dayListDate ? format(dayListDate, "yyyy-MM-dd") : "";
  const daySummary = dayKey ? summaryByDate[dayKey] : undefined;
  const dayAppointments = daySummary?.appointments || [];

  // 💅 Style events by status (ONLY for week/day/agenda; month has no events)
  const eventStyleGetter = (event: Appointment) => {
    const e: any = event;
    const status: string = (e.type as string) || "pending";
    const accent = getStatusColorHex(status);

    return {
      style: {
        borderRadius: 10,
        padding: "4px 8px",
        color: "#e5e7eb",
        backgroundColor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderLeft: `3px solid ${accent}`,
        fontSize: "12px",
        fontWeight: 600,
      },
    };
  };

  // Month view shows summary-only, so hide events
  const visibleEvents = isMonth ? [] : events;

  // 📊 header summary
  const { totalAppointments, statusTotals } = useMemo(() => {
    let total = 0;
    const statusMap: Record<string, number> = {};

    monthSummary.forEach((day) => {
      total += typeof day.total === "number" ? day.total : 0;

      const by = (day.byStatus || {}) as Record<string, number>;
      Object.entries(by).forEach(([status, count]) => {
        statusMap[status] = (statusMap[status] ?? 0) + (count || 0);
      });
    });

    return { totalAppointments: total, statusTotals: statusMap };
  }, [monthSummary]);

  const legend = [
    { label: "Pending", color: getStatusColorHex("pending") },
    { label: "Confirmed", color: getStatusColorHex("confirmed") },
    { label: "Cancelled", color: getStatusColorHex("cancelled") },
    { label: "Completed", color: getStatusColorHex("completed") },
    { label: "No-show", color: getStatusColorHex("no-show") },
    { label: "Rescheduled", color: getStatusColorHex("rescheduled") },
  ];

  return (
    <div className="w-full">
      <div className="rounded-2xl border border-neutral-800 bg-gradient-to-b from-[#111113] to-[#050507] p-4 sm:p-6 lg:p-7 shadow-[0_0_25px_rgba(0,0,0,0.4)] backdrop-blur-sm">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3 text-white font-medium text-base sm:text-lg">
              <CalendarDays size={20} className="text-blue-500" />
              <span>Appointments Calendar</span>
            </div>
            <span className="text-xs text-neutral-400">
              {format(currentDate, "MMMM yyyy")}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2 text-[11px] sm:text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-900/80 border border-neutral-700 px-3 py-1 text-neutral-200">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              {totalAppointments} appointments this month
            </span>
            {Object.entries(statusTotals).map(([status, count]) => (
              <span
                key={status}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 ${statusPillClass(
                  status
                )}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {status.replace(/[-_]/g, " ")} · {count}
              </span>
            ))}
          </div>
        </div>

        {fetchError && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-[11px] sm:text-xs text-rose-100">
            <AlertTriangle className="h-4 w-4" />
            <span>{fetchError}</span>
          </div>
        )}

        {loading && (
          <div className="mb-3 text-[11px] sm:text-xs text-neutral-400">
            Loading appointments for {format(currentDate, "MMMM yyyy")}…
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-neutral-800">
          <div
            key={`${currentDate.toISOString()}_${currentView}`}
            className={`transition-all duration-200 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
            }`}
          >
            <RBC<Appointment>
              localizer={localizer}
              events={visibleEvents}
              startAccessor="start"
              endAccessor="end"
              date={currentDate}
              view={currentView}
              onNavigate={(d) => setCurrentDate(new Date(d))}
              onView={(v) => setCurrentView(v)}
              onSelectEvent={handleSelectEvent}
              selectable={isMonth}
              onSelectSlot={onSelectSlot}
              popup={!isMonth} // ✅ no +more in month
              length={1}
              eventPropGetter={(evt) => eventStyleGetter(evt as Appointment)}
              components={{
                toolbar: (props) => (
                  <CustomToolbar
                    {...props}
                    onDateChange={onDateChange}
                    onViewChange={onViewChange}
                  />
                ),
                month: {
                  dateHeader: (props: any) => (
                    <MonthDateHeaderCompact
                      {...props}
                      summaryByDate={summaryByDate}
                    />
                  ),
                },
              }}
              style={{ height: 640 }}
              views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
              className="text-[11px] sm:text-sm
                [&_.rbc-month-view]:bg-neutral-900
                [&_.rbc-time-view]:bg-neutral-900
                [&_.rbc-header]:bg-neutral-900
                [&_.rbc-header]:text-neutral-300
                [&_.rbc-today]:bg-blue-500/10
                [&_.rbc-off-range-bg]:bg-neutral-800/40
                [&_.rbc-date-cell]:text-neutral-300
                [&_.rbc-month-row]:min-h-[92px]
                [&_.rbc-show-more]:hidden
              "
            />
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-3 text-[10px] sm:text-[11px] text-neutral-400">
          {legend.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span
                className="h-2 w-3 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {isMonth && (
          <div className="mt-2 text-[11px] text-neutral-500">
            Month view is summary-only. Click any day to open the day list.
          </div>
        )}
      </div>

      {/* ---------------- Day List Popup (NEW, simple) ---------------- */}
      <Dialog
        open={dayListOpen}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setDayListOpen(false);
            setDayListDate(null);
          }
        }}
      >
        {dayListOpen && dayListDate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-4">
            <div className="relative w-full max-w-3xl bg-gradient-to-b from-[#141417] to-[#050507] border border-neutral-800/80 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.65)] p-4 sm:p-6 text-white max-h-[85vh] overflow-y-auto">
              <button
                onClick={() => {
                  setDayListOpen(false);
                  setDayListDate(null);
                }}
                className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-neutral-800/60 transition"
              >
                <X size={18} className="text-neutral-400 hover:text-neutral-200" />
              </button>

              <div className="flex items-start justify-between gap-3 pr-8">
                <div>
                  <p className="text-white text-lg font-semibold">
                    {format(dayListDate, "dd MMM yyyy")}
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    {(daySummary?.total || 0)} appointments
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-[11px]">
                  {Object.entries((daySummary?.byStatus || {}) as any)
                    .filter(([, c]) => (c as number) > 0)
                    .sort((a, b) => (b[1] as number) - (a[1] as number))
                    .map(([st, c]) => (
                      <span
                        key={st}
                        className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 ${statusPillClass(
                          st
                        )}`}
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: getStatusColorHex(st) }}
                        />
                        {st.replace(/[-_]/g, " ")} · {c as number}
                      </span>
                    ))}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {dayAppointments.length === 0 ? (
                  <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm text-neutral-400">
                    No appointments on this day.
                  </div>
                ) : (
                  dayAppointments
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(a.start_at).getTime() -
                        new Date(b.start_at).getTime()
                    )
                    .map((appt) => {
                      const st = appt.status || "pending";
                      const start = new Date(appt.start_at);
                      const end = new Date(start.getTime() + 15 * 60 * 1000);

                      return (
                        <button
                          key={appt._id}
                          type="button"
                          onClick={() => {
                            // close day list and open your existing modal
                            setDayListOpen(false);
                            setDayListDate(null);

                            const ev = {
                              id: 999999,
                              title: `Appointment – ${format(start, "HH:mm")}`,
                              start,
                              end,
                              type: st,
                              appointmentId: appt._id,
                            } as any as Appointment;

                            handleSelectEvent(ev);
                          }}
                          className="w-full text-left rounded-xl border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-900/80 transition p-3 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: getStatusColorHex(st) }}
                              />
                              <span className="text-white font-semibold text-sm">
                                {formatTime(appt.start_at)}
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-neutral-500" />
                        </button>
                      );
                    })
                )}
              </div>

              <div className="mt-5 flex justify-end">
                <Button
                  onClick={() => {
                    setDayListOpen(false);
                    setDayListDate(null);
                  }}
                  className="px-4 py-2 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 rounded-md transition"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* --------- BIG DETAIL MODAL (YOUR OLD MODAL - UNCHANGED) --------- */}
      <Dialog
        open={!!selectedEvent}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setSelectedEvent(null);
            setSelectedAppointment(null);
            setSelectedUser(null);
            setSelectedOrder(null);
            setDetailError(null);
            setDetailLoading(false);
          }
        }}
      >
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-3 sm:px-4 md:px-6">
            <div
              className="
                relative
                w-full
                max-w-5xl
                bg-gradient-to-b from-[#141417] to-[#050507]
                border border-neutral-800/80
                rounded-2xl
                shadow-[0_0_40px_rgba(0,0,0,0.65)]
                px-4 sm:px-6 md:px-8
                py-4 sm:py-6 md:py-7
                text-white
                backdrop-blur-2xl
                max-h-[90vh]
                overflow-y-auto
              "
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setSelectedEvent(null);
                  setSelectedAppointment(null);
                  setSelectedUser(null);
                  setSelectedOrder(null);
                  setDetailError(null);
                  setDetailLoading(false);
                }}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 rounded-md hover:bg-neutral-800/60 transition"
              >
                <X
                  size={18}
                  className="text-neutral-400 hover:text-neutral-200 transition"
                />
              </button>

              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6 pr-4 sm:pr-6 md:pr-8">
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-2 rounded-xl bg-blue-600/20 border border-blue-600/30">
                    <CalendarDays size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg md:text-xl font-semibold tracking-tight">
                      {selectedAppointment?.service_name ||
                        selectedAppointment?.patient_name ||
                        selectedEvent.title}
                    </h3>
                    <p className="mt-1 text-[11px] sm:text-xs md:text-sm text-neutral-400 flex flex-wrap items-center gap-1 sm:gap-2">
                      <span>
                        {formatDateOnly(
                          selectedAppointment?.start_at || selectedEvent.start
                        )}
                      </span>
                      <span className="text-neutral-600">•</span>
                      <span>
                        {formatTime(
                          selectedAppointment?.start_at || selectedEvent.start
                        )}{" "}
                        –{" "}
                        {formatTime(
                          selectedAppointment?.end_at || selectedEvent.end
                        )}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Status + medium */}
                <div className="flex flex-col items-end gap-2 text-[10px] sm:text-[11px]">
                  {(() => {
                    const rawStatus =
                      selectedAppointment?.status ||
                      ((selectedEvent as any).type as string | undefined);
                    if (!rawStatus) return null;
                    return (
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 sm:px-3 sm:py-1 ${statusPillClass(
                          rawStatus
                        )}`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {rawStatus.replace(/[-_]/g, " ")}
                      </span>
                    );
                  })()}
                  {selectedAppointment?.medium && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 sm:px-3 sm:py-1 ${mediumPillClass(
                        selectedAppointment.medium
                      )}`}
                    >
                      {selectedAppointment.medium}
                    </span>
                  )}
                </div>
              </div>

              {/* Detail loading / error */}
              {detailLoading && (
                <div className="mb-3 flex items-center gap-2 text-[11px] sm:text-xs text-neutral-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading full appointment, patient and order details…
                </div>
              )}

              {detailError && (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/50 px-3 py-2 text-[11px] sm:text-xs text-rose-100">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{detailError}</span>
                </div>
              )}

              {/* BODY */}
              <div className="space-y-5">
                {/* Top two cards: patient + appointment */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Patient Card */}
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-3 sm:px-4 py-3 sm:py-4 space-y-3 h-full">
                    <p className="text-[10px] sm:text-[11px] font-medium text-neutral-400 mb-1">
                      Patient profile
                    </p>
                    {selectedUser ? (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                            <span className="text-xs sm:text-sm font-semibold text-neutral-100">
                              {getUserInitials(selectedUser)}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {selectedUser.name ||
                                selectedUser.fullName ||
                                `${selectedUser.firstName || ""} ${
                                  selectedUser.lastName || ""
                                }`.trim() ||
                                "Unknown patient"}
                            </p>
                            <p className="text-[10px] sm:text-[11px] text-neutral-400 flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                              {selectedUser.gender && (
                                <span className="capitalize">
                                  {selectedUser.gender}
                                </span>
                              )}
                              {selectedUser._id && (
                                <>
                                  <span className="text-neutral-600">•</span>
                                  <span className="inline-flex items-center gap-1">
                                    <Hash className="h-3 w-3 text-neutral-500" />
                                    {selectedUser._id}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-neutral-300 pt-2">
                          {selectedUser.email && (
                            <div className="inline-flex items-center gap-1">
                              <Mail className="h-3 w-3 text-neutral-500" />
                              <span className="break-all">
                                {selectedUser.email}
                              </span>
                            </div>
                          )}
                          {(selectedUser.phone ||
                            (selectedUser as any).phoneNumber) && (
                            <div className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3 text-neutral-500" />
                              <span>
                                {selectedUser.phone ||
                                  (selectedUser as any).phoneNumber}
                              </span>
                            </div>
                          )}
                        </div>

                        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] sm:text-[11px] mt-3">
                          <div>
                            <dt className="text-neutral-500">Address line 1</dt>
                            <dd className="text-neutral-100">
                              {(selectedUser as any).address_line1 ||
                                (selectedUser as any).addressLine1 ||
                                "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-neutral-500">Address line 2</dt>
                            <dd className="text-neutral-100">
                              {(selectedUser as any).address_line2 ||
                                (selectedUser as any).addressLine2 ||
                                "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-neutral-500">City</dt>
                            <dd className="text-neutral-100">
                             { (selectedUser as any).city || "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-neutral-500">County</dt>
                            <dd className="text-neutral-100">
                              {(selectedUser as any).county || "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-neutral-500">Postcode</dt>
                            <dd className="text-neutral-100">
                              {(selectedUser as any).postalcode || "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-neutral-500">Country</dt>
                            <dd className="text-neutral-100">
                              {(selectedUser as any).country || "—"}
                            </dd>
                          </div>
                        </dl>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-neutral-400">
                        <User className="h-4 w-4 text-neutral-500" />
                        No patient details found for this appointment.
                      </div>
                    )}
                  </div>

                  {/* Appointment Card */}
                  <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-3 sm:px-4 py-3 sm:py-4 space-y-3 h-full">
                    <p className="text-[10px] sm:text-[11px] font-medium text-neutral-400 mb-1">
                      Appointment info
                    </p>

                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-white">
                        {selectedAppointment?.service_name || "Service"}
                      </p>
                      {selectedAppointment?.service_slug && (
                        <p className="text-[10px] sm:text-[11px] text-neutral-400">
                          {selectedAppointment.service_slug}
                        </p>
                      )}
                    </div>

                    <div className="text-[10px] sm:text-[11px] text-neutral-300 pt-1 space-y-1">
                      <p>
                        <span className="font-semibold text-neutral-400">
                          Date:
                        </span>{" "}
                        {formatDateOnly(
                          selectedAppointment?.start_at || selectedEvent.start
                        )}
                      </p>
                      <p className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-neutral-500" />
                        <span className="font-semibold text-neutral-400">
                          Time:
                        </span>{" "}
                        {formatTime(
                          selectedAppointment?.start_at || selectedEvent.start
                        )}{" "}
                        –{" "}
                        {formatTime(
                          selectedAppointment?.end_at || selectedEvent.end
                        )}
                      </p>
                      {selectedAppointment && (
                        <>
                          <p>
                            <span className="font-semibold text-neutral-400">
                              Medium:
                            </span>{" "}
                            {selectedAppointment.medium || "—"}
                          </p>
                          <p>
                            <span className="font-semibold text-neutral-400">
                              Status:
                            </span>{" "}
                            {selectedAppointment.status || "—"}
                          </p>
                        </>
                      )}
                    </div>

                    {(selectedAppointment?.join_url ||
                      selectedAppointment?.host_url) && (
                      <div className="pt-3 flex flex-wrap gap-2">
                        {selectedAppointment?.join_url && (
                          <Button
                            type="button"
                            onClick={() =>
                              window.open(selectedAppointment.join_url!, "_blank")
                            }
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-[10px] sm:text-[11px] rounded-full inline-flex items-center gap-1"
                          >
                            <Link2 className="h-3 w-3" />
                            Patient join link
                          </Button>
                        )}
                        {selectedAppointment?.host_url && (
                          <Button
                            type="button"
                            onClick={() =>
                              window.open(selectedAppointment.host_url!, "_blank")
                            }
                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-[10px] sm:text-[11px] rounded-full inline-flex items-center gap-1"
                          >
                            <Link2 className="h-3 w-3" />
                            Host link
                          </Button>
                        )}
                      </div>
                    )}

                    {selectedAppointment && (
                      <div className="pt-3 border-t border-neutral-800 mt-3 text-[10px] sm:text-[11px] text-neutral-500 space-y-1">
                        <p>
                          Created:{" "}
                          <span className="text-neutral-200">
                            {formatDateTime(selectedAppointment.createdAt)}
                          </span>
                        </p>
                        <p>
                          Updated:{" "}
                          <span className="text-neutral-200">
                            {formatDateTime(selectedAppointment.updatedAt)}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Order summary full width */}
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 px-3 sm:px-4 py-3 sm:py-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-neutral-300" />
                      <p className="text-[11px] sm:text-xs font-semibold text-neutral-200">
                        Order summary
                      </p>
                    </div>
                    {selectedOrder?.reference && (
                      <p className="text-[10px] sm:text-xs text-neutral-400">
                        Ref:{" "}
                        <span className="font-mono text-neutral-200">
                          {selectedOrder.reference}
                        </span>
                      </p>
                    )}
                  </div>

                  {selectedOrder ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-neutral-300">
                        <span>
                          Service{" "}
                          <span className="font-semibold text-neutral-100">
                            {(selectedOrder as any).service_name}
                          </span>
                        </span>
                        {(selectedOrder as any).service_slug && (
                          <span className="text-neutral-400">
                            ({(selectedOrder as any).service_slug})
                          </span>
                        )}
                        {(selectedOrder as any).status && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${statusPillClass(
                              (selectedOrder as any).status
                            )}`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {String((selectedOrder as any).status).replace(
                              /[-_]/g,
                              " "
                            )}
                          </span>
                        )}
                      </div>

                      <div className="mt-3">
                        {(selectedOrder as any).meta?.items?.length ? (
                          <div className="space-y-1">
                            {(selectedOrder as any).meta.items.map(
                              (it: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-[11px] py-1.5 border-b border-neutral-800/70 last:border-none"
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium text-white">
                                      {it.name}
                                    </span>
                                    <span className="text-[10px] sm:text-[11px] text-neutral-400">
                                      {it.variation ||
                                        it.variations ||
                                        "Standard"}
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="block text-[10px] sm:text-[11px] text-neutral-400">
                                      Qty: {it.qty}
                                    </span>
                                    <span className="block text-[10px] sm:text-[11px] text-neutral-300">
                                      {formatMoney(it.totalMinor)}
                                    </span>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] sm:text-xs text-neutral-500">
                            No items found on this order.
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-neutral-800 mt-2 flex items-center justify-between text-[10px] sm:text-xs">
                        <span className="text-neutral-400">
                          Total amount (incl. appointment):
                        </span>
                        <span className="font-semibold text-white">
                          {formatMoney((selectedOrder as any).meta?.totalMinor)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-[10px] sm:text-xs text-neutral-500">
                      No linked order information found for this appointment.
                    </p>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
                <Button
                  onClick={() => {
                    setSelectedEvent(null);
                    setSelectedAppointment(null);
                    setSelectedUser(null);
                    setSelectedOrder(null);
                    setDetailError(null);
                    setDetailLoading(false);
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 rounded-md transition"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
