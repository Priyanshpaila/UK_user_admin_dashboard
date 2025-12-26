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
  const parts = hostname.split(".");

  // Check if there is a subdomain (at least 3 parts: subdomain.domain.tld)
  // const hasSubdomain = parts.length >= 2; //for local host
  const hasSubdomain = parts.length >= 4; // for our live domain : adminukproject.rrispat.in

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

function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("session_token");
  } catch {
    return null;
  }
}

function toHeaders(init?: HeadersInit): Headers {
  const h = new Headers();
  if (!init) return h;

  // Normalize init into Headers
  if (init instanceof Headers) {
    init.forEach((v, k) => h.set(k, v));
  } else if (Array.isArray(init)) {
    init.forEach(([k, v]) => h.set(k, v));
  } else {
    Object.entries(init).forEach(([k, v]) => {
      if (typeof v !== "undefined") h.set(k, String(v));
    });
  }
  return h;
}

async function jsonFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = toHeaders(options.headers);

  // ✅ Always attach Bearer token when available (unless caller already set it)
  const token = getSessionToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // ✅ Default JSON headers unless body is FormData
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  if (!isFormData) {
    // Your preference: default JSON content-type
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }
  }

  const res = await fetch(url, { ...options, headers });

  // Try to read body safely once
  const text = await res.text().catch(() => "");

  if (!res.ok) {
    // Prefer backend JSON message if present
    try {
      const parsed = text ? JSON.parse(text) : null;
      const msg =
        parsed?.message ||
        parsed?.error ||
        parsed?.details ||
        (typeof parsed === "string" ? parsed : null);
      throw new Error(msg || text || `Request failed: ${res.status}`);
    } catch {
      throw new Error(text || `Request failed: ${res.status}`);
    }
  }

  // If empty body, return empty object as T
  if (!text) return {} as T;

  // Prefer JSON parse; otherwise return raw text
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
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
export type AppointmentMedium = "offline" | "online";

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
  service_type?: "private" | "nhs" | string;
  appointment_medium?: AppointmentMedium;
};

export async function createServiceApi(payload: ServicePayload) {
  const base = getBackendBase();

  const finalPayload = {
    ...payload,
    service_type: payload.service_type ?? "private",
    appointment_medium: payload.appointment_medium ?? "offline",
  };

  return jsonFetch<any>(`${base}/services`, {
    method: "POST",
    body: JSON.stringify(finalPayload),
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

  const finalPayload = {
    ...payload,
    service_type: payload.service_type ?? "private",
    appointment_medium: payload.appointment_medium ?? "offline",
  };

  return jsonFetch<any>(`${base}/services/${id}`, {
    method: "PUT",
    body: JSON.stringify(finalPayload),
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

/** One variation row on a medicine */
export type MedicineVariationPayload = {
  title: string;
  status: string; // e.g. "published" | "draft"
  price: number;
  stock: number;
  max_qty: number;
  sort_order: number;
};

export type MedicineVariationDto = {
  _id?: string;
  title: string;
  status: string;
  price: number;
  stock: number;
  max_qty: number;
  sort_order: number;
};

/** Payload used when creating/updating a medicine */
export type MedicinePayload = {
  sku: string;
  name: string;
  slug: string;
  description: string;
  status: string; // "draft" | "published" | etc.
  max_bookable_quantity?: number; // default 2
  allow_reorder?: boolean; // default true
  is_virtual?: boolean; // default false
  variations: MedicineVariationPayload[];
  image?: string | File; // file upload or existing path/URL
};

/** DTO for medicines returned by backend (e.g. /medicines) */
export type MedicineDto = {
  _id: string;
  sku: string;
  name: string;
  slug: string;
  description?: string;
  status: string;
  max_bookable_quantity: number;
  allow_reorder: boolean;
  is_virtual: boolean;
  variations: MedicineVariationDto[];
  image?: string;
  deleted_at?: string | null;
  createdAt: string;
  updatedAt: string;
  __v: number;
};

/**
 * Helper just for FormData requests (no JSON Content-Type).
 * Includes Bearer token by default.
 */
// in src/api.ts
async function formDataRequest<T>(
  url: string,
  method: "POST" | "PUT",
  payload: MedicinePayload
): Promise<T> {
  const formData = new FormData();

  formData.append("sku", payload.sku);
  formData.append("name", payload.name);
  formData.append("slug", payload.slug);
  formData.append("description", payload.description ?? "");
  formData.append("status", payload.status ?? "draft");

  formData.append(
    "max_bookable_quantity",
    String(payload.max_bookable_quantity ?? 2)
  );
  formData.append("allow_reorder", String(payload.allow_reorder ?? true));
  formData.append("is_virtual", String(payload.is_virtual ?? false));

  // ✅ send JSON string
  formData.append("variations", JSON.stringify(payload.variations ?? []));

  if (payload.image) {
    if (payload.image instanceof File) {
      formData.append("image", payload.image);
    } else {
      formData.append("image", payload.image);
    }
  }

  let headers: HeadersInit | undefined;
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("session_token");
    if (token) headers = { Authorization: `Bearer ${token}` };
  }

  const res = await fetch(url, { method, body: formData, headers });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }

  return res.json();
}

// GET /medicines  -> list of medicines
export async function getMedicinesApi() {
  const base = getBackendBase();
  const url = `${base}/medicines`;

  let headers: HeadersInit = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("session_token");
    if (token) {
      headers = {
        ...headers,
        Authorization: `Bearer ${token}`,
      };
    }
  }

  // jsonFetch will add "Content-Type: application/json" (OK for GET)
  return jsonFetch<any>(url, { headers });
}

// POST /medicines  -> create medicine (FormData body)
export async function createMedicineApi(payload: MedicinePayload) {
  const base = getBackendBase();
  return formDataRequest<any>(`${base}/medicines`, "POST", payload);
}

// PUT /medicines/:id  -> update medicine (FormData body)
export async function updateMedicineApi(id: string, payload: MedicinePayload) {
  const base = getBackendBase();
  return formDataRequest<any>(`${base}/medicines/${id}`, "PUT", payload);
}

// GET /service-medicines/service/:service_id -> medicines linked to a service
export async function getServiceMedicinesByServiceApi(
  serviceId: string
): Promise<MedicineDto[]> {
  const base = getBackendBase();
  const url = `${base}/service-medicines/service/${serviceId}`;
  return jsonFetch<MedicineDto[]>(url);
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

  let headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("session_token");
    if (token) {
      headers = {
        ...headers,
        Authorization: `Bearer ${token}`,
      };
    }
  }

  const res = await fetch(`${base}/service-medicines`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("Failed to link service & medicine:", txt);
    throw new Error("Failed to link service and medicine");
  }

  return res.json();
}

// DELETE /service-medicines/:id  -> remove service-medicine mapping by mapping id
export async function deleteServiceMedicineApi(linkId: string) {
  const base = getBackendBase();
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("session_token")
      : null;

  const res = await fetch(`${base}/service-medicines/${linkId}`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || "Failed to unlink medicine from service");
  }

  return res.json().catch(() => ({}));
}

