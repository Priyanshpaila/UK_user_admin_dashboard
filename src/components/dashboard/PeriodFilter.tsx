"use client";

import React from "react";

export type PeriodPreset = "7d" | "30d" | "custom";

export default function PeriodFilter({
  preset,
  onPresetChange,
  start,
  end,
  onStartChange,
  onEndChange,
}: {
  preset: PeriodPreset;
  onPresetChange: (v: PeriodPreset) => void;
  start: string; // ISO
  end: string; // ISO
  onStartChange: (iso: string) => void;
  onEndChange: (iso: string) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="inline-flex rounded-lg border border-neutral-800 bg-neutral-900/60 p-1">
        {[
          { k: "7d", label: "Daily 7d" },
          { k: "30d", label: "Daily 30d" },
          { k: "custom", label: "Custom" },
        ].map((x) => (
          <button
            key={x.k}
            onClick={() => onPresetChange(x.k as any)}
            className={[
              "px-3 py-1.5 text-xs rounded-md transition",
              preset === x.k
                ? "bg-amber-500/20 text-amber-200 border border-amber-500/30"
                : "text-neutral-300 hover:bg-neutral-800/60",
            ].join(" ")}
          >
            {x.label}
          </button>
        ))}
      </div>

      {preset === "custom" && (
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="text-[11px] text-neutral-400">
            Start
            <input
              className="mt-1 w-full sm:w-[220px] rounded-md bg-neutral-950 border border-neutral-800 px-2 py-1 text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
              type="datetime-local"
              value={isoToLocalInput(start)}
              onChange={(e) => onStartChange(localInputToIso(e.target.value))}
            />
          </label>
          <label className="text-[11px] text-neutral-400">
            End
            <input
              className="mt-1 w-full sm:w-[220px] rounded-md bg-neutral-950 border border-neutral-800 px-2 py-1 text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
              type="datetime-local"
              value={isoToLocalInput(end)}
              onChange={(e) => onEndChange(localInputToIso(e.target.value))}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function isoToLocalInput(iso: string) {
  // "2025-12-19T23:59:59.999Z" -> "2025-12-19T23:59"
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function localInputToIso(v: string) {
  // treat input as local time; convert to ISO
  const d = new Date(v);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}
