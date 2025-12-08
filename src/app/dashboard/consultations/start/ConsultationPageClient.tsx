"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getOrderByIdApi,
  updateOrderStatusApi,
  sendEmailApi,
  type OrderDto,
} from "../../../../api";
import {
  Loader2,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import jsPDF from "jspdf";

import RecordOfSupplyTab from "./RecordOfSupplyTab";
import RiskAssessmentTab from "./RiskAssessmentTab";
import PharmacistAdviceTab from "./PharmacistAdviceTab";
import PharmacistDeclarationTab from "./PharmacistDeclarationTab";

type TabKey = "risk" | "advice" | "declaration" | "record";

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

  // accent
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageWidth, 6, "F");

  const headerTopY = 36;
  const patientName = consult?.patient?.name || getDisplayPatientName(order);
  const patientEmail = consult?.patient?.email || order.email || "";
  const patientPhone = consult?.patient?.phone || "";
  const appointmentAt =
    consult?.appointmentAt ||
    order.meta?.appointment_start_at ||
    order.start_at ||
    null;

  // brand
  doc.setFontSize(20);
  doc.setTextColor(16, 185, 129);
  doc.text("Pharmacy Express", margin, headerTopY);

  doc.setFontSize(26);
  doc.setTextColor(15, 23, 42);
  doc.text("Record of Supply", pageWidth - margin, headerTopY, {
    align: "right",
  });

  let y = headerTopY + 26;
  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);
  doc.text(`Patient: ${patientName}`, margin, y);
  y += lineHeight;
  if (patientEmail) {
    doc.text(`Email: ${patientEmail}`, margin, y);
    y += lineHeight;
  }
  if (patientPhone) {
    doc.text(`Phone: ${patientPhone}`, margin, y);
    y += lineHeight;
  }
  if (appointmentAt) {
    doc.text(
      `Consultation: ${formatDateTime(appointmentAt)}`,
      margin,
      y
    );
    y += lineHeight;
  }
  const todayLabel = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  doc.text(`Generated: ${todayLabel}`, margin, y);
  y += lineHeight;
  if (order.reference) {
    doc.text(`Reference: ${order.reference}`, margin, y);
    y += lineHeight;
  }

  y += lineHeight;

  // section title
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Record of supply details", margin, y);
  y += lineHeight;

  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);

  // 🔹 NEW: use record.fields if present, otherwise fall back to record
  const fieldsObj: any =
    record && typeof record === "object" && (record as any).fields
      ? (record as any).fields
      : record;

  if (!fieldsObj || typeof fieldsObj !== "object") {
    doc.text("No record of supply data captured.", margin, y);
  } else {
    const entries = Object.entries(fieldsObj as Record<string, any>);

    if (!entries.length) {
      doc.text("No record of supply data captured.", margin, y);
    } else {
      entries.forEach(([key, value]) => {
        if (y > pageHeight - margin - 40) {
          doc.addPage();
          y = margin;
        }

        // Use the key as label (your localStorage now stores label → value,
        // but this also works if the key is still text_xxx)
        const label = String(key);

        let valStr: string;
        if (Array.isArray(value)) valStr = value.join(", ");
        else if (value == null) valStr = "—";
        else if (typeof value === "object") valStr = JSON.stringify(value);
        else valStr = String(value);

        const labelX = margin;
        const valueX = margin + 110;

        // Render like a bullet list: "Label: value"
        doc.text(`• ${label}:`, labelX, y);
        const wrapped = doc.splitTextToSize(valStr, contentWidth - 120);
        doc.text(wrapped, valueX, y);
        y += lineHeight * Math.max(1, wrapped.length);
      });
    }
  }

  // footer
  const footerY = pageHeight - 40;
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text(
    "This record of supply was generated from your consultation at Pharmacy Express.",
    margin,
    footerY,
    { maxWidth: contentWidth }
  );

  const blob = doc.output("blob");
  const fileName = `record-of-supply-${order.reference || order._id}.pdf`;

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

  const ref = order.reference;
  const dateLabel = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const patientName = consult?.patient?.name || getDisplayPatientName(order);
  const patientEmail = consult?.patient?.email || order.email || "";
  const serviceName = consult?.serviceName || order.service_name;

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
  const totalMinor = subtotalMinor;

  // accent
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageWidth, 6, "F");

  const headerTopY = 36;

  doc.setFontSize(22);
  doc.setTextColor(16, 185, 129);
  doc.text("Pharmacy Express", margin, headerTopY);

  doc.setFontSize(26);
  doc.setTextColor(15, 23, 42);
  doc.text("Invoice", pageWidth - margin, headerTopY, {
    align: "right",
  });

  let y = headerTopY + 24;
  doc.setFontSize(11);
  doc.setTextColor(31, 41, 55);

  doc.text(`Invoice # ${ref}`, margin, y);
  y += lineHeight;
  doc.text(`Invoice date: ${dateLabel}`, margin, y);
  y += lineHeight;
  doc.text(`Service: ${serviceName}`, margin, y);
  y += lineHeight * 2;

  // Bill to
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Bill to", margin, y);
  y += lineHeight;
  doc.setTextColor(31, 41, 55);
  doc.text(patientName, margin, y);
  y += lineHeight;
  if (patientEmail) {
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(patientEmail, margin, y);
    y += lineHeight;
  }
  y += lineHeight;

  // Table headers
  const headerY = y;
  const tableHeight = 22;

  const descX = margin + 10;
  const qtyX = margin + contentWidth * 0.55;
  const unitX = margin + contentWidth * 0.7;
  const amountX = margin + contentWidth * 0.85;

  doc.setFillColor(243, 244, 246);
  doc.rect(
    margin,
    headerY - tableHeight + 6,
    contentWidth,
    tableHeight,
    "F"
  );

  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text("Description", descX, headerY);
  doc.text("Qty", qtyX, headerY);
  doc.text("Unit", unitX, headerY);
  doc.text("Amount", amountX, headerY);

  y += 14;
  doc.setFontSize(10);
  doc.setTextColor(31, 41, 55);

  if (!items.length) {
    doc.text(serviceName || "Service", descX, y);
    doc.text("1", qtyX, y);
    doc.text(formatMinorGBP(totalMinor), unitX, y);
    doc.text(formatMinorGBP(totalMinor), amountX, y);
    y += lineHeight;
  } else {
    items.forEach((it) => {
      if (y > pageHeight - margin - 80) {
        doc.addPage();
        y = margin;
      }
      const name = String(it.name || "Item");
      const variation = it.variation || it.variations || "";
      const fullDesc = variation ? `${name} – ${variation}` : name;

      const wrapped = doc.splitTextToSize(fullDesc, qtyX - descX - 12);
      doc.text(wrapped, descX, y);
      doc.text(String(it.qty || 1), qtyX, y);
      doc.text(formatMinorGBP(it.unitMinor), unitX, y);
      doc.text(formatMinorGBP(it.totalMinor), amountX, y);

      y += lineHeight * Math.max(1, wrapped.length);
    });
  }

  // line
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, y, pageWidth - margin, y);
  y += lineHeight;

  // totals
  const totalsX = margin + contentWidth * 0.55;
  const labelX = totalsX + contentWidth * 0.25;
  const valueX = pageWidth - margin;

  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);

  doc.text("Subtotal", labelX, y, { align: "right" });
  doc.text(formatMinorGBP(subtotalMinor), valueX, y, { align: "right" });
  y += lineHeight;

  const taxMinor = 0;
  const shippingMinor = 0;

  doc.text("Sales tax", labelX, y, { align: "right" });
  doc.text(formatMinorGBP(taxMinor), valueX, y, { align: "right" });
  y += lineHeight;

  doc.text("Shipping", labelX, y, { align: "right" });
  doc.text(formatMinorGBP(shippingMinor), valueX, y, { align: "right" });
  y += lineHeight + 4;

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Total", labelX, y, { align: "right" });
  doc.setFontSize(12);
  doc.text(formatMinorGBP(totalMinor), valueX, y, { align: "right" });

  const footerY = pageHeight - 40;
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text(
    "Thank you for choosing Pharmacy Express. For questions, please contact support@safescript.co.uk",
    margin,
    footerY,
    { maxWidth: contentWidth }
  );

  const blob = doc.output("blob");
  const fileName = `invoice-${ref || order._id}.pdf`;

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
    template: "consultationcompleted", // 🔁 adjust to match your backend template name
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

      // ✅ include completed_at with current time
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
        {[
          { key: "risk" as TabKey, label: "Risk Assessment" },
          { key: "advice" as TabKey, label: "Pharmacist’s Advice" },
          {
            key: "declaration" as TabKey,
            label: "Pharmacist Declaration",
          },
          { key: "record" as TabKey, label: "Record of Supply" },
        ].map((tab) => {
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
          <PharmacistDeclarationTab
            orderId={order._id}
            serviceId={serviceId}
          />
        )}

        {activeTab === "record" && (
          <RecordOfSupplyTab orderId={order._id} serviceId={serviceId} />
        )}
      </div>

      {/* End consultation area – ONLY on Record of Supply tab */}
      {activeTab === "record" && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-t border-neutral-800 pt-3">
          <div className="text-xs text-neutral-500">
            When you click{" "}
            <span className="text-neutral-200 font-semibold">
              End consultation
            </span>
            , all tab data will be saved into the order meta, the patient
            will receive a summary email with PDFs attached, and local
            consultation data will be cleared.
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
              {endSaving && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              {endSaving ? "Saving & ending…" : "End consultation"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
