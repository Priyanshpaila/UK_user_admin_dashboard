"use client";

import React, { useMemo, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

export type CardPeriodKey = "daily7d" | "weekly12w" | "monthly12m" | "yearly5y";

const OPTIONS: Array<{ key: CardPeriodKey; label: string }> = [
  { key: "daily7d", label: "Daily 7d" },
  { key: "weekly12w", label: "Weekly 12w" },
  { key: "monthly12m", label: "Monthly 12m" },
  { key: "yearly5y", label: "Yearly 5y" },
];

export default function CardPeriodPicker({
  value,
  onChange,
  title = "Period",
}: {
  value: CardPeriodKey;
  onChange: (v: CardPeriodKey) => void;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CardPeriodKey>(value);

  const label = useMemo(
    () => OPTIONS.find((o) => o.key === value)?.label || "Period",
    [value]
  );

  function close() {
    setOpen(false);
    setDraft(value);
  }

  function submit() {
    onChange(draft);
    setOpen(false);
  }

  return (
    <>
      {/* button */}
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-lg bg-[#c77700] hover:bg-[#d58400] text-white text-xs font-semibold px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
      >
        <SlidersHorizontal className="h-4 w-4" />
        {label}
      </button>

      {/* modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-950/90 shadow-[0_0_60px_rgba(0,0,0,0.65)]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
              <p className="text-sm font-semibold text-neutral-100">{title}</p>
              <button
                type="button"
                onClick={close}
                className="p-2 rounded-md hover:bg-neutral-900 text-neutral-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-xs text-neutral-300 mb-2">
                  Period<span className="text-red-400">*</span>
                </p>

                <select
                  value={draft}
                  onChange={(e) => setDraft(e.target.value as CardPeriodKey)}
                  className="w-full rounded-xl bg-neutral-950 border border-[#c77700] px-3 py-3 text-sm text-neutral-100 focus:outline-none"
                >
                  {OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={submit}
                  className="rounded-lg bg-[#c77700] hover:bg-[#d58400] text-white text-xs font-semibold px-4 py-2"
                >
                  Submit
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold px-4 py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
