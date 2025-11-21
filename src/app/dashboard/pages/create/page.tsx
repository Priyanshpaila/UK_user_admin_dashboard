"use client";
import React, { useEffect, useState } from "react";
import { getServiceApi, createPageApi } from "../../../../api";
import dynamic from "next/dynamic";
import "react-quill/dist/quill.snow.css";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "react-toastify";

const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });
const QuillEmoji = dynamic(() => import("quill-emoji"), { ssr: false });
const QuillMention = dynamic(() => import("quill-mention"), { ssr: false });
const QuillTable = dynamic(() => import("quill-table"), { ssr: false });

const modules = {
  toolbar: [
    [{ header: "1" }, { header: "2" }, { font: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["bold", "italic", "underline", "strike"],
    ["link", "image", "video"],
    [{ color: [] }, { background: [] }],
    ["blockquote", "code-block"],
    [{ table: [] }],
    ["emoji", "mention"],
  ],
};

export default function CreatePage() {
  const [services, setServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedService, setSelectedService] = useState<any | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [metaKeywords, setMetaKeywords] = useState(""); // comma-separated
  const [template, setTemplate] = useState("default");
  const [visibility, setVisibility] = useState("public");
  const [status, setStatus] = useState("published");
  const [active, setActive] = useState(true);
  const [content, setContent] = useState("");
  const [gallery, setGallery] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);

  useEffect(() => {
    const loadServices = async () => {
      try {
        const res = await getServiceApi("");
        setServices(res?.data || []);
      } catch (e) {
        toast.error("Failed to load services");
      } finally {
        setLoadingServices(false);
      }
    };
    loadServices();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const QuillCore = require("quill");
      QuillCore.register("modules/table", QuillTable);
      QuillCore.register("modules/emoji", QuillEmoji);
      QuillCore.register("modules/mention", QuillMention);
    }
  }, []);

  const handleGallery = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setGallery((prev) => [...prev, ...files]);
    }
  };

  const handleCreatePage = async () => {
    if (!selectedService) return toast.error("Please select a service");
    if (!title.trim()) return toast.error("Title is required");
    if (!slug.trim()) return toast.error("Slug is required");

    setSaving(true);

    try {
      const keywordsArr = metaKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      // Whatever meta shape you want
      const meta = {
        keywords: keywordsArr,
        // you can extend this later with background, author, etc.
        // background: { enabled: false }
      };

      const fd = new FormData();

      fd.append("title", title);
      fd.append("slug", slug);
      fd.append("description", description);
      fd.append("template", template);
      fd.append("visibility", visibility);
      fd.append("status", status);
      fd.append("active", String(active));
      fd.append("meta_title", metaTitle);
      fd.append("meta_description", metaDescription);

      // 🔴 IMPORTANT: meta as JSON string
      fd.append("meta", JSON.stringify(meta));

      fd.append("content", content);
      fd.append("service_id", selectedService._id);
      fd.append("published_at", new Date().toISOString());

      gallery.forEach((file) => {
        fd.append("gallery", file); // field name must match Multer config
      });

      await createPageApi(fd); // keep this as FormData

      toast.success("Page created successfully!");
      window.location.href = "/dashboard/pages";
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || "Failed to create page");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 text-white">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/pages"
          className="flex items-center text-neutral-400 hover:text-white"
        >
          <ArrowLeft size={18} /> Back
        </Link>
      </div>

      <h1 className="text-3xl font-semibold mb-6">Create Page</h1>

      {/* STEP 1: Select Service */}
      <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900 mb-8">
        <h2 className="text-xl mb-3 font-semibold">Select Service</h2>

        {loadingServices ? (
          <div className="flex justify-center py-6">
            <Loader2 className="animate-spin text-neutral-400" size={28} />
          </div>
        ) : (
          // inside your <select onChange=...>

          <select
            className="w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
            onChange={(e) => {
              const svc =
                services.find((s) => s._id === e.target.value) || null;
              setSelectedService(svc);

              // 🔹 Auto-fill slug from service.slug
              if (svc?.slug) {
                setSlug(svc.slug);
              }
            }}
            defaultValue=""
          >
            <option value="" disabled>
              -- Select Service --
            </option>
            {services.map((svc) => (
              <option key={svc._id} value={svc._id}>
                {svc.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* STEP 2: Page Builder */}
      {selectedService && (
        <div className="space-y-8">
          {/* Service Preview */}
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900">
            <h2 className="text-xl font-semibold mb-4">Service Details</h2>
            <p>
              <strong>Name:</strong> {selectedService.name}
            </p>
            <p>
              <strong>Slug:</strong> {selectedService.slug}
            </p>
          </div>

          {/* Page Details */}
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900">
            <h2 className="text-xl mb-4 font-semibold">Page Details</h2>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm">Title</label>
                <input
                  className="w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm">Slug</label>
                <input
                  className="w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm">Description</label>
                <textarea
                  rows={3}
                  className="w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm">Meta Title</label>
                <input
                  className="w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm">Meta Description</label>
                <input
                  className="w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm">Keywords (comma separated)</label>
                <input
                  className="w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
                  value={metaKeywords}
                  onChange={(e) => setMetaKeywords(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm">Template</label>
                <input
                  className="w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Editor */}
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900">
            <h2 className="text-xl mb-4 font-semibold">Content Editor</h2>

            <ReactQuill
              value={content}
              onChange={setContent}
              theme="snow"
              modules={modules}
              className="bg-neutral-800 text-white"
            />
          </div>

          {/* Gallery */}
          <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900">
            <h2 className="text-xl font-semibold mb-4">Gallery</h2>
            <input
              type="file"
              multiple
              onChange={handleGallery}
              className="bg-neutral-800"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end">
            <button
              disabled={saving}
              onClick={handleCreatePage}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white flex items-center gap-2"
            >
              {saving && <Loader2 className="animate-spin" size={18} />}
              Create Page
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
