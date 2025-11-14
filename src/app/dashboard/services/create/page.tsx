"use client";

import React, { useState, memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Upload, Save, Plus, X } from "lucide-react";

const DEFAULT_FLOW_OPTIONS = [
  "Treatments",
  "Login",
  "RAF",
  "Calendar",
  "Payment",
];

/* ---------------------------------------------------
   REUSABLE SECTION COMPONENT
--------------------------------------------------- */
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

/* ---------------------------------------------------
   FLOW EDITOR COMPONENT
--------------------------------------------------- */
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
        {/* SELECT PREDEFINED */}
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

        {/* ADD CUSTOM STEP */}
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

        {/* DRAG LIST */}
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

/* ---------------------------------------------------
   MAIN PAGE (NO RE-RENDER BUGS)
--------------------------------------------------- */
export default function CreateServicePage() {
  const router = useRouter();

  /* BASIC INFO */
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [ctaText, setCtaText] = useState(""); // 🚀 NEW CTA TEXT

  const [viewType, setViewType] = useState("card");
  const [image, setImage] = useState<string | null>(null);

  /* FLOWS */
  const [bookingFlow, setBookingFlow] = useState<string[]>([]);
  const [reorderFlow, setReorderFlow] = useState<string[]>([]);

  const [customBookingStep, setCustomBookingStep] = useState("");
  const [customReorderStep, setCustomReorderStep] = useState("");

  const [selectedBookingOption, setSelectedBookingOption] = useState("");
  const [selectedReorderOption, setSelectedReorderOption] = useState("");

  /* ---------------------------------------------------
     SUBMIT FORM
  --------------------------------------------------- */
  const submitForm = async () => {
    const makeFlow = (arr: string[]) =>
      Object.fromEntries(
        Array.from({ length: 6 }).map((_, i) => [
          `step${i + 1}`,
          arr[i] ?? null,
        ])
      );

    const payload = {
      name,
      slug,
      description,
      booking_flow: makeFlow(bookingFlow),
      reorder_flow: makeFlow(reorderFlow),
      forms_assignment: {},
      status: "published",
      active: true,
      view_type: viewType,
      cta_text: ctaText || "Book Now", // 👈 uses custom CTA
      image,
    };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed");
      router.push("/dashboard/services");
    } catch (err) {
      alert("Error creating service");
    }
  };

  /* ---------------------------------------------------
     UI SECTION
  --------------------------------------------------- */
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
      <h1 className="text-3xl font-semibold tracking-wide mb-4">
        Create New Service
      </h1>

      {/* BASIC INFO */}
      <SectionCard title="Basic Information">
        <div className="grid gap-6">
          {/* NAME */}
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

          {/* SLUG */}
          <div>
            <label className="text-sm text-neutral-300">Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-1 w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
            />
          </div>

          {/* DESCRIPTION */}
          <div>
            <label className="text-sm text-neutral-300">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
            />
          </div>

          {/* CTA TEXT — NEW */}
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

      {/* IMAGE */}
      <SectionCard title="Service Image">
        <div className="flex items-center gap-4">
          {/* IMAGE PREVIEW BOX */}
          <div
            className="relative w-40 h-40 rounded-lg bg-neutral-800 border border-neutral-700 
                 flex items-center justify-center cursor-pointer overflow-hidden shadow"
            onClick={() =>
              !image && document.getElementById("upload-img")?.click()
            }
          >
            {image ? (
              <>
                <img src={image} className="w-full h-full object-cover" />

                {/* REMOVE IMAGE BUTTON */}
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // prevent open-file trigger
                    setImage(null);
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

          {/* FILE INPUT */}
          <input
            id="upload-img"
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setImage(URL.createObjectURL(file));
            }}
          />
        </div>
      </SectionCard>

      {/* VIEW TYPE */}
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

      {/* FLOWS */}
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

      {/* SAVE */}
      <div className="flex justify-end">
        <button
          onClick={submitForm}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 shadow-lg transition"
        >
          <Save size={18} />
          Save Service
        </button>
      </div>
    </div>
  );
}
