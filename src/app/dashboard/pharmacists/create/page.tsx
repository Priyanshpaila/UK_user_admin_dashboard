"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Loader2,
  Users,
  Building2,
  ChevronDown,
  Mail,
  Phone,
  Frown 
} from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import {
  createPharmacistApi,
  getPlatformTenantsApi,
  getBackendBase,
  type PharmacistPayload,
  type PlatformTenantDto,
} from "../../../../api";

/** ✅ Tenant slug logic for pharma-health.co.uk (DO NOT touch getBackendBase) */
function deriveTenantSlugFromHostname(): string {
  if (typeof window === "undefined") return "";

  try {
    const hostname = window.location.hostname.toLowerCase();

    // localhost or IP → no tenant
    if (hostname === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
      return "";
    }

    const parts = hostname.split(".").filter(Boolean);

    /**
     * pharma-health.co.uk
     *   => ["pharma-health","co","uk"] => no tenant
     *
     * tenant.pharma-health.co.uk
     *   => ["tenant","pharma-health","co","uk"] => tenant
     */
    const hasTenant = parts.length >= 4; // ✅ IMPORTANT for your live domain pattern
    if (!hasTenant) return "";

    const slug = parts[0];

    // avoid infra/common subdomains being treated as tenants
    const RESERVED = ["www", "admin", "api", "app", "backend"];
    if (RESERVED.includes(slug)) return "";

    return slug;
  } catch {
    return "";
  }
}

