export function toIsoStartOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0)).toISOString();
}

export function toIsoEndOfDayUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999)).toISOString();
}

export function addDaysUTC(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function formatBucketLabel(bucket: string) {
  // bucket: "2025-12-19"
  const d = new Date(bucket + "T00:00:00Z");
  if (isNaN(d.getTime())) return bucket;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function formatGBP(value: number) {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 2,
    }).format(value || 0);
  } catch {
    return `£${(value || 0).toFixed(2)}`;
  }
}
