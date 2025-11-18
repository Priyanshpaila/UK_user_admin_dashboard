"use client";
import React, { useEffect, useState } from "react";
import { getServiceApi } from "../../../api"; // Assuming your API function is located in 'api.ts'
import Link from "next/link";
import { Plus, Loader2 } from "lucide-react";

export default function Page() {
  const [services, setServices] = useState<any[]>([]); // State to store fetched services
  const [loading, setLoading] = useState(true); // State to track loading status
  const [error, setError] = useState(""); // State to handle error messages

  // Fetch services on component mount
  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        const response = await getServiceApi(""); // Fetch all services
        if (
          !response ||
          !Array.isArray(response.data) ||
          response.data.length === 0
        ) {
          setError("No services found.");
        } else {
          setServices(response.data); // Set services data
        }
      } catch (error) {
        console.error("Error fetching services:", error);
        setError("Failed to load services.");
      } finally {
        setLoading(false); // Set loading to false once fetch is done
      }
    };

    fetchServices();
  }, []); // Empty dependency array ensures this runs once on mount

  return (
    <div className="max-w-7xl mx-auto px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Pages</h1>
        <Link
          href="/dashboard/services/create"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow"
        >
          <Plus size={18} />
          New Service
        </Link>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-neutral-400" size={32} />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-center py-14 border border-neutral-800 bg-neutral-900 rounded-xl">
          <p className="text-neutral-300">{error}</p>
        </div>
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
          {services.map((service) => (
            <div
              key={service._id} // Use service._id as the key
              className="p-4 flex justify-between items-center hover:bg-neutral-800 transition"
            >
              <div>
                <p className="text-white font-medium">{service.name}</p>{" "}
                {/* Use 'name' instead of 'title' */}
                <p className="text-neutral-400 text-sm capitalize">
                  {service.status || "published"}
                </p>
              </div>
              <div className="flex space-x-4">
                <Link
                  href={`/dashboard/pages/${service._id}`}
                  className="text-yellow-500 px-2 py-1 rounded-lg"
                  // Add functionality to "Build View" button
                >
                  Build View
                </Link>
                {/* <Link
                  href={`/dashboard/services/${service._id}`} // Use service._id to create the link for editing
                  className="text-yellow-400 hover:underline text-sm"
                >
                  Edit
                </Link> */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
