"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import Link from "next/link";
import "react-quill/dist/quill.snow.css";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { toast } from "react-toastify";

import type ReactQuillType from "react-quill";

import {
  getServiceApi,
  createPageApi,
  uploadPageImageApi,
  getBackendBase,
} from "../../../../api";
import QuillEditor from "../../../../components/QuillEditor";

/** 🔹 Toolbar config – image button opens our modal */
const toolbarOptions = [
  [{ header: [1, 2, 3, 4, 5, 6, false] }],
  [{ font: [] }],
  [{ size: ["small", false, "large", "huge"] }],
  ["bold", "italic", "underline", "strike"],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  ["blockquote", "code-block"],
  ["link", "image", "video"],
  ["clean"],
];

const formats = [
  "header",
  "font",
  "size",
  "bold",
  "italic",
  "underline",
  "strike",
  "color",
  "background",
  "align",
  "list",
  "bullet",
  "blockquote",
  "code-block",
  "link",
  "image",
  "video",
];

/** 🔹 Helper: resolve backend image path to full URL */
const resolveImageUrl = (imagePath: string) => {
  if (!imagePath) return "";

  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  const normalizedPath = imagePath.startsWith("/")
    ? imagePath
    : `/${imagePath}`;

  const baseWithApi = getBackendBase();
  const cleanBase = baseWithApi.replace(/\/api\/?$/, "");

  return `${cleanBase}${normalizedPath}`;
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
  const [metaKeywords, setMetaKeywords] = useState("");
  const [template, setTemplate] = useState("default");
  const [visibility, setVisibility] = useState("public");
  const [status, setStatus] = useState("published");
  const [active, setActive] = useState(true);
  const [content, setContent] = useState("");
  const [gallery, setGallery] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  // ✅ This ref will now point to the real ReactQuill instance via QuillEditor
  const quillRef = useRef<ReactQuillType | null>(null);

  // 🔹 Image modal state
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageLink, setImageLink] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  /** Load services */
  useEffect(() => {
    const loadServices = async () => {
      try {
        const res = await getServiceApi("");
        setServices(res?.data || []);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load services");
      } finally {
        setLoadingServices(false);
      }
    };
    loadServices();
  }, []);

  /** Gallery file picker (page gallery, not Quill upload) */
  const handleGallery = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setGallery((prev) => [...prev, ...files]);
    }
  };

  /** Open Quill image modal */
  const openImageModal = useCallback(() => {
    setImageError(null);
    setImageFile(null);
    setImageLink("");
    setShowImageModal(true);
  }, []);

  /** Quill modules with toolbar handler */
  const modules = useMemo(
    () => ({
      toolbar: {
        container: toolbarOptions,
        handlers: {
          image: () => openImageModal(), // 👈 our custom handler
        },
      },
    }),
    [openImageModal]
  );

  /** Upload via /pages/upload-image and auto-fill link */
  const handleUploadAndGetLink = useCallback(async () => {
    if (!imageFile) {
      setImageError("Please select an image file first.");
      return;
    }

    setUploadingImage(true);
    setImageError(null);

    try {
      // 👇 this calls http://localhost:8000/api/pages/upload-image
      const res = await uploadPageImageApi(imageFile);
      const rawPath = (res as any).url || (res as any).path;
      if (!rawPath) {
        throw new Error("Upload succeeded but no URL was returned.");
      }

      const fullUrl = resolveImageUrl(rawPath);
      setImageLink(fullUrl);
    } catch (err: any) {
      console.error("Image upload failed:", err);
      setImageError(err?.message || "Failed to upload image.");
    } finally {
      setUploadingImage(false);
    }
  }, [imageFile]);

  /** Insert image into Quill from link (modal) */
  const handleInsertImageFromModal = useCallback(() => {
    if (!imageLink.trim()) {
      setImageError("Please enter or fetch an image URL.");
      return;
    }

    const editor = quillRef.current?.getEditor?.();
    if (!editor) {
      setImageError("Editor not ready. Please try again.");
      return;
    }

    const url = imageLink.trim();
    const range = editor.getSelection(true);
    const index = range ? range.index : editor.getLength();

    editor.insertEmbed(index, "image", url, "user");
    editor.setSelection(index + 1, 0);
    setShowImageModal(false);
  }, [imageLink]);

  /** Create page submit */
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

      const meta = {
        keywords: keywordsArr,
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
      fd.append("meta", JSON.stringify(meta));
      fd.append("content", content);
      fd.append("service_id", selectedService._id);
      fd.append("published_at", new Date().toISOString());

      gallery.forEach((file) => {
        fd.append("gallery", file);
      });

      await createPageApi(fd);

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
          <select
            className="w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
            onChange={(e) => {
              const svc =
                services.find((s) => s._id === e.target.value) || null;
              setSelectedService(svc);

              if (svc?.slug) setSlug(svc.slug);
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

      {/* STEP 2: Builder */}
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

            <QuillEditor
              ref={quillRef}
              value={content}
              onChange={setContent}
              modules={modules}
              formats={formats}
              className="bg-neutral-800 text-white"
            />

            <h3 className="text-white text-lg mt-4">Generated HTML</h3>
            <div className="mt-2 p-4 bg-neutral-700 rounded-lg max-h-64 overflow-auto text-sm">
              <div className="whitespace-pre-wrap text-white">{content}</div>
            </div>
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
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="animate-spin" size={18} />}
              Create Page
            </button>
          </div>
        </div>
      )}

      {/* 🔹 Image Insert Modal for Quill */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-700 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-white">
                Insert Image
              </h2>
              <button
                type="button"
                onClick={() => !uploadingImage && setShowImageModal(false)}
                className="text-neutral-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-neutral-300 mb-1 block">
                  Select image file (optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setImageFile(file);
                    setImageError(null);
                  }}
                  className="w-full text-xs text-neutral-200"
                />
                <button
                  type="button"
                  onClick={handleUploadAndGetLink}
                  disabled={!imageFile || uploadingImage}
                  className="mt-2 inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingImage ? "Uploading…" : "Get link from upload"}
                </button>
              </div>

              <div>
                <label className="text-xs text-neutral-300 mb-1 block">
                  Image URL
                </label>
                <input
                  type="text"
                  className="w-full bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md text-sm text-neutral-100"
                  placeholder="https://example.com/image.png"
                  value={imageLink}
                  onChange={(e) => {
                    setImageLink(e.target.value);
                    setImageError(null);
                  }}
                />
                <p className="mt-1 text-[11px] text-neutral-500">
                  Paste an image URL, or upload a file and use “Get link”.
                </p>
              </div>

              {imageError && (
                <div className="rounded-lg border border-rose-400 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
                  {imageError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImageModal(false)}
                  className="px-4 py-1.5 rounded-full text-xs font-medium bg-neutral-700 hover:bg-neutral-600"
                  disabled={uploadingImage}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleInsertImageFromModal}
                  className="px-4 py-1.5 rounded-full text-xs font-medium bg-emerald-600 hover:bg-emerald-700"
                  disabled={uploadingImage}
                >
                  Insert image
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
