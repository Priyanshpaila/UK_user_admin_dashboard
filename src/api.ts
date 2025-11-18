// src/api.ts

const ENV_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || ""; // e.g. http://192.168.13.75:8000/api
const ENV_BASE_ONLY_URL = process.env.NEXT_PUBLIC_ONLY_URL || ""; // e.g. 192.168.13.75:8000/api

// Helper function to check if the host is an IP
const isIp = (host: string) => /^\d+\.\d+\.\d+\.\d+$/.test(host);

// Helper function to strip protocol (e.g., http:// or https://)
const stripProtocol = (url: string) => url.replace(/^https?:\/\//, "");

// Function to get the backend base URL
export function getBackendBase(): string {
  if (typeof window === "undefined") {
    // SSR safety fallback
    return ENV_BASE_URL || "http://localhost:8000/api";
  }

  const { protocol, hostname } = window.location;

  // Split hostname to check for subdomain (e.g., xyz.mydomain.com)
  const parts = hostname.split(".");

  // Check if there is a subdomain (at least 3 parts: subdomain.domain.tld)
  const hasSubdomain = parts.length >= 2;

  if (!hasSubdomain) {
    // If there's no subdomain, fall back to NEXT_PUBLIC_BASE_URL or localhost
    return resolveBaseForNoSubdomain(protocol);
  }

  // Subdomain case: xyz.mydomain.com -> xyz
  const subdomain = parts[0].toLowerCase();

  // Get the base URL from the environment variable (NEXT_PUBLIC_ONLY_URL) or fallback
  const baseOnly = stripProtocol(ENV_BASE_ONLY_URL || "localhost:8000/api"); // safe fallback

  return `${protocol}//${subdomain}.${baseOnly}`;
}

// Function to handle base URL when there is no subdomain
function resolveBaseForNoSubdomain(protocol: string): string {
  if (ENV_BASE_URL) {
    // Already a full URL like http://192.168.13.75:8000/api
    return ENV_BASE_URL;
  }

  if (ENV_BASE_ONLY_URL) {
    // If someone misconfigured and only gave ONLY_URL, still try to use it
    return `${protocol}//${stripProtocol(ENV_BASE_ONLY_URL)}`;
  }

  // Default fallback (shouldn't be hit in production)
  return `${protocol}//localhost:8000/api`;
}

/**
 * Base URL for "master" backend (used for dns/subdomain creation).
 * This should ALWAYS be without tenant subdomain.
 * So we just use NEXT_PUBLIC_BASE_URL.
 */
export function getMasterBase(): string {
  return ENV_BASE_URL || "http://localhost:8000/api";
}

/* ------------------- Generic helper ------------------- */

async function jsonFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return res.json();
}

/* ------------------- Auth APIs ------------------- */

export async function loginApi(email: string, password: string) {
  const base = getBackendBase(); // Get the correct backend base URL dynamically
  return jsonFetch<{
    session_token: string;
    user: any;
  }>(`${base}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

/* ------------------- Services APIs ------------------- */

export type ServicePayload = {
  name: string;
  slug: string;
  description: string;
  booking_flow: Record<string, string | null>;
  reorder_flow: Record<string, string | null>;
  forms_assignment: Record<string, unknown>;
  status: string;
  active: boolean;
  view_type: string;
  cta_text: string;
  image: string | null;
};

export async function createServiceApi(payload: ServicePayload) {
  const base = getBackendBase();
  return jsonFetch<any>(`${base}/services`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getServiceApi(id: string | string[]) {
  const base = getBackendBase(); // Get the backend base URL dynamically based on subdomain
  const url = `${base}/services/${id}`;

  // Fetch the service data from the dynamic URL
  return jsonFetch<any>(url);
}

export async function updateServiceApi(
  id: string | string[],
  payload: ServicePayload
) {
  const base = getBackendBase();
  return jsonFetch<any>(`${base}/services/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/* ------------------- Tenant APIs ------------------- */

export async function createSubdomainApi(subdomain: string, ttl = 600) {
  const base = getMasterBase(); // master backend, no tenant subdomain
  return jsonFetch<any>(`${base}/dns/subdomain`, {
    method: "POST",
    body: JSON.stringify({ subdomain, ttl }),
  });
}

export type PharmacistPayload = {
  firstName: string;
  lastName: string;
  gender: string;
  email: string;
  phone: string;
  password: string;
};

export async function createPharmacistApi(
  subdomain: string,
  payload: PharmacistPayload
) {
  const protocol =
    typeof window !== "undefined" ? window.location.protocol : "http:";

  const baseOnly = stripProtocol(ENV_BASE_ONLY_URL || "192.168.13.75:8000/api");

  // Always use tenant backend: http(s)://subdomain.NEXT_PUBLIC_ONLY_URL
  // Example: http://xyz.192.168.13.75:8000/api
  const base = `${protocol}//${subdomain}.${baseOnly}`;

  return jsonFetch<any>(`${base}/users/createPharmacist`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ------------------- Medicines APIs ------------------- */

export type MedicinePayload = {
  sku: string;
  name: string;
  variations: string;
  strength?: string | null;
  qty: number;
  unitMinor: number;
  totalMinor: number;
  variation: string;
  price: number;
  image_path?: string | File;
  description?: string;
  status: string;
};

// Helper just for FormData requests (no JSON Content-Type)
async function formDataRequest<T>(
  url: string,
  method: "POST" | "PUT",
  payload: MedicinePayload
): Promise<T> {
  const formData = new FormData();

  formData.append("sku", payload.sku);
  formData.append("name", payload.name);
  formData.append("variations", payload.variations);
  formData.append("variation", payload.variation);
  formData.append("qty", String(payload.qty));
  formData.append("unitMinor", String(payload.unitMinor));
  formData.append("totalMinor", String(payload.totalMinor));
  formData.append("price", String(payload.price));
  formData.append("status", payload.status);

  if (payload.strength != null) {
    formData.append("strength", payload.strength);
  }

  if (payload.description) {
    formData.append("description", payload.description);
  }

  if (payload.image_path) {
    if (payload.image_path instanceof File) {
      // file upload
      formData.append("image_path", payload.image_path);
    } else {
      // URL string
      formData.append("image_path", payload.image_path);
    }
  }

  const res = await fetch(url, {
    method,
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return res.json();
}

// GET /medicines  -> list of medicines
export async function getMedicinesApi() {
  const base = getBackendBase();
  // assuming response like { data: [...], meta: {...} }
  return jsonFetch<any>(`${base}/medicines`);
}

// POST /medicines  -> create medicine (FormData body)
export async function createMedicineApi(payload: MedicinePayload) {
  const base = getBackendBase();
  return formDataRequest<any>(`${base}/medicines`, "POST", payload);
}

// PUT /medicines/:id  -> update medicine (FormData body)
export async function updateMedicineApi(id: string, payload: MedicinePayload) {
  const base = getBackendBase();
  // if your backend expects /medicines?id=... instead, change URL here
  return formDataRequest<any>(`${base}/medicines/${id}`, "PUT", payload);
}

// api.ts
export type ServiceMedicinePayload = {
  service_id: string;
  medicine_id: string;
  active: boolean;
  sort_order: number;
  min_qty: number;
  max_qty: number;
};

export async function createServiceMedicineApi(
  payload: ServiceMedicinePayload
) {
  const base = getBackendBase();
  const res = await fetch(`${base}/service-medicines`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("Failed to link service & medicine:", txt);
    throw new Error("Failed to link service and medicine");
  }

  return res.json();
}
