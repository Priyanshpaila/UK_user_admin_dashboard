"use client";
import React, { useEffect, useState } from "react";
import {
  Calendar as RBC,
  dateFnsLocalizer,
  Views,
  type View,
  type ToolbarProps,
} from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import enUS from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";
import useEventStore, { Appointment } from "../../stores/events";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

/* ------------------- Custom Toolbar ------------------- */
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

  const goPrev = () =>
    toolbar.onDateChange(new Date(current.setMonth(currentMonth - 1)));
  const goNext = () =>
    toolbar.onDateChange(new Date(current.setMonth(currentMonth + 1)));
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
    <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-neutral-900/70 backdrop-blur-md rounded-xl border border-neutral-800 shadow-md">
      {/* Left: navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={goPrev}
          className="p-2 rounded-md bg-neutral-800 hover:bg-neutral-700 transition"
        >
          <ChevronLeft size={16} />
        </button>

        <button
          onClick={goToday}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition"
        >
          Today
        </button>

        <button
          onClick={goNext}
          className="p-2 rounded-md bg-neutral-800 hover:bg-neutral-700 transition"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Middle: month/year */}
      <div className="flex items-center gap-2">
        <select
          className="bg-neutral-800 text-neutral-200 text-sm rounded-md px-2 py-1 border border-neutral-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={currentMonth}
          onChange={handleMonth}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <option key={i} value={i}>
              {new Date(0, i).toLocaleString("default", { month: "long" })}
            </option>
          ))}
        </select>

        <select
          className="bg-neutral-800 text-neutral-200 text-sm rounded-md px-2 py-1 border border-neutral-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={currentYear}
          onChange={handleYear}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Right: view buttons */}
      <div className="flex items-center gap-2">
        {views.map((v) => (
          <button
            key={v}
            onClick={() => toolbar.onViewChange(v)}
            className={`capitalize text-sm px-3 py-1.5 rounded-md ${
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

/* ------------------- Calendar Widget ------------------- */
export default function CalendarWidget() {
  const { events, setEvents } = useEventStore((s) => ({
    events: s.events,
    setEvents: s.setEvents,
  }));
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<View>(Views.MONTH);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const mock: Appointment[] = [
      {
        id: 1,
        title: "Dental Cleaning — John Doe",
        start: new Date(2025, 10, 11, 10, 0),
        end: new Date(2025, 10, 11, 11, 0),
        doctor: "Dr. Smith",
        type: "Dental",
        notes: "Bring previous X-rays.",
      },
      {
        id: 2,
        title: "Eye Checkup — Sarah Lee",
        start: new Date(2025, 10, 13, 9, 30),
        end: new Date(2025, 10, 13, 10, 15),
        doctor: "Dr. Patel",
        type: "Optometry",
        notes: "Follow-up visit.",
      },
      {
        id: 3,
        title: "Physiotherapy — Jake Kim",
        start: new Date(2025, 10, 14, 14, 0),
        end: new Date(2025, 10, 14, 15, 0),
        doctor: "Dr. Adams",
        type: "Rehab",
        notes: "Routine muscle recovery.",
      },
    ];
    setEvents(mock);
  }, [setEvents]);

  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 150);
    return () => clearTimeout(t);
  }, [currentDate, currentView]);

  const onDateChange = (d: Date) => setCurrentDate(new Date(d));
  const onViewChange = (v: View) => setCurrentView(v);
  const handleSelectEvent = (ev: Appointment) => setSelected(ev);

  const eventStyleGetter = (event: Appointment) => {
    const colorMap: Record<string, string> = {
      Dental: "#60a5fa",
      Optometry: "#34d399",
      Rehab: "#f59e0b",
      Quick: "#a78bfa",
    };
    return {
      style: {
        borderRadius: 10,
        padding: "4px 8px",
        color: "#0f172a",
        backgroundColor: colorMap[event.type || "Dental"] || "#60a5fa",
        border: "none",
      },
    };
  };

  return (
    <div className="w-full">
      <div className="rounded-2xl border border-neutral-800 bg-gradient-to-b from-[#111113] to-[#0b0b0c] p-6 shadow-[0_0_25px_rgba(0,0,0,0.4)] backdrop-blur-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3 text-white font-medium text-lg">
            <CalendarDays size={20} className="text-blue-500" />
            Appointments Calendar
          </div>
          <Button
            onClick={() =>
              setEvents([
                ...events,
                {
                  id: Date.now(),
                  title: `New Event ${events.length + 1}`,
                  start: new Date(),
                  end: new Date(new Date().getTime() + 30 * 60 * 1000),
                  doctor: "Dr. Auto",
                  type: "Quick",
                } as Appointment,
              ])
            }
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 transition text-white"
          >
            + Quick Add
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-800">
          <div
            key={`${currentDate.toISOString()}_${currentView}`}
            className={`transition-all duration-200 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
            }`}
          >
            <RBC<Appointment>
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              date={currentDate}
              view={currentView}
              onNavigate={(d) => setCurrentDate(new Date(d))}
              onView={(v) => setCurrentView(v)}
              onSelectEvent={handleSelectEvent}
              popup
              eventPropGetter={(evt) => eventStyleGetter(evt as Appointment)}
              components={{
                toolbar: (props) => (
                  <CustomToolbar
                    {...props}
                    onDateChange={onDateChange}
                    onViewChange={onViewChange}
                  />
                ),
              }}
              style={{ height: 650 }}
              views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
              className="text-sm [&_.rbc-month-view]:bg-neutral-900 [&_.rbc-today]:bg-blue-500/10 [&_.rbc-off-range-bg]:bg-neutral-800/40 [&_.rbc-date-cell]:text-neutral-300"
            />
          </div>
        </div>
      </div>

      {/* Modal */}
      {/* Beautiful Modern Modal */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        {selected && (
          <div className="relative w-full max-w-lg mx-auto bg-gradient-to-b from-[#121214] to-[#0b0b0c] border border-neutral-800 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] p-8 text-white backdrop-blur-xl animate-in fade-in duration-200">
            {/* Close Button */}
            <button
              onClick={() => setSelected(null)}
              className="absolute top-5 right-5 p-1.5 rounded-md hover:bg-neutral-800/60 transition"
            >
              <X
                size={18}
                className="text-neutral-400 hover:text-neutral-200 transition"
              />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-blue-600/20 border border-blue-600/30">
                <CalendarDays size={20} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold tracking-tight">
                  {selected.title}
                </h3>
                <p className="text-sm text-neutral-400">
                  {new Date(selected.start).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>

            {/* Details Section */}
            <div className="space-y-4">
              <div className="bg-neutral-900/60 rounded-xl p-4 border border-neutral-800/60">
                <p className="text-sm text-neutral-300 leading-relaxed">
                  <span className="font-medium text-neutral-200">🕒 Time:</span>{" "}
                  {new Date(selected.start).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  -{" "}
                  {new Date(selected.end).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>

                {selected.doctor && (
                  <p className="text-sm text-neutral-300 mt-2">
                    <span className="font-medium text-neutral-200">
                      👨‍⚕️ Doctor:
                    </span>{" "}
                    {selected.doctor}
                  </p>
                )}
                {selected.type && (
                  <p className="text-sm text-neutral-300 mt-2">
                    <span className="font-medium text-neutral-200">
                      📋 Type:
                    </span>{" "}
                    <span
                      className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                        selected.type === "Dental"
                          ? "bg-blue-600/30 text-blue-300"
                          : selected.type === "Optometry"
                          ? "bg-green-600/30 text-green-300"
                          : selected.type === "Rehab"
                          ? "bg-amber-600/30 text-amber-300"
                          : "bg-purple-600/30 text-purple-300"
                      }`}
                    >
                      {selected.type}
                    </span>
                  </p>
                )}
              </div>

              {/* Notes Section */}
              {selected.notes && (
                <div className="bg-neutral-900/60 rounded-xl p-4 border border-neutral-800/60">
                  <h4 className="text-sm font-semibold text-neutral-300 mb-1">
                    🗒️ Notes
                  </h4>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    {selected.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-8 flex justify-end gap-3">
              <Button
                onClick={() => setSelected(null)}
                className="px-4 py-2 bg-neutral-800 text-neutral-300 hover:bg-neutral-700 rounded-md transition"
              >
                Close
              </Button>

              <Button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white rounded-md transition">
                Edit Appointment
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
