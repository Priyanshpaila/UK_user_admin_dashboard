"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Loader2, Save, Upload, X, Plus } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const DEFAULT_FLOW_OPTIONS = ["Treatments", "Login", "RAF", "Calendar", "Payment"];

/* -----------------------------------------------------
   REUSABLE SECTION
----------------------------------------------------- */
function SectionCard({ title, children }: any) {
  return (
    <section className="p-6 rounded-xl border border-neutral-800 bg-neutral-900 shadow-md">
      <h2 className="text-xl font-semibold mb-4 tracking-wide text-white">{title}</h2>
      {children}
    </section>
  );
}

/* -----------------------------------------------------
   FLOW EDITOR COMPONENT
----------------------------------------------------- */
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

        {/* PREDEFINED STEP SELECT */}
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
            <option key={step} value={step}>{step}</option>
          ))}
        </select>

        {/* CUSTOM ADD */}
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

        {/* DRAGGABLE LIST */}
        <DragDropContext onDragEnd={reorderList}>
          <Droppable droppableId={`${title}-drop`}>
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                {list.map((step: string, i: number) => (
                  <Draggable key={`${title}-${i}`} draggableId={`${title}-${i}`} index={i}>
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

                        <button onClick={() => removeStep(i)} className="text-red-400 hover:text-red-300">
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

/* -----------------------------------------------------
   MAIN EDIT SERVICE PAGE
----------------------------------------------------- */
export default function EditServicePage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id;

  /* States */
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [ctaText, setCtaText] = useState("");

  const [viewType, setViewType] = useState("card");
  const [image, setImage] = useState<string | null>(null);

  const [bookingFlow, setBookingFlow] = useState<string[]>([]);
  const [reorderFlow, setReorderFlow] = useState<string[]>([]);

  const [selectedBookingOption, setSelectedBookingOption] = useState("");
  const [selectedReorderOption, setSelectedReorderOption] = useState("");

  const [customBookingStep, setCustomBookingStep] = useState("");
  const [customReorderStep, setCustomReorderStep] = useState("");

  /* -----------------------------------------------------
     FETCH EXISTING SERVICE
  ----------------------------------------------------- */
  useEffect(() => {
    if (!id) return;

    const loadService = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/services/${id}`);
        if (!res.ok) throw new Error("Failed");

        const data = await res.json();

        setName(data.name);
        setSlug(data.slug);
        setDescription(data.description);
        setCtaText(data.cta_text || "");
        setViewType(data.view_type);
        setImage(data.image);

        setBookingFlow([
          data.booking_flow?.step1,
          data.booking_flow?.step2,
          data.booking_flow?.step3,
          data.booking_flow?.step4,
          data.booking_flow?.step5,
          data.booking_flow?.step6,
        ].filter(Boolean));

        setReorderFlow([
          data.reorder_flow?.step1,
          data.reorder_flow?.step2,
          data.reorder_flow?.step3,
          data.reorder_flow?.step4,
          data.reorder_flow?.step5,
          data.reorder_flow?.step6,
        ].filter(Boolean));

      } catch (err) {
        console.error(err);
        alert("Failed to load service");
      } finally {
        setLoading(false);
      }
    };

    loadService();
  }, [id]);

  /* -----------------------------------------------------
     SAVE EDITS (PUT METHOD)
  ----------------------------------------------------- */
  const saveService = async () => {
    const formatFlow = (arr: string[]) =>
      Object.fromEntries(
        Array.from({ length: 6 }).map((_, i) => [`step${i + 1}`, arr[i] ?? null])
      );

    const payload = {
      name,
      slug,
      description,
      cta_text: ctaText || "Book Now",
      view_type: viewType,
      image,
      booking_flow: formatFlow(bookingFlow),
      reorder_flow: formatFlow(reorderFlow),
      active: true,
      status: "published",
      forms_assignment: {},
    };

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/services/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed");
      router.push("/dashboard/services");
    } catch (error) {
      alert("Error while saving service");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin text-neutral-400" size={40} />
      </div>
    );
  }

  /* -----------------------------------------------------
     RENDER UI
  ----------------------------------------------------- */
  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
      <h1 className="text-3xl font-semibold tracking-wide mb-4">
        Edit Service
      </h1>

      {/* BASIC INFO */}
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

      {/* IMAGE */}
      <SectionCard title="Service Image">
        <div className="flex items-start gap-6">

          <div
            className="w-40 h-40 bg-neutral-800 border border-neutral-700 rounded-lg flex items-center justify-center overflow-hidden cursor-pointer"
            onClick={() => document.getElementById("edit-img")?.click()}
          >
            {image ? (
              <img src={image} className="w-full h-full object-cover" />
            ) : (
              <Upload size={34} className="text-neutral-400" />
            )}
          </div>

          <input
            id="edit-img"
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setImage(URL.createObjectURL(file));
            }}
          />

          {image && (
            <button
              onClick={() => setImage(null)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Remove Image
            </button>
          )}
        </div>
      </SectionCard>

      {/* VIEW TYPE */}
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

      {/* SAVE BUTTON */}
      <div className="flex justify-end">
        <button
          onClick={saveService}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white flex items-center gap-2 shadow-lg"
        >
          <Save size={18} />
          Save Changes
        </button>
      </div>
    </div>
  );
}
