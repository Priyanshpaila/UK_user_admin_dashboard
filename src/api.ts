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
  // const hasSubdomain = parts.length >= 2; //for local host
  const hasSubdomain = parts.length >= 4;// for our live domain : adminukproject.rrispat.in

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
  image?: string | File;
  description?: string;
  status: string;
};

// DTO for medicines returned by backend (e.g. /medicines, /service-medicines/service/:id)
export type MedicineDto = {
  _id: string;
  sku: string;
  name: string;
  variations: string;
  strength: string | null;
  qty: number;
  unitMinor: number;
  totalMinor: number;
  variation: string;
  price: number;
  image: string;
  description: string;
  status: string;
  deleted_at: string | null;
  createdAt: string;
  updatedAt: string;
  __v: number;
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
  formData.append("qty", String(payload.qty));
  formData.append("price", String(payload.price));
  formData.append("status", payload.status);

  if (payload.strength != null) {
    formData.append("strength", payload.strength);
  }

  if (payload.description) {
    formData.append("description", payload.description);
  }

  if (payload.image) {
    if (payload.image instanceof File) {
      // file upload
      formData.append("image", payload.image);
    } else {
      // URL string
      formData.append("image", payload.image);
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

// PUT /users/:id -> Update a user by ID
export async function updateUserApi(userId: string, payload: any) {
  const base = getBackendBase(); // Get the correct backend base URL dynamically
  const url = `${base}/users/${userId}`; // Construct the URL using the userId

  // Get the token from local storage or a global auth state (use your own method of getting it)
  const token = localStorage.getItem("session_token"); // Adjust this based on your token storage method

  if (!token) {
    throw new Error("No authentication token found.");
  }

  return jsonFetch<any>(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`, // Add the Bearer token to the request
      "Content-Type": "application/json", // Specify content type for the payload
    },
    body: JSON.stringify(payload), // Send the updated user data
  });
}

// POST /users -> Create a new user
export async function createUserApi(payload: any) {
  const base = getBackendBase();
  const url = `${base}/users`;

  const token = localStorage.getItem("session_token");

  if (!token) {
    throw new Error("No authentication token found.");
  }

  return jsonFetch<any>(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`, // Bearer token
      "Content-Type": "application/json", // JSON body
    },
    body: JSON.stringify(payload),
  });
}


// Single weekday config
export type ScheduleWeekDay = {
  day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  open: boolean;
  start?: string; // "HH:MM" when open=true
  end?: string;   // "HH:MM" when open=true
  break_start?: string;  // NEW: "13:00"
  break_end?: string;  // NEW: "14:00"
};

// Date override config
export type ScheduleOverride = {
  date: string;    // "YYYY-MM-DD"
  open: boolean;
  start?: string;  // "HH:MM" when open=true
  end?: string;    // "HH:MM" when open=true
  note?: string;   // optional note / reason
};

// Payload for POST /schedules
export type SchedulePayload = {
  name: string;          // "Travel Clinic" or "Global"
  service_slug: string;  // "travel-clinic" or "global"
  service_id?: string | null; // omit or null for Global schedule
  timezone: string;      // e.g. "UTC" or "Europe/London"
  slot_minutes: number;  // e.g. 15
  capacity: number;      // e.g. 1
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
export async function updateScheduleApi(
  id: string,
  payload: SchedulePayload
) {
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
  url?: string;               // public URL
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
  galleryFiles?: File[];   // for upload
  galleryExisting?: string[]; // existing URLs when editing
};

export const createPageApi = async (formData: FormData) => {
  const base = getBackendBase();

  const res = await fetch(`${base}/pages`, {
    method: "POST",
    body: formData, // no headers here
  });

  if (!res.ok) throw new Error(await res.text());

  return res.json();
};

export async function updatePageApi(id: string, payload: PageFormPayload) {
  const base = getBackendBase();
  const url = `${base}/pages/${id}`;

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

  (payload.galleryExisting || []).forEach((g) => {
    fd.append("gallery_existing", g);
  });

  (payload.galleryFiles || []).forEach((file) => {
    fd.append("gallery", file);
  });

  const res = await fetch(url, {
    method: "PUT",
    body: fd,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || "Failed to update page");
  }

  return res.json();
}

// Upload a single image for pages: POST /pages/upload-image
export type PageImageUploadResponse = {
  path: string;          // e.g. "/upload/pages/page-123.png"
  [key: string]: any;    // allow backend to return extra fields
};

export async function uploadPageImageApi(
  file: File
): Promise<PageImageUploadResponse> {
  const base = getBackendBase(); // e.g. http://tenant.domain:8000/api
  const url = `${base}/pages/upload-image`;

  const formData = new FormData();
  formData.append("image", file); // adjust field name if backend expects something else

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Page image upload failed: ${res.status}`);
  }

  const data = await res.json();

  // backend "gives a path" – usually under `path`
  // keep it flexible in case it returns url or something else
  if (!data.path && !data.url) {
    console.warn("Unexpected upload response shape:", data);
  }

  return data as PageImageUploadResponse;
}

