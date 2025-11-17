"use client";

import React, { useState, memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Upload, Save, Plus, X } from "lucide-react";
import { getBackendBase } from "../../../../api";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const DEFAULT_FLOW_OPTIONS = [
  "Treatments",
  "Login",
  "RAF",
  "Calendar",
  "Payment",
];

const SectionCard = memo(function SectionCard({
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
});

const FlowEditor = memo(function FlowEditor({
  title,
  list,
  setList,
  customStep,
  setCustomStep,
  selectedOption,
  setSelectedOption,
}: any) {
  const reorderList = useCallback(
    (result: any) => {
      if (!result.destination) return;

      const updated = [...list];
      const [removed] = updated.splice(result.source.index, 1);
      updated.splice(result.destination.index, 0, removed);

      setList(updated);
    },
    [list, setList]
  );

  const removeStep = (i: number) => {
    const updated = list.filter((_: any, idx: number) => idx !== i);
    setList(updated);
  };

  return (
    <SectionCard title={title}>
      <div className="space-y-6">
        <select
          value={selectedOption}
          className="w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md text-neutral-200"
          onChange={(e) => {
            const val = e.target.value;
            if (!val) return;
            if (!list.includes(val)) setList([...list, val]);
            setSelectedOption("");
          }}
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
            className="flex-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md text-neutral-200"
          />
          <button
            onClick={() => {
              if (!customStep.trim()) return;
              setList([...list, customStep.trim()]);
              setCustomStep("");
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow flex items-center gap-2"
          >
            <Plus size={16} /> Add
          </button>
        </div>

        <DragDropContext onDragEnd={reorderList}>
          <Droppable droppableId={title}>
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="space-y-2"
              >
                {list.map((step: string, idx: number) => (
                  <Draggable
                    key={`${title}-${idx}`}
                    draggableId={`${title}-${idx}`}
                    index={idx}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="bg-neutral-800 px-4 py-2 border border-neutral-700 rounded-md 
                                   flex justify-between items-center shadow-sm cursor-grab hover:border-neutral-600"
                      >
                        <span className="text-neutral-200">
                          Step {idx + 1}:{" "}
                          <span className="text-white font-medium">{step}</span>
                        </span>

                        <button
                          onClick={() => removeStep(idx)}
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
});

export default function CreateServicePage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [viewType, setViewType] = useState("card");

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [bookingFlow, setBookingFlow] = useState<string[]>([]);
  const [reorderFlow, setReorderFlow] = useState<string[]>([]);

  const [customBookingStep, setCustomBookingStep] = useState("");
  const [customReorderStep, setCustomReorderStep] = useState("");

  const [selectedBookingOption, setSelectedBookingOption] = useState("");
  const [selectedReorderOption, setSelectedReorderOption] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const submitForm = async () => {
    setSubmitting(true);
    try {
      const makeFlow = (arr: string[]) =>
        Object.fromEntries(
          Array.from({ length: 6 }).map((_, i) => [
            `step${i + 1}`,
            arr[i] ?? null,
          ])
        );

      const booking = makeFlow(bookingFlow);
      const reorder = makeFlow(reorderFlow);

      const formData = new FormData();

      formData.append("name", name);
      formData.append("slug", slug);
      formData.append("description", description);
      formData.append("view_type", viewType);
      formData.append("cta_text", ctaText || "Book Now");
      formData.append("status", "published");

      formData.append("booking_flow", JSON.stringify(booking));
      formData.append("reorder_flow", JSON.stringify(reorder));
      formData.append("forms_assignment", JSON.stringify({}));

      if (imageFile) {
        formData.append("image", imageFile);
      }

      const base = getBackendBase();
      const res = await fetch(`${base}/services`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        console.error("Service create failed:", txt);
        toast.error("Error creating service");
        return;
      }

      toast.success("Service created successfully");
      router.push("/dashboard/services");
    } catch (err) {
      console.error(err);
      toast.error("Error creating service");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
      {/* Toasts */}
      <ToastContainer position="top-right" autoClose={3000} />

      <h1 className="text-3xl font-semibold tracking-wide mb-4">
        Create New Service
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
              className="mt-1 w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
            />
          </div>

          <div>
            <label className="text-sm text-neutral-300">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-1 w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
            />
          </div>

          <div>
            <label className="text-sm text-neutral-300">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
            />
          </div>

          <div>
            <label className="text-sm text-neutral-300">CTA Button Text</label>
            <input
              value={ctaText}
              onChange={(e) => setCtaText(e.target.value)}
              placeholder="Book Vaccine / Schedule Visit / etc."
              className="mt-1 w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Service Image">
        <div className="flex items-center gap-4">
          <div
            className="relative w-40 h-40 rounded-lg bg-neutral-800 border border-neutral-700 
                 flex items-center justify-center cursor-pointer overflow-hidden shadow"
            onClick={() =>
              !imagePreview && document.getElementById("upload-img")?.click()
            }
          >
            {imagePreview ? (
              <>
                <img src={imagePreview} className="w-full h-full object-cover" />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setImagePreview(null);
                    setImageFile(null);
                  }}
                  className="absolute top-2 right-2 bg-red-600/80 hover:bg-red-700 text-white 
                       rounded-full p-1 shadow transition"
                >
                  <X size={16} />
                </button>
              </>
            ) : (
              <Upload size={34} className="text-neutral-400" />
            )}
          </div>

          <input
            id="upload-img"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setImageFile(file);
              setImagePreview(URL.createObjectURL(file));
            }}
          />
        </div>
      </SectionCard>

      <SectionCard title="View Type">
        <select
          value={viewType}
          onChange={(e) => setViewType(e.target.value)}
          className="bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md text-neutral-200"
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
          onClick={submitForm}
          disabled={submitting}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 shadow-lg transition disabled:opacity-60"
        >
          <Save size={18} />
          {submitting ? "Saving..." : "Save Service"}
        </button>
      </div>
    </div>
  );
}
