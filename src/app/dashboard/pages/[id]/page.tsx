"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { toast } from "react-toastify";



import type ReactQuillType from "react-quill";

import {
  getServiceApi,
  getBackendBase,
  getPageByIdApi,
  updatePageApi,
  uploadPageImageApi,
} from "../../../../api";
import QuillEditor from "../../../../components/QuillEditor";

/** 🔹 Same toolbar as CreatePage */
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

/** 🔹 Helper: resolve image path to full URL */
const resolveImageUrl = (imagePath: string) => {
  if (!imagePath) return "";

  // Already full URL
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

export default function EditPage() {
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : (rawId as string | undefined);

  const [page, setPage] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [service, setService] = useState<any | null>(null);

  const [content, setContent] = useState("");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [metaKeywords, setMetaKeywords] = useState(""); // comma separated
  const [template, setTemplate] = useState("default");
  const [visibility, setVisibility] = useState("public");
  const [status, setStatus] = useState("published");
  const [active, setActive] = useState(true);
  const [serviceId, setServiceId] = useState("");

  // gallery: existing URLs (string) or new Files
  const [gallery, setGallery] = useState<(File | string)[]>([]);

  // ✅ ref to real ReactQuill instance via QuillEditor
  const quillRef = useRef<ReactQuillType | null>(null);

  // 🔹 Image modal state
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageLink, setImageLink] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // ---------- Load page + linked service ----------
  useEffect(() => {
    const fetchPageAndService = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const data = await getPageByIdApi(id);
        setPage(data);

        setTitle(data.title ?? "");
        setSlug(data.slug ?? "");
        setDescription(data.description ?? "");
        setContent(data.content ?? "");
        setMetaTitle(data.meta_title ?? "");
        setMetaDescription(data.meta_description ?? "");
        setTemplate(data.template ?? "default");
        setVisibility(data.visibility ?? "public");
        setStatus(data.status ?? "published");
        setActive(typeof data.active === "boolean" ? data.active : true);
        setServiceId(data.service_id ?? "");

        const keywordsArr = Array.isArray(data.meta?.keywords)
          ? data.meta.keywords
          : [];
        setMetaKeywords(keywordsArr.join(", "));

        if (Array.isArray(data.gallery)) {
          setGallery(data.gallery); // existing URLs
        } else {
          setGallery([]);
        }

        if (data.service_id) {
          try {
            const svc = await getServiceApi(data.service_id);
            setService(svc);
          } catch (err) {
            console.error("Failed to load linked service:", err);
          }
        }
      } catch (error) {
        console.error("Error fetching page:", error);
        toast.error("Failed to load page.");
      } finally {
        setLoading(false);
      }
    };

    fetchPageAndService();
  }, [id]);

  // ---------- Gallery file picker ----------
  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArr = Array.from(files);
      setGallery((prev) => [...prev, ...fileArr]);
    }
  };

  // ---------- Open image modal for Quill ----------
  const openImageModal = useCallback(() => {
    setImageError(null);
    setImageFile(null);
    setImageLink("");
    setShowImageModal(true);
  }, []);

  // ---------- Quill modules ----------
  const modules = useMemo(
    () => ({
      toolbar: {
        container: toolbarOptions,
        handlers: {
          image: () => openImageModal(), // 👈 custom handler
        },
      },
    }),
    [openImageModal]
  );

  // ---------- Upload via /pages/upload-image ----------
  const handleUploadAndGetLink = useCallback(async () => {
    if (!imageFile) {
      setImageError("Please select an image file first.");
      return;
    }

    setUploadingImage(true);
    setImageError(null);

    try {
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

  // ---------- Insert image into Quill from modal ----------
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

  // ---------- Save / update ----------
  const savePage = async () => {
    if (!id) return;

    try {
      setSaving(true);

      const keywordsArr = metaKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      const galleryExisting: string[] = [];
      const galleryFiles: File[] = [];

      gallery.forEach((item) => {
        if (typeof item === "string") {
          galleryExisting.push(item);
        } else {
          galleryFiles.push(item);
        }
      });

      await updatePageApi(id, {
        title,
        slug,
        description,
        template,
        visibility,
        active,
        meta_title: metaTitle,
        meta_description: metaDescription,
        meta: {
          ...(page?.meta || {}),
          keywords: keywordsArr,
        },
        status,
        content,
        service_id: serviceId,
        galleryExisting,
        galleryFiles,
      });

      toast.success("Page updated successfully!");
      window.location.href = "/dashboard/pages";
    } catch (error: any) {
      console.error("Error while updating page:", error);
      toast.error(error?.message || "Failed to update page");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-neutral-300">
        <Loader2 className="animate-spin mr-2" /> Loading...
      </div>
    );
  }

  if (!page) {
    return (
      <div className="flex justify-center py-20 text-neutral-300">
        Page not found.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 bg-transparent text-white rounded-xl">
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/dashboard/pages"
          className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-white"
        >
          <ArrowLeft size={16} />
          Back to Pages
        </Link>
      </div>
      <h1 className="text-3xl font-semibold mb-6">Edit Page</h1>

      <div className="space-y-6 mb-10">
        {/* Service Info */}
        <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900 shadow-md">
          <h2 className="text-xl font-semibold mb-4">Service Details</h2>
          {service ? (
            <div className="flex items-center gap-6">
              {service.image && (
                <div className="w-20 h-20 bg-neutral-800 rounded-lg overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveImageUrl(service.image)}
                    alt={service.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="text-white text-sm space-y-1">
                <p>
                  <strong>Name:</strong> {service.name}
                </p>
                <p>
                  <strong>Slug:</strong> {service.slug}
                </p>
                <p>
                  <strong>Description:</strong> {service.description}
                </p>
                <p>
                  <strong>CTA Text:</strong> {service.cta_text || "No CTA Text"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-400">
              This page is not currently linked to a specific service.
            </p>
          )}
        </div>

        {/* Page Details */}
        <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900 shadow-md">
          <h2 className="text-xl font-semibold mb-4">Page Details</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-1">
              <label className="text-sm">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
              />
            </div>

            <div className="md:col-span-1">
              <label className="text-sm">Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm">Meta Title</label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
              />
            </div>

            <div>
              <label className="text-sm">Meta Description</label>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
                rows={3}
              />
            </div>

            <div>
              <label className="text-sm">Meta Keywords (comma separated)</label>
              <input
                type="text"
                value={metaKeywords}
                onChange={(e) => setMetaKeywords(e.target.value)}
                className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
              />
            </div>

            <div>
              <label className="text-sm">Template</label>
              <input
                type="text"
                value={template}
                onChange={(e) => setTemplate(e.target.value)}
                className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
              />
            </div>

            <div>
              <label className="text-sm">Visibility</label>
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value)}
                className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
              </select>
            </div>

            <div>
              <label className="text-sm">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                id="active-toggle"
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-600 bg-neutral-900"
              />
              <label
                htmlFor="active-toggle"
                className="text-sm text-neutral-300"
              >
                Active
              </label>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900 shadow-md">
          <h2 className="text-xl font-semibold mb-4">Content Editor</h2>

          <QuillEditor
            ref={quillRef}
            value={content}
            onChange={setContent}
            modules={modules}
            formats={formats}
            className="bg-neutral-800 text-white mb-3"
          />

          <h3 className="text-white text-lg">Generated HTML</h3>
          <div className="mt-2 p-4 bg-neutral-700 rounded-lg max-h-64 overflow-auto text-sm">
            <div className="whitespace-pre-wrap text-white">{content}</div>
          </div>
        </div>

        {/* Gallery Upload */}
        <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900 shadow-md">
          <h2 className="text-xl font-semibold mb-4">Gallery</h2>
          <input
            type="file"
            multiple
            onChange={handleGalleryChange}
            className="bg-neutral-800 text-neutral-300"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {gallery.map((item, idx) => {
              const src =
                typeof item === "string"
                  ? resolveImageUrl(item)
                  : URL.createObjectURL(item);

              return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={idx}
                  src={src}
                  alt={`Gallery image ${idx + 1}`}
                  className="w-24 h-24 object-cover rounded-md border border-neutral-700"
                />
              );
            })}
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end space-x-4 mt-6">
          <button
            onClick={savePage}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving && <Loader2 className="animate-spin" size={18} />}
            Save Changes
          </button>
        </div>
      </div>

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
