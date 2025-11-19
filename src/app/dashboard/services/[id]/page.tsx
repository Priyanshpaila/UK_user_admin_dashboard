"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2, Save, Upload, X, Plus, ArrowLeft } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { getServiceApi, getBackendBase } from "../../../../api";
import { toast, ToastContainer } from "react-toastify";
import Link from "next/link";
import "react-toastify/dist/ReactToastify.css";

const DEFAULT_FLOW_OPTIONS = [
  "Treatments",
  "Login",
  "RAF",
  "Calendar",
  "Payment",
];

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="p-6 rounded-xl border border-neutral-800 bg-neutral-900 shadow-md">
      <h2 className="text-xl font-semibold mb-4 tracking-wide text-white">
        {title}
      </h2>
      {children}
    </section>
  );
}

function FlowEditor({
  title,
  list,
  setList,
  customStep,
  setCustomStep,
  selectedOption,
  setSelectedOption,
}: any) {
  const reorderList = (result: any) => {
    if (!result.destination) return;
    const items = [...list];
    const [removed] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, removed);
    setList(items);
  };

  const removeStep = (i: number) => {
    setList(list.filter((_: any, idx: number) => idx !== i));
  };

  return (
    <SectionCard title={title}>
      <div className="space-y-6">
        <select
          value={selectedOption}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) return;
            if (!list.includes(val)) setList([...list, val]);
            setSelectedOption("");
          }}
          className="w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
        >
          <option value="">Select step...</option>
          {DEFAULT_FLOW_OPTIONS.map((step) => (
            <option key={step} value={step}>
              {step}
            </option>
          ))}
        </select>

        <div className="flex gap-3">
          <input
            placeholder="Add custom step..."
            value={customStep}
            onChange={(e) => setCustomStep(e.target.value)}
            className="flex-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
          />
          <button
            onClick={() => {
              if (!customStep.trim()) return;
              setList([...list, customStep.trim()]);
              setCustomStep("");
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white flex gap-2"
          >
            <Plus size={16} /> Add
          </button>
        </div>

        <DragDropContext onDragEnd={reorderList}>
          <Droppable droppableId={`${title}-drop`}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-2"
              >
                {list.map((step: string, i: number) => (
                  <Draggable
                    key={`${title}-${i}`}
                    draggableId={`${title}-${i}`}
                    index={i}
                  >
                    {(provided) => (
                      <div
                        className="bg-neutral-800 px-4 py-2 border border-neutral-700 rounded-md flex justify-between items-center shadow-sm cursor-grab"
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <span className="text-white">
                          Step {i + 1}: <b>{step}</b>
                        </span>

                        <button
                          onClick={() => removeStep(i)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}

                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>
    </SectionCard>
  );
}

export default function EditServicePage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : (rawId as string | undefined);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [ctaText, setCtaText] = useState("");

  const [viewType, setViewType] = useState("card");

  // image preview + file + original path
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImagePath, setExistingImagePath] = useState<string | null>(
    null
  );

  const [bookingFlow, setBookingFlow] = useState<string[]>([]);
  const [reorderFlow, setReorderFlow] = useState<string[]>([]);

  const [selectedBookingOption, setSelectedBookingOption] = useState("");
  const [selectedReorderOption, setSelectedReorderOption] = useState("");

  const [customBookingStep, setCustomBookingStep] = useState("");
  const [customReorderStep, setCustomReorderStep] = useState("");

  useEffect(() => {
    if (!id) return;

    const loadService = async () => {
      try {
        const data = await getServiceApi(id);

        setName(data.name);
        setSlug(data.slug);
        setDescription(data.description);
        setCtaText(data.cta_text || "");
        setViewType(data.view_type);

        // IMAGE HANDLING
        if (data.image) {
          setExistingImagePath(data.image);
          const baseForImage = getBackendBase().replace(/\/api\/?$/, ""); // strip /api
          const fullUrl =
            typeof data.image === "string" && data.image.startsWith("http")
              ? data.image
              : `${baseForImage}/${String(data.image).replace(/^\/+/, "")}`;
          setImagePreview(fullUrl);
        } else {
          setExistingImagePath(null);
          setImagePreview(null);
        }

        // BOOKING FLOW (stored as JSON string)
        let bookingObj: any = {};
        try {
          bookingObj = data.booking_flow ? JSON.parse(data.booking_flow) : {};
        } catch (e) {
          console.warn("Failed to parse booking_flow JSON:", e);
          bookingObj = {};
        }

        setBookingFlow(
          [
            bookingObj.step1,
            bookingObj.step2,
            bookingObj.step3,
            bookingObj.step4,
            bookingObj.step5,
            bookingObj.step6,
          ].filter(Boolean)
        );

        // REORDER FLOW (stored as JSON string)
        let reorderObj: any = {};
        try {
          reorderObj = data.reorder_flow ? JSON.parse(data.reorder_flow) : {};
        } catch (e) {
          console.warn("Failed to parse reorder_flow JSON:", e);
          reorderObj = {};
        }

        setReorderFlow(
          [
            reorderObj.step1,
            reorderObj.step2,
            reorderObj.step3,
            reorderObj.step4,
            reorderObj.step5,
            reorderObj.step6,
          ].filter(Boolean)
        );
      } catch (err) {
        console.error(err);
        toast.error("Failed to load service");
      } finally {
        setLoading(false);
      }
    };

    loadService();
  }, [id]);

  const saveService = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const formatFlow = (arr: string[]) =>
        Object.fromEntries(
          Array.from({ length: 6 }).map((_, i) => [
            `step${i + 1}`,
            arr[i] ?? null,
          ])
        );

      const booking = formatFlow(bookingFlow);
      const reorder = formatFlow(reorderFlow);

      const formData = new FormData();

      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("description", description);
      formData.append("cta_text", ctaText || "Book Now");
      formData.append("view_type", viewType);
      formData.append("status", "published");

      formData.append("booking_flow", JSON.stringify(booking));
      formData.append("reorder_flow", JSON.stringify(reorder));
      formData.append("forms_assignment", JSON.stringify({}));

      if (imageFile) {
        formData.append("image", imageFile);
      } else if (existingImagePath) {
        // let backend keep old image if supported
        formData.append("existingImage", existingImagePath);
      }

      const base = getBackendBase();
      const res = await fetch(`${base}/services/${id}`, {
        method: "PUT",
        body: formData,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("Update service failed:", txt);
        toast.error("Error while saving service");
        return;
      }

      toast.success("Service updated successfully");
      router.push("/dashboard/services");
    } catch (error) {
      console.error(error);
      toast.error("Error while saving service");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        {/* Toast container here so errors during load still show */}
        <ToastContainer position="top-right" autoClose={3000} />
        <Loader2 className="animate-spin text-neutral-400" size={40} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/services"
          className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to Services
        </Link>
      </div>

      <h1 className="text-3xl font-semibold tracking-wide mb-4">
        Edit Service
      </h1>

      <SectionCard title="Basic Information">
        <div className="grid gap-6">
          <div>
            <label className="text-sm text-neutral-300">Service Name</label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
              }}
              className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
            />
          </div>

          <div>
            <label className="text-sm text-neutral-300">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
            />
          </div>

          <div>
            <label className="text-sm text-neutral-300">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
            />
          </div>

          <div>
            <label className="text-sm text-neutral-300">CTA Button Text</label>
            <input
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              placeholder="Book Now / Book Vaccine / etc."
              className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Service Image">
        <div className="flex items-start gap-6">
          <div
            className="w-40 h-40 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center justify-center overflow-hidden cursor-pointer"
            onClick={() => document.getElementById("edit-img")?.click()}
          >
            {imagePreview ? (
              <img src={imagePreview} className="w-full h-full object-cover" />
            ) : (
              <Upload size={34} className="text-neutral-400" />
            )}
          </div>

          <input
            id="edit-img"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setImageFile(file);
                setImagePreview(URL.createObjectURL(file));
              }
            }}
          />

          {imagePreview && (
            <button
              onClick={() => {
                setImagePreview(null);
                setImageFile(null);
                setExistingImagePath(null);
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Remove Image
            </button>
          )}
        </div>
      </SectionCard>

      <SectionCard title="View Type">
        <select
          value={viewType}
          onChange={(e) => setViewType(e.target.value)}
          className="bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
        >
          <option value="card">Card</option>
          <option value="list">List</option>
        </select>
      </SectionCard>

      <FlowEditor
        title="Booking Flow"
        list={bookingFlow}
        setList={setBookingFlow}
        customStep={customBookingStep}
        setCustomStep={setCustomBookingStep}
        selectedOption={selectedBookingOption}
        setSelectedOption={setSelectedBookingOption}
      />

      <FlowEditor
        title="Reorder Flow"
        list={reorderFlow}
        setList={setReorderFlow}
        customStep={customReorderStep}
        setCustomStep={setCustomReorderStep}
        selectedOption={selectedReorderOption}
        setSelectedOption={setSelectedReorderOption}
      />

      <div className="flex justify-end">
        <button
          onClick={saveService}
          disabled={saving}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white flex items-center gap-2 shadow-lg disabled:opacity-60"
        >
          <Save size={18} />
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