export default function CreatePharmacistPage() {
  const [mounted, setMounted] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);

  // tenants (admin list + also used to show pharmacists)
  const [tenants, setTenants] = useState<PlatformTenantDto[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);

  // derived from hostname AFTER mount
  const [derivedTenantSlug, setDerivedTenantSlug] = useState("");

  // chosen tenant slug (admin can select; non-admin locked; empty => master)
  const [selectedSubdomain, setSelectedSubdomain] = useState("");

  // form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("male");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const isTenantContextMissing = useMemo(() => {
    if (!mounted) return false; // hydration-safe default
    return !derivedTenantSlug;
  }, [mounted, derivedTenantSlug]);

  const loadTenants = async () => {
    try {
      setLoadingTenants(true);
      const list = await getPlatformTenantsApi();
      setTenants(list || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load tenants");
    } finally {
      setLoadingTenants(false);
    }
  };

  // mount gate
  useEffect(() => {
    setMounted(true);
  }, []);

  // read user + derive slug ONLY after mount (hydration-safe)
  useEffect(() => {
    if (!mounted) return;

    // 1) user
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const parsed = JSON.parse(raw);
        setIsAdmin(!!parsed.is_admin);
      }
    } catch (e) {
      console.error("Failed to parse user from localStorage", e);
    }

    // 2) derive tenant slug from hostname (pharma-health.co.uk safe)
    setDerivedTenantSlug(deriveTenantSlugFromHostname());

    // 3) tenants list
    void loadTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // non-admin: lock selectedSubdomain to current tenant if present else master fallback
  useEffect(() => {
    if (!mounted) return;
    if (isAdmin) return;

    if (derivedTenantSlug) setSelectedSubdomain(derivedTenantSlug);
    else setSelectedSubdomain(""); // master fallback mode
  }, [mounted, isAdmin, derivedTenantSlug]);

  const canSubmit = useMemo(() => {
    if (!firstName.trim()) return false;
    if (!lastName.trim()) return false;
    if (!email.trim()) return false;
    if (!phone.trim()) return false;
    if (!password.trim()) return false;
    return true;
  }, [firstName, lastName, email, phone, password]);

  const handleCreate = async () => {
    const payload: PharmacistPayload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender,
      email: email.trim(),
      phone: phone.trim(),
      password,
    };

    setIsSubmitting(true);
    try {
      // ✅ Tenant-selected (admin OR non-admin tenant lock)
      if (selectedSubdomain) {
        await createPharmacistApi(selectedSubdomain, payload);
        toast.success(`Pharmacist created for tenant: ${selectedSubdomain}`);
      } else {
        // ✅ Master fallback (admin OR non-admin without tenant)
        const base = getBackendBase();
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("session_token")
            : null;

        const res = await fetch(`${base}/users/createPharmacist`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || `Request failed: ${res.status}`);
        }

        toast.success("Pharmacist created on master domain");
      }

      // reset form
      setFirstName("");
      setLastName("");
      setGender("male");
      setEmail("");
      setPhone("");
      setPassword("");

      // refresh list so pharmacists update
      void loadTenants();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Failed to create pharmacist");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pharmacistsScopeLabel = useMemo(() => {
    if (!mounted) return "—";
    return selectedSubdomain ? selectedSubdomain : "Master domain";
  }, [mounted, selectedSubdomain]);

  const selectedTenantObj = useMemo(() => {
    if (!selectedSubdomain) return null;
    return (
      tenants.find(
        (t) => (t.slug || "").toLowerCase() === selectedSubdomain.toLowerCase()
      ) || null
    );
  }, [tenants, selectedSubdomain]);

  const pharmacistsToShow = useMemo(() => {
    if (!selectedTenantObj) return [];
    return Array.isArray(selectedTenantObj.pharmacists)
      ? selectedTenantObj.pharmacists
      : [];
  }, [selectedTenantObj]);

  // ✅ optional: avoid rendering until mounted to guarantee no hydration mismatch
  if (!mounted) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6">
          <div className="flex items-center gap-3 text-sm text-neutral-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Create Pharmacist
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            {isAdmin
              ? "Superadmin: select a tenant (optional) and create pharmacist users."
              : "You can create a pharmacist for your current tenant; if opened on master domain, it will create on master domain."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-neutral-300">
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/70 px-3 py-1">
            <Users className="h-3.5 w-3.5 text-sky-400" />
            <span className="font-medium">
              {isAdmin ? "Superadmin mode" : "User mode"}
            </span>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/70 px-3 py-1">
            <Building2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-medium">{pharmacistsScopeLabel}</span>
          </div>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 shadow-xl shadow-black/40">
        {/* Tenant selector */}
        <div className="mb-6">
          <label className="text-xs font-medium text-neutral-300">Tenant</label>

          {isAdmin ? (
            <div className="mt-2">
              <div className="relative">
                <select
                  value={selectedSubdomain}
                  onChange={(e) => setSelectedSubdomain(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 pr-10 text-sm text-neutral-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40"
                >
                  <option value="">
                    {loadingTenants
                      ? "Loading tenants..."
                      : "Master domain (no subdomain)"}
                  </option>

                  {tenants.map((t) => (
                    <option key={t._id} value={t.slug}>
                      {t.slug} — {t.full_domain}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              </div>
            </div>
          ) : (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm text-neutral-100">
                <Building2 className="h-4 w-4 text-emerald-400" />
                <span className="font-semibold">
                  {selectedSubdomain || "Master domain (no subdomain)"}
                </span>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
                {selectedSubdomain ? "Locked" : "Fallback"}
              </span>
            </div>
          )}

          {!isAdmin && isTenantContextMissing && (
            <p className="mt-2 text-xs text-neutral-500">
              You are not on a tenant subdomain. Pharmacist will be created on
              the master domain as a fallback.
            </p>
          )}
        </div>

        {/* Form */}
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40"
            />
            <input
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>

            <div className="relative">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
              <input
                type="text"
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-neutral-950 pl-10 pr-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40"
              />
            </div>
          </div>

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 pl-10 pr-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40"
            />
          </div>

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40"
          />

          <button
            type="button"
            onClick={handleCreate}
            disabled={!canSubmit || isSubmitting}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-900/60 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {isSubmitting ? "Creating pharmacist..." : "Create pharmacist"}
          </button>
        </div>

        {/* Pharmacists list */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Pharmacists</h3>
            <span className="text-xs text-neutral-500">
              Scope:{" "}
              <span className="text-neutral-300">{pharmacistsScopeLabel}</span>
            </span>
          </div>

          {selectedSubdomain ? (
            !selectedTenantObj && !loadingTenants ? (
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-4 text-xs text-neutral-400">
                Could not resolve tenant{" "}
                <span className="text-neutral-200">{selectedSubdomain}</span>{" "}
                from platform tenants list.
              </div>
            ) : pharmacistsToShow.length === 0 ? (
              <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/60 px-4 py-6 text-center text-xs text-neutral-400">
                No pharmacists found for this tenant yet.
              </div>
            ) : (
              <div className="space-y-2">
                {pharmacistsToShow.map((p, idx) => (
                  <div
                    key={`${p.tenant_user_id ?? p.email}-${idx}`}
                    className="flex items-start justify-between rounded-xl border border-neutral-800 bg-neutral-950/70 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {p.name || "Unnamed pharmacist"}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-400">
                        <Mail className="h-3 w-3" />
                        {p.email}
                      </p>
                      <p className="mt-0.5 text-[11px] text-neutral-500">
                        Role: {p.role}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 px-4 py-4 text-xs text-neutral-400">
              Master-domain pharmacist listing is not available right now. <Frown className="inline-block h-4 w-4 ml-1 text-neutral-400" />
            </div>
          )}
        </div>
      </div>

      <ToastContainer position="top-right" theme="dark" />
    </div>
  );
}