/* ------------------- Patients APIs ------------------- */

// GET /users/patients -> List of patients
export async function getPatientsApi(page: number = 1, limit: number = 10) {
  const base = getBackendBase(); // Get the correct backend base URL dynamically
  const url = `${base}/users/patients?page=${page}&limit=${limit}`;

  // Get the token from local storage or a global auth state (use your own method of getting it)
  const token = localStorage.getItem("session_token"); // Adjust this based on your token storage method

  if (!token) {
    throw new Error("No authentication token found.");
  }

  return jsonFetch<any>(url, {
    headers: {
      Authorization: `Bearer ${token}`, // Add the Bearer token to the request
    },
  });
}

/* ------------------- Users APIs ------------------- */

export type UserDto = {
  _id: string;
  name?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  gender?: string;
  dob?: string;

  address_line1?: string;
  address_line2?: string;
  city?: string;
  county?: string;
  postalcode?: string;
  country?: string;

  // ✅ NEW: shipping address support
  use_shipping_address?: boolean;
  shipping_address_line1?: string;
  shipping_address_line2?: string;
  shipping_city?: string;
  shipping_postalcode?: string;
  shipping_country?: string;

  user_priority?: string;
  gphc_number?: string;
  signature_image?: string;
  [key: string]: any;
};

export type CreateUserPayload = {
  email: string;
  password: string;

  firstName: string;
  lastName: string;

  gender?: string;
  phone?: string;
  email_verified?: boolean;
  dob?: string; // "YYYY-MM-DD"

  address_line1?: string;
  address_line2?: string;
  city?: string;
  county?: string;
  postalcode?: string;
  country?: string;

  // ✅ NEW: shipping address support
  use_shipping_address?: boolean;
  shipping_address_line1?: string;
  shipping_address_line2?: string;
  shipping_city?: string;
  shipping_postalcode?: string;
  shipping_country?: string;

  is_patient?: boolean;

  [key: string]: any;
};

