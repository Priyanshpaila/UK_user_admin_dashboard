"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Loader2,
  Building2,
  Globe2,
  Users,
  Database,
  CalendarDays,
  Mail,
  Phone,
  X,
  CreditCard,
  Video,
  Package,
} from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  createSubdomainApi,
  createPharmacistApi,
  PharmacistPayload,
  getPlatformTenantsApi,
  deletePharmacistApi,
  deleteTenantApi,
  type PlatformTenantDto,
  PlatformTenantPharmacist,
  updateTenantIntegrationApi,
} from "../../../api";

export default function CreateTenantPage() {
  const [subdomain, setSubdomain] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("male");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [tenantCreated, setTenantCreated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔹 Tenants list
  const [tenants, setTenants] = useState<PlatformTenantDto[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [tenantsError, setTenantsError] = useState<string | null>(null);

  // 🔹 Modal
  const [selectedTenant, setSelectedTenant] =
    useState<PlatformTenantDto | null>(null);
  const [selectedPharmacist, setSelectedPharmacist] =
    useState<PlatformTenantPharmacist | null>(null);

  const [isDeleteTenantModalOpen, setDeleteTenantModalOpen] = useState(false);
  const [tenantPassword, setTenantPassword] = useState("");
  const [isDeletePharmacistModalOpen, setDeletePharmacistModalOpen] =
    useState(false);
  const [isFillCredentialsModalOpen, setFillCredentialsModalOpen] =
    useState(false);

  // Credentials states
  const [emailProvider, setEmailProvider] = useState("smtp");
  const [emailHost, setEmailHost] = useState("smtp-relay.brevo.com");
  const [emailPort, setEmailPort] = useState(587);
  const [emailSecure, setEmailSecure] = useState(false);
  const [emailUsername, setEmailUsername] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailFromName, setEmailFromName] = useState("Pharmacy Express");
  const [emailFromEmail, setEmailFromEmail] = useState("info@safescript.co.uk");

  const [paymentProvider, setPaymentProvider] = useState("ryft");
  const [ryftApiBase, setRyftApiBase] = useState("https://api.ryftpay.com");
  const [ryftSecretKey, setRyftSecretKey] = useState("");
  const [ryftWebhookSecret, setRyftWebhookSecret] = useState("");
  const [ryftPublicKey, setRyftPublicKey] = useState("");
  const [ryftMerchantName, setRyftMerchantName] = useState(
    "Safescript Pharmacy"
  );
  const [ryftMerchantCountry, setRyftMerchantCountry] = useState("GB");

  const [zoomAccountId, setZoomAccountId] = useState("");
  const [zoomClientId, setZoomClientId] = useState("");
  const [zoomClientSecret, setZoomClientSecret] = useState("");
  const [zoomDefaultUser, setZoomDefaultUser] = useState("me");
  const [zoomBaseUrl, setZoomBaseUrl] = useState("https://api.zoom.us/v2");

  const [shippingProvider, setShippingProvider] = useState("clickanddrop");
  const [clickanddropBase, setClickanddropBase] = useState(
    "https://api.parcel.royalmail.com/api/v1"
  );
  const [clickanddropApiKey, setClickanddropApiKey] = useState("");
  const [clickanddropDefaultService, setClickanddropDefaultService] =
    useState("RM24");
  const [clickanddropDefaultPackage, setClickanddropDefaultPackage] =
    useState("Parcel");
  const [clickanddropMinWeightG, setClickanddropMinWeightG] = useState(2000);

  const closeModal = () => {
    setSelectedTenant(null);
    setDeleteTenantModalOpen(false);
    setDeletePharmacistModalOpen(false);
  };

  const formatDateTime = (iso?: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const loadTenants = async () => {
    try {
      setLoadingTenants(true);
      setTenantsError(null);
      const res = await getPlatformTenantsApi();
      setTenants(res || []);
    } catch (err: any) {
      console.error(err);
      setTenantsError("Failed to load tenants");
    } finally {
      setLoadingTenants(false);
    }
  };

  useEffect(() => {
    loadTenants();
  }, []);

  const handleCreateSubdomain = async () => {
    if (!subdomain.trim()) {
      toast.error("Please enter a subdomain");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await createSubdomainApi(subdomain.trim());
      setTenantCreated(true);
      toast.success("Subdomain created successfully!");
      // refresh list
      loadTenants();
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      toast.error("Failed to create subdomain");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePharmacist = async () => {
    if (!subdomain.trim()) {
      toast.error("Subdomain is required to create pharmacist");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload: PharmacistPayload = {
        firstName,
        lastName,
        gender,
        email,
        phone,
        password,
      };

      await createPharmacistApi(subdomain.trim(), payload);
      toast.success("Pharmacist created successfully!");

      // Optionally clear form
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setPassword("");

      // refresh tenants to show new pharmacist
      loadTenants();
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      toast.error("Failed to create pharmacist");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTenant = async () => {
    if (tenantPassword !== "rri12345") {
      toast.error("Incorrect password!");
      return;
    }
    try {
      await deleteTenantApi(selectedTenant?.slug!);
      toast.success("Tenant deleted successfully");
      loadTenants();
      closeModal();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete tenant");
    }
  };

  const handleDeletePharmacist = async () => {
    try {
      await deletePharmacistApi(
        selectedTenant?.slug!,
        selectedPharmacist?.tenant_user_id!
      );
      toast.success("Pharmacist deleted successfully");
      loadTenants();
      closeModal();
    } catch (err: any) {
      console.error(err);
      toast.error("Failed to delete pharmacist");
    }
  };

  // Handle the fill credentials form and update integration
  const handleFillCredentials = async () => {
    const integrationData = {
      email_provider: emailProvider,
      email_host: emailHost,
      email_port: emailPort,
      email_secure: emailSecure,
      email_username: emailUsername,
      email_password: emailPassword,
      email_fromName: emailFromName,
      email_fromEmail: emailFromEmail,

      payment_provider: paymentProvider,
      ryft_apiBase: ryftApiBase,
      ryft_secretKey: ryftSecretKey,
      ryft_webhookSecret: ryftWebhookSecret,
      ryft_publicKey: ryftPublicKey,
      ryft_merchantName: ryftMerchantName,
      ryft_merchantCountry: ryftMerchantCountry,

      zoom_accountId: zoomAccountId,
      zoom_clientId: zoomClientId,
      zoom_clientSecret: zoomClientSecret,
      zoom_defaultUser: zoomDefaultUser,
      zoom_baseUrl: zoomBaseUrl,

      shipping_provider: shippingProvider,
      clickanddrop_base: clickanddropBase,
      clickanddrop_apiKey: clickanddropApiKey,
      clickanddrop_defaultService: clickanddropDefaultService,
      clickanddrop_defaultPackage: clickanddropDefaultPackage,
      clickanddrop_minWeightG: clickanddropMinWeightG,
    };

    try {
      await updateTenantIntegrationApi(selectedTenant?.slug!, integrationData);
      toast.success("Integration credentials updated successfully!");
      closeModal();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update credentials");
    }
  };

  const totalTenants = tenants.length;
  const totalPharmacists = useMemo(
    () =>
      tenants.reduce(
        (sum, t) =>
          sum + (Array.isArray(t.pharmacists) ? t.pharmacists.length : 0),
        0
      ),
    [tenants]
  );

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">
            Tenants & Pharmacists
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Create new tenant subdomains and manage pharmacists for each tenant
            from a single place.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-neutral-300">
          <div className="flex items-center gap-2 rounded-full bg-neutral-900/70 px-3 py-1 border border-neutral-700">
            <Building2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="font-medium">
              {totalTenants} tenant{totalTenants !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-neutral-900/70 px-3 py-1 border border-neutral-700">
            <Users className="h-3.5 w-3.5 text-sky-400" />
            <span className="font-medium">
              {totalPharmacists} pharmacist{totalPharmacists !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)]">
        {/* Left: create tenant / pharmacist */}
        <div className="space-y-6">
          {/* Create Tenant */}
          {!tenantCreated && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 shadow-xl shadow-black/40">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Create tenant subdomain
                  </h2>
                  <p className="mt-1 text-xs text-neutral-400">
                    This will create the tenant DB and DNS entry.
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <Globe2 className="h-4 w-4" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-medium text-neutral-300">
                  Subdomain
                </label>
                <div className="flex items-center gap-2 rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/40">
                  <span className="text-neutral-500">https://</span>
                  <input
                    type="text"
                    placeholder="e.g. safescript"
                    value={subdomain}
                    onChange={(e) => setSubdomain(e.target.value)}
                    className="flex-1 border-none bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                  />
                  <span className="text-neutral-500 text-xs">
                    .your-domain.com
                  </span>
                </div>

                <button
                  onClick={handleCreateSubdomain}
                  disabled={isSubmitting}
                  className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/60 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {isSubmitting ? "Creating tenant..." : "Create tenant"}
                </button>

                {error && (
                  <p className="mt-2 text-xs text-red-400 text-center">
                    {error}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Create Pharmacist */}
          {tenantCreated && (
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6 shadow-xl shadow-black/40">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Create pharmacist user
                  </h2>
                  <p className="mt-1 text-xs text-neutral-400">
                    Link a pharmacist to the tenant{" "}
                    <span className="font-semibold text-emerald-400">
                      {subdomain}
                    </span>
                    .
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/10 text-sky-400">
                  <Users className="h-4 w-4" />
                </div>
              </div>

              <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40"
                    required
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

                  <input
                    type="text"
                    placeholder="Phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40"
                    required
                  />
                </div>

                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40"
                  required
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-sky-500 focus:ring-1 focus:ring-sky-500/40"
                  required
                />

                <button
                  type="button"
                  onClick={handleCreatePharmacist}
                  disabled={isSubmitting}
                  className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-sky-900/60 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {isSubmitting
                    ? "Creating pharmacist..."
                    : "Create pharmacist"}
                </button>

                {error && (
                  <p className="mt-2 text-xs text-red-400 text-center">
                    {error}
                  </p>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Right: tenants list */}
        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-5 shadow-xl shadow-black/40">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-white">
                Existing tenants
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Tap a tenant to view full details and pharmacists.
              </p>
            </div>
            {loadingTenants && (
              <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
            )}
          </div>

          {tenantsError && (
            <p className="mb-3 rounded-lg bg-red-900/40 px-3 py-2 text-xs text-red-200">
              {tenantsError}
            </p>
          )}

          {tenants.length === 0 && !loadingTenants ? (
            <div className="rounded-xl border border-dashed border-neutral-700 bg-neutral-900/60 px-4 py-6 text-center text-xs text-neutral-400">
              No tenants found yet. Create your first tenant to see it here.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {tenants.map((t) => {
                const pharmacistsCount = t.pharmacists?.length ?? 0;
                return (
                  <button
                    key={t._id}
                    type="button"
                    onClick={() => setSelectedTenant(t)}
                    className="group flex flex-col rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-3 text-left text-xs text-neutral-300 transition hover:border-emerald-500/70 hover:bg-neutral-900 hover:shadow-lg hover:shadow-emerald-900/30"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                          <Building2 className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {t.slug}
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            {t.full_domain}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          t.status === "active"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-neutral-700 text-neutral-200"
                        }`}
                      >
                        {t.status}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-400">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3 w-3 text-sky-400" />
                        {pharmacistsCount} pharmacist
                        {pharmacistsCount !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3 w-3 text-neutral-500" />
                        {formatDate(t.createdAt)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal for tenant details */}
      {selectedTenant && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950 shadow-2xl shadow-black/70">
            {/* Modal header */}
            <div className="flex items-start justify-between gap-3 border-b border-neutral-800 px-5 py-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-3 py-1 text-[11px] text-neutral-300">
                  <Building2 className="h-3 w-3 text-emerald-400" />
                  <span className="font-semibold">{selectedTenant.slug}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-white">
                  {selectedTenant.full_domain}
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  Tenant ID:{" "}
                  <span className="font-mono text-[11px] text-neutral-300">
                    {selectedTenant._id}
                  </span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <div className="flex gap-2 ">
                  <span
                    className={`flex rounded-full justify-center items-center px-3 py-1 text-[11px] font-semibold ${
                      selectedTenant.status === "active"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "bg-neutral-700 text-neutral-200"
                    }`}
                  >
                    {selectedTenant.status}
                  </span>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex gap-2">
                  {/* Button to delete tenant */}
                  <button
                    type="button"
                    onClick={() => setFillCredentialsModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 px-3 py-1 text-sm font-normal transition duration-300 ease-in-out transform hover:scale-105 shadow-md hover:shadow-lg"
                  >
                    Fill Credentials
                  </button>
                  <button
                    onClick={() => setDeleteTenantModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 px-3 py-1 text-sm font-normal transition duration-300 ease-in-out transform hover:scale-105 shadow-md hover:shadow-lg"
                  >
                    Delete Tenant
                  </button>
                </div>
              </div>
            </div>

            {/* Modal body */}
            <div className="space-y-5 overflow-y-auto px-5 py-4">
              {/* Meta info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 text-xs text-neutral-300">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Connection
                  </p>
                  <div className="mt-2 space-y-1.5">
                    <p className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-amber-300" />
                      <span className="font-mono text-[11px]">
                        {selectedTenant.db_name}
                      </span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Globe2 className="h-3.5 w-3.5 text-sky-300" />
                      <span>{selectedTenant.domain}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 text-neutral-400" />
                      <span>
                        Created: {formatDateTime(selectedTenant.createdAt)}
                      </span>
                    </p>
                    <p className="flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 text-neutral-400" />
                      <span>
                        Updated: {formatDateTime(selectedTenant.updatedAt)}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 text-xs text-neutral-300">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                    Notes
                  </p>
                  <p className="mt-2 text-xs text-neutral-300">
                    {selectedTenant.notes || "No extra notes for this tenant."}
                  </p>
                </div>
              </div>

              {/* Pharmacists list */}
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Pharmacists
                  </p>
                  <span className="text-[11px] text-neutral-400">
                    {selectedTenant.pharmacists?.length ?? 0} user
                    {((selectedTenant.pharmacists?.length ?? 0) || 0) !== 1
                      ? "s"
                      : ""}
                  </span>
                </div>

                {selectedTenant.pharmacists?.length ? (
                  <div className="space-y-2 text-xs text-neutral-200">
                    {selectedTenant.pharmacists.map((p, idx) => (
                      <div
                        key={`${p.tenant_user_id ?? p.email}-${idx}`}
                        className="flex items-start justify-between rounded-xl border border-neutral-800 bg-neutral-950/80 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {p.name || "Unnamed pharmacist"}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-400">
                            <Mail className="h-3 w-3" />
                            {p.email}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
                            <Users className="h-3 w-3" />
                            Role: {p.role}
                          </p>
                          {p.created_at && (
                            <p className="mt-0.5 text-[11px] text-neutral-500">
                              Added {formatDateTime(p.created_at)}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setSelectedPharmacist(p);
                            setDeletePharmacistModalOpen(true);
                          }}
                          className="ml-3 text-sm text-red-400 hover:text-red-500"
                        >
                          Delete Pharmacist
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-neutral-700 bg-neutral-950/60 px-3 py-3 text-xs text-neutral-400">
                    No pharmacists have been added to this tenant yet.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Tenant Confirmation Modal */}
      {isDeleteTenantModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="max-w-md w-full rounded-3xl bg-neutral-950 p-6 shadow-xl shadow-black/70">
            <h3 className="text-lg font-semibold text-white">
              Confirm Deletion
            </h3>
            <p className="mt-2 text-xs text-neutral-400">
              Enter password to delete tenant {selectedTenant?.slug}
            </p>
            <input
              type="password"
              value={tenantPassword}
              onChange={(e) => setTenantPassword(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-emerald-500"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleDeleteTenant}
                className="w-full rounded-xl bg-red-600 text-white py-2"
              >
                Delete Tenant
              </button>
              <button
                onClick={() => setDeleteTenantModalOpen(false)}
                className="w-full rounded-xl bg-neutral-600 text-white py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Pharmacist Confirmation Modal */}
      {isDeletePharmacistModalOpen && selectedPharmacist && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="max-w-md w-full rounded-3xl bg-neutral-950 p-6 shadow-xl shadow-black/70">
            <h3 className="text-lg font-semibold text-white">
              Confirm Deletion
            </h3>
            <p className="mt-2 text-xs text-neutral-400">
              Are you sure you want to delete {selectedPharmacist.name}?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleDeletePharmacist}
                className="w-full rounded-xl bg-red-600 text-white py-2"
              >
                Delete
              </button>
              <button
                onClick={() => setDeletePharmacistModalOpen(false)}
                className="w-full rounded-xl bg-neutral-600 text-white py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {isFillCredentialsModalOpen && selectedTenant && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="max-w-6xl w-full max-h-[80vh] overflow-y-auto rounded-3xl bg-neutral-950 p-6 shadow-xl shadow-black/70 flex flex-col">
            <h3 className="text-2xl font-semibold text-white mb-4">
              Fill Credentials for {selectedTenant?.slug}
            </h3>
            <div className="mt-3 space-y-6 overflow-y-auto">
              {/* Email Provider Section */}
              <div>
                <h4 className="text-lg font-semibold text-neutral-300 flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-400" />
                  Email Provider
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-3">
                  <div>
                    <input
                      type="text"
                      value={emailProvider}
                      onChange={(e) => setEmailProvider(e.target.value)}
                      placeholder="Email Provider"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={emailHost}
                      onChange={(e) => setEmailHost(e.target.value)}
                      placeholder="Email Host"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={emailPort}
                      onChange={(e) => setEmailPort(Number(e.target.value))}
                      placeholder="Email Port"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      value={emailUsername}
                      onChange={(e) => setEmailUsername(e.target.value)}
                      placeholder="Email Username"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="password"
                      value={emailPassword}
                      onChange={(e) => setEmailPassword(e.target.value)}
                      placeholder="Email Password"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={emailFromName}
                      onChange={(e) => setEmailFromName(e.target.value)}
                      placeholder="Email From Name"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="email"
                      value={emailFromEmail}
                      onChange={(e) => setEmailFromEmail(e.target.value)}
                      placeholder="Email From Email"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Provider Section */}
              <div>
                <h4 className="text-lg font-semibold text-neutral-300 flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-green-400" />
                  Payment Provider
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-3">
                  <div>
                    <input
                      type="text"
                      value={paymentProvider}
                      onChange={(e) => setPaymentProvider(e.target.value)}
                      placeholder="Payment Provider"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={ryftApiBase}
                      onChange={(e) => setRyftApiBase(e.target.value)}
                      placeholder="Ryft API Base"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={ryftSecretKey}
                      onChange={(e) => setRyftSecretKey(e.target.value)}
                      placeholder="Ryft Secret Key"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={ryftWebhookSecret}
                      onChange={(e) => setRyftWebhookSecret(e.target.value)}
                      placeholder="Ryft Webhook Secret"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={ryftPublicKey}
                      onChange={(e) => setRyftPublicKey(e.target.value)}
                      placeholder="Ryft Public Key"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={ryftMerchantName}
                      onChange={(e) => setRyftMerchantName(e.target.value)}
                      placeholder="Ryft Merchant Name"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={ryftMerchantCountry}
                      onChange={(e) => setRyftMerchantCountry(e.target.value)}
                      placeholder="Ryft Merchant Country"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                </div>
              </div>

              {/* Zoom Provider Section */}
              <div>
                <h4 className="text-lg font-semibold text-neutral-300 flex items-center gap-2">
                  <Video className="h-5 w-5 text-yellow-400" />
                  Zoom Provider
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-3">
                  <div>
                    <input
                      type="text"
                      value={zoomAccountId}
                      onChange={(e) => setZoomAccountId(e.target.value)}
                      placeholder="Zoom Account ID"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={zoomClientId}
                      onChange={(e) => setZoomClientId(e.target.value)}
                      placeholder="Zoom Client ID"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={zoomClientSecret}
                      onChange={(e) => setZoomClientSecret(e.target.value)}
                      placeholder="Zoom Client Secret"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={zoomDefaultUser}
                      onChange={(e) => setZoomDefaultUser(e.target.value)}
                      placeholder="Zoom Default User"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={zoomBaseUrl}
                      onChange={(e) => setZoomBaseUrl(e.target.value)}
                      placeholder="Zoom Base URL"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Provider Section */}
              <div>
                <h4 className="text-lg font-semibold text-neutral-300 flex items-center gap-2">
                  <Package className="h-5 w-5 text-red-400" />
                  Shipping Provider
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-3">
                  <div>
                    <input
                      type="text"
                      value={shippingProvider}
                      onChange={(e) => setShippingProvider(e.target.value)}
                      placeholder="Shipping Provider"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={clickanddropBase}
                      onChange={(e) => setClickanddropBase(e.target.value)}
                      placeholder="ClickAndDrop Base URL"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={clickanddropApiKey}
                      onChange={(e) => setClickanddropApiKey(e.target.value)}
                      placeholder="ClickAndDrop API Key"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={clickanddropDefaultService}
                      onChange={(e) =>
                        setClickanddropDefaultService(e.target.value)
                      }
                      placeholder="Default Service (e.g. RM24)"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={clickanddropDefaultPackage}
                      onChange={(e) =>
                        setClickanddropDefaultPackage(e.target.value)
                      }
                      placeholder="Default Package (e.g. Parcel)"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      value={clickanddropMinWeightG}
                      onChange={(e) =>
                        setClickanddropMinWeightG(Number(e.target.value))
                      }
                      placeholder="Min Weight (g)"
                      className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-100 outline-none placeholder:text-neutral-600"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Buttons Section */}
            <div className="sticky bottom-0 left-0 right-0 bg-neutral-950 p-4 flex gap-4 justify-center sm:justify-start z-50">
              <button
                onClick={handleFillCredentials}
                className="w-full sm:w-auto rounded-xl bg-blue-600 text-white py-2 px-6 font-semibold transition-all transform hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 active:bg-blue-800"
              >
                Save Credentials
              </button>
              <button
                onClick={() => setFillCredentialsModalOpen(false)}
                className="w-full sm:w-auto rounded-xl bg-neutral-600 text-white py-2 px-6 font-semibold transition-all transform hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-400 active:bg-neutral-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}
