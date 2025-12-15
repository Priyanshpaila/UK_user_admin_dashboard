// app/dashboard/orders/page.tsx (or your current file path)
/* eslint-disable @next/next/no-img-element */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  getOrdersApi,
  getOrderByIdApi,
  getUserByIdApi,
  getBackendBase,
  sendEmailApi,
  type OrderDto,
  type OrdersListMeta,
  type UserDto,
} from "../../../../api";
import {
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  CreditCard,
  ArrowRight,
  Filter,
  X,
  ClipboardList,
  Mail,
  Phone,
  Download,
  Send,
} from "lucide-react";
import jsPDF from "jspdf";

/* ----------------- Helpers ----------------- */

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type PdfHeaderState = {
  title: string;
  subtitle?: string;
  logoDataUrl?: string | null;
};

function drawPdfHeader(doc: jsPDF, header: PdfHeaderState) {
  const pageWidth = getPageWidth(doc);
  const headerY = 18;

  // white background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, getPageHeight(doc), "F");

  if (header.logoDataUrl) {
    try {
      doc.addImage(
        header.logoDataUrl,
        guessImageFormat(header.logoDataUrl),
        MARGIN_X,
        headerY - 6,
        26,
        12
      );
    } catch {
      // ignore logo errors
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
  doc.text(PHARMACY_INFO.name, MARGIN_X + 32, headerY - 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.text(String(header.title || "").toUpperCase(), MARGIN_X, headerY + 8);

  if (header.subtitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
    doc.text(header.subtitle, MARGIN_X, headerY + 14);
  }

  doc.setDrawColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.setLineWidth(0.6);
  doc.line(MARGIN_X, headerY + 18, pageWidth - MARGIN_X, headerY + 18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
}

function addPageWithHeader(doc: jsPDF, cursor: PdfCursor) {
  doc.addPage();
  const hdr = (doc as any).__pe_header as PdfHeaderState | undefined;
  if (hdr) drawPdfHeader(doc, hdr);
  cursor.y = TOP_CONTENT_Y;
}

/* ----------------- NEW: Ordered items normalisation (for PDFs) ----------------- */

type PdfOrderedItem = {
  name: string;
  variation?: string;
  qty: string;
};

function coerceQty(v: any): string {
  if (v == null) return "1";
  if (typeof v === "number") return String(v);
  const s = String(v).trim();
  return s || "1";
}

function getOrderedItemsForPdf(order: OrderDto): PdfOrderedItem[] {
  const anyOrder: any = order as any;
  const meta: any = anyOrder?.meta || {};

  const candidates: any[] = [
    ...(Array.isArray(meta.items) ? meta.items : []),
    ...(Array.isArray(meta.lines) ? meta.lines : []),
    ...(Array.isArray(meta.orderItems) ? meta.orderItems : []),
    ...(Array.isArray(anyOrder.items) ? anyOrder.items : []),
    ...(Array.isArray(anyOrder.lines) ? anyOrder.lines : []),
  ];

  const out: PdfOrderedItem[] = [];

  for (const it of candidates) {
    if (!it) continue;

    const name =
      it.name ||
      it.title ||
      it.product_name ||
      it.productName ||
      it.medicine_name ||
      it.medicineName ||
      it.label ||
      it.item ||
      "";

    const variation =
      it.variation ||
      it.variations ||
      it.strength ||
      it.dose ||
      it.option ||
      it.variant ||
      it.packSize ||
      it.pack_size ||
      "";

    const qty = coerceQty(
      it.qty ?? it.quantity ?? it.count ?? it.units ?? it.unitQty ?? 1
    );

    const cleanName = String(name || "").trim();
    const cleanVar = String(variation || "").trim();

    // Only keep rows that actually represent an item
    if (!cleanName && !cleanVar) continue;

    out.push({
      name: cleanName || "Item",
      variation: cleanVar || undefined,
      qty,
    });
  }

  // Deduplicate by name+variation+qty
  const seen = new Set<string>();
  return out.filter((x) => {
    const k = `${x.name}__${x.variation || ""}__${x.qty}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

type AdvicePoint = string;

const ADVICE_LIST_STYLE: "bullets" | "numbered" = "bullets"; // or "numbered"

function extractAdvicePoints(order: OrderDto): AdvicePoint[] {
  const meta: any = (order as any).meta || {};
  const advice = meta.pharmacistAdvice;
  const adviceState: Record<string, any[]> = advice?.adviceState || {};

  const points: string[] = [];

  const isCheckboxLine = (line: string) => /^checkbox\b/i.test(line.trim()); // "Checkbox 4vh4ypm", "Checkbox: ..."

  const stripPrefix = (line: string) =>
    line
      .replace(/^[•\u2022-]\s*/g, "") // bullets
      .replace(/^\(?\d+[\).\]]\s*/g, "") // "1." "1)" etc
      .trim();

  for (const arr of Object.values(adviceState || {})) {
    for (const raw of arr || []) {
      const s = String(raw ?? "")
        .replace(/\r/g, "")
        .trim();
      if (!s) continue;

      const lines = s
        .split(/\n+/)
        .map((x) => x.trim())
        .filter(Boolean)
        .filter((x) => !isCheckboxLine(x)) // ✅ remove "Checkbox xxxx"
        .map(stripPrefix)
        .filter(Boolean);

      points.push(...lines);
    }
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  return points.filter((p) => {
    const k = p.trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function drawItemsSuppliedTable(
  doc: jsPDF,
  cursor: PdfCursor,
  items: PdfOrderedItem[]
) {
  const pageWidth = getPageWidth(doc);
  const x = MARGIN_X;
  const w = pageWidth - 2 * MARGIN_X;

  const colItemW = w * 0.52;
  const colVarW = w * 0.33;
  const colQtyW = w - colItemW - colVarW;

  const headerH = 8;
  const lineH = 4.2;
  const padY = 2.5;
  const padX = 2.2;

  const drawHeader = () => {
    ensureSpace(doc, cursor, headerH);

    doc.setDrawColor(PDF_BORDER.r, PDF_BORDER.g, PDF_BORDER.b);
    doc.setFillColor(PDF_CARD_BG.r, PDF_CARD_BG.g, PDF_CARD_BG.b);
    doc.rect(x, cursor.y, w, headerH, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

    const ty = cursor.y + 5.4;
    doc.text("Item", x + padX, ty);
    doc.text("Variation / Strength", x + colItemW + padX, ty);
    doc.text("Qty", x + colItemW + colVarW + padX, ty);

    // vertical lines
    doc.setLineWidth(0.3);
    doc.line(x + colItemW, cursor.y, x + colItemW, cursor.y + headerH);
    doc.line(
      x + colItemW + colVarW,
      cursor.y,
      x + colItemW + colVarW,
      cursor.y + headerH
    );

    cursor.y += headerH;
  };

  if (!items.length) {
    ensureSpace(doc, cursor, 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("No items were recorded for this supply.", x, cursor.y);
    cursor.y += 6;
    return;
  }

  drawHeader();

  items.forEach((it, idx) => {
    const itemText = `${String.fromCharCode(65 + (idx % 26))}. ${
      it.name || "—"
    }`;
    const varText = it.variation || "—";
    const qtyText = it.qty || "—";

    const itemLines = doc.splitTextToSize(itemText, colItemW - padX * 2);
    const varLines = doc.splitTextToSize(varText, colVarW - padX * 2);
    const qtyLines = doc.splitTextToSize(qtyText, colQtyW - padX * 2);

    const maxLines = Math.max(
      itemLines.length,
      varLines.length,
      qtyLines.length
    );
    const rowH = padY + maxLines * lineH + padY;

    // page break + header repeat for table itself
    const pageHeight = getPageHeight(doc);
    if (cursor.y + rowH > pageHeight - 18) {
      addPageWithHeader(doc, cursor);
      drawHeader();
    }

    // zebra background
    doc.setDrawColor(PDF_BORDER.r, PDF_BORDER.g, PDF_BORDER.b);
    if (idx % 2 === 0) {
      doc.setFillColor(255, 255, 255);
    } else {
      doc.setFillColor(248, 250, 252);
    }
    doc.rect(x, cursor.y, w, rowH, "FD");

    // grid lines
    doc.setLineWidth(0.3);
    doc.line(x + colItemW, cursor.y, x + colItemW, cursor.y + rowH);
    doc.line(
      x + colItemW + colVarW,
      cursor.y,
      x + colItemW + colVarW,
      cursor.y + rowH
    );

    // text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

    const textTop = cursor.y + padY + 3.2;

    itemLines.forEach((ln: string, i: number) => {
      doc.text(ln, x + padX, textTop + i * lineH);
    });

    varLines.forEach((ln: string, i: number) => {
      doc.text(ln, x + colItemW + padX, textTop + i * lineH);
    });

    qtyLines.forEach((ln: string, i: number) => {
      doc.text(ln, x + colItemW + colVarW + padX, textTop + i * lineH);
    });

    cursor.y += rowH;
  });

  cursor.y += 6;
}

type AdviceGroup = { title: string; lines: AdviceLine[] };

function titleCaseKey(key: string) {
  const s = String(key || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return "Advice";
  return s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function extractAdviceGroups(order: OrderDto): AdviceGroup[] {
  const meta: any = (order as any).meta || {};
  const advice = meta.pharmacistAdvice;
  const adviceState: Record<string, any[]> = advice?.adviceState || {};

  const groups: AdviceGroup[] = [];

  for (const [key, arr] of Object.entries(adviceState || {})) {
    const lines: AdviceLine[] = [];
    for (const raw of arr || []) lines.push(...parseAdviceLines(raw));
    if (lines.length) groups.push({ title: titleCaseKey(key), lines });
  }

  return groups;
}

type AdviceLine = { kind: "bullet" | "text"; text: string };

function parseAdviceLines(raw: any): AdviceLine[] {
  const s = String(raw ?? "").replace(/\r/g, "");
  if (!s.trim()) return [];

  const parts = s
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean);

  return parts.map((p) => {
    const m = /^[•\u2022-]\s*(.*)$/.exec(p);
    if (m) return { kind: "bullet", text: (m[1] || "").trim() };
    return { kind: "text", text: p };
  });
}

function extractAdviceLines(order: OrderDto): AdviceLine[] {
  const meta: any = (order as any).meta || {};
  const advice = meta.pharmacistAdvice;
  const adviceState: Record<string, any[]> = advice?.adviceState || {};

  const out: AdviceLine[] = [];

  // ✅ Ignore keys like "Checkbox 4vh4ypm" completely
  for (const arr of Object.values(adviceState || {})) {
    for (const raw of arr || []) out.push(...parseAdviceLines(raw));
  }

  // (Optional) Deduplicate exact repeats while keeping order
  const seen = new Set<string>();
  return out.filter((x) => {
    const k = `${x.kind}::${x.text}`.trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function writeAdviceSection(doc: jsPDF, cursor: PdfCursor, order: OrderDto) {
  const points = extractAdvicePoints(order);

  writeSectionTitle(doc, cursor, "Pharmacist Advice");

  if (!points.length) {
    ensureSpace(doc, cursor, 6);
    doc.text(
      "No Pharmacist Advice has been recorded for this order.",
      MARGIN_X,
      cursor.y
    );
    cursor.y += 6;
    return;
  }

  const pageWidth = getPageWidth(doc);
  const maxW = pageWidth - 2 * MARGIN_X;
  const lineH = 4.3;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);

  const intro = doc.splitTextToSize(
    "The following advice points were selected during the consultation:",
    maxW
  );
  intro.forEach((l: string) => {
    ensureSpace(doc, cursor, lineH);
    doc.text(l, MARGIN_X, cursor.y);
    cursor.y += lineH;
  });
  cursor.y += 3;

  const drawPoint = (label: string, text: string) => {
    const labelW = doc.getTextWidth(label);
    const labelX = MARGIN_X;
    const textX = MARGIN_X + labelW + 2;
    const wrapW = maxW - (textX - MARGIN_X);

    const lines = doc.splitTextToSize(text, wrapW);

    ensureSpace(doc, cursor, lineH);
    doc.text(label, labelX, cursor.y);
    doc.text(lines[0] || "", textX, cursor.y);
    cursor.y += lineH;

    for (let i = 1; i < lines.length; i++) {
      ensureSpace(doc, cursor, lineH);
      doc.text(lines[i], textX, cursor.y);
      cursor.y += lineH;
    }

    cursor.y += 1.2;
  };

  points.forEach((p, idx) => {
    const label = ADVICE_LIST_STYLE === "numbered" ? `${idx + 1}.` : "•";
    drawPoint(label, p);
  });

  cursor.y += 2;
}

function extractItemsFromRecordFieldsForPdf(
  recordFields: Record<string, any>
): PdfOrderedItem[] {
  if (!recordFields || typeof recordFields !== "object") return [];

  const keyMap = new Map<string, string>();
  for (const k of Object.keys(recordFields)) {
    keyMap.set(String(k).toLowerCase().trim(), k);
  }

  const pick = (...cands: string[]) => {
    for (const c of cands) {
      const realKey = keyMap.get(c.toLowerCase().trim());
      if (!realKey) continue;
      const v = recordFields[realKey];
      if (v == null) continue;
      const s = String(v).trim();
      if (s) return s;
    }
    return "";
  };

  const items: PdfOrderedItem[] = [];
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  for (const L of letters) {
    const name = pick(
      `Item ${L}`,
      `Item ${L.toLowerCase()}`,
      `Item name ${L}`,
      `Item name ${L.toLowerCase()}`,
      `Medicine ${L}`,
      `Medicine ${L.toLowerCase()}`
    );

    const variation = pick(
      `Item variation ${L}`,
      `Item Variation ${L}`,
      `Item variation ${L.toLowerCase()}`,
      `Strength ${L}`,
      `Strength ${L.toLowerCase()}`,
      `Dose ${L}`,
      `Dose ${L.toLowerCase()}`
    );

    const qty = pick(
      `Quantity ${L}`,
      `Quantity ${L.toLowerCase()}`,
      `Qty ${L}`,
      `Qty ${L.toLowerCase()}`
    );

    if (!name && !variation && !qty) continue;

    items.push({
      name: name || "Item",
      variation: variation || undefined,
      qty: coerceQty(qty || "1"),
    });
  }

  return items;
}

function getLoginUrl() {
  if (typeof window === "undefined")
    return "https://pharmacy-express.co.uk/account";
  return `${window.location.origin}/account`;
}

function formatMoney(minor?: number | null) {
  if (minor == null) return "—";
  return `£${(minor / 100).toFixed(2)}`;
}

function statusBadgeClasses(status: string) {
  switch (status) {
    case "pending":
      return "bg-amber-500/10 text-amber-300 border-amber-500/40";
    case "approved":
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/40";
    case "completed":
      return "bg-sky-500/10 text-sky-300 border-sky-500/40";
    case "draft":
      return "bg-neutral-500/15 text-neutral-300 border-neutral-500/40";
    case "cancelled":
    case "rejected":
      return "bg-rose-500/10 text-rose-300 border-rose-500/40";
    default:
      return "bg-neutral-500/10 text-neutral-300 border-neutral-500/40";
  }
}

function paymentBadgeClasses(status: string) {
  switch (status) {
    case "paid":
      return "bg-emerald-500/10 text-emerald-300 border-emerald-500/40";
    case "pending":
      return "bg-amber-500/10 text-amber-300 border-amber-500/40";
    case "failed":
      return "bg-rose-500/10 text-rose-300 border-rose-500/40";
    default:
      return "bg-neutral-500/10 text-neutral-300 border-neutral-500/40";
  }
}

function getDisplayPatientName(order: OrderDto, user?: UserDto | null): string {
  if (!order) return "Unknown";

  const anyOrder: any = order;
  const meta: any = anyOrder.meta || {};

  if (anyOrder.patient_name) return anyOrder.patient_name;
  if (meta.patient_name) return meta.patient_name;

  const patient =
    meta.patient ||
    meta.patientDetails ||
    meta.patient_details ||
    meta.personalDetails ||
    meta.personal_details ||
    meta.demographics;

  if (patient) {
    const p: any = patient;
    const fromPatientStruct =
      p.name ||
      `${p.first_name || p.firstName || ""} ${
        p.last_name || p.lastName || ""
      }`.trim();
    if (fromPatientStruct) return fromPatientStruct;
  }

  const fromOrder = `${anyOrder.first_name || ""} ${
    anyOrder.last_name || ""
  }`.trim();
  if (fromOrder) return fromOrder;

  if (user) {
    const u: any = user;
    const fromUser =
      u.name ||
      u.fullName ||
      `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
      u.email;
    if (fromUser) return fromUser;
  }

  return "Unknown";
}

function formatDateOnly(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDobWithAge(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;

  const dateStr = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return `${dateStr} (${age} yrs)`;
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

/* ----------------- Shared pharmacy + media helpers ----------------- */

const PHARMACY_INFO = {
  name: "Pharmacy Express",
  addressLines: [
    "Unit 4, The Office Campus",
    "Paragon Business Park,",
    "Wakefield, West Yorkshire",
    "WF1 2UY",
  ],
  tel: "01924 971414",
  email: "info@pharmacy-express.co.uk",
  vatNo: "274797643",
};

type RafFileRef = {
  url: string;
  name?: string | null;
  mimeType?: string | null;
};

function formatFieldValue(value: any): string {
  if (value == null) return "—";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return String(value);
  if (Array.isArray(value)) {
    const txt = value
      .map((v) =>
        typeof v === "string" || typeof v === "number" ? String(v) : ""
      )
      .filter(Boolean)
      .join(", ");
    return txt || "—";
  }
  return "—";
}

function resolveImageUrl(imagePath?: string | null): string {
  if (!imagePath) return "";

  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  const normalizedPath = imagePath.startsWith("/")
    ? imagePath
    : `/${imagePath}`;

  const baseWithApi = getBackendBase(); // often ends with /api
  const cleanBase = baseWithApi.replace(/\/api\/?$/, "");
  return `${cleanBase}${normalizedPath}`;
}

/* ----------------- Risk Assessment helpers (USE meta.riskAssessment) ----------------- */

type RiskAssessmentItem = {
  key?: string;
  question?: string;
  value?: any;
};

function getRiskAssessmentItems(order: OrderDto): RiskAssessmentItem[] {
  const meta: any = (order as any)?.meta || {};
  const ra = meta?.riskAssessment;
  if (Array.isArray(ra)) return ra as RiskAssessmentItem[];
  return [];
}

function uniqueJoin(parts: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const s = String(p ?? "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out.join(", ");
}

function normaliseRiskValue(value: any): { text: string; files: RafFileRef[] } {
  const files: RafFileRef[] = [];
  const textParts: string[] = [];

  function collect(v: any) {
    if (v == null) return;

    if (Array.isArray(v)) {
      v.forEach(collect);
      return;
    }

    const t = typeof v;

    if (t === "string" || t === "number" || t === "boolean") {
      const s = String(v).trim();
      if (s && s !== "[object Object]") textParts.push(s);
      return;
    }

    if (t === "object") {
      const obj: any = v;
      const url: string | undefined = obj.url || obj.href || obj.path;
      const name: string | undefined =
        obj.name ||
        obj.filename ||
        (url ? String(url).split("/").pop() : undefined);
      const mimeType: string | undefined =
        obj.type || obj.mimetype || obj.mimeType;

      if (url) {
        files.push({ url, name, mimeType });
      } else {
        // ignore generic objects to avoid [object Object]
      }
    }
  }

  collect(value);

  // IMPORTANT: avoid duplication by deduping textParts
  let text = uniqueJoin(textParts).trim();

  if (!text && files.length) {
    const names = files
      .map((f) => f.name || f.url)
      .filter(Boolean)
      .map(String);
    text =
      files.length === 1
        ? `Attached file: ${uniqueJoin(names)}`
        : `Attached file(s): ${uniqueJoin(names)}`;
  }

  if (!text) text = "—";

  return { text, files };
}

function rafFileLooksLikeImage(file: RafFileRef): boolean {
  const mt = (file.mimeType || "").toLowerCase();
  if (mt && mt.startsWith("image/")) return true;
  const url = file.url || "";
  return /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(url);
}

function guessImageFormat(dataUrlOrUrl: string): "PNG" | "JPEG" | "WEBP" {
  const s = dataUrlOrUrl || "";
  if (s.startsWith("data:image/png")) return "PNG";
  if (s.startsWith("data:image/jpeg") || s.startsWith("data:image/jpg"))
    return "JPEG";
  if (s.startsWith("data:image/webp")) return "WEBP";
  if (/\.(jpe?g)(\?|$)/i.test(s)) return "JPEG";
  if (/\.(webp)(\?|$)/i.test(s)) return "WEBP";
  return "PNG";
}

async function fetchImageDataUrl(url: string): Promise<string | null> {
  try {
    const full = resolveImageUrl(url);
    if (!full) return null;

    if (full.startsWith("data:image")) return full;

    const res = await fetch(full, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/* ----------------- PDF Helpers ----------------- */

type PdfCursor = { y: number };
type PdfExportMode = "download" | "file";

const MARGIN_X = 18;
const TOP_CONTENT_Y = 48;

const PDF_BRAND_GREEN = { r: 34, g: 197, b: 94 };
const PDF_TEXT_DARK = { r: 31, g: 41, b: 55 };
const PDF_TEXT_MUTED = { r: 100, g: 116, b: 139 };
const PDF_BORDER = { r: 209, g: 213, b: 219 };
const PDF_CARD_BG = { r: 248, g: 250, b: 252 };

const PDF_LOGO_SRC =
  process.env.NEXT_PUBLIC_PDF_LOGO_URL || "/images/pharmacy-express-logo.png";

let cachedPdfLogoDataUrl: string | null | undefined;

async function getPdfLogoDataUrl(): Promise<string | null> {
  if (cachedPdfLogoDataUrl !== undefined) return cachedPdfLogoDataUrl;

  if (!PDF_LOGO_SRC) {
    cachedPdfLogoDataUrl = null;
    return null;
  }

  if (typeof window === "undefined" || typeof FileReader === "undefined") {
    cachedPdfLogoDataUrl = null;
    return null;
  }

  try {
    let url = PDF_LOGO_SRC;
    if (url.startsWith("/")) url = `${window.location.origin}${url}`;
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("Logo fetch failed");

    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Logo read failed"));
      reader.readAsDataURL(blob);
    });

    cachedPdfLogoDataUrl = dataUrl;
    return dataUrl;
  } catch {
    cachedPdfLogoDataUrl = null;
    return null;
  }
}

function getPageWidth(doc: jsPDF) {
  return (
    (doc.internal as any).pageSize?.getWidth?.() ??
    (doc.internal as any).pageSize?.width ??
    210
  );
}
function getPageHeight(doc: jsPDF) {
  return (
    (doc.internal as any).pageSize?.getHeight?.() ??
    (doc.internal as any).pageSize?.height ??
    297
  );
}

function drawTwoColumnTable(
  doc: jsPDF,
  startX: number,
  startY: number,
  tableWidth: number,
  rows: { label: string; value: string }[],
  rowHeight: number = 8
) {
  const col1Width = tableWidth * 0.35;
  const totalHeight = rows.length * rowHeight;

  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.3);
  doc.rect(startX, startY, tableWidth, totalHeight);

  for (let i = 1; i < rows.length; i++) {
    const y = startY + i * rowHeight;
    doc.line(startX, y, startX + tableWidth, y);
  }

  doc.line(
    startX + col1Width,
    startY,
    startX + col1Width,
    startY + totalHeight
  );

  doc.setFontSize(9);

  rows.forEach((row, index) => {
    const textY = startY + index * rowHeight + 5;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(row.label, startX + 2, textY);

    doc.setFont("helvetica", "normal");
    const value = row.value || "—";
    doc.text(value, startX + col1Width + 2, textY);
  });

  return startY + totalHeight;
}

function ensureSpace(doc: jsPDF, cursor: PdfCursor, extra = 6) {
  const pageHeight = getPageHeight(doc);
  const bottomMargin = 18;

  if (cursor.y + extra > pageHeight - bottomMargin) {
    addPageWithHeader(doc, cursor);
  }
}

function createPdfBaseDoc(
  title: string,
  subtitle?: string,
  logoDataUrl?: string | null
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // store header state so we can re-draw on page breaks
  (doc as any).__pe_header = { title, subtitle, logoDataUrl } as PdfHeaderState;

  drawPdfHeader(doc, { title, subtitle, logoDataUrl });
  return doc;
}
function writeSectionTitle(doc: jsPDF, cursor: PdfCursor, title: string) {
  ensureSpace(doc, cursor, 10);
  const pageWidth = getPageWidth(doc);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.text(title, MARGIN_X, cursor.y);

  doc.setDrawColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_X, cursor.y + 1.5, pageWidth - MARGIN_X, cursor.y + 1.5);

  cursor.y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
}

function drawInfoCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  rows: { label: string; value: string }[]
): number {
  const labelWidth = 22;
  const contentWidth = width - labelWidth - 10;
  const lineHeight = 4;

  const prepared = rows.map((row) => {
    const value = row.value || "—";
    const lines = doc.splitTextToSize(value, contentWidth);
    const height = Math.max(1, lines.length) * lineHeight;
    return { ...row, lines, height };
  });

  let innerHeight = 0;
  prepared.forEach((r) => {
    innerHeight += r.height + 1;
  });

  const cardHeight = 10 + innerHeight + 6;

  doc.setDrawColor(PDF_BORDER.r, PDF_BORDER.g, PDF_BORDER.b);
  doc.setFillColor(PDF_CARD_BG.r, PDF_CARD_BG.g, PDF_CARD_BG.b);
  doc.roundedRect(x, y, width, cardHeight, 2, 2, "FD");

  let cy = y + 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.text(title, x + 4, cy);

  cy += 2.5;
  doc.setDrawColor(PDF_BRAND_GREEN.r, PDF_BRAND_GREEN.g, PDF_BRAND_GREEN.b);
  doc.setLineWidth(0.3);
  doc.line(x + 4, cy + 1, x + width - 4, cy + 1);
  cy += 4;

  prepared.forEach((row) => {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
    doc.text(row.label, x + 4, cy);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

    row.lines.forEach((line: string, idx: number) => {
      const ly = cy + idx * lineHeight;
      doc.text(line, x + 4 + labelWidth, ly);
    });

    cy += row.height + 2;
  });

  return y + cardHeight;
}

function writeLabelValueRow(
  doc: jsPDF,
  cursor: PdfCursor,
  label: string,
  value: string,
  x: number
) {
  ensureSpace(doc, cursor, 7);
  doc.setFontSize(8.5);
  doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
  doc.text(label.toUpperCase(), x, cursor.y);
  cursor.y += 3.5;

  doc.setFontSize(10);
  doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);

  const lines = doc.splitTextToSize(value || "—", 80);
  lines.forEach((line: string) => {
    ensureSpace(doc, cursor);
    doc.text(line, x, cursor.y);
    cursor.y += 4.2;
  });
}

function writePatientOrderBlock(
  doc: jsPDF,
  cursor: PdfCursor,
  order: OrderDto,
  user: UserDto | null
) {
  const pageWidth = getPageWidth(doc);
  const colGap = 8;
  const colWidth = (pageWidth - 2 * MARGIN_X - colGap) / 2;
  const leftX = MARGIN_X;
  const rightX = MARGIN_X + colWidth + colGap;

  ensureSpace(doc, cursor, 40);
  const leftCursor: PdfCursor = { y: cursor.y };
  const rightCursor: PdfCursor = { y: cursor.y };

  const patientName = getDisplayPatientName(order, user || undefined);
  const u: any = user || {};
  const dob = formatDobWithAge(u.dob);
  const gender =
    u.gender && typeof u.gender === "string"
      ? u.gender.charAt(0).toUpperCase() + u.gender.slice(1)
      : null;

  const addr1 =
    u.address_line1 || u.addressLine1 || u.address_line_1 || u.address1;
  const city = u.city;
  const county = u.county;
  const postcode = u.postalcode || u.postcode;
  const country = u.country;
  const addrParts = [addr1, city, county, postcode, country].filter(Boolean);

  doc.setFontSize(9);
  doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
  doc.setFont("helvetica", "bold");
  doc.text("PATIENT DETAILS", leftX, leftCursor.y);
  leftCursor.y += 5;

  doc.setFont("helvetica", "normal");
  writeLabelValueRow(doc, leftCursor, "Name", patientName, leftX);
  if (dob) writeLabelValueRow(doc, leftCursor, "Date of birth", dob, leftX);
  if (gender) writeLabelValueRow(doc, leftCursor, "Gender", gender, leftX);
  if (addrParts.length)
    writeLabelValueRow(doc, leftCursor, "Address", addrParts.join(", "), leftX);

  doc.setFontSize(9);
  doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
  doc.setFont("helvetica", "bold");
  doc.text("ORDER DETAILS", rightX, rightCursor.y);
  rightCursor.y += 5;

  doc.setFont("helvetica", "normal");
  writeLabelValueRow(
    doc,
    rightCursor,
    "Reference",
    order.reference || (order as any)._id,
    rightX
  );
  writeLabelValueRow(
    doc,
    rightCursor,
    "Service",
    `${(order as any).service_name || "Service"} (${
      (order as any).service_slug || "N/A"
    })`,
    rightX
  );

  const appointmentAt =
    (order as any)?.meta?.appointment_start_at ||
    (order as any)?.start_at ||
    null;
  if (appointmentAt)
    writeLabelValueRow(
      doc,
      rightCursor,
      "Appointment",
      formatDateTime(appointmentAt),
      rightX
    );

  if ((order as any)?.status || (order as any)?.payment_status) {
    writeLabelValueRow(
      doc,
      rightCursor,
      "Status",
      `${String((order as any).status || "").toUpperCase()} / ${String(
        (order as any).payment_status || "N/A"
      ).toUpperCase()}`,
      rightX
    );
  }

  const blockBottom = Math.max(leftCursor.y, rightCursor.y);
  cursor.y = blockBottom + 6;
}

/* ----------------- Risk Assessment PDF section (FIXED: uses meta.riskAssessment) ----------------- */

async function writeRiskAssessmentSection(
  doc: jsPDF,
  cursor: PdfCursor,
  order: OrderDto
) {
  const items = getRiskAssessmentItems(order);

  writeSectionTitle(doc, cursor, "Risk Assessment Form (RAF)");

  if (!items.length) {
    ensureSpace(doc, cursor);
    doc.text(
      "No Risk Assessment data captured for this order.",
      MARGIN_X,
      cursor.y
    );
    cursor.y += 6;
    return;
  }

  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx] || {};
    const q = String(it.question || it.key || `Question ${idx + 1}`);
    const { text: ans, files } = normaliseRiskValue(it.value);

    // Question
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const qLines = doc.splitTextToSize(
      `${idx + 1}. ${q}`,
      getPageWidth(doc) - 2 * MARGIN_X
    );
    qLines.forEach((line: string) => {
      ensureSpace(doc, cursor);
      doc.text(line, MARGIN_X, cursor.y);
      cursor.y += 4.6;
    });

    // Answer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const aLines = doc.splitTextToSize(
      `Answer: ${ans}`,
      getPageWidth(doc) - 2 * MARGIN_X - 4
    );
    aLines.forEach((line: string) => {
      ensureSpace(doc, cursor);
      doc.text(line, MARGIN_X + 4, cursor.y);
      cursor.y += 4.3;
    });

    // Attach images inline
    const imageFiles = files.filter(rafFileLooksLikeImage);
    for (const file of imageFiles) {
      const dataUrl = await fetchImageDataUrl(file.url);
      if (!dataUrl) continue;

      const pageW = getPageWidth(doc);
      const maxWidth = pageW - 2 * MARGIN_X;
      const imgWidth = Math.min(90, maxWidth);
      const imgHeight = imgWidth * 0.75;

      ensureSpace(doc, cursor, imgHeight + 8);
      try {
        doc.addImage(
          dataUrl,
          guessImageFormat(dataUrl || file.url),
          MARGIN_X,
          cursor.y,
          imgWidth,
          imgHeight
        );
        cursor.y += imgHeight + 4;
      } catch {
        // ignore
      }
    }

    // Non-image attachments list
    const nonImage = files.filter((f) => !rafFileLooksLikeImage(f));
    if (nonImage.length) {
      const names = nonImage
        .map((f) => f.name || f.url)
        .filter(Boolean)
        .map(String);
      const line = `Attachment(s): ${uniqueJoin(names) || "—"}`;
      const lns = doc.splitTextToSize(
        line,
        getPageWidth(doc) - 2 * MARGIN_X - 4
      );
      lns.forEach((l: string) => {
        ensureSpace(doc, cursor);
        doc.setFontSize(9);
        doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
        doc.text(l, MARGIN_X + 4, cursor.y);
        doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
        cursor.y += 4.0;
      });
    }

    cursor.y += 3;
  }
}

/* ----------------- Advice / Declaration / Record sections ----------------- */

function extractAdviceTexts(order: OrderDto): string[] {
  const meta: any = (order as any).meta || {};
  const advice = meta.pharmacistAdvice;
  const adviceState: Record<string, string[]> = advice?.adviceState || {};
  return Object.values(adviceState)
    .flatMap((arr) => arr || [])
    .filter((s) => !!s && String(s).trim().length > 0)
    .map((s) => String(s));
}

async function getSignatureDataUrl(order: OrderDto): Promise<string | null> {
  try {
    const meta: any = (order as any).meta || {};
    const declaration = meta.pharmacistDeclaration;
    const url: string | undefined = declaration?.signatureUrl;
    if (!url) return null;
    return fetchImageDataUrl(url);
  } catch {
    return null;
  }
}

function writeDeclarationSection(
  doc: jsPDF,
  cursor: PdfCursor,
  order: OrderDto,
  signatureDataUrl?: string | null
) {
  const meta: any = (order as any).meta || {};
  const declaration = meta.pharmacistDeclaration;

  writeSectionTitle(doc, cursor, "Pharmacist Declaration");

  if (!declaration) {
    ensureSpace(doc, cursor);
    doc.text(
      "No Pharmacist Declaration has been recorded.",
      MARGIN_X,
      cursor.y
    );
    cursor.y += 6;
    return;
  }

  const fields: Record<string, string> = declaration.fields || {};
  const entries = Object.entries(fields);

  if (!entries.length) {
    ensureSpace(doc, cursor);
    doc.text("No declaration fields were filled.", MARGIN_X, cursor.y);
    cursor.y += 6;
  } else {
    entries.forEach(([key, value]) => {
      const labelLines = doc.splitTextToSize(`${key}:`, 60);
      const valueLines = doc.splitTextToSize(
        value || "—",
        getPageWidth(doc) - MARGIN_X - 60 - 10
      );

      const numLines = Math.max(labelLines.length, valueLines.length);
      for (let i = 0; i < numLines; i++) {
        ensureSpace(doc, cursor);
        const l = labelLines[i] || "";
        const v = valueLines[i] || "";
        if (l) {
          doc.setFontSize(9);
          doc.setTextColor(
            PDF_TEXT_MUTED.r,
            PDF_TEXT_MUTED.g,
            PDF_TEXT_MUTED.b
          );
          doc.text(l, MARGIN_X, cursor.y);
        }
        if (v) {
          doc.setFontSize(10);
          doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
          doc.text(v, MARGIN_X + 60, cursor.y);
        }
        cursor.y += 4.2;
      }
      cursor.y += 2;
    });
  }

  cursor.y += 4;

  if (signatureDataUrl) {
    ensureSpace(doc, cursor, 30);
    doc.setFontSize(9);
    doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
    doc.text("Pharmacist signature", MARGIN_X, cursor.y);
    cursor.y += 4;

    try {
      const imgWidth = 40;
      const imgHeight = 18;
      doc.addImage(
        signatureDataUrl,
        guessImageFormat(signatureDataUrl),
        MARGIN_X,
        cursor.y,
        imgWidth,
        imgHeight
      );
      cursor.y += imgHeight + 4;
    } catch {
      ensureSpace(doc, cursor);
      doc.setTextColor(148, 163, 184);
      doc.text("Signature recorded in system.", MARGIN_X, cursor.y);
      cursor.y += 5;
    }
  } else if (declaration?.signatureUrl) {
    ensureSpace(doc, cursor);
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("Signature recorded in system.", MARGIN_X, cursor.y);
    cursor.y += 5;
  }

  if (declaration?.saved_at) {
    ensureSpace(doc, cursor);
    doc.setFontSize(9);
    doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
    doc.text("Saved at:", MARGIN_X, cursor.y);
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
    doc.text(formatDateTime(declaration.saved_at), MARGIN_X + 20, cursor.y);
    cursor.y += 5;
  }
}

function writeRecordSection(doc: jsPDF, cursor: PdfCursor, order: OrderDto) {
  const meta: any = (order as any).meta || {};
  const record = meta.recordOfSupply;

  writeSectionTitle(doc, cursor, "Record of Supply");

  if (!record) {
    ensureSpace(doc, cursor);
    doc.text("No Record of Supply has been captured.", MARGIN_X, cursor.y);
    cursor.y += 6;
    return;
  }

  const fields: Record<string, string> = record.fields || {};
  const entries = Object.entries(fields);

  if (!entries.length) {
    ensureSpace(doc, cursor);
    doc.text("Record of Supply fields are empty.", MARGIN_X, cursor.y);
    cursor.y += 6;
    return;
  }

  entries.forEach(([key, value]) => {
    const labelLines = doc.splitTextToSize(`${key}:`, 60);
    const valueLines = doc.splitTextToSize(
      value || "—",
      getPageWidth(doc) - MARGIN_X - 60 - 10
    );
    const numLines = Math.max(labelLines.length, valueLines.length);

    for (let i = 0; i < numLines; i++) {
      ensureSpace(doc, cursor);
      const l = labelLines[i] || "";
      const v = valueLines[i] || "";
      if (l) {
        doc.setFontSize(9);
        doc.setTextColor(PDF_TEXT_MUTED.r, PDF_TEXT_MUTED.g, PDF_TEXT_MUTED.b);
        doc.text(l, MARGIN_X, cursor.y);
      }
      if (v) {
        doc.setFontSize(10);
        doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
        doc.text(v, MARGIN_X + 60, cursor.y);
      }
      cursor.y += 4.2;
    }
    cursor.y += 2;
  });
}

function finalisePdf(
  doc: jsPDF,
  filename: string,
  mode: PdfExportMode
): File | void {
  if (mode === "file") {
    const blob = doc.output("blob");
    return new File([blob], filename, { type: "application/pdf" });
  }
  doc.save(filename);
  return;
}

/* ----------------- Invoice PDF ----------------- */

async function exportInvoicePdf(
  order: OrderDto,
  user: UserDto | null,
  mode: PdfExportMode = "download"
) {
  const invoiceNo = `#INV-${(order as any).reference || (order as any)._id}`;
  const invoiceDate = formatDateOnly(
    (order as any).completed_at ||
      (order as any).completedAt ||
      (order as any).createdAt ||
      (order as any).created_at ||
      new Date().toISOString()
  );

  const subtitle = `Invoice No: ${invoiceNo}  |  VAT No: ${PHARMACY_INFO.vatNo}  |  Date: ${invoiceDate}`;
  const logoDataUrl = await getPdfLogoDataUrl();
  const doc = createPdfBaseDoc("Invoice", subtitle, logoDataUrl);
  const pageWidth = getPageWidth(doc);
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  const patientName = getDisplayPatientName(order, user || undefined);
  const u: any = user || {};
  const dobLabel = u.dob ? formatDateOnly(u.dob) : null;

  const addrParts = [
    u.address_line1 || u.addressLine1 || u.address_line_1 || u.address1,
    u.address_line2 || u.addressLine2 || u.address_line_2 || u.address2,
    u.city,
    u.county,
    u.postalcode || u.postcode,
    u.country,
  ].filter(Boolean);
  const patientAddress = addrParts.join(", ");

  const email = u.email || (order as any).email || "";
  const phone = u.phone || u.phoneNumber || (order as any).phone || "";
  const contactParts: string[] = [];
  if (email) contactParts.push(email);
  if (phone) contactParts.push(phone);
  const contact = contactParts.join(" | ");

  const cardGap = 6;
  const cardWidth = (pageWidth - 2 * MARGIN_X - cardGap) / 2;

  const leftBottom = drawInfoCard(doc, MARGIN_X, cursor.y, cardWidth, "From", [
    { label: "Name:", value: PHARMACY_INFO.name },
    { label: "Address:", value: PHARMACY_INFO.addressLines.join(", ") },
    { label: "Tel:", value: PHARMACY_INFO.tel },
    { label: "Email:", value: PHARMACY_INFO.email },
  ]);

  const rightBottom = drawInfoCard(
    doc,
    MARGIN_X + cardWidth + cardGap,
    cursor.y,
    cardWidth,
    "Bill To",
    [
      { label: "Patient:", value: patientName },
      { label: "DOB:", value: dobLabel || "—" },
      { label: "Address:", value: patientAddress || "—" },
      { label: "Contact:", value: contact || "—" },
    ]
  );

  cursor.y = Math.max(leftBottom, rightBottom) + 10;

  writeSectionTitle(doc, cursor, "Invoice Details");

  const items = ((order as any).meta?.items || []) as any[];

  if (!items.length) {
    ensureSpace(doc, cursor);
    doc.text("No items found for this order.", MARGIN_X, cursor.y);
    cursor.y += 6;
  } else {
    const tableX = MARGIN_X;
    const tableWidth = pageWidth - 2 * MARGIN_X;
    const colDescX = tableX;
    const colQtyX = tableX + tableWidth * 0.6;
    const colUnitX = tableX + tableWidth * 0.78;
    const colNetX = tableX + tableWidth * 0.9;

    ensureSpace(doc, cursor, 8);
    const headerY = cursor.y;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(PDF_TEXT_DARK.r, PDF_TEXT_DARK.g, PDF_TEXT_DARK.b);
    doc.text("Description", colDescX, headerY);
    doc.text("Qty", colQtyX, headerY);
    doc.text("Unit Price", colUnitX, headerY);
    doc.text("Net", colNetX, headerY);
    cursor.y += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    items.forEach((it) => {
      const qty = it.qty ?? 1;
      const unitMinor = it.unitMinor ?? null;
      const totalMinor = it.totalMinor ?? null;
      const variation = it.variation || it.variations || it.strength || "";
      const desc = variation ? `${it.name} | ${variation}` : it.name || "Item";

      const descLines = doc.splitTextToSize(desc, colQtyX - colDescX - 4);
      const rowY = cursor.y;
      const rowHeight = descLines.length * 4.2 + 3;

      ensureSpace(doc, cursor, rowHeight);

      descLines.forEach((line: string, lineIdx: number) => {
        doc.text(line, colDescX, rowY + lineIdx * 4.2);
      });

      const numY = rowY;
      doc.text(String(qty), colQtyX, numY);
      if (unitMinor != null)
        doc.text((unitMinor / 100).toFixed(2), colUnitX, numY);
      if (totalMinor != null)
        doc.text((totalMinor / 100).toFixed(2), colNetX, numY);

      cursor.y = rowY + rowHeight;
    });
  }

  cursor.y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  const total = (order as any).meta?.totalMinor ?? null;
  const totalText = `Total incl. VAT ${formatMoney(total)}`;
  ensureSpace(doc, cursor);
  doc.text(totalText, MARGIN_X, cursor.y);
  cursor.y += 8;

  writeSectionTitle(doc, cursor, "Payment Information");

  const paymentStatus =
    String((order as any).payment_status || "").toUpperCase() || "N/A";
  const paidAtSource =
    (order as any).paid_at ||
    (order as any).meta?.paid_at ||
    (order as any).completed_at ||
    (order as any).completedAt ||
    (order as any).createdAt ||
    (order as any).created_at ||
    new Date().toISOString();

  const paidDate = formatDateOnly(paidAtSource);
  const paymentLine = `Status: ${paymentStatus}  |  Date: ${paidDate}`;
  ensureSpace(doc, cursor);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(paymentLine, MARGIN_X, cursor.y);
  cursor.y += 6;

  const filename = `Invoice_${
    (order as any).reference || (order as any)._id
  }.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ----------------- RAF PDF (now uses meta.riskAssessment) ----------------- */

async function exportRafPdf(
  order: OrderDto,
  user: UserDto | null,
  mode: PdfExportMode = "download"
) {
  const reference = (order as any).reference || (order as any)._id;
  const serviceName = (order as any).service_name || "Service";
  const meta: any = (order as any).meta || {};
  const dateSource =
    meta.appointment_start_at ||
    (order as any).completed_at ||
    (order as any).createdAt ||
    (order as any).created_at ||
    new Date().toISOString();

  const subtitle = `Reference: ${reference}  |  Service: ${serviceName}  |  Date: ${formatDateOnly(
    dateSource
  )}`;

  const logoDataUrl = await getPdfLogoDataUrl();
  const doc = createPdfBaseDoc("Risk Assessment Form", subtitle, logoDataUrl);
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  writePatientOrderBlock(doc, cursor, order, user);
  await writeRiskAssessmentSection(doc, cursor, order);

  const filename = `RAF_${reference}.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ----------------- Advice / Declaration / Record PDFs ----------------- */

async function exportAdvicePdf(
  order: OrderDto,
  user: UserDto | null,
  mode: PdfExportMode = "download"
) {
  const reference = (order as any).reference || (order as any)._id;
  const serviceName = (order as any).service_name || "Service";
  const meta: any = (order as any).meta || {};

  const dateSource =
    meta.appointment_start_at ||
    (order as any).completed_at ||
    (order as any).createdAt ||
    (order as any).created_at ||
    new Date().toISOString();

  const subtitle = `Reference: ${reference}  |  Service: ${serviceName}  |  Date: ${formatDateOnly(
    dateSource
  )}`;

  const logoDataUrl = await getPdfLogoDataUrl();
  const doc = createPdfBaseDoc("Pharmacist Advice", subtitle, logoDataUrl);
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  writePatientOrderBlock(doc, cursor, order, user);

  // ✅ this must be the improved version below
  writeAdviceSection(doc, cursor, order);

  const filename = `Advice_${reference}.pdf`;
  return finalisePdf(doc, filename, mode);
}

async function exportDeclarationPdf(
  order: OrderDto,
  user: UserDto | null,
  mode: PdfExportMode = "download"
) {
  const reference = (order as any).reference || (order as any)._id;
  const serviceName = (order as any).service_name || "Service";
  const meta: any = (order as any).meta || {};
  const dateSource =
    meta.appointment_start_at ||
    (order as any).completed_at ||
    (order as any).createdAt ||
    (order as any).created_at ||
    new Date().toISOString();

  const subtitle = `Reference: ${reference}  |  Service: ${serviceName}  |  Date: ${formatDateOnly(
    dateSource
  )}`;

  const logoDataUrl = await getPdfLogoDataUrl();
  const signatureDataUrl = await getSignatureDataUrl(order);

  const doc = createPdfBaseDoc("Pharmacist Declaration", subtitle, logoDataUrl);
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  writePatientOrderBlock(doc, cursor, order, user);
  writeDeclarationSection(doc, cursor, order, signatureDataUrl);

  const filename = `Declaration_${reference}.pdf`;
  return finalisePdf(doc, filename, mode);
}

async function exportRecordPdf(
  order: OrderDto,
  user: UserDto | null,
  mode: PdfExportMode = "download"
) {
  const reference = (order as any).reference || (order as any)._id;
  const meta: any = (order as any).meta || {};
  const record = meta.recordOfSupply;
  const recordFields: Record<string, any> = (record?.fields as any) || {};

  const recordDateStr =
    recordFields["Date provided"] ||
    recordFields["Date Provided"] ||
    formatDateOnly(
      (order as any).completed_at ||
        (order as any).completedAt ||
        (order as any).createdAt ||
        (order as any).created_at ||
        new Date().toISOString()
    );

  const subtitle = `Reference: ${reference}  |  Date: ${recordDateStr}`;
  const logoDataUrl = await getPdfLogoDataUrl();
  const doc = createPdfBaseDoc("Record of Supply", subtitle, logoDataUrl);
  const pageWidth = getPageWidth(doc);
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  const patientName = getDisplayPatientName(order, user || undefined);
  const u: any = user || {};
  const dobLabel = u.dob ? formatDateOnly(u.dob) : null;

  const addrParts = [
    u.address_line1 || u.addressLine1 || u.address_line_1 || u.address1,
    u.address_line2 || u.addressLine2 || u.address_line_2 || u.address2,
    u.city,
    u.county,
    u.postalcode || u.postcode,
    u.country,
  ].filter(Boolean);
  const patientAddress = addrParts.join(", ");

  const email = u.email || (order as any).email || "";
  const phone = u.phone || u.phoneNumber || (order as any).phone || "";
  const contactParts: string[] = [];
  if (email) contactParts.push(email);
  if (phone) contactParts.push(phone);
  const contact = contactParts.join(" | ");

  const cardGap = 6;
  const cardWidth = (pageWidth - 2 * MARGIN_X - cardGap) / 2;

  const leftBottom = drawInfoCard(
    doc,
    MARGIN_X,
    cursor.y,
    cardWidth,
    "Pharmacy Details",
    [
      { label: "Name:", value: PHARMACY_INFO.name },
      { label: "Address:", value: PHARMACY_INFO.addressLines.join(", ") },
      { label: "Tel:", value: PHARMACY_INFO.tel },
      { label: "Email:", value: PHARMACY_INFO.email },
    ]
  );

  const rightBottom = drawInfoCard(
    doc,
    MARGIN_X + cardWidth + cardGap,
    cursor.y,
    cardWidth,
    "Patient Information",
    [
      { label: "Name:", value: patientName },
      { label: "DOB:", value: dobLabel || "—" },
      { label: "Address:", value: patientAddress || "—" },
      { label: "Contact:", value: contact || "—" },
    ]
  );

  cursor.y = Math.max(leftBottom, rightBottom) + 10;

  /* ----------------- Clinical Notes ----------------- */

  writeSectionTitle(doc, cursor, "Clinical Notes");

  ensureSpace(doc, cursor, 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Date provided: ${recordDateStr}`, MARGIN_X, cursor.y);
  cursor.y += 8;

  // ✅ Items: prefer recordFields; fallback to order/meta
  const itemsFromRecordFields =
    extractItemsFromRecordFieldsForPdf(recordFields);
  const orderedItems = itemsFromRecordFields.length
    ? itemsFromRecordFields
    : getOrderedItemsForPdf(order);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text("Items supplied", MARGIN_X, cursor.y);
  cursor.y += 5;

  // ✅ Proper table
  drawItemsSuppliedTable(doc, cursor, orderedItems);

  /* ----------------- Pharmacist Declaration ----------------- */

  writeSectionTitle(doc, cursor, "Pharmacist Declaration");

  const declaration = meta.pharmacistDeclaration;

  const longText =
    "I confirm that the above named patient has been clinically assessed and supplied medication in accordance with the service protocol. The supply is appropriate, counselling has been provided, and relevant records have been completed.";

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);

  const paraLines = doc.splitTextToSize(longText, pageWidth - 2 * MARGIN_X);
  paraLines.forEach((line: string) => {
    ensureSpace(doc, cursor, 5);
    doc.text(line, MARGIN_X, cursor.y);
    cursor.y += 4.2;
  });
  cursor.y += 2;

  const declarationFields: Record<string, any> =
    (declaration?.fields as any) || {};
  if (Object.keys(declarationFields).length) {
    Object.entries(declarationFields).forEach(([key, value]) => {
      const line = `${key}: ${value || "—"}`;
      const lines = doc.splitTextToSize(line, pageWidth - 2 * MARGIN_X);
      lines.forEach((l: string) => {
        ensureSpace(doc, cursor, 5);
        doc.text(l, MARGIN_X, cursor.y);
        cursor.y += 4.2;
      });
      cursor.y += 1;
    });
  }

  const signatureDataUrl = await getSignatureDataUrl(order);

  ensureSpace(doc, cursor, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Signature:", MARGIN_X, cursor.y);
  doc.setFont("helvetica", "normal");

  if (signatureDataUrl) {
    cursor.y += 4;
    try {
      doc.addImage(
        signatureDataUrl,
        guessImageFormat(signatureDataUrl),
        MARGIN_X,
        cursor.y,
        40,
        18
      );
      cursor.y += 22;
    } catch {
      cursor.y += 12;
    }
  } else {
    cursor.y += 12;
  }

  const declDate =
    declaration?.saved_at ||
    recordFields["Date"] ||
    recordFields["Date provided"] ||
    recordFields["Date Provided"] ||
    null;

  if (declDate) {
    ensureSpace(doc, cursor, 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Date: ${formatDateOnly(declDate)}`, MARGIN_X, cursor.y);
    cursor.y += 6;
  }

  const filename = `RecordOfSupply_${reference}.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ----------------- Private Prescription PDF (unchanged structure, just safer images) ----------------- */

async function exportPrivatePrescriptionPdf(
  order: OrderDto,
  user: UserDto | null,
  mode: PdfExportMode = "download"
) {
  const signatureDataUrl = await getSignatureDataUrl(order);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = getPageWidth(doc);
  const marginX = MARGIN_X;

  const meta: any = (order as any).meta || {};

  const record =
    meta.recordOfSupply ||
    meta.record_of_supply ||
    meta.recordOfSupplyDoc ||
    null;

  let recordFields: Record<string, any> = {};
  if (record && record.fields) {
    if (Array.isArray(record.fields)) {
      for (const f of record.fields as any[]) {
        const label =
          f?.label || f?.name || f?.fieldLabel || f?.key || f?.id || "";
        if (!label) continue;
        recordFields[label] = f?.value ?? f?.answer ?? f?.data ?? "";
      }
    } else if (typeof record.fields === "object") {
      recordFields = { ...(record.fields as Record<string, any>) };
    }
  }

  const fallbackDateRaw =
    (recordFields["Date provided"] as string) ||
    (recordFields["Date Provided"] as string) ||
    record?.saved_at ||
    record?.created_at ||
    (order as any).completed_at ||
    (order as any).completedAt ||
    (order as any).createdAt ||
    (order as any).created_at ||
    (order as any).start_at ||
    meta.appointment_start_at ||
    new Date().toISOString();

  const fallBackDate = formatDateOnly(fallbackDateRaw);

  const dateProvided =
    (recordFields["Date provided"] as string) ||
    (recordFields["Date Provided"] as string) ||
    fallBackDate;

  const reference = (order as any).reference || (order as any)._id;

  // ✅ FIX: include ALL ordered items (prefer recordFields items; fallback to order/meta)
  const itemsFromRecordFields =
    extractItemsFromRecordFieldsForPdf(recordFields);
  const orderedItems = itemsFromRecordFields.length
    ? itemsFromRecordFields
    : getOrderedItemsForPdf(order);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(22, 163, 74);
  doc.text("PHARMACY EXPRESS", marginX, 18);

  doc.setFontSize(16);
  doc.text("PRIVATE PRESCRIPTION", marginX, 30);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);
  doc.text(
    `Reference: ${reference} | Date: ${dateProvided || "—"}`,
    marginX,
    36
  );

  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.6);
  doc.line(marginX, 38, pageWidth - marginX, 38);

  const cursorY: PdfCursor = { y: 48 };

  const gap = 8;
  const totalCardWidth = pageWidth - 2 * marginX - gap;
  const cardWidth = totalCardWidth / 2;
  const cardHeight = 56;
  const cardTop = cursorY.y;

  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, cardTop, cardWidth, cardHeight, 2, 2);
  doc.roundedRect(
    marginX + cardWidth + gap,
    cardTop,
    cardWidth,
    cardHeight,
    2,
    2
  );

  // Left: Pharmacy
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(22, 163, 74);
  doc.text("Pharmacy Details", marginX + 4, cardTop + 8);
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.4);
  doc.line(marginX + 4, cardTop + 10, marginX + cardWidth - 4, cardTop + 10);

  let y = cardTop + 18;
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  const leftLabelX = marginX + 4;
  const leftValueX = marginX + 26;

  doc.setFont("helvetica", "bold");
  doc.text("Name:", leftLabelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(PHARMACY_INFO.name, leftValueX, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text("Address:", leftLabelX, y);
  doc.setFont("helvetica", "normal");
  const addrLines = PHARMACY_INFO.addressLines || [];
  if (addrLines.length) {
    doc.text(addrLines[0], leftValueX, y);
    for (let i = 1; i < addrLines.length; i++) {
      y += 4;
      doc.text(addrLines[i], leftValueX, y);
    }
  }
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text("Tel:", leftLabelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(PHARMACY_INFO.tel, leftValueX, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text("Email:", leftLabelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(PHARMACY_INFO.email, leftValueX, y);

  // Right: Patient
  const u: any = user || {};
  const patientName = getDisplayPatientName(order, user || undefined);
  const dobLabel = u.dob ? formatDateOnly(u.dob) : null;

  const addrParts = [
    u.address_line1 || u.addressLine1 || u.address_line_1 || u.address1,
    u.address_line2 || u.addressLine2 || u.address_line_2 || u.address2,
    u.city,
    u.county,
    u.postalcode || u.postcode,
    u.country,
  ].filter(Boolean);
  const fullAddress = addrParts.join(", ");
  const contactStr = [u.email || (order as any).email, u.phone || u.phoneNumber]
    .filter(Boolean)
    .join(" | ");

  const rightX = marginX + cardWidth + gap;
  const rightLabelX = rightX + 4;
  const rightValueX = rightX + 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(22, 163, 74);
  doc.text("Patient Information", rightLabelX, cardTop + 8);
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.4);
  doc.line(rightLabelX, cardTop + 10, rightX + cardWidth - 4, cardTop + 10);

  y = cardTop + 18;
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  doc.setFont("helvetica", "bold");
  doc.text("Name:", rightLabelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(patientName || "—", rightValueX, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text("DOB:", rightLabelX, y);
  doc.setFont("helvetica", "normal");
  doc.text(dobLabel || "—", rightValueX, y);
  y += 5;

  doc.setFont("helvetica", "bold");
  doc.text("Address:", rightLabelX, y);
  doc.setFont("helvetica", "normal");
  const addrLinesPt = doc.splitTextToSize(fullAddress || "—", cardWidth - 30);
  doc.text(addrLinesPt as any, rightValueX, y);
  y += 4 * addrLinesPt.length + 1;

  doc.setFont("helvetica", "bold");
  doc.text("Contact:", rightLabelX, y);
  doc.setFont("helvetica", "normal");
  const contactLines = doc.splitTextToSize(contactStr || "—", cardWidth - 30);
  doc.text(contactLines as any, rightValueX, y);

  cursorY.y = cardTop + cardHeight + 10;

  // Medicines section
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(22, 163, 74);
  doc.text("Medicine Prescribed", marginX, cursorY.y);
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.4);
  doc.line(marginX, cursorY.y + 2, pageWidth - marginX, cursorY.y + 2);

  // ✅ FIX: build rows for ALL items
  const rows: { label: string; value: string }[] = [
    { label: "Date provided", value: String(dateProvided || "—") },
  ];

  if (!orderedItems.length) {
    rows.push({ label: "Item", value: "—" });
    rows.push({ label: "Quantity", value: "—" });
  } else {
    orderedItems.forEach((it, idx) => {
      const letter = String.fromCharCode(65 + idx);
      rows.push({ label: `Item ${letter}`, value: String(it.name || "—") });
      rows.push({
        label: `Item variation ${letter}`,
        value: String(it.variation || "—"),
      });
      rows.push({ label: `Quantity ${letter}`, value: String(it.qty || "—") });
    });
  }

  const rowHeight = 8;
  const bottomMargin = 18;
  let yStart = cursorY.y + 6;
  let remaining = rows.slice();

  // Chunk table across pages if needed
  while (remaining.length) {
    const pageHeight = getPageHeight(doc);
    const maxRowsThisPage = Math.max(
      1,
      Math.floor((pageHeight - bottomMargin - yStart) / rowHeight)
    );

    const chunk = remaining.slice(0, maxRowsThisPage);
    remaining = remaining.slice(maxRowsThisPage);

    const after = drawTwoColumnTable(
      doc,
      marginX,
      yStart,
      pageWidth - 2 * marginX,
      chunk,
      rowHeight
    );

    if (remaining.length) {
      doc.addPage();
      yStart = TOP_CONTENT_Y;
    } else {
      cursorY.y = after + 10;
    }
  }

  // Declaration box (unchanged)
  const declaration = meta.pharmacistDeclaration;
  const fields: Record<string, any> = (declaration?.fields as any) || {};
  const pharmacistNameField =
    fields["Pharmacist Name"] ||
    fields["Pharmacist name"] ||
    fields["Pharmacist"] ||
    "—";
  const gphcNumberField =
    fields["GPhC Number"] || fields["GPhC number"] || fields["GPhC"] || "—";
  const declarationDate =
    fields["Date"] ||
    fields["Date provided"] ||
    declaration?.saved_at ||
    dateProvided ||
    fallBackDate;

  const boxTop = cursorY.y;
  const boxHeight = 62;
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, boxTop, pageWidth - 2 * marginX, boxHeight, 2, 2);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(22, 163, 74);
  doc.text("Pharmacist Declaration", marginX + 4, boxTop + 8);
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.4);
  doc.line(marginX + 4, boxTop + 10, pageWidth - marginX - 4, boxTop + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  const longText =
    "I confirm that the above named patient has been clinically assessed and supplied medication in accordance with the service protocol. The supply is appropriate, counselling has been provided, and relevant records have been completed.";
  let textY = boxTop + 18;
  const paraLines = doc.splitTextToSize(longText, pageWidth - 2 * marginX - 8);
  doc.text(paraLines as any, marginX + 4, textY);
  textY += 4 * paraLines.length + 4;

  const infoRows = [
    ["Pharmacist Name:", pharmacistNameField],
    ["GPhC Number:", gphcNumberField],
    ["Date:", formatDateOnly(declarationDate) || "—"],
  ] as [string, string][];

  infoRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, marginX + 4, textY);
    doc.setFont("helvetica", "normal");
    doc.text(value || "—", marginX + 40, textY);
    textY += 5;
  });

  doc.setFont("helvetica", "bold");
  doc.text("Signature:", marginX + 4, textY);
  if (signatureDataUrl) {
    try {
      doc.addImage(
        signatureDataUrl,
        guessImageFormat(signatureDataUrl),
        marginX + 40,
        textY - 6,
        30,
        14
      );
    } catch {
      // ignore
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(50);
  doc.setTextColor(229, 231, 235);

  const filename = `PrivatePrescription_${reference}.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ----------------- Full Clinical PDF (now uses meta.riskAssessment) ----------------- */

async function exportAllClinicalPdf(
  order: OrderDto,
  user: UserDto | null,
  mode: PdfExportMode = "download"
) {
  const reference = (order as any).reference || (order as any)._id;
  const serviceName = (order as any).service_name || "Service";
  const meta: any = (order as any).meta || {};
  const dateSource =
    meta.appointment_start_at ||
    (order as any).completed_at ||
    (order as any).createdAt ||
    (order as any).created_at ||
    new Date().toISOString();

  const subtitle = `Reference: ${reference}  |  Service: ${serviceName}  |  Date: ${formatDateOnly(
    dateSource
  )}`;

  const logoDataUrl = await getPdfLogoDataUrl();
  const signatureDataUrl = await getSignatureDataUrl(order);

  const doc = createPdfBaseDoc("Clinical Documentation", subtitle, logoDataUrl);
  const cursor: PdfCursor = { y: TOP_CONTENT_Y };

  writePatientOrderBlock(doc, cursor, order, user);

  const hasRiskAssessment = getRiskAssessmentItems(order).length > 0;
  const hasAdvice = extractAdvicePoints(order).length > 0;

  const hasDeclaration = !!meta.pharmacistDeclaration;
  const hasRecord = !!meta.recordOfSupply;

  if (!hasRiskAssessment && !hasAdvice && !hasDeclaration && !hasRecord) {
    writeSectionTitle(doc, cursor, "Clinical Documentation");
    ensureSpace(doc, cursor);
    doc.text(
      "No clinical documentation has been recorded for this order.",
      MARGIN_X,
      cursor.y
    );
    const filename = `FullConsultation_${reference}.pdf`;
    return finalisePdf(doc, filename, mode);
  }

  if (hasRiskAssessment) {
    await writeRiskAssessmentSection(doc, cursor, order);
    cursor.y += 4;
  }
  if (hasAdvice) {
    writeAdviceSection(doc, cursor, order);
    cursor.y += 4;
  }
  if (hasDeclaration) {
    writeDeclarationSection(doc, cursor, order, signatureDataUrl);
    cursor.y += 4;
  }
  if (hasRecord) {
    writeRecordSection(doc, cursor, order);
  }

  const filename = `FullConsultation_${reference}.pdf`;
  return finalisePdf(doc, filename, mode);
}

/* ----------------- UI: Patient card ----------------- */

function PatientProfileCard({ user }: { user: UserDto | null }) {
  if (!user) {
    return (
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
        <p className="mb-1 text-xs text-neutral-400">Patient profile</p>
        <p className="text-sm text-neutral-300">No patient details found.</p>
      </div>
    );
  }

  const u: any = user;
  const fullName =
    u.name ||
    u.fullName ||
    `${u.firstName || ""} ${u.lastName || ""}`.trim() ||
    "Unknown patient";

  const gender =
    u.gender && typeof u.gender === "string"
      ? u.gender.charAt(0).toUpperCase() + u.gender.slice(1)
      : null;

  const dobLabel = formatDobWithAge(u.dob);
  const createdAt = u.createdAt || u.created_at || null;
  const updatedAt = u.updatedAt || u.updated_at || null;

  return (
    <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800">
          <span className="text-xs font-semibold text-neutral-100">
            {getUserInitials(user)}
          </span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{fullName}</p>
          <p className="text-[11px] text-neutral-400">
            {gender ? gender : "Gender: —"}
            {dobLabel && (
              <>
                {" "}
                • <span>{dobLabel}</span>
              </>
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-neutral-300">
            {u.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3 text-neutral-500" />
                <span className="break-all">{u.email}</span>
              </span>
            )}
            {(u.phone || u.phoneNumber) && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3 text-neutral-500" />
                <span>{u.phone || u.phoneNumber}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[11px] sm:grid-cols-2">
        <div>
          <dt className="text-neutral-500">Address line 1</dt>
          <dd className="text-neutral-100">
            {u.address_line1 || u.addressLine1 || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Address line 2</dt>
          <dd className="text-neutral-100">
            {u.address_line2 || u.addressLine2 || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">City</dt>
          <dd className="text-neutral-100">{u.city || "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">County</dt>
          <dd className="text-neutral-100">{u.county || "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Postcode</dt>
          <dd className="text-neutral-100">
            {u.postalcode || u.postcode || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Country</dt>
          <dd className="text-neutral-100">{u.country || "—"}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-4 border-t border-neutral-800 pt-2 text-[11px] text-neutral-500">
        <span>
          Created:{" "}
          <span className="text-neutral-200">
            {formatDateOnly(createdAt) || "—"}
          </span>
        </span>
        <span>
          Updated:{" "}
          <span className="text-neutral-200">
            {formatDateOnly(updatedAt) || "—"}
          </span>
        </span>
      </div>
    </div>
  );
}

/* ----------------- Types for clinical section tabs ----------------- */

type DetailSection = "raf" | "advice" | "declaration" | "record";
type PdfKind =
  | "full"
  | "raf"
  | "advice"
  | "declaration"
  | "record"
  | "invoice"
  | "private_rx";

function getPdfLabel(kind: PdfKind): string {
  switch (kind) {
    case "full":
      return "Full Consultation Record";
    case "raf":
      return "Risk Assessment Form (RAF)";
    case "advice":
      return "Pharmacist Advice";
    case "declaration":
      return "Pharmacist Declaration";
    case "record":
      return "Record of Supply";
    case "invoice":
      return "Invoice";
    case "private_rx":
      return "Private Prescription";
    default:
      return kind;
  }
}

const DEFAULT_PAGE_SIZE = 25;

/* ----------------- Page ----------------- */

export default function Page() {
  const [orders, setOrders] = useState<OrderDto[]>([]);
  const [meta, setMeta] = useState<OrdersListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [orderUsers, setOrderUsers] = useState<Record<string, UserDto | null>>(
    {}
  );

  const [showDetail, setShowDetail] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [orderedByUser, setOrderedByUser] = useState<UserDto | null>(null);

  const [activeSection, setActiveSection] = useState<DetailSection>("raf");

  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [emailPdfMenuOpen, setEmailPdfMenuOpen] = useState(false);
  const [emailPdfSending, setEmailPdfSending] = useState(false);
  const [emailPdfStatus, setEmailPdfStatus] = useState<string | null>(null);

  const [emailPeopleOpen, setEmailPeopleOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [emailBcc, setEmailBcc] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailAttachments, setEmailAttachments] = useState<File[]>([]);
  const [emailPeopleSending, setEmailPeopleSending] = useState(false);
  const [emailPeopleError, setEmailPeopleError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const pageSize = DEFAULT_PAGE_SIZE;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: orders.length,
      pending: 0,
      approved: 0,
      completed: 0,
      cancelled: 0,
    };
    orders.forEach((o: any) => {
      const s = o.status;
      if (s && counts[s] != null) counts[s] += 1;
    });
    return counts;
  }, [orders]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await getOrdersApi({
          page,
          pageSize,
          status: "completed",
          search: search || undefined,
        } as any);

        const list =
          (res as any)?.data ??
          (res as any)?.orders ??
          (Array.isArray(res) ? res : []);
        const metaRes = (res as any)?.meta ?? null;

        if (!cancelled) {
          setOrders(list || []);
          setMeta(metaRes);
        }
      } catch (err: any) {
        if (cancelled) return;
        setError(
          err?.message ||
            "Failed to load orders. Please try again or refresh the page."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, search]);

  useEffect(() => {
    async function fetchUsersForOrders() {
      if (!orders.length) return;

      const allIds = Array.from(
        new Set(
          orders
            .map((o: any) => o.user_id || o.userId || o.patient_user_id)
            .filter(Boolean)
        )
      );

      const missingIds = allIds.filter((id) => orderUsers[id] === undefined);
      if (!missingIds.length) return;

      try {
        const results = await Promise.all(
          missingIds.map(async (id) => {
            try {
              const res = await getUserByIdApi(id);
              const user =
                (res as any)?.data ?? (res as any)?.user ?? (res as any);
              return { id, user: user as UserDto | null };
            } catch (err) {
              console.error("Failed to fetch user for order", id, err);
              return { id, user: null as UserDto | null };
            }
          })
        );

        setOrderUsers((prev) => {
          const next = { ...prev };
          for (const { id, user } of results) {
            if (next[id] === undefined) next[id] = user;
          }
          return next;
        });
      } catch (err) {
        console.error("Error prefetching users for orders", err);
      }
    }

    fetchUsersForOrders();
  }, [orders, orderUsers]);

  const openOrderDetail = async (order: OrderDto) => {
    setShowDetail(true);
    setSelectedOrder(order);
    setOrderedByUser(null);
    setDetailError(null);
    setDetailLoading(true);
    setActiveSection("raf");
    setDownloadMenuOpen(false);
    setEmailPdfMenuOpen(false);
    setEmailPdfStatus(null);

    try {
      const userId =
        (order as any).user_id ||
        (order as any).userId ||
        (order as any).patient_user_id;

      const promises: Promise<any>[] = [
        getOrderByIdApi((order as any)._id) as any,
      ];
      if (userId && !orderUsers[userId])
        promises.push(getUserByIdApi(userId) as any);

      const [orderRes, maybeUserRes] = await Promise.all(promises);

      const fullOrder =
        (orderRes as any)?.data ??
        (orderRes as any)?.order ??
        orderRes ??
        order;
      setSelectedOrder(fullOrder);

      if (userId) {
        let user: UserDto | null = null;
        if (maybeUserRes)
          user =
            (maybeUserRes as any)?.data ??
            (maybeUserRes as any)?.user ??
            maybeUserRes;
        else user = orderUsers[userId] ?? null;

        if (user) {
          setOrderedByUser(user);
          setOrderUsers((prev) => ({ ...prev, [userId]: user }));
        }
      }
    } catch (err: any) {
      setDetailError(
        err?.message || "Unable to load full order details at this time."
      );
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setShowDetail(false);
    setSelectedOrder(null);
    setOrderedByUser(null);
    setDetailError(null);
    setDownloadMenuOpen(false);
    setEmailPdfMenuOpen(false);
  };

  const handleDownloadPdf = async (kind: PdfKind) => {
    if (!selectedOrder) return;
    try {
      const order = selectedOrder;
      const user = orderedByUser;

      switch (kind) {
        case "full":
          await exportAllClinicalPdf(order, user, "download");
          break;
        case "raf":
          await exportRafPdf(order, user, "download");
          break;
        case "advice":
          await exportAdvicePdf(order, user, "download");
          break;
        case "declaration":
          await exportDeclarationPdf(order, user, "download");
          break;
        case "record":
          await exportRecordPdf(order, user, "download");
          break;
        case "invoice":
          await exportInvoicePdf(order, user, "download");
          break;
        case "private_rx":
          await exportPrivatePrescriptionPdf(order, user, "download");
          break;
      }
    } catch (err) {
      console.error("PDF download failed", err);
    }
  };

  const generatePdfFile = async (kind: PdfKind): Promise<File | null> => {
    if (!selectedOrder) return null;
    const order = selectedOrder;
    const user = orderedByUser;

    switch (kind) {
      case "full":
        return (await exportAllClinicalPdf(order, user, "file")) as File;
      case "raf":
        return (await exportRafPdf(order, user, "file")) as File;
      case "advice":
        return (await exportAdvicePdf(order, user, "file")) as File;
      case "declaration":
        return (await exportDeclarationPdf(order, user, "file")) as File;
      case "record":
        return (await exportRecordPdf(order, user, "file")) as File;
      case "invoice":
        return (await exportInvoicePdf(order, user, "file")) as File;
      case "private_rx":
        return (await exportPrivatePrescriptionPdf(
          order,
          user,
          "file"
        )) as File;
      default:
        return null;
    }
  };

  const handleEmailPdf = async (kind: PdfKind) => {
    if (!selectedOrder) return;

    const order = selectedOrder;
    const patientName = getDisplayPatientName(
      order,
      orderedByUser ?? undefined
    );
    const u: any = orderedByUser || {};
    const email =
      u.email || (order as any).email || (order as any).patient_email || "";

    if (!email) {
      setEmailPdfStatus("No email address found for this patient/order.");
      return;
    }

    setEmailPdfSending(true);
    setEmailPdfStatus(null);

    try {
      const file = await generatePdfFile(kind);
      if (!file) throw new Error("Failed to generate PDF.");

      const subject = `${getPdfLabel(kind)} - ${
        (order as any).service_name || "Order"
      } (${(order as any).reference || (order as any)._id})`;

      const message =
        `Dear ${patientName || "Patient"},\n\n` +
        `Please find attached your ${getPdfLabel(
          kind
        ).toLowerCase()} for your recent consultation (${
          (order as any).service_name || "service"
        }) with ${PHARMACY_INFO.name}.\n\n` +
        `If you have any questions, please contact us on ${PHARMACY_INFO.tel} or reply to this email.\n\n` +
        `Kind regards,\n${PHARMACY_INFO.name}`;

      const loginUrl = getLoginUrl();

      await sendEmailApi({
        to: email,
        subject,
        template: "welcome",
        context: {
          subject,
          name: patientName || "Patient",
          email,
          loginUrl,
          supportEmail: PHARMACY_INFO.email,
          year: new Date().getFullYear(),
          message,
        },
        attachments: [file],
      });

      setEmailPdfStatus(`Sent ${getPdfLabel(kind)} to ${email}.`);
    } catch (err: any) {
      console.error("Email PDF failed", err);
      setEmailPdfStatus(
        err?.message || "Unable to send email. Please try again."
      );
    } finally {
      setEmailPdfSending(false);
    }
  };

  const openEmailComposer = () => {
    if (!selectedOrder) return;

    const order = selectedOrder;
    const patientName = getDisplayPatientName(
      order,
      orderedByUser ?? undefined
    );
    const u: any = orderedByUser || {};
    const email =
      u.email || (order as any).email || (order as any).patient_email || "";

    setEmailTo(email || "");
    setEmailCc("");
    setEmailBcc("");
    setEmailSubject(
      `Your consultation documents - ${
        (order as any).service_name || "Pharmacy Express"
      }`
    );
    setEmailMessage(
      `Dear ${patientName || "Patient"},\n\n` +
        `Please find attached your documents for your recent consultation (${
          (order as any).service_name || "service"
        }) with ${PHARMACY_INFO.name}.\n\n` +
        `If anything does not look correct, or you have questions, please contact us on ${PHARMACY_INFO.tel} or reply to this email.\n\n` +
        `Kind regards,\n${PHARMACY_INFO.name}`
    );
    setEmailAttachments([]);
    setEmailPeopleError(null);
    setEmailPeopleOpen(true);
  };

  const handleAttachPdfToEmail = async (kind: PdfKind) => {
    try {
      const file = await generatePdfFile(kind);
      if (!file) return;
      setEmailAttachments((prev) => {
        const already = prev.find(
          (f) => f.name === file.name && f.size === file.size
        );
        if (already) return prev;
        return [...prev, file];
      });
      setEmailPeopleError(null);
    } catch (err: any) {
      setEmailPeopleError(
        err?.message || "Unable to attach PDF. Please try again."
      );
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setEmailAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeAttachmentAt = (idx: number) => {
    setEmailAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSendEmailPeople = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailPeopleError(null);

    if (!emailTo.trim()) {
      setEmailPeopleError("Please enter a recipient in the To field.");
      return;
    }
    if (!emailSubject.trim()) {
      setEmailPeopleError("Please enter an email subject.");
      return;
    }

    try {
      setEmailPeopleSending(true);

      const order = selectedOrder;
      const patientName = order
        ? getDisplayPatientName(order, orderedByUser ?? undefined)
        : "";
      const friendlyName =
        patientName || emailTo.trim().split("@")[0] || "Customer";
      const loginUrl = getLoginUrl();

      await sendEmailApi({
        to: emailTo.trim(),
        subject: emailSubject.trim(),
        template: "welcome",
        context: {
          subject: emailSubject.trim(),
          name: friendlyName,
          email: emailTo.trim(),
          loginUrl,
          supportEmail: PHARMACY_INFO.email,
          year: new Date().getFullYear(),
          message: emailMessage,
        },
        attachments: emailAttachments,
      });

      setEmailPeopleSending(false);
      setEmailPeopleOpen(false);
      setEmailPdfStatus(`Email sent to ${emailTo.trim()}.`);
    } catch (err: any) {
      console.error("Email send failed", err);
      setEmailPeopleSending(false);
      setEmailPeopleError(
        err?.message || "Unable to send email. Please try again."
      );
    }
  };

  /* ---- Clinical detail render helper (FIXED: uses meta.riskAssessment + image rendering) ---- */
  const renderClinicalSection = () => {
    if (!selectedOrder) return null;
    const riskItems = getRiskAssessmentItems(selectedOrder);

    if (activeSection === "raf") {
      if (!riskItems.length) {
        return (
          <p className="text-xs text-neutral-400">
            No Risk Assessment data captured for this order.
          </p>
        );
      }

      return (
        <ol className="space-y-3">
          {riskItems.map((it: any, idx: number) => {
            const q = String(it.question || it.key || `Question ${idx + 1}`);
            const { text, files } = normaliseRiskValue(it.value);
            const imageFiles = files.filter(rafFileLooksLikeImage);
            const otherFiles = files.filter((f) => !rafFileLooksLikeImage(f));

            return (
              <li
                key={`${it.key || idx}`}
                className="rounded-md border border-neutral-800 bg-neutral-900/40 px-3 py-2"
              >
                <p className="text-xs font-medium text-neutral-100">
                  {idx + 1}. {q}
                </p>

                <p className="mt-1 text-[11px] text-neutral-300">
                  <span className="font-semibold text-neutral-400">
                    Answer:
                  </span>{" "}
                  {text}
                </p>

                {imageFiles.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {imageFiles.map((f, i) => (
                      <a
                        key={i}
                        href={resolveImageUrl(f.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="group overflow-hidden rounded-md border border-neutral-800 bg-neutral-950/40"
                        title={f.name || `Attachment ${i + 1}`}
                      >
                        <img
                          src={resolveImageUrl(f.url)}
                          alt={f.name || `Attachment ${i + 1}`}
                          className="h-24 w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                        <div className="px-2 py-1 text-[10px] text-neutral-400">
                          {f.name || `Image ${i + 1}`}
                        </div>
                      </a>
                    ))}
                  </div>
                )}

                {otherFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {otherFiles.map((f, i) => (
                      <a
                        key={i}
                        href={resolveImageUrl(f.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-sky-400 underline underline-offset-2"
                      >
                        {f.name || `Attachment ${i + 1}`}
                      </a>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      );
    }

    if (activeSection === "advice") {
      const points = extractAdvicePoints(selectedOrder);

      if (!points.length) {
        return (
          <p className="text-xs text-neutral-400">
            No Pharmacist Advice has been recorded for this order.
          </p>
        );
      }

      const common =
        "space-y-2 pl-5 text-[11px] leading-relaxed text-neutral-200";

      return ADVICE_LIST_STYLE === "numbered" ? (
        <ol className={`list-decimal ${common}`}>
          {points.map((p, idx) => (
            <li key={idx} className="break-words">
              {p}
            </li>
          ))}
        </ol>
      ) : (
        <ul className={`list-disc ${common}`}>
          {points.map((p, idx) => (
            <li key={idx} className="break-words">
              {p}
            </li>
          ))}
        </ul>
      );
    }

    if (activeSection === "declaration") {
      const meta: any = (selectedOrder as any).meta || {};
      const declaration = meta.pharmacistDeclaration;
      if (!declaration)
        return (
          <p className="text-xs text-neutral-400">
            No Pharmacist Declaration has been recorded.
          </p>
        );

      const fields: Record<string, any> = declaration.fields || {};
      const entries = Object.entries(fields);

      return (
        <div className="space-y-3 text-[11px] text-neutral-200">
          {entries.length ? (
            <dl className="space-y-2">
              {entries.map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <dt className="w-32 shrink-0 text-neutral-400">{key}</dt>
                  <dd className="flex-1">{formatFieldValue(value)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-xs text-neutral-400">
              No declaration fields were filled.
            </p>
          )}

          {declaration.signatureUrl && (
            <div className="rounded-md border border-neutral-800 bg-neutral-950/40 p-2">
              <p className="text-[11px] text-neutral-400">Signature:</p>
              <img
                src={resolveImageUrl(declaration.signatureUrl)}
                alt="Pharmacist signature"
                className="mt-2 h-16 w-auto rounded border border-neutral-800 bg-white"
              />
            </div>
          )}

          {declaration.saved_at && (
            <p className="text-neutral-400">
              Saved at: {formatDateTime(declaration.saved_at)}
            </p>
          )}
        </div>
      );
    }

    if (activeSection === "record") {
      const meta: any = (selectedOrder as any).meta || {};
      const record = meta.recordOfSupply;
      if (!record)
        return (
          <p className="text-xs text-neutral-400">
            No Record of Supply has been captured.
          </p>
        );

      const fields: Record<string, any> = record.fields || {};
      const entries = Object.entries(fields);
      if (!entries.length)
        return (
          <p className="text-xs text-neutral-400">
            Record of Supply fields are empty.
          </p>
        );

      return (
        <dl className="space-y-2 text-[11px] text-neutral-200">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <dt className="w-32 shrink-0 text-neutral-400">{key}</dt>
              <dd className="flex-1">{formatFieldValue(value)}</dd>
            </div>
          ))}
        </dl>
      );
    }

    return null;
  };

  const canPrev = (meta?.page ?? page) > 1;
  const totalPages =
    meta?.totalPages ??
    (meta?.total && (meta as any)?.pageSize
      ? Math.max(1, Math.ceil(meta.total / (meta as any).pageSize))
      : page);
  const canNext = (meta?.page ?? page) < totalPages;

  return (
    <>
      <div className="px-4 py-4 lg:px-6 lg:py-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-base font-semibold text-white sm:text-lg">
              Orders & clinical records
            </h1>
            <p className="mt-1 text-xs text-neutral-400">
              View patient orders, generate invoices, and export clinical
              documentation PDFs.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-100">
            {error}
          </div>
        )}
        {emailPdfStatus && (
          <div className="mb-3 rounded-md border border-neutral-700 bg-neutral-900/70 px-3 py-2 text-[11px] text-neutral-100">
            {emailPdfStatus}
          </div>
        )}

        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Filter className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-8 w-full rounded-md border border-neutral-700 bg-neutral-900/70 pl-7 pr-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-0"
              placeholder="Search by reference, patient, service..."
            />
          </div>
          <div className="flex items-center gap-2 text-[11px] text-neutral-400">
            <span>
              Page{" "}
              <span className="text-neutral-100">
                {meta?.page ?? page} / {totalPages || 1}
              </span>
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!canPrev}
                onClick={() => canPrev && setPage((p) => Math.max(1, p - 1))}
                className={[
                  "inline-flex h-7 items-center justify-center rounded-md border px-2 text-[11px]",
                  canPrev
                    ? "border-neutral-700 bg-neutral-900/70 text-neutral-100 hover:border-neutral-500"
                    : "cursor-not-allowed border-neutral-800 bg-neutral-900/40 text-neutral-600",
                ].join(" ")}
              >
                Prev
              </button>
              <button
                type="button"
                disabled={!canNext}
                onClick={() => canNext && setPage((p) => p + 1)}
                className={[
                  "inline-flex h-7 items-center justify-center rounded-md border px-2 text-[11px]",
                  canNext
                    ? "border-neutral-700 bg-neutral-900/70 text-neutral-100 hover:border-neutral-500"
                    : "cursor-not-allowed border-neutral-800 bg-neutral-900/40 text-neutral-600",
                ].join(" ")}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950/40">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-neutral-900/80 text-[11px] uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Reference</th>
                  <th className="px-3 py-2 text-left font-medium">Patient</th>
                  <th className="px-3 py-2 text-left font-medium">Service</th>
                  <th className="px-3 py-2 text-left font-medium">Created</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Payment</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Total incl. VAT
                  </th>
                  <th className="px-3 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-6 text-center text-xs text-neutral-500"
                    >
                      {loading
                        ? "Loading orders..."
                        : "No orders found for the current filters."}
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => {
                    const userId =
                      (order as any).user_id ||
                      (order as any).userId ||
                      (order as any).patient_user_id ||
                      "";
                    const userForOrder = (userId && orderUsers[userId]) || null;
                    const patientName = getDisplayPatientName(
                      order,
                      userForOrder ?? undefined
                    );
                    const totalMinor =
                      (order as any).total_minor ??
                      (order as any).meta?.totalMinor ??
                      null;

                    return (
                      <tr
                        key={(order as any)._id}
                        className="cursor-pointer border-t border-neutral-900/80 bg-neutral-950/40 hover:bg-neutral-900/60"
                        onClick={() => openOrderDetail(order)}
                      >
                        <td className="whitespace-nowrap px-3 py-2 align-middle">
                          <div className="flex items-center gap-1">
                            <ClipboardList className="h-3.5 w-3.5 text-neutral-500" />
                            <span className="font-medium text-neutral-100">
                              {(order as any).reference || (order as any)._id}
                            </span>
                          </div>
                        </td>
                        <td className="max-w-xs px-3 py-2 align-middle">
                          <span className="line-clamp-2 text-[11px] text-neutral-100">
                            {patientName}
                          </span>
                        </td>
                        <td className="max-w-xs px-3 py-2 align-middle">
                          <span className="line-clamp-2 text-[11px] text-neutral-200">
                            {(order as any).service_name || "—"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-middle text-[11px] text-neutral-300">
                          {formatDateTime(
                            (order as any).createdAt ||
                              (order as any).created_at
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {(order as any).status && (
                            <span
                              className={[
                                "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px]",
                                statusBadgeClasses((order as any).status),
                              ].join(" ")}
                            >
                              {(order as any).status === "completed" ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (order as any).status === "pending" ? (
                                <Clock className="h-3 w-3" />
                              ) : (order as any).status === "approved" ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (order as any).status === "cancelled" ||
                                (order as any).status === "rejected" ? (
                                <XCircle className="h-3 w-3" />
                              ) : (
                                <ClipboardList className="h-3 w-3" />
                              )}
                              <span className="capitalize">
                                {String((order as any).status).replace(
                                  /_/g,
                                  " "
                                )}
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {(order as any).payment_status && (
                            <span
                              className={[
                                "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px]",
                                paymentBadgeClasses(
                                  (order as any).payment_status
                                ),
                              ].join(" ")}
                            >
                              <CreditCard className="h-3 w-3" />
                              <span className="capitalize">
                                {String((order as any).payment_status).replace(
                                  /_/g,
                                  " "
                                )}
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right align-middle text-[11px] text-neutral-100">
                          {formatMoney(totalMinor)}
                        </td>
                        <td className="px-3 py-2 text-right align-middle">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openOrderDetail(order);
                            }}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-[11px] text-neutral-100 hover:border-emerald-500/70 hover:text-emerald-100"
                          >
                            <span>Open</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {loading && (
            <div className="flex items-center gap-2 border-t border-neutral-900/80 bg-neutral-950/60 px-3 py-2 text-[11px] text-neutral-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Loading latest orders…</span>
            </div>
          )}
        </div>
      </div>

      {showDetail && selectedOrder && (
        <div className="fixed inset-0 z-40 flex items-stretch justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={closeDetail} />
          <div className="relative z-10 flex h-full w-full max-w-3xl flex-col border-l border-neutral-800 bg-neutral-950">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                  Order reference
                </p>
                <p className="text-sm font-semibold text-white">
                  {(selectedOrder as any).reference ||
                    (selectedOrder as any)._id}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[11px] text-neutral-400">
                  <ClipboardList className="h-3 w-3" />
                  <span>
                    {(selectedOrder as any).service_name || "Service"}
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(selectedOrder as any).status && (
                    <span
                      className={[
                        "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px]",
                        statusBadgeClasses((selectedOrder as any).status),
                      ].join(" ")}
                    >
                      {(selectedOrder as any).status === "completed" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (selectedOrder as any).status === "pending" ? (
                        <Clock className="h-3 w-3" />
                      ) : (selectedOrder as any).status === "approved" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (selectedOrder as any).status === "cancelled" ||
                        (selectedOrder as any).status === "rejected" ? (
                        <XCircle className="h-3 w-3" />
                      ) : (
                        <ClipboardList className="h-3 w-3" />
                      )}
                      <span className="capitalize">
                        {String((selectedOrder as any).status).replace(
                          /_/g,
                          " "
                        )}
                      </span>
                    </span>
                  )}
                  {(selectedOrder as any).payment_status && (
                    <span
                      className={[
                        "inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px]",
                        paymentBadgeClasses(
                          (selectedOrder as any).payment_status
                        ),
                      ].join(" ")}
                    >
                      <CreditCard className="h-3 w-3" />
                      <span className="capitalize">
                        {String((selectedOrder as any).payment_status).replace(
                          /_/g,
                          " "
                        )}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={closeDetail}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/80 text-neutral-300 hover:border-neutral-500 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setDownloadMenuOpen((v) => !v);
                        setEmailPdfMenuOpen(false);
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-[11px] text-neutral-100 hover:border-emerald-500/70 hover:text-emerald-100"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download</span>
                    </button>
                    {downloadMenuOpen && (
                      <div className="absolute right-0 mt-1 w-52 rounded-md border border-neutral-800 bg-neutral-950/95 text-[11px] text-neutral-100 shadow-xl backdrop-blur">
                        {(
                          [
                            ["full", "Full consultation record"],
                            ["invoice", "Invoice"],
                            ["raf", "RAF – Risk assessment"],
                            ["advice", "Pharmacist advice"],
                            ["declaration", "Pharmacist declaration"],
                            ["record", "Record of supply"],
                            ["private_rx", "Private prescription"],
                          ] as [PdfKind, string][]
                        ).map(([kind, label]) => (
                          <button
                            key={kind}
                            type="button"
                            onClick={() => {
                              setDownloadMenuOpen(false);
                              handleDownloadPdf(kind);
                            }}
                            className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-neutral-800/80"
                          >
                            <span>{label}</span>
                          </button>
                        ))}
                        <div className="border-t border-neutral-800 px-3 py-1.5 text-[10px] text-neutral-500">
                          Tip: open the downloaded PDF and print from your PDF
                          viewer if needed.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setEmailPdfMenuOpen((v) => !v);
                        setDownloadMenuOpen(false);
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-[11px] text-neutral-100 hover:border-emerald-500/70 hover:text-emerald-100"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>Email PDF</span>
                    </button>
                    {emailPdfMenuOpen && (
                      <div className="absolute right-0 mt-1 w-56 rounded-md border border-neutral-800 bg-neutral-950/95 text-[11px] text-neutral-100 shadow-xl backdrop-blur">
                        {emailPdfSending ? (
                          <div className="flex items-center gap-2 px-3 py-2 text-neutral-300">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Sending…</span>
                          </div>
                        ) : (
                          <>
                            {(
                              [
                                ["full", "Full consultation record"],
                                ["invoice", "Invoice"],
                                ["raf", "RAF"],
                                ["advice", "Advice"],
                                ["declaration", "Declaration"],
                                ["record", "Record of supply"],
                                ["private_rx", "Private prescription"],
                              ] as [PdfKind, string][]
                            ).map(([kind, label]) => (
                              <button
                                key={kind}
                                type="button"
                                onClick={() => {
                                  handleEmailPdf(kind);
                                  setEmailPdfMenuOpen(false);
                                }}
                                className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-neutral-800/80"
                              >
                                <span>{label}</span>
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setEmailPdfMenuOpen(false);
                                openEmailComposer();
                              }}
                              className="mt-1 flex w-full items-center justify-between border-t border-neutral-800 px-3 py-1.5 text-left text-neutral-200 hover:bg-neutral-800/80"
                            >
                              <span>Open email composer…</span>
                              <Send className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <PatientProfileCard user={orderedByUser} />

              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40">
                <div className="flex gap-1 border-b border-neutral-800 px-3 pt-2">
                  {(
                    [
                      ["raf", "RAF"],
                      ["advice", "Advice"],
                      ["declaration", "Declaration"],
                      ["record", "Record of supply"],
                    ] as [DetailSection, string][]
                  ).map(([id, label]) => {
                    const active = activeSection === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setActiveSection(id)}
                        className={[
                          "relative inline-flex items-center gap-1 rounded-t-md px-3 pb-1.5 pt-1 text-[11px]",
                          active
                            ? "border-b border-emerald-500 text-emerald-100"
                            : "text-neutral-400 hover:text-neutral-100",
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                <div className="px-3 py-3 text-xs text-neutral-200">
                  {detailLoading ? (
                    <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Loading full clinical details…</span>
                    </div>
                  ) : detailError ? (
                    <p className="text-xs text-rose-300">{detailError}</p>
                  ) : (
                    renderClinicalSection()
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 px-3 py-3">
                <p className="mb-2 text-xs font-semibold text-neutral-200">
                  Order summary
                </p>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-[11px] sm:grid-cols-2">
                  <div>
                    <dt className="text-neutral-500">Reference</dt>
                    <dd className="text-neutral-100">
                      {(selectedOrder as any).reference ||
                        (selectedOrder as any)._id}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Service</dt>
                    <dd className="text-neutral-100">
                      {(selectedOrder as any).service_name || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Created at</dt>
                    <dd className="text-neutral-100">
                      {formatDateTime(
                        (selectedOrder as any).createdAt ||
                          (selectedOrder as any).created_at
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Appointment</dt>
                    <dd className="text-neutral-100">
                      {formatDateTime(
                        (selectedOrder as any).meta?.appointment_start_at ||
                          (selectedOrder as any).start_at
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Total incl. VAT</dt>
                    <dd className="text-neutral-100">
                      {formatMoney(
                        (selectedOrder as any).meta?.totalMinor ??
                          (selectedOrder as any).total_minor ??
                          null
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-500">Status</dt>
                    <dd className="text-neutral-100 capitalize">
                      {String((selectedOrder as any).status || "—").replace(
                        /_/g,
                        " "
                      )}
                      {(selectedOrder as any).payment_status && (
                        <>
                          {" "}
                          •{" "}
                          <span className="text-neutral-300">
                            Payment:{" "}
                            {String((selectedOrder as any).payment_status)
                              .replace(/_/g, " ")
                              .toLowerCase()}
                          </span>
                        </>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}

      {emailPeopleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setEmailPeopleOpen(false)}
          />
          <div className="relative z-10 w-full max-w-xl rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-4 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-white">
                  Email documents
                </p>
                <p className="mt-1 text-[11px] text-neutral-400">
                  Send consultation PDFs and custom message to the patient or
                  other recipients.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEmailPeopleOpen(false)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900/80 text-neutral-300 hover:border-neutral-500 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <form
              className="mt-3 space-y-3 text-xs"
              onSubmit={handleSendEmailPeople}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                    To
                  </label>
                  <input
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    className="h-8 w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
                    placeholder="patient@example.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                    Cc
                  </label>
                  <input
                    value={emailCc}
                    onChange={(e) => setEmailCc(e.target.value)}
                    className="h-8 w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
                    placeholder="optional"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                    Bcc
                  </label>
                  <input
                    value={emailBcc}
                    onChange={(e) => setEmailBcc(e.target.value)}
                    className="h-8 w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
                    placeholder="optional"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                  Subject
                </label>
                <input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="h-8 w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-2 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
                  placeholder="Subject"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-neutral-300">
                  Message
                </label>
                <textarea
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-2 py-1.5 text-xs text-neutral-100 placeholder:text-neutral-500 focus:border-emerald-500 focus:outline-none"
                  placeholder="Write your message..."
                />
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-neutral-300">
                    Attachments
                  </span>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleAttachPdfToEmail("invoice")}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900/80 px-2 py-[2px] hover:border-emerald-500/70 hover:text-emerald-100"
                    >
                      Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAttachPdfToEmail("full")}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900/80 px-2 py-[2px] hover:border-emerald-500/70 hover:text-emerald-100"
                    >
                      Full record
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAttachPdfToEmail("raf")}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900/80 px-2 py-[2px] hover:border-emerald-500/70 hover:text-emerald-100"
                    >
                      RAF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAttachPdfToEmail("record")}
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-700 bg-neutral-900/80 px-2 py-[2px] hover:border-emerald-500/70 hover:text-emerald-100"
                    >
                      Record of supply
                    </button>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-dashed border-neutral-700 bg-neutral-900/80 px-2 py-[2px] text-[11px] text-neutral-200 hover:border-neutral-500">
                      <span>Upload files</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleFileInput}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-1 rounded-md border border-neutral-800 bg-neutral-900/60 px-2 py-2 text-[11px] text-neutral-200">
                  {emailAttachments.length === 0 ? (
                    <p className="text-neutral-500">
                      No attachments added yet.
                    </p>
                  ) : (
                    emailAttachments.map((file, idx) => (
                      <div
                        key={`${file.name}-${idx}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate">
                          {file.name}{" "}
                          <span className="text-neutral-500">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAttachmentAt(idx)}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-neutral-700 text-neutral-400 hover:border-rose-500/70 hover:text-rose-200"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {emailPeopleError && (
                <div className="rounded-md border border-rose-700/60 bg-rose-950/40 px-3 py-2 text-[11px] text-rose-100">
                  {emailPeopleError}
                </div>
              )}

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEmailPeopleOpen(false)}
                  className="inline-flex h-8 items-center rounded-md border border-neutral-700 bg-neutral-900/80 px-3 text-[11px] text-neutral-200 hover:border-neutral-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={emailPeopleSending}
                  className={[
                    "inline-flex h-8 items-center gap-2 rounded-md border px-3 text-[11px]",
                    emailPeopleSending
                      ? "border-emerald-700/70 bg-emerald-700/40 text-emerald-50"
                      : "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500",
                  ].join(" ")}
                >
                  {emailPeopleSending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Sending…</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Send email</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