export async function getCurrentUserApi(): Promise<UserDto> {
  const base = getBackendBase();
  const url = `${base}/users/me`;

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("session_token")
      : null;

  if (!token) {
    throw new Error("No authentication token found.");
  }

  return jsonFetch<UserDto>(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getUserByIdApi(userId: string) {
  const base = getBackendBase();
  const url = `${base}/users/${userId}`;

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("session_token")
      : null;

  if (!token) {
    throw new Error("No authentication token found.");
  }

  return jsonFetch<UserDto>(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// JSON-based updater (keep for all places that don't send files)
export async function updateUserApi(userId: string, payload: any) {
  const base = getBackendBase();
  const url = `${base}/users/${userId}`;

  const token = localStorage.getItem("session_token");

  if (!token) {
    throw new Error("No authentication token found.");
  }

  return jsonFetch<any>(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

// ✅ NEW: multipart updater to send signature_image file
export async function updateUserWithFormDataApi(
  userId: string,
  payload: Record<string, any>,
  signatureFile?: File | null
) {
  const base = getBackendBase();
  const url = `${base}/users/${userId}`;

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("session_token")
      : null;

  if (!token) {
    throw new Error("No authentication token found.");
  }

  const fd = new FormData();

  // append primitive fields as strings
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    fd.append(key, String(value));
  });

  // append signature image if we have one
  if (signatureFile) {
    fd.append("signature_image", signatureFile); // 👈 field name required by backend
  }

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`, // DO NOT set Content-Type (browser will set boundary)
    },
    body: fd,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to update user: ${res.status}`);
  }

  return res.json();
}

// POST /users -> Create a new user (JSON)
export async function createUserApi(payload: CreateUserPayload) {
  const base = getBackendBase();
  const url = `${base}/users`;

  const token = localStorage.getItem("session_token");
  if (!token) throw new Error("No authentication token found.");

  return jsonFetch<any>(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

// Single weekday config
export type ScheduleWeekDay = {
  day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  open: boolean;
  start?: string; // "HH:MM" when open=true
  end?: string; // "HH:MM" when open=true
  break_start?: string; // NEW: "13:00"
  break_end?: string; // NEW: "14:00"
};

// Date override config
export type ScheduleOverride = {
  date: string; // "YYYY-MM-DD"
  open: boolean;
  start?: string; // "HH:MM" when open=true
  end?: string; // "HH:MM" when open=true
  note?: string; // optional note / reason

  // NEW: service-specific override
  service_slug?: string; // e.g. "travel-clinic"

  // NEW: specific times to remove from that date/service
  remove_times?: string[]; // e.g. ["10:00", "10:15"]
};

// Payload for POST /schedules
export type SchedulePayload = {
  name: string; // "Travel Clinic" or "Global"
  service_slug: string; // "travel-clinic" or "global"
  service_id?: string | null; // omit or null for Global schedule
  timezone: string; // e.g. "UTC" or "Europe/London"
  slot_minutes: number; // e.g. 15
  capacity: number; // e.g. 1
  week: ScheduleWeekDay[];
  overrides?: ScheduleOverride[];
};

// POST /schedules -> create schedule
export async function createScheduleApi(payload: SchedulePayload) {
  const base = getBackendBase();
  return jsonFetch<any>(`${base}/schedules`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// GET /schedules -> list schedules
export async function getSchedulesApi() {
  const base = getBackendBase();
  // if backend later returns { data, meta }, you can type it accordingly
  return jsonFetch<any>(`${base}/schedules`);
}

/** PUT /schedules/:id -> update an existing schedule */
export async function updateScheduleApi(id: string, payload: SchedulePayload) {
  const base = getBackendBase();
  return jsonFetch<any>(`${base}/schedules/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/* ------------------- Clinic Forms APIs ------------------- */

export type ClinicFormField = {
  type:
    | "section"
    | "text"
    | "email"
    | "number"
    | "textarea"
    | "date"
    | "select"
    | "radio"
    | "checkbox"
    | "file_upload"
    | "signature"
    | "text_block"
    | "divider"
    | "image"
    | "page_break"
    | string;
  data: any;
};

export type ClinicFormPayload = {
  name: string;
  description?: string;
  schema: ClinicFormField[];

  service_id: string;
  service_slug: string;
  treatment_slug?: string;

  version?: number;
  is_active?: boolean;

  raf_schema?: any[];
  raf_version?: number;
  raf_status?: string;

  form_type?: string; // e.g. "raf"
};

export async function createClinicFormApi(payload: ClinicFormPayload) {
  const base = getBackendBase();
  return jsonFetch<any>(`${base}/clinic-forms`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type ClinicForm = ClinicFormPayload & {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
};

export async function getClinicFormsApi() {
  const base = getBackendBase();
  return jsonFetch<any>(`${base}/clinic-forms`);
}

export async function updateClinicFormApi(
  id: string,
  payload: Partial<ClinicFormPayload>
) {
  const base = getBackendBase();
  return jsonFetch<any>(`${base}/clinic-forms/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getClinicFormByIdApi(id: string) {
  const base = getBackendBase();
  const url = `${base}/clinic-forms/${id}`;

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("session_token")
      : null;

  const headers: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  return jsonFetch<ClinicForm>(url, {
    headers,
  });
}

export async function deleteClinicFormApi(id: string) {
  const base = getBackendBase();
  return jsonFetch<any>(`${base}/clinic-forms/${id}`, {
    method: "DELETE",
  });
}

/* ------------------- Pages APIs (with FormData for images) ------------------- */

export async function getPagesApi() {
  const base = getBackendBase();
  return jsonFetch<any>(`${base}/pages`);
}

export async function getPageByIdApi(id: string) {
  const base = getBackendBase();
  return jsonFetch<any>(`${base}/pages/${id}`);
}

export type PageMetaBackground = {
  enabled: boolean;
  background_upload?: string; // stored path in DB
  url?: string; // public URL
  blur?: number;
  overlay?: number;
};

export type PageMeta = {
  keywords?: string[];
  author?: string;
  background?: PageMetaBackground;
  [key: string]: any;
};

export type PageFormPayload = {
  title: string;
  slug: string;
  description: string;
  template: string;
  visibility: string;
  active: boolean;
  meta_title: string;
  meta_description: string;
  meta: PageMeta;
  status: string;
  content: string;
  service_id: string;
  galleryFiles?: File[]; // for upload
  galleryExisting?: string[]; // existing URLs when editing
};

export const createPageApi = async (formData: FormData) => {
  const base = getBackendBase();
  const token = getSessionToken();

  const res = await fetch(`${base}/pages`, {
    method: "POST",
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
};

export async function updatePageApi(id: string, payload: PageFormPayload) {
  const base = getBackendBase();
  const url = `${base}/pages/${id}`;
  const token = getSessionToken();

  const fd = new FormData();

  fd.append("title", payload.title);
  fd.append("slug", payload.slug);
  fd.append("description", payload.description);
  fd.append("template", payload.template);
  fd.append("visibility", payload.visibility);
  fd.append("active", String(payload.active));
  fd.append("meta_title", payload.meta_title);
  fd.append("meta_description", payload.meta_description);
  fd.append("status", payload.status);
  fd.append("content", payload.content);
  fd.append("service_id", payload.service_id);
  fd.append("published_at", new Date().toISOString());
  fd.append("meta", JSON.stringify(payload.meta || {}));

  (payload.galleryExisting || []).forEach((g) =>
    fd.append("gallery_existing", g)
  );
  (payload.galleryFiles || []).forEach((file) => fd.append("gallery", file));

  const res = await fetch(url, {
    method: "PUT",
    body: fd,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || "Failed to update page");
  }

  return res.json();
}

export async function deletePageApi(id: string) {
  const base = getBackendBase();
  const url = `${base}/pages/${id}`;
  const token = getSessionToken();

  const res = await fetch(url, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || "Failed to delete page");
  }

  // Some backends return JSON, some return empty 204. Handle both safely.
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return { success: true };
}

export async function uploadPageImageApi(
  file: File
): Promise<PageImageUploadResponse> {
  const base = getBackendBase();
  const url = `${base}/pages/upload-image`;
  const token = getSessionToken();

  const formData = new FormData();
  formData.append("image", file);

  const res = await fetch(url, {
    method: "POST",
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Page image upload failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data.path && !data.url) {
    console.warn("Unexpected upload response shape:", data);
  }
  return data as PageImageUploadResponse;
}

// Upload a single image for pages: POST /pages/upload-image
export type PageImageUploadResponse = {
  path: string; // e.g. "/upload/pages/page-123.png"
  [key: string]: any; // allow backend to return extra fields
};

/* ------------------- Orders APIs ------------------- */

// Shape of one item inside meta.lines
export type OrderLine = {
  index: number;
  name: string;
  qty: number;
  variation: string | null;
};

// Shape of one item inside meta.items
export type OrderItemMeta = {
  sku: string;
  name: string;
  variations: string | null;
  strength: string | null;
  qty: number;
  unitMinor: number;
  totalMinor: number;
  variation: string | null;
};

// Meta object (kept flexible with index signature)
export type OrderMeta = {
  lines?: OrderLine[];
  type?: string;
  items?: OrderItemMeta[];
  selectedProduct?: {
    name: string;
    variation: string | null;
    strength: string | null;
    qty: number;
    unitMinor: number;
    totalMinor: number;
  };
  createdAt?: string;
  totalMinor?: number;
  service_slug?: string;
  service?: string;
  appointment_start_at?: string;
  payment_status?: string;
  email?: string;
  [key: string]: any; // allow extra fields like formsQA, admin_notes, etc.
};

export type OrderDto = {
  _id: string;
  user_id: string;
  reference: string;
  status: string;
  payment_status: string;
  paid_at: string | null;
  approved_at: string | null;
  meta: OrderMeta;
  service_id: string;
  deleted_at: string | null;
  schedule_id: string;
  appointment_status: string;
  is_appointment_booked: boolean;
  first_name: string;
  last_name: string;
  email: string;
  start_at: string;
  end_at: string;
  booked_by: string | null;
  calendly_event_uuid: string | null;
  calendly_invitee_uuid: string | null;
  patient_name: string;
  service_slug: string;
  service_name: string;
  createdAt: string;
  updatedAt: string;
  admin_notes?: string[];
  __v: number;
};

export type OrdersListMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type OrdersListResponse = {
  data: OrderDto[];
  meta: OrdersListMeta;
};

// Optional query filters – matches your QueryOrderDto on backend
export type OrdersQuery = {
  user_id?: string;
  reference?: string;
  status?: string;
  payment_status?: string;
  booking_status?: string;
  include_deleted?: boolean;
  page?: number;
  limit?: number;
};

/**
 * GET /orders – fetch orders list
 * Example: getOrdersApi({ page: 1, limit: 20 })
 */
export async function getOrdersApi(
  query: OrdersQuery = {}
): Promise<OrdersListResponse> {
  const base = getBackendBase(); // e.g. http://localhost:8000/api

  const params = new URLSearchParams();

  if (query.user_id) params.set("user_id", query.user_id);
  if (query.reference) params.set("reference", query.reference);
  if (query.status) params.set("status", query.status);
  if (query.payment_status) params.set("payment_status", query.payment_status);
  if (query.booking_status) params.set("booking_status", query.booking_status);
  if (typeof query.include_deleted === "boolean") {
    params.set("include_deleted", String(query.include_deleted));
  }
  if (typeof query.page === "number") params.set("page", String(query.page));
  if (typeof query.limit === "number") params.set("limit", String(query.limit));

  const qs = params.toString();
  const url = qs ? `${base}/orders?${qs}` : `${base}/orders`;

  return jsonFetch<OrdersListResponse>(url);
}

// Single order detail: GET /orders/:id
export async function getOrderByIdApi(id: string) {
  const base = getBackendBase();
  // assumes backend route: GET /api/orders/:id
  return jsonFetch<OrderDto>(`${base}/orders/${id}`);
}

export type UpdateOrderPayload = {
  // status
  status?: string; // "approved" | "rejected" | "completed" | "pending" | etc.

  // notes
  admin_notes?: string[];
  consultation_notes?: string[]; // (your UI uses this)
  consultant_notes?: string[]; // (backend may store this)
  rejection_notes?: string[];

  // audit fields
  approved_by?: string;
  approved_at?: string; // ISO string
  rejected_by?: string;
  rejected_at?: string; // ISO string

  // common order fields you may update
  payment_status?: string;
  appointment_status?: string;

  // ✅ important for items edit: update full meta without losing keys
  meta?: any;

  // allow future fields if needed
  [key: string]: any;
};

export async function updateOrderStatusApi(
  id: string,
  payload: UpdateOrderPayload
) {
  const base = getBackendBase();

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("session_token")
      : null;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  return jsonFetch<OrderDto>(`${base}/orders/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
}

/* ------------------- Appointments APIs ------------------- */

export type AppointmentDto = {
  _id: string;
  order_id: string;
  user_id: string;
  service_id: string;
  schedule_id: string;
  start_at: string;
  end_at: string;
  join_url?: string;
  host_url?: string;

  // Optional extras if your backend sends them
  status?: string;
  reference?: string;
  patient_name?: string;
  service_name?: string;
  meta?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
};

export type AppointmentsQuery = {
  status?: string;
  page?: number;
  limit?: number;
};

export async function getAppointmentsApi(query: AppointmentsQuery = {}) {
  const base = getBackendBase();
  const params = new URLSearchParams();

  if (query.status) params.set("status", query.status);
  if (typeof query.page === "number") params.set("page", String(query.page));
  if (typeof query.limit === "number") params.set("limit", String(query.limit));

  const qs = params.toString();
  const url = qs ? `${base}/appointments?${qs}` : `${base}/appointments`;

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("session_token")
      : null;

  const headers: HeadersInit = token
    ? {
        Authorization: `Bearer ${token}`,
      }
    : {};

  const res = await jsonFetch<any>(url, { headers });
  if (Array.isArray(res)) {
    return { data: res as AppointmentDto[], meta: undefined };
  }
  return res as { data: AppointmentDto[]; meta?: any };
}

export type UpdateAppointmentPayload = {
  status?: string;
  join_url?: string;
  host_url?: string;
  [key: string]: any;
};

export async function updateAppointmentApi(
  id: string,
  payload: UpdateAppointmentPayload
) {
  const base = getBackendBase();

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("session_token")
      : null;

  if (!token) {
    throw new Error("No authentication token found.");
  }

  return jsonFetch<AppointmentDto>(`${base}/appointments/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function getAppointmentByIdApi(
  id: string
): Promise<AppointmentDto> {
  const base = getBackendBase();
  const url = `${base}/appointments/${id}`;

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("session_token")
      : null;

  const headers: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  return jsonFetch<AppointmentDto>(url, { headers });
}

/* ------------------- Tenant APIs ------------------- */

export type PlatformTenantPharmacist = {
  email: string;
  name: string;
  role: string;
  tenant_user_id?: string;
  created_at?: string;
  [key: string]: any;
};

export type PlatformTenantDto = {
  _id: string;
  slug: string;
  db_name: string;
  domain: string;
  full_domain: string;
  notes?: string;
  pharmacists: PlatformTenantPharmacist[];
  status: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
};

export async function getPlatformTenantsApi(): Promise<PlatformTenantDto[]> {
  const base = getMasterBase(); // master backend (no tenant subdomain)
  const res = await jsonFetch<any>(`${base}/platform-tenants`);

  // backend returns an array directly
  if (Array.isArray(res)) return res as PlatformTenantDto[];

  // or { data: [...] }
  return (res?.data ?? []) as PlatformTenantDto[];
}

export async function getPlatformTenantBySlugApi(
  slug: string
): Promise<PlatformTenantDto | PlatformTenantDto[]> {
  const base = getMasterBase();
  // your current backend returns an array even for /platform-tenants/kfc,
  // so keep it loose here
  return jsonFetch<any>(`${base}/platform-tenants/${slug}`);
}

// ---------- Types ----------
export type AppointmentsCalendarSummaryDay = {
  date: string; // "2025-12-01"
  total: number;
  byStatus: Record<string, number>;
  appointments: {
    _id: string;
    start_at: string; // ISO
    status: string; // "pending" | "approved" | ...
  }[];
};

export type AppointmentsCalendarSummaryResponse = {
  data: AppointmentsCalendarSummaryDay[];
};

// ---------- Helper ----------
export async function getAppointmentsCalendarSummaryApi(params: {
  from: string; // "YYYY-MM-DD"
  to: string; // "YYYY-MM-DD"
}): Promise<AppointmentsCalendarSummaryResponse> {
  const base = getBackendBase(); // e.g. http://tenant.domain:8000/api
  const qs = new URLSearchParams({
    from: params.from,
    to: params.to,
  }).toString();

  const url = `${base}/appointments/calendar-summary?${qs}`;

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("session_token")
      : null;

  const headers: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  return jsonFetch<AppointmentsCalendarSummaryResponse>(url, { headers });
}

/* ------------------- Dynamic Home Page APIs ------------------- */

export type DynamicNavbarContent = {
  logoUrl?: string;
  logoAlt?: string;
  searchPlaceholder?: string;
  navLinks?: {
    label: string;
    href: string;
    external?: boolean;
  }[];
};

export type DynamicFooterContent = {
  brandName?: string;
  brandDescription?: string;
  infoLinks?: { label: string; href: string }[];
  contact?: {
    phoneLabel?: string;
    emailLabel?: string;
    addressLabel?: string;
  };
  bottomLeft?: string;
  bottomRight?: string;
};

/**
 * Shape returned by GET /dynamicHomePages/:slug
 * Your backend currently returns:
 *   { slug, ...(doc.content || {}) }
 * so we model sections and allow extra keys.
 */
export type DynamicHomePageContent = {
  slug: string;
  navbar?: DynamicNavbarContent;
  hero?: any;
  safeSecure?: any;
  keyBenefits?: any;
  faq?: any;
  contact?: any;
  testimonials?: any;
  footer?: DynamicFooterContent;
  [key: string]: any; // allow future sections
};

/**
 * GET /dynamicHomePages/:slug
 * Used in admin UI to load current home-page JSON (navbar, hero, footer, etc.)
 */
export async function getDynamicHomePageApi(
  slug: string
): Promise<DynamicHomePageContent> {
  const base = getBackendBase();
  const url = `${base}/dynamicHomePages/${encodeURIComponent(slug)}`;

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("session_token")
      : null;

  const headers: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  return jsonFetch<DynamicHomePageContent>(url, { headers });
}

/**
 * PUT /dynamicHomePages/:slug
 * Partial update – you can send only the section you edit:
 *   updateDynamicHomePageApi("home", { hero: { titleHighlight: "25%" } })
 * Backend merges with existing content (using the updated service we wrote).
 */
export async function updateDynamicHomePageApi(
  slug: string,
  payload: Partial<DynamicHomePageContent>
): Promise<DynamicHomePageContent> {
  const base = getBackendBase();
  const url = `${base}/dynamicHomePages/${encodeURIComponent(slug)}`;

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("session_token")
      : null;

  if (!token) {
    throw new Error("No authentication token found.");
  }

  return jsonFetch<DynamicHomePageContent>(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      // Content-Type is set by jsonFetch
    },
    body: JSON.stringify(payload),
  });
}

/* ------------------- Email APIs ------------------- */

export type SendEmailRequest = {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  template: string;
  context: Record<string, any>;
  attachments?: File[];
};

export async function sendEmailApi(payload: SendEmailRequest) {
  const base = getBackendBase();
  const url = `${base}/email/send`;

  const formData = new FormData();

  const to = Array.isArray(payload.to) ? payload.to.join(",") : payload.to;
  const cc = Array.isArray(payload.cc) ? payload.cc.join(",") : payload.cc;
  const bcc = Array.isArray(payload.bcc) ? payload.bcc.join(",") : payload.bcc;

  formData.append("to", to);
  if (cc && cc.length) formData.append("cc", cc);
  if (bcc && bcc.length) formData.append("bcc", bcc);

  formData.append("subject", payload.subject);
  formData.append("template", payload.template);
  formData.append("context", JSON.stringify(payload.context || {}));

  // Attach files if provided
  (payload.attachments || []).forEach((file, index) => {
    formData.append("attachments", file, file.name || `attachment-${index}`);
  });

  let headers: HeadersInit = {};
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("session_token");
    if (token) {
      headers = { ...headers, Authorization: `Bearer ${token}` };
    }
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Email send failed: ${res.status}`);
  }

  return res.json();
}

/* ------------------- NHS Service (NHS nominations) APIs ------------------- */

export type NhsServiceRequestDto = {
  _id: string;

  first_name: string;
  last_name: string;
  dob: string; // ISO date string
  gender: string;
  nhs_number: string;

  email: string;
  phone: string;

  address: string;
  address1: string;
  address2: string;
  city: string;
  postcode: string;
  country: string;

  use_alt_delivery: boolean;
  delivery_address: string;
  delivery_address1: string;
  delivery_address2: string;
  delivery_city: string;
  delivery_postcode: string;
  delivery_country: string;

  exemption: string; // e.g. "age_60_plus", "pays"
  exemption_number: string;
  exemption_expiry: string; // ISO date string

  consent_patient: boolean;
  consent_nomination: boolean;
  consent_nomination_explained: boolean;
  consent_exemption_signed: boolean;
  consent_scr_access: boolean;

  status: string; // "pending" | "approved" | "rejected" | etc.
  approved_at: string | null;
  approvedBy: string | null;
  approval_note: string;
  rejection_note: string;
  notes: string[];

  meta?: {
    source?: string;
    utm_campaign?: string;
    [key: string]: any;
  };

  createdAt: string;
  updatedAt: string;
  __v: number;
};

export type NhsServiceListMeta = {
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export type NhsServiceListResponse = {
  data: NhsServiceRequestDto[];
  meta: NhsServiceListMeta;
};

/**
 * GET /nhsService
 * (no query params for now)
 */
export async function getNhsServicesApi(): Promise<NhsServiceListResponse> {
  const base = getBackendBase();
  const url = `${base}/nhsService`;

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("session_token")
      : null;

  const headers: HeadersInit = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  return jsonFetch<NhsServiceListResponse>(url, { headers });
}

/* ---------- UPDATE /nhsService/:id ---------- */

export type UpdateNhsServicePayload = {
  status?: string; // "approved" | "rejected" | "pending" | etc.
  approval_note?: string;
  rejection_note?: string;
  notes?: string[];
  approved_at?: string | null;
  approvedBy?: string | null;
  [key: string]: any; // allow extra fields if backend supports them
};

/**
 * PUT /nhsService/:id
 * Example: updateNhsServiceApi("6937d323537a2eaea5073f5c", { status: "approved" })
 */
export async function updateNhsServiceApi(
  id: string,
  payload: UpdateNhsServicePayload
): Promise<NhsServiceRequestDto> {
  const base = getBackendBase();
  const url = `${base}/nhsService/${encodeURIComponent(id)}`;

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("session_token")
      : null;

  if (!token) {
    throw new Error("No authentication token found.");
  }

  return jsonFetch<NhsServiceRequestDto>(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      // Content-Type is added by jsonFetch
    },
    body: JSON.stringify(payload),
  });
}

/* ------------------- Analytics APIs ------------------- */

export type RevenueBookingsGranularity =
  | "daily"
  | "weekly"
  | "monthly"
  | string;

export type RevenueBookingsAnalyticsParams = {
  granularity?: RevenueBookingsGranularity; // optional; backend may default
  last?: number; // use this OR start/end
  start?: string; // ISO string
  end?: string; // ISO string
  status?: string;
  payment_status?: string;
  date_field?: string;
  include_deleted?: boolean;
};

export type RevenueBookingsAnalyticsTotals = {
  revenue: number;
  bookings: number;
  avg_revenue_per_booking: number;
};

export type RevenueBookingsAnalyticsPoint = {
  bucket: string;
  revenue: number;
  bookings: number;
  avg_revenue_per_booking: number;
};

export type RevenueBookingsAnalyticsResponse = {
  filters: Record<string, any>;
  totals: RevenueBookingsAnalyticsTotals;
  series: RevenueBookingsAnalyticsPoint[];
};

/**
 * GET /analytics/revenue-bookings
 *
 * Supports:
 * 1) Range mode:
 *    getRevenueBookingsAnalyticsApi({ start, end, granularity?, status?, payment_status? })
 *
 * 2) Rolling mode:
 *    getRevenueBookingsAnalyticsApi({ last, granularity, status?, payment_status? })
 *
 * If start/end are provided, they take precedence over last.
 */
export async function getRevenueBookingsAnalyticsApi(
  params: RevenueBookingsAnalyticsParams = {}
): Promise<RevenueBookingsAnalyticsResponse> {
  const base = getBackendBase();

  const qs = new URLSearchParams();

  // Optional filters
  if (params.granularity) qs.set("granularity", String(params.granularity));
  if (params.status) qs.set("status", params.status);
  if (params.payment_status) qs.set("payment_status", params.payment_status);
  if (params.date_field) qs.set("date_field", params.date_field);
  if (typeof params.include_deleted === "boolean") {
    qs.set("include_deleted", String(params.include_deleted));
  }

  // Range mode (preferred when provided)
  const hasStart =
    typeof params.start === "string" && params.start.trim().length > 0;
  const hasEnd = typeof params.end === "string" && params.end.trim().length > 0;

  if (hasStart) qs.set("start", params.start!.trim());
  if (hasEnd) qs.set("end", params.end!.trim());

  // Rolling mode (only if range not provided)
  if (!hasStart && !hasEnd && typeof params.last === "number") {
    qs.set("last", String(params.last));
  }

  const url = qs.toString()
    ? `${base}/analytics/revenue-bookings?${qs.toString()}`
    : `${base}/analytics/revenue-bookings`;

  return jsonFetch<RevenueBookingsAnalyticsResponse>(url);
}

/* ------------------- Analytics APIs ------------------- */

export type AnalyticsCommonParams = {
  start?: string; // ISO string
  end?: string; // ISO string
  status?: string | null;
  payment_status?: string | null;
  include_deleted?: boolean;
};

export type AnalyticsTotals = {
  bookings: number;
  revenue: number;
  avg_revenue_per_booking: number;
};

/* ---------- 1) GET /analytics/summary ---------- */

export type AnalyticsSummaryBreakdownByStatus = {
  bookings: number;
  status: string;
  revenue: number;
  avg_revenue_per_booking: number;
  percent_of_total_bookings: number;
  percent_of_total_revenue: number;
};

export type AnalyticsSummaryBreakdownByPaymentStatus = {
  bookings: number;
  payment_status: string;
  revenue: number;
  avg_revenue_per_booking: number;
  percent_of_total_bookings: number;
  percent_of_total_revenue: number;
};

export type AnalyticsSummaryResponse = {
  filters: {
    start?: string;
    end?: string;
    status: string | null;
    payment_status: string | null;
    include_deleted: boolean;
    [key: string]: any;
  };
  totals: AnalyticsTotals;
  breakdown: {
    byStatus: AnalyticsSummaryBreakdownByStatus[];
    byPaymentStatus: AnalyticsSummaryBreakdownByPaymentStatus[];
    [key: string]: any;
  };
};

export async function getAnalyticsSummaryApi(
  params: AnalyticsCommonParams = {}
): Promise<AnalyticsSummaryResponse> {
  const base = getBackendBase();

  const qs = new URLSearchParams();
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);

  // allow passing explicit status/payment_status if your backend supports it
  if (params.status != null && String(params.status).trim().length > 0) {
    qs.set("status", String(params.status));
  }
  if (
    params.payment_status != null &&
    String(params.payment_status).trim().length > 0
  ) {
    qs.set("payment_status", String(params.payment_status));
  }
  if (typeof params.include_deleted === "boolean") {
    qs.set("include_deleted", String(params.include_deleted));
  }

  const url = qs.toString()
    ? `${base}/analytics/summary?${qs.toString()}`
    : `${base}/analytics/summary`;

  return jsonFetch<AnalyticsSummaryResponse>(url);
}

/* ---------- 2) GET /analytics/by-service ---------- */

export type AnalyticsByServiceRow = {
  bookings: number;
  service_id: string;
  service_name: string;
  service_slug: string;
  revenue: number;
  avg_revenue_per_booking: number;
  percent_of_total_bookings: number;
  percent_of_total_revenue: number;
};

export type AnalyticsByServiceResponse = {
  filters: {
    start?: string;
    end?: string;
    status: string | null;
    payment_status: string | null;
    include_deleted: boolean;
    [key: string]: any;
  };
  totals: AnalyticsTotals;
  data: AnalyticsByServiceRow[];
};

export async function getAnalyticsByServiceApi(
  params: AnalyticsCommonParams = {}
): Promise<AnalyticsByServiceResponse> {
  const base = getBackendBase();

  const qs = new URLSearchParams();
  if (params.start) qs.set("start", params.start);
  if (params.end) qs.set("end", params.end);

  if (params.status != null && String(params.status).trim().length > 0) {
    qs.set("status", String(params.status));
  }
  if (
    params.payment_status != null &&
    String(params.payment_status).trim().length > 0
  ) {
    qs.set("payment_status", String(params.payment_status));
  }
  if (typeof params.include_deleted === "boolean") {
    qs.set("include_deleted", String(params.include_deleted));
  }

  const url = qs.toString()
    ? `${base}/analytics/by-service?${qs.toString()}`
    : `${base}/analytics/by-service`;

  return jsonFetch<AnalyticsByServiceResponse>(url);
}

// ✅ Backward-compatible alias (some components import this name)
export type RevenueBookingsResponse = RevenueBookingsAnalyticsResponse;

// Optional aliases if you used these names elsewhere
export type RevenueBookingsTotals = RevenueBookingsAnalyticsTotals;
export type RevenueBookingsPoint = RevenueBookingsAnalyticsPoint;
export type RevenueBookingsParams = RevenueBookingsAnalyticsParams;
