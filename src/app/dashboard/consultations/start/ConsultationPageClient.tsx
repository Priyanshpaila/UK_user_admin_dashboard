"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getOrderByIdApi,
  updateOrderStatusApi,
  sendEmailApi,
  type OrderDto,
  getDynamicHomePageApi,
  getCurrentUserApi,
  getBackendBase,
} from "../../../../api";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import jsPDF from "jspdf";

import RecordOfSupplyTab from "./RecordOfSupplyTab";
import RiskAssessmentTab from "./RiskAssessmentTab";
import PharmacistAdviceTab from "./PharmacistAdviceTab";
import PharmacistDeclarationTab from "./PharmacistDeclarationTab";

type TabKey = "risk" | "advice" | "declaration" | "record";

const TABS: { key: TabKey; label: string }[] = [
  { key: "risk", label: "Risk Assessment" },
  { key: "advice", label: "Pharmacist’s Advice" },
  { key: "declaration", label: "Pharmacist Declaration" },
  { key: "record", label: "Record of Supply" },
];

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

type PharmacyDetails = {
  name: string;
  addressLines: string[]; // split lines for PDF
  phone?: string;
  email?: string;
  gphcNumber?: string;
  vatNumber?: string;
};

function splitAddressLines(raw?: string): string[] {
  if (!raw) return [];
  // allow commas or newlines
  return raw
    .split(/\n|,/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildAddressFromUser(u: any): string[] {
  // If your "pharmacy profile" is stored on user object, adapt these keys.
  // Prefer a single string like `pharmacy_address`, else assemble from pieces.
  const direct =
    u?.pharmacy_address ||
    u?.pharmacyAddress ||
    u?.address ||
    u?.address_line1 ||
    "";

  const directLines = splitAddressLines(direct);
  if (directLines.length) return directLines;

  // assemble common address fields (if you store them)
  const parts = [
    u?.address_line1,
    u?.address_line2,
    u?.city,
    u?.county,
    u?.postalcode,
    u?.country,
  ]
    .map((x: any) => String(x ?? "").trim())
    .filter(Boolean);

  return parts;
}

/**
 * Fetch pharmacy details from current user (tenant context).
 * Fallback order:
 *  1) getCurrentUserApi() (preferred)
 *  2) getDynamicHomePageApi("home") (branding)
 *  3) env defaults
 */
async function getPharmacyDetails(): Promise<PharmacyDetails> {
  // env fallbacks (you can rename keys as you like)
  const fallbackVat = process.env.NEXT_PUBLIC_VAT_NUMBER || "274797643";
  const fallbackEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "info@pharmacy-express.co.uk";
  const fallbackName = "Pharmacy";

  try {
    const me: any = await getCurrentUserApi();

    // Adjust mapping based on how your backend stores pharmacy info.
    const name =
      me?.pharmacy_name ||
      me?.firstName ||
      me?.pharmacyName ||
      me?.companyName ||
      me?.tenant_name ||
      me?.name ||
      me?.fullName ||
      fallbackName;

    const addressLines = buildAddressFromUser(me);

    const phone =
      me?.pharmacy_phone ||
      me?.pharmacyPhone ||
      me?.phone ||
      me?.phoneNumber ||
      "";

    const email =
      me?.pharmacy_email || me?.pharmacyEmail || me?.email || fallbackEmail;

    const gphcNumber = me?.gphc_number || me?.gphcNumber || "";
    const vatNumber = me?.vat_number || me?.vatNumber || fallbackVat;

    // If user doesn’t actually have pharmacy fields, we still return minimal.
    return {
      name: String(name || fallbackName),
      addressLines: addressLines.length ? addressLines : [],
      phone: phone ? String(phone) : undefined,
      email: email ? String(email) : undefined,
      gphcNumber: gphcNumber ? String(gphcNumber) : undefined,
      vatNumber: vatNumber ? String(vatNumber) : undefined,
    };
  } catch (err) {
    // fallback to Dynamic Home Page (tenant branding)
    try {
      const home: any = await getDynamicHomePageApi("home");
      const name =
        home?.navbar?.companyName ||
        home?.navbar?.brandName ||
        home?.navbar?.logoAlt ||
        fallbackName;

      const email =
        home?.navbar?.supportEmail || home?.supportEmail || fallbackEmail;

      // if you store address/phone in footer.contact (adapt as needed)
      const addr =
        home?.footer?.contact?.addressLabel || home?.contact?.address || "";

      const phone =
        home?.footer?.contact?.phoneLabel || home?.contact?.phone || "";

      return {
        name: String(name || fallbackName),
        addressLines: splitAddressLines(String(addr || "")),
        phone: phone ? String(phone) : undefined,
        email: email ? String(email) : undefined,
        vatNumber: fallbackVat,
      };
    } catch {
      // hard fallback
      return {
        name: fallbackName,
        addressLines: [],
        phone: undefined,
        email: fallbackEmail,
        vatNumber: fallbackVat,
      };
    }
  }
}

/* ---------------- PDF branding helpers ---------------- */

type PdfBranding = {
  brandName: string;
  logoDataUrl?: string | null;
};

function sanitizeHeaderName(v?: string | null): string {
  if (!v) return "";
  return v
    .replace(/logo|image/gi, "")
    .replace(/\.(png|jpg|jpeg|svg|webp)$/gi, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

async function getPdfBranding(): Promise<PdfBranding> {
  try {
    const home: any = await getDynamicHomePageApi("home");

    const rawName =
      home?.navbar?.headerName ||
      home?.navbar?.brandName ||
      home?.navbar?.logoAlt ||
      "";

    const brandName =
      sanitizeHeaderName(rawName) ||
      sanitizeHeaderName(home?.name) ||
      "Pharmacy";

    let logoDataUrl: string | null = null;

    const logoPath = home?.navbar?.logoUrl || home?.branding?.logo || null;

    if (logoPath) {
      const resolvedUrl = resolveImageUrl(logoPath);
      logoDataUrl = await loadImageAsDataUrl(resolvedUrl);
    }

    return { brandName, logoDataUrl };
  } catch (err) {
    console.warn("PDF branding fallback used", err);
    return { brandName: "Pharmacy", logoDataUrl: null };
  }
}

function getDisplayPatientName(order: OrderDto): string {
  if (!order) return "Unknown";

  if (order.patient_name) return order.patient_name;

  const fromOrder = `${order.first_name || ""} ${order.last_name || ""}`.trim();
  if (fromOrder) return fromOrder;

  return order.email || "Unknown";
}

function formatMinorGBP(minor?: number | null) {
  if (minor == null || Number.isNaN(minor)) return "£0.00";
  return `£${(minor / 100).toFixed(2)}`;
}

// value can be string | string[] | number | boolean | null
type RiskAnswerLS = { key: string; question: string; value: any };

type ConsultAddressLS = {
  line1?: string;
  line2?: string;
  city?: string;
  county?: string;
  postalcode?: string;
  country?: string;
};

type ConsultPatientLS = {
  orderId: string;
  serviceId: string;
  serviceSlug?: string;
  serviceName?: string;
  orderReference?: string;
  appointmentAt?: string;
  patient?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    gender?: string;
    dob?: string;
    priority?: string;
    address?: ConsultAddressLS;
  };
};

/* ----------------- helpers for LS + PDFs + email ----------------- */

function readCurrentConsultPatient(): ConsultPatientLS | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("current_consult_patient");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ConsultPatientLS;
  } catch {
    return null;
  }
}

function clearNonAuthLocalStorage() {
  if (typeof window === "undefined") return;
  try {
    const keep = new Set(["session_token", "user"]);
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (!keep.has(key)) keys.push(key);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch (err) {
    console.error("Failed to clear localStorage", err);
  }
}

// Add these helpers near the top of the file --------------------------

function formatDateOnly(value?: string | Date | null): string {
  if (!value) return "—";

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return "—";
    return value.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  const str = String(value);
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  // fallback for raw "YYYY-MM-DD"
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return str;
}

type PharmacistDeclarationPdf = {
  pharmacistName: string;
  gphcNumber: string;
  declarationDate: string;
  signatureUrl?: string | null;
};

function extractPharmacistDeclarationForPdf(
  order: OrderDto
): PharmacistDeclarationPdf {
  const meta: any = order.meta || {};
  const decMeta: any = meta.pharmacistDeclaration || {};

  let fields: Record<string, any> =
    (decMeta && typeof decMeta === "object" && decMeta.fields) || {};

  let pharmacistName = decMeta.pharmacistName || decMeta.pharmacist_name || "";
  let gphcNumber = decMeta.gphcNumber || decMeta.gphc_number || "";
  let signatureUrl: string | null =
    decMeta.signatureUrl || decMeta.signature_url || null;

  // Also merge data from localStorage (your example object lives here)
  if (typeof window !== "undefined") {
    try {
      const lsKey = `consultation_${order._id}_declaration`;
      const raw = window.localStorage.getItem(lsKey);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          fields?: Record<string, any>;
          signatureUrl?: string;
          signaturePath?: string;
        };

        if (parsed && parsed.fields && typeof parsed.fields === "object") {
          fields = { ...fields, ...parsed.fields };
        }

        if (parsed?.signatureUrl) {
          signatureUrl = parsed.signatureUrl;
        } else if (!signatureUrl && parsed?.signaturePath) {
          // crude fallback if only path is stored
          const path = parsed.signaturePath;
          if (/^https?:\/\//i.test(path)) {
            signatureUrl = path;
          } else if (typeof window !== "undefined") {
            const origin = window.location.origin.replace(/\/+$/, "");
            const normalizedPath = path.startsWith("/") ? path : `/${path}`;
            signatureUrl = `${origin}${normalizedPath}`;
          }
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  // If not explicitly present, infer from fields
  if (
    (!pharmacistName || !gphcNumber) &&
    fields &&
    typeof fields === "object"
  ) {
    const entries = Object.entries(fields).map(([k, v]) => [
      k.toLowerCase(),
      String(v ?? "").trim(),
    ]) as [string, string][];

    for (const [k, v] of entries) {
      if (!pharmacistName && k.includes("pharmacist") && k.includes("name")) {
        pharmacistName = v;
      }
      if (!gphcNumber && k.includes("gphc")) {
        gphcNumber = v;
      }
    }

    const values = entries.map(([, v]) => v).filter(Boolean);
    if (!pharmacistName && values.length) {
      pharmacistName = values[0]; // e.g. "Abhishek Paul"
    }
    if (!gphcNumber && values.length > 1) {
      const numericLike =
        values.find((v) => /^[0-9\s-]+$/.test(v)) || values[1]; // e.g. "345345345"
      gphcNumber = numericLike;
    }
  }

  const declarationDate = formatDateOnly(
    decMeta.saved_at || new Date().toISOString()
  );

  return {
    pharmacistName: pharmacistName || "—",
    gphcNumber: gphcNumber || "—",
    declarationDate,
    signatureUrl,
  };
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

async function loadImageAsDataUrl(url?: string | null): Promise<string | null> {
  if (!url || typeof window === "undefined") return null;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image blob"));
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Failed to load signature image for PDF:", err);
    return null;
  }
}

async function generateRecordOfSupplyPdf(
  order: OrderDto,
  record: any,
  consult: ConsultPatientLS | null
): Promise<File> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 16;

  const GREEN = { r: 16, g: 185, b: 129 };

  // Top accent line
  doc.setFillColor(GREEN.r, GREEN.g, GREEN.b);
  doc.rect(0, 0, pageWidth, 4, "F");

  const todayLabel = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const patientName = consult?.patient?.name || getDisplayPatientName(order);
  const patientEmail = consult?.patient?.email || order.email || "";
  const patientPhone = consult?.patient?.phone || "";

  const rawDob =
    consult?.patient?.dob ||
    (order as any).dob ||
    (order.meta as any)?.patient?.dob ||
    null;
  const patientDob = formatDateOnly(rawDob);

  // Build address from consult patient if available
  let patientAddress = "";
  const addr = consult?.patient?.address;
  if (addr) {
    const parts = [
      addr.line1,
      addr.line2,
      addr.city,
      addr.county,
      addr.postalcode,
      addr.country,
    ]
      .map((p) => (p ?? "").toString().trim())
      .filter(Boolean);
    patientAddress = parts.join(", ");
  }

  const ref = order.reference || order._id;

  /* ---------------- Header: brand + title + meta line ---------------- */

  const headerTopY = 40;

  // Brand text
  const { brandName, logoDataUrl } = await getPdfBranding();

  // Logo (if present)
  if (logoDataUrl) {
    try {
      doc.addImage(
        logoDataUrl,
        undefined as any,
        margin,
        headerTopY - 18,
        48,
        18
      );
    } catch {}
  }

  // Title
  doc.setFontSize(20);
  doc.setTextColor(GREEN.r, GREEN.g, GREEN.b);
  doc.text("RECORD OF SUPPLY", margin, headerTopY + 28);

  // Reference + date
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  const refLineParts: string[] = [];
  if (ref) refLineParts.push(`Reference: ${ref}`);
  refLineParts.push(`Date: ${todayLabel}`);
  doc.text(refLineParts.join(" | "), margin, headerTopY + 42);

  // Horizontal rule
  doc.setDrawColor(GREEN.r, GREEN.g, GREEN.b);
  doc.setLineWidth(0.8);
  doc.line(margin, headerTopY + 48, pageWidth - margin, headerTopY + 48);

  /* ---------------- Pharmacy + Patient cards ---------------- */

  const cardsTop = headerTopY + 60;
  const cardGap = 20;
  const cardWidth = (contentWidth - cardGap) / 2;
  const cardHeight = 150;

  const lightBorder = { r: 211, g: 214, b: 219 };

  // Pharmacy Details (left)
  doc.setDrawColor(lightBorder.r, lightBorder.g, lightBorder.b);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, cardsTop, cardWidth, cardHeight, 6, 6);

  let yLeft = cardsTop + 20;
  let xLeft = margin + 12;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(GREEN.r, GREEN.g, GREEN.b);
  doc.text("Pharmacy Details", xLeft, yLeft);
  yLeft += 8;
  doc.setDrawColor(GREEN.r, GREEN.g, GREEN.b);
  doc.setLineWidth(0.7);
  doc.line(xLeft, yLeft, margin + cardWidth - 12, yLeft);
  yLeft += 10;

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  const labelWidthLeft = 55;
  const putRowLeft = (label: string, value: string | string[]) => {
    const v =
      Array.isArray(value) && value.length > 0 ? value.join("\n") : value;

    doc.setFont("helvetica", "bold");
    doc.text(label, xLeft, yLeft);

    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(
      String(v || ""),
      cardWidth - labelWidthLeft - 24
    );
    doc.text(lines, xLeft + labelWidthLeft, yLeft);

    yLeft += lineHeight * Math.max(1, lines.length);
  };
  const pharmacy = await getPharmacyDetails();
  putRowLeft("Name:", pharmacy.name || "—");
  putRowLeft(
    "Address:",
    pharmacy.addressLines?.length ? pharmacy.addressLines : "—"
  );
  if (pharmacy.phone) putRowLeft("Tel:", pharmacy.phone);
  if (pharmacy.email) putRowLeft("Email:", pharmacy.email);

  // Patient Information (right)
  const rightX = margin + cardWidth + cardGap;
  doc.setDrawColor(lightBorder.r, lightBorder.g, lightBorder.b);
  doc.setLineWidth(0.6);
  doc.roundedRect(rightX, cardsTop, cardWidth, cardHeight, 6, 6);

  let yRight = cardsTop + 20;
  const xRight = rightX + 12;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(GREEN.r, GREEN.g, GREEN.b);
  doc.text("Patient Information", xRight, yRight);
  yRight += 8;
  doc.setDrawColor(GREEN.r, GREEN.g, GREEN.b);
  doc.setLineWidth(0.7);
  doc.line(xRight, yRight, rightX + cardWidth - 12, yRight);
  yRight += 10;

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);

  const labelWidthRight = 55;
  const putRowRight = (label: string, value: string | string[]) => {
    const v =
      Array.isArray(value) && value.length > 0 ? value.join("\n") : value;

    doc.setFont("helvetica", "bold");
    doc.text(label, xRight, yRight);

    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(
      String(v || ""),
      cardWidth - labelWidthRight - 24
    );
    doc.text(lines, xRight + labelWidthRight, yRight);

    yRight += lineHeight * Math.max(1, lines.length);
  };

  putRowRight("Name:", patientName || "—");
  putRowRight("DOB:", patientDob || "—");
  putRowRight("Address:", patientAddress || "—");
  const contactParts = [patientEmail, patientPhone].filter(Boolean);
  putRowRight("Contact:", contactParts.join(" | ") || "—");

  /* ---------------- Clinical Notes table ---------------- */

  let sectionTop = cardsTop + cardHeight + 30;
  if (sectionTop > pageHeight - margin - 200) {
    doc.addPage();
    sectionTop = margin;
  }

  // Section header bar
  doc.setFillColor(232, 248, 240);
  doc.setDrawColor(GREEN.r, GREEN.g, GREEN.b);
  const sectionWidth = contentWidth;
  doc.rect(margin, sectionTop, sectionWidth, 22, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(GREEN.r, GREEN.g, GREEN.b);
  doc.text("Clinical Notes", margin + 8, sectionTop + 14);

  let y = sectionTop + 28;
  doc.setFontSize(9);
  doc.setTextColor(55, 65, 81);

  const fieldsObj: any =
    record && typeof record === "object" && (record as any).fields
      ? (record as any).fields
      : record;

  if (!fieldsObj || typeof fieldsObj !== "object") {
    doc.text("No record of supply data captured.", margin + 8, y + 10);
    y += 24;
  } else {
    const entries = Object.entries(fieldsObj as Record<string, any>);
    if (!entries.length) {
      doc.text("No record of supply data captured.", margin + 8, y + 10);
      y += 24;
    } else {
      const labelColWidth = sectionWidth * 0.28;
      const valueColWidth = sectionWidth - labelColWidth;

      for (const [key, value] of entries) {
        if (y > pageHeight - margin - 160) {
          doc.addPage();
          y = margin;
        }

        doc.setDrawColor(229, 231, 235);
        const rowTop = y;
        const baseRowHeight = 20;

        const label = String(key);
        let valStr: string;
        if (Array.isArray(value)) valStr = value.join(", ");
        else if (value == null) valStr = "—";
        else valStr = String(value);

        const labelText = doc.splitTextToSize(label, labelColWidth - 12);
        const valueText = doc.splitTextToSize(valStr, valueColWidth - 12);
        const rowHeight =
          baseRowHeight * Math.max(labelText.length, valueText.length, 1);

        doc.rect(margin, rowTop, labelColWidth, rowHeight);
        doc.rect(margin + labelColWidth, rowTop, valueColWidth, rowHeight);

        doc.setFont("helvetica", "bold");
        doc.text(labelText, margin + 6, rowTop + 13);
        doc.setFont("helvetica", "normal");
        doc.text(valueText, margin + labelColWidth + 6, rowTop + 13);

        y += rowHeight;
      }
    }
  }

  /* ---------------- Pharmacist Declaration ---------------- */

  y += 24;
  if (y > pageHeight - margin - 160) {
    doc.addPage();
    y = margin;
  }

  const decHeaderTop = y;
  const decBoxHeight = 160;

  doc.setFillColor(232, 248, 240);
  doc.setDrawColor(GREEN.r, GREEN.g, GREEN.b);
  doc.rect(margin, decHeaderTop, contentWidth, 22, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(GREEN.r, GREEN.g, GREEN.b);
  doc.text("Pharmacist Declaration", margin + 8, decHeaderTop + 14);

  doc.setDrawColor(GREEN.r, GREEN.g, GREEN.b);
  doc.roundedRect(margin, decHeaderTop, contentWidth, decBoxHeight, 6, 6);

  y = decHeaderTop + 40;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(55, 65, 81);

  const declarationParagraph =
    "I confirm that the above named patient has been clinically assessed and supplied medication in accordance with the service protocol. The supply is appropriate, counselling has been provided, and relevant records have been completed.";

  const wrappedDecl = doc.splitTextToSize(
    declarationParagraph,
    contentWidth - 16
  );
  doc.text(wrappedDecl, margin + 8, y);
  y += lineHeight * wrappedDecl.length + 6;

  const { pharmacistName, gphcNumber, declarationDate, signatureUrl } =
    extractPharmacistDeclarationForPdf(order);

  const labelX = margin + 8;
  const valueX = margin + 130;

  const row = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, labelX, y);
    doc.setFont("helvetica", "normal");
    doc.text(value || "—", valueX, y);
    y += lineHeight - 2;
  };

  row("Pharmacist Name:", pharmacistName);
  row("GPhC Number:", gphcNumber);
  row("Date:", declarationDate);

  // Signature label + line
  const sigLabelY = y + 10;
  doc.setFont("helvetica", "bold");
  doc.text("Signature:", labelX, sigLabelY);

  const lineY = sigLabelY + 4;
  const lineStartX = valueX;
  const lineEndX = margin + contentWidth - 40;
  doc.setDrawColor(148, 163, 184);
  doc.line(lineStartX, lineY, lineEndX, lineY);
  // Signature image above the line (if available)
  if (signatureUrl) {
    const dataUrl = await resolveImageUrl(signatureUrl);
    if (dataUrl) {
      const sigHeight = 3;
      const sigWidth = 140;
      const sigY = lineY - sigHeight + 6;
      const sigX = lineStartX;

      try {
        doc.addImage(
          dataUrl,
          undefined as any,
          sigX,
          sigY,
          sigWidth,
          sigHeight
        );
      } catch (err) {
        console.error("Failed to add signature image to PDF:", err);
      }
    }
  }

  // Footer
  const footerY = pageHeight - 40;
  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text(
    `This record of supply was generated from your consultation at ${brandName}.`,
    margin,
    footerY,
    { maxWidth: contentWidth }
  );

  const blob = doc.output("blob");
  const fileName = `${ref}-record-of-supply.pdf`;

  let file: File;
  try {
    file = new File([blob], fileName, { type: "application/pdf" });
  } catch {
    throw new Error("File constructor not available for PDF attachment");
  }
  return file;
}

async function generateInvoicePdfFromOrder(
  order: OrderDto,
  consult: ConsultPatientLS | null
): Promise<File> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 16;

  const GREEN = { r: 16, g: 185, b: 129 };

  const ref = order.reference || order._id;
  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const vatNumber = process.env.NEXT_PUBLIC_VAT_NUMBER || "274797643";

  const patientName = consult?.patient?.name || getDisplayPatientName(order);
  const patientEmail = consult?.patient?.email || order.email || "";
  const patientPhone =
    consult?.patient?.phone ||
    (order.meta as any)?.phone ||
    (order as any)?.phone ||
    "";

  const patientDobRaw: any =
    consult?.patient?.dob ||
    (order.meta as any)?.dob ||
    (order as any)?.dob ||
    null;
  const patientDob = formatDateOnly(patientDobRaw);

  const addr =
    consult?.patient?.address ||
    (order.meta as any)?.patient_address ||
    (order.meta as any)?.address ||
    {};

  const patientAddressParts = [
    addr.line1,
    addr.line2,
    addr.city,
    addr.county,
    addr.postalcode,
    addr.country,
  ]
    .filter(Boolean)
    .map((s: string) => String(s));

  const patientAddress = patientAddressParts.join(", ");

  const items: any[] = Array.isArray(order.meta?.items)
    ? (order.meta!.items as any[])
    : [];

  let subtotalMinor = 0;
  items.forEach((it) => {
    subtotalMinor += Number(it.totalMinor || 0);
  });
  if (!subtotalMinor && typeof order.meta?.totalMinor === "number") {
    subtotalMinor = order.meta.totalMinor;
  }
  if (!subtotalMinor && typeof order.meta?.total === "number") {
    subtotalMinor = Math.round(order.meta.total * 100);
  }
  const totalMinor = subtotalMinor || 0;

  /* -------------------- Header (same style as record-of-supply) -------------------- */

  // Top accent line
  doc.setFillColor(GREEN.r, GREEN.g, GREEN.b);
  doc.rect(0, 0, pageWidth, 4, "F");

  const headerTopY = 40;

  const { brandName, logoDataUrl } = await getPdfBranding();

  // Logo (if present)
  if (logoDataUrl) {
    try {
      doc.addImage(
        logoDataUrl,
        undefined as any,
        margin,
        headerTopY - 18,
        48,
        18
      );
    } catch {}
  }



  doc.setFontSize(20);
  doc.setTextColor(GREEN.r, GREEN.g, GREEN.b);
  doc.text("INVOICE", margin, headerTopY + 28);

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  const metaLine = `Invoice No: #${ref} | VAT No: ${vatNumber} | Date: ${dateLabel}`;
  doc.text(metaLine, margin, headerTopY + 42);

  doc.setDrawColor(GREEN.r, GREEN.g, GREEN.b);
  doc.setLineWidth(0.8);
  doc.line(margin, headerTopY + 48, pageWidth - margin, headerTopY + 48);

  /* -------------------- From / Bill To cards -------------------- */

  const cardsTop = headerTopY + 60;
  const cardWidth = (contentWidth - 20) / 2;
  const cardHeight = 150;
  const leftCardX = margin;
  const rightCardX = margin + cardWidth + 20;

  const lightBorder = { r: 211, g: 214, b: 219 };
  const headerFill = { r: 241, g: 250, b: 245 };
  const headerGreen = GREEN;

  const drawCard = (x: number, title: string) => {
    doc.setDrawColor(lightBorder.r, lightBorder.g, lightBorder.b);
    doc.setLineWidth(0.8);
    doc.roundedRect(x, cardsTop, cardWidth, cardHeight, 6, 6, "S");

    doc.setFillColor(headerFill.r, headerFill.g, headerFill.b);
    doc.roundedRect(x, cardsTop, cardWidth, 22, 6, 6, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(headerGreen.r, headerGreen.g, headerGreen.b);
    doc.text(title, x + 10, cardsTop + 15);
  };

  drawCard(leftCardX, "From");
  drawCard(rightCardX, "Bill To");

  // From content
  let y = cardsTop + 38;
  const labelXLeft = leftCardX + 12;
  const valueXLeft = leftCardX + 80;

  doc.setFontSize(10);
  doc.setTextColor(34, 34, 34);

  const putRowLeft = (label: string, value: string | string[]) => {
    const v =
      Array.isArray(value) && value.length > 0 ? value.join("\n") : value;
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, labelXLeft, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(String(v || ""), cardWidth - 90);
    doc.text(lines, valueXLeft, y);
    y += lineHeight * Math.max(1, lines.length);
  };

  const pharmacy = await getPharmacyDetails();

  putRowLeft("Name:", pharmacy.name || "—");

  // Address lines (if missing, show —)
  putRowLeft(
    "Address:",
    pharmacy.addressLines?.length ? pharmacy.addressLines : "—"
  );

  if (pharmacy.phone) putRowLeft("Tel:", pharmacy.phone);
  if (pharmacy.email) putRowLeft("Email:", pharmacy.email);

  // Bill To content
  let yRight = cardsTop + 38;
  const labelXRight = rightCardX + 12;
  const valueXRight = rightCardX + 80;

  const putRowRight = (label: string, value: string | string[]) => {
    const v =
      Array.isArray(value) && value.length > 0 ? value.join("\n") : value;
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, labelXRight, yRight);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(String(v || ""), cardWidth - 90);
    doc.text(lines, valueXRight, yRight);
    yRight += lineHeight * Math.max(1, lines.length);
  };

  putRowRight("Patient", patientName || "—");
  if (patientDob) putRowRight("DOB", patientDob);
  if (patientAddress) putRowRight("Address", patientAddress);
  const contactLine = [patientEmail, patientPhone].filter(Boolean).join(" | ");
  if (contactLine) putRowRight("Contact", contactLine);

  /* -------------------- Invoice Details table -------------------- */

  const detailsTop = cardsTop + cardHeight + 28;

  doc.setFillColor(headerFill.r, headerFill.g, headerFill.b);
  doc.setDrawColor(lightBorder.r, lightBorder.g, lightBorder.b);
  doc.rect(margin, detailsTop, contentWidth, 22, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(headerGreen.r, headerGreen.g, headerGreen.b);
  doc.text("Invoice Details", margin + 8, detailsTop + 14);

  const tableTop = detailsTop + 24;
  const rowHeightHeader = 22;
  const rowHeight = 22;

  const descX = margin + 10;
  const qtyX = margin + contentWidth * 0.6;
  const unitX = margin + contentWidth * 0.75;
  const netX = margin + contentWidth * 0.9;

  doc.setFillColor(247, 249, 252);
  doc.setDrawColor(lightBorder.r, lightBorder.g, lightBorder.b);
  doc.rect(margin, tableTop, contentWidth, rowHeightHeader, "FD");

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  const headerY = tableTop + 14;
  doc.text("Description", descX, headerY);
  doc.text("Qty", qtyX, headerY, { align: "right" });
  doc.text("Unit Price", unitX, headerY, { align: "right" });
  doc.text("Net", netX, headerY, { align: "right" });

  let currentY = tableTop + rowHeightHeader;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(34, 34, 34);

  const drawItemRow = (
    desc: string,
    qty: number,
    unitMinor: number,
    totalMinorLine: number
  ) => {
    doc.setDrawColor(lightBorder.r, lightBorder.g, lightBorder.b);
    doc.rect(margin, currentY, contentWidth, rowHeight, "S");

    const descLines = doc.splitTextToSize(desc, qtyX - descX - 10);
    const lineY = currentY + 14;

    doc.text(descLines, descX, lineY);
    doc.text(String(qty), qtyX, lineY, { align: "right" });
    doc.text(formatMinorGBP(unitMinor), unitX, lineY, { align: "right" });
    doc.text(formatMinorGBP(totalMinorLine), netX, lineY, { align: "right" });

    currentY += rowHeight;
  };

  if (!items.length) {
    drawItemRow(
      consult?.serviceName || order.service_name || "Service",
      1,
      totalMinor,
      totalMinor
    );
  } else {
    items.forEach((it) => {
      const name = String(it.name || order.service_name || "Item");
      const variation = it.variation || it.variations || "";
      const fullDesc = variation ? `${name} | ${variation}` : name;

      const qty = Number(it.qty || 1);
      const unitMinor = Number(it.unitMinor || it.unit_minor || totalMinor);
      const lineTotalMinor = Number(it.totalMinor || unitMinor * qty);

      drawItemRow(fullDesc, qty, unitMinor, lineTotalMinor);
    });
  }

  // total row
  currentY += 2;
  doc.setDrawColor(lightBorder.r, lightBorder.g, lightBorder.b);
  doc.rect(margin, currentY, contentWidth, rowHeight, "S");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  const totalLabelY = currentY + 14;
  doc.text("Total incl. VAT", unitX, totalLabelY, { align: "right" });
  doc.text(formatMinorGBP(totalMinor), netX, totalLabelY, { align: "right" });

  /* -------------------- Payment Information -------------------- */

  const paymentTop = currentY + rowHeight + 26;

  const paymentStatusRaw =
    (order as any).payment_status ||
    (order.meta as any)?.payment_status ||
    order.status;
  const paymentStatus = (paymentStatusRaw || "PAID").toString().toUpperCase();

  doc.setFillColor(headerFill.r, headerFill.g, headerFill.b);
  doc.setDrawColor(lightBorder.r, lightBorder.g, lightBorder.b);
  doc.rect(margin, paymentTop, contentWidth, 22, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(headerGreen.r, headerGreen.g, headerGreen.b);
  doc.text("Payment Information", margin + 8, paymentTop + 14);

  const paymentBodyTop = paymentTop + 24;
  doc.setDrawColor(lightBorder.r, lightBorder.g, lightBorder.b);
  doc.rect(margin, paymentBodyTop, contentWidth, 26, "S");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(34, 34, 34);
  const paymentLine = `Status: ${paymentStatus}  |  Date: ${dateLabel}`;
  doc.text(paymentLine, margin + 10, paymentBodyTop + 17);

  /* -------------------- Footer -------------------- */

  const footerY = pageHeight - 32;
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Thank you for choosing ${brandName}.`, margin, footerY);

  const blob = doc.output("blob");
  const fileName = `${ref}-invoice.pdf`;

  let file: File;
  try {
    file = new File([blob], fileName, { type: "application/pdf" });
  } catch {
    throw new Error("File constructor not available for PDF attachment");
  }
  return file;
}

async function sendConsultationSummaryEmail(
  order: OrderDto,
  record: any,
  consult: ConsultPatientLS | null
) {
  const email =
    consult?.patient?.email || order.email || consult?.patient?.name || "";
  if (!email || !email.includes("@")) {
    console.warn("No valid patient email for consultation summary", {
      order,
      consult,
    });
    return;
  }

  const patientName =
    consult?.patient?.name || getDisplayPatientName(order) || "Customer";

  const appointmentAt =
    consult?.appointmentAt ||
    order.meta?.appointment_start_at ||
    order.start_at ||
    null;

  const loginUrl =
    process.env.NEXT_PUBLIC_LOGIN_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://safescript.co.uk";
  const supportEmail =
    process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@safescript.co.uk";

  let recordPdf: File | null = null;
  let invoicePdf: File | null = null;

  try {
    recordPdf = await generateRecordOfSupplyPdf(order, record, consult);
  } catch (err) {
    console.error("Failed to generate Record of Supply PDF", err);
  }

  try {
    invoicePdf = await generateInvoicePdfFromOrder(order, consult);
  } catch (err) {
    console.error("Failed to generate Invoice PDF", err);
  }

  const attachments: File[] = [];
  if (recordPdf) attachments.push(recordPdf);
  if (invoicePdf) attachments.push(invoicePdf);

  const subject = `Consultation summary - Ref ${order.reference}`;

  await sendEmailApi({
    to: email,
    subject,
    template: "consultationcompleted", // adjust to match your backend template name
    context: {
      name: patientName,
      email,
      reference: order.reference,
      serviceName: consult?.serviceName || order.service_name,
      appointmentAt,
      loginUrl,
      supportEmail,
      year: new Date().getFullYear().toString(),
    },
    attachments: attachments.length ? attachments : undefined,
  });
}

/* ----------------- Page ----------------- */

export default function ConsultationPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const orderId = searchParams.get("order_id") || "";
  const serviceIdFromQuery = searchParams.get("service_id") || "";

  const [order, setOrder] = useState<OrderDto | null>(null);
  const [serviceId, setServiceId] = useState<string>(serviceIdFromQuery);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("risk");

  const [endSaving, setEndSaving] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);
  const [endSuccess, setEndSuccess] = useState<string | null>(null);

  // Load order
  useEffect(() => {
    if (!orderId) {
      setError("Missing order_id in URL");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const o = await getOrderByIdApi(orderId);
        if (cancelled) return;
        setOrder(o);

        if (!serviceId && o.service_id) {
          setServiceId(o.service_id);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Failed to load order");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const baseStorageKey = useCallback(
    () => (order ? `consultation_${order._id}` : ""),
    [order]
  );

  // End consultation: gather all data from localStorage & send to backend + email
  async function handleEndConsultation() {
    if (!order) return;
    const baseKey = baseStorageKey();
    if (!baseKey) return;

    setEndSaving(true);
    setEndError(null);
    setEndSuccess(null);

    try {
      const readJson = (suffix: string) => {
        if (typeof window === "undefined") return null;
        const raw = window.localStorage.getItem(`${baseKey}_${suffix}`);
        if (!raw) return null;
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      };

      const risk = readJson("risk") as RiskAnswerLS[] | null;
      const advice = readJson("advice");
      const declaration = readJson("declaration");
      const record = readJson("record");

      // Start from existing meta
      const updatedMeta: any = { ...(order.meta || {}) };

      // -------- RISK ----------
      if (risk && Array.isArray(risk) && risk.length) {
        if (!updatedMeta.formsQA) updatedMeta.formsQA = {};

        const existingRaf: any = updatedMeta.formsQA.raf || {};
        const existingQa: any[] = Array.isArray(existingRaf.qa)
          ? [...existingRaf.qa]
          : [];

        const byKey: Record<string, any> = {};
        for (const q of existingQa) {
          if (!q || !q.key) continue;
          byKey[q.key] = q;
        }

        for (const ans of risk) {
          if (!ans || !ans.key) continue;
          const existing = byKey[ans.key];

          let valueStr = "";
          let raw: any;

          if (Array.isArray(ans.value)) {
            const arr = ans.value
              .map((v: any) => String(v).trim())
              .filter(Boolean);
            valueStr = arr.join(", ");
            raw = arr;
          } else if (typeof ans.value === "string") {
            valueStr = ans.value;
            if (valueStr.includes(",")) {
              const arr = valueStr
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              raw = arr;
            } else {
              raw = valueStr;
            }
          } else if (ans.value != null) {
            valueStr = String(ans.value);
            raw = valueStr;
          } else {
            valueStr = "";
            raw = "";
          }

          if (existing) {
            existing.question = ans.question || existing.question || ans.key;
            existing.answer = valueStr;

            if (Array.isArray(existing.raw)) {
              if (Array.isArray(raw)) {
                existing.raw = raw;
              } else if (valueStr) {
                existing.raw = [valueStr];
              } else {
                existing.raw = [];
              }
            } else {
              existing.raw = raw;
            }
          } else {
            existingQa.push({
              key: ans.key,
              question: ans.question || ans.key,
              answer: valueStr,
              raw,
            });
          }
        }

        existingRaf.qa = existingQa;

        if (!existingRaf.form_id) {
          existingRaf.form_id =
            existingRaf.formId ||
            updatedMeta.formsQA?.raf?.form_id ||
            updatedMeta.formsQA?.raf?.formId ||
            (order.meta as any)?.formsQA?.raf?.form_id ||
            null;
        }

        updatedMeta.formsQA.raf = existingRaf;
        updatedMeta.riskAssessment = risk;
      }

      // -------- Advice ----------
      if (advice) {
        updatedMeta.pharmacistAdvice = advice;
      }

      // -------- Declaration ----------
      if (declaration) {
        updatedMeta.pharmacistDeclaration = {
          ...(declaration || {}),
          saved_at: new Date().toISOString(),
        };
      }

      // -------- Record of supply ----------
      if (record) {
        updatedMeta.recordOfSupply = record;
      }

      // include completed_at with current time
      const payload: any = {
        status: "completed",
        completed_at: new Date().toISOString(),
        meta: updatedMeta,
      };

      const updatedOrder = await updateOrderStatusApi(order._id, payload);
      setOrder(updatedOrder);

      // Email: consultation summary + PDFs
      const consultPatient = readCurrentConsultPatient();
      try {
        await sendConsultationSummaryEmail(
          updatedOrder,
          record,
          consultPatient
        );
      } catch (err) {
        console.error("Failed to send consultation summary email", err);
      }

      // Clear localStorage for this consultation + everything except auth
      if (typeof window !== "undefined") {
        ["risk", "advice", "declaration", "record"].forEach((suffix) => {
          window.localStorage.removeItem(`${baseKey}_${suffix}`);
        });
        window.localStorage.removeItem("current_consult_patient");
        clearNonAuthLocalStorage(); // keeps session_token + user
      }

      setEndSuccess(
        "Consultation data saved, order marked as completed and email sent to patient."
      );

      router.push("/dashboard/approved-orders");
    } catch (e: any) {
      setEndError(e?.message || "Failed to end consultation");
    } finally {
      setEndSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 flex items-center justify-center text-neutral-300">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading consultation…
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="mb-4 inline-flex items-center gap-2 text-sm text-neutral-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-100 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>{error || "Order not found"}</span>
        </div>
      </div>
    );
  }

  const patientName = getDisplayPatientName(order);

  // For Next / Prev buttons
  const currentIndex = TABS.findIndex((t) => t.key === activeTab);
  const prevTab = currentIndex > 0 ? TABS[currentIndex - 1] : null;
  const nextTab =
    currentIndex >= 0 && currentIndex < TABS.length - 1
      ? TABS[currentIndex + 1]
      : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 px-2.5 py-1 text-xs text-neutral-300 hover:border-emerald-500 hover:text-emerald-300"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-white flex items-center gap-2">
              Consultation
              {order.status === "completed" && (
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              )}
            </h1>
            <p className="text-xs text-neutral-400">
              Ref:{" "}
              <span className="font-mono text-neutral-100">
                {order.reference}
              </span>{" "}
              • {order.service_name} • {patientName}
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-neutral-400">
          <p>
            Appointment:{" "}
            <span className="text-neutral-100">
              {formatDateTime(
                order.meta?.appointment_start_at || order.start_at
              )}
            </span>
          </p>
          <p>
            Status:{" "}
            <span className="uppercase font-semibold text-emerald-300">
              {order.status}
            </span>
          </p>
        </div>
      </div>

      {/* Tabs header */}
      <div className="flex flex-wrap gap-2 border-b border-neutral-800 pb-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                isActive
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                  : "border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-emerald-500/60 hover:text-emerald-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
        {activeTab === "risk" && <RiskAssessmentTab order={order} />}

        {activeTab === "advice" && (
          <PharmacistAdviceTab orderId={order._id} serviceId={serviceId} />
        )}

        {activeTab === "declaration" && (
          <PharmacistDeclarationTab orderId={order._id} serviceId={serviceId} />
        )}

        {activeTab === "record" && (
          <RecordOfSupplyTab orderId={order._id} serviceId={serviceId} />
        )}
      </div>

      {/* Bottom navigation + End consultation */}
      <div className="border-t border-neutral-800 pt-3 space-y-3">
        {/* Next / Previous buttons */}
        <div className="flex flex-col sm:flex-row justify-between gap-2">
          <button
            type="button"
            disabled={!prevTab}
            onClick={() => prevTab && setActiveTab(prevTab.key)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium ${
              prevTab
                ? "border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-emerald-500 hover:text-emerald-200"
                : "border-neutral-800 bg-neutral-950 text-neutral-500 cursor-not-allowed opacity-60"
            }`}
          >
            <ArrowLeft className="h-3 w-3" />
            {prevTab ? `Previous: ${prevTab.label}` : "Previous"}
          </button>

          <button
            type="button"
            disabled={!nextTab}
            onClick={() => nextTab && setActiveTab(nextTab.key)}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold ${
              nextTab
                ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                : "border-neutral-800 bg-neutral-950 text-neutral-500 cursor-not-allowed opacity-60"
            }`}
          >
            {nextTab ? `Next: ${nextTab.label}` : "Next"}
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>

        {/* End consultation area – ONLY on Record of Supply tab */}
        {activeTab === "record" && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="text-xs text-neutral-500">
              When you click{" "}
              <span className="text-neutral-200 font-semibold">
                End consultation
              </span>
              , all tab data will be saved into the order meta, the patient will
              receive a summary email with PDFs attached, and local consultation
              data will be cleared.
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              {endError && (
                <div className="text-xs text-rose-300 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {endError}
                </div>
              )}
              {endSuccess && (
                <div className="text-xs text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {endSuccess}
                </div>
              )}
              <button
                type="button"
                onClick={handleEndConsultation}
                disabled={endSaving}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-500/70 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {endSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                {endSaving ? "Saving & ending…" : "End consultation"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
