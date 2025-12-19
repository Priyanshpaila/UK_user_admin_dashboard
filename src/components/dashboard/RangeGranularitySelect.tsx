"use client";

import React, { useMemo } from "react";

export type ChartPresetKey = "daily7d" | "weekly12w" | "monthly12m" | "yearly5y";

export type RevenueBookingsQueryPreset = {
  key: ChartPresetKey;
  label: string; // shown in dropdown
  granularity: "daily" | "weekly" | "monthly" | string;
  // rolling window:
  last?: number;
  // optional explicit range:
  start?: string;
  end?: string;
};

const PRESETS: RevenueBookingsQueryPreset[] = [
  { key: "daily7d", label: "Daily 7d", granularity: "daily", last: 7 },
  { key: "weekly12w", label: "Weekly 12w", granularity: "weekly", last: 12 },
  { key: "monthly12m", label: "Monthly 12m", granularity: "monthly", last: 12 },
  // 5y shown monthly buckets (60 months)
  { key: "yearly5y", label: "Yearly 5y", granularity: "monthly", last: 60 },
];

export function getPreset(key: ChartPresetKey): RevenueBookingsQueryPreset {
  return PRESETS.find((p) => p.key === key) || PRESETS[0];
}

export default function RangeGranularitySelect({
  value,
  onChange,
  align = "right",
}: {
  value: ChartPresetKey;
  onChange: (v: ChartPresetKey) => void;
  align?: "left" | "right";
}) {
  const items = useMemo(() => PRESETS, []);

  return (
    <div className={`relative ${align === "right" ? "ml-auto" : ""}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ChartPresetKey)}
        className="h-8 rounded-lg border border-neutral-700 bg-neutral-950 px-3 pr-9 text-xs text-neutral-100 outline-none
                   focus:border-amber-500/80 focus:ring-2 focus:ring-amber-500/20"
      >
        {items.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>

      {/* caret (matches screenshot vibe) */}
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400">
        ▾
      </span>
    </div>
  );
}
