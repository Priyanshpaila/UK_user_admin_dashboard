"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Loader2 } from "lucide-react";

export default function ServicesPage() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ----------------------------------------
      FETCH SERVICES
  ---------------------------------------- */
  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/services`);

      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();
      setServices(data?.data || data || []); // supports multiple API formats
    } catch (err) {
      console.error(err);
      setError("Failed to load services.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Services</h1>

        <Link
          href="/dashboard/services/create"
          className="flex items-center gap-2 px-4 py-2 
                     bg-blue-600 hover:bg-blue-700 
                     text-white rounded-lg shadow"
        >
          <Plus size={18} />
          Add Service
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-neutral-400" size={32} />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-10 text-red-400">{error}</div>
      )}

      {/* Empty State */}
      {!loading && services.length === 0 && !error && (
        <div className="text-center py-14 border border-neutral-800 bg-neutral-900 rounded-xl">
          <p className="text-neutral-300">No services found.</p>

          <Link
            href="/dashboard/services/create"
            className="mt-4 inline-flex gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            <Plus size={18} />
            Create First Service
          </Link>
        </div>
      )}

      {/* Services List */}
      {!loading && services.length > 0 && (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800">
          {services.map((svc) => (
            <div
              key={svc.id}
              className="p-4 flex justify-between items-center hover:bg-neutral-800 transition"
            >
              <div>
                <p className="text-white font-medium">{svc.name}</p>
                <p className="text-neutral-400 text-sm capitalize">
                  {svc.status || "published"}
                </p>
              </div>

              <Link
                href={`/dashboard/services/${svc._id}`}
                className="text-blue-400 hover:underline text-sm"
              >
                Edit
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
