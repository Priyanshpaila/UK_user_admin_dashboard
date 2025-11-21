"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  getServiceApi,
  getBackendBase,
  getPageByIdApi,
  updatePageApi,
} from "../../../../api";
import dynamic from "next/dynamic";
import "react-quill/dist/quill.snow.css";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";

// Quill
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });
const QuillEmoji = dynamic(() => import("quill-emoji"), { ssr: false });
const QuillMention = dynamic(() => import("quill-mention"), { ssr: false });
const QuillTable = dynamic(() => import("quill-table"), { ssr: false });

/** 🔹 Toolbar now supports font sizes etc. */
const modules = {
  toolbar: [
    [{ header: [1, 2, 3, 4, 5, 6, false] }],
    [{ font: [] }],
    [{ size: ["small", false, "large", "huge"] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["bold", "italic", "underline", "strike"],
    ["link", "image", "video"],
    [{ color: [] }, { background: [] }],
    ["blockquote", "code-block"],
    [{ direction: "rtl" }],
    [{ table: [] }, { insertRow: [] }, { deleteRow: [] }],
    ["emoji", "mention"],
    ["clean"],
  ],
};

/** 🔹 Allowed formats so Quill keeps size / align / image formats */
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
  "direction",
  "link",
  "image",
  "video",
  "table",
  "emoji",
  "mention",
];

// 🔹 Helper: use backend base, remove /api at the end, then append image path
const resolveImageUrl = (imagePath: string) => {
  if (!imagePath) return "";

  // If already a full URL, just return it
  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  // Ensure path starts with "/"
  const normalizedPath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;

  const baseWithApi = getBackendBase();
  // remove trailing /api or /api/
  const cleanBase = baseWithApi.replace(/\/api\/?$/, "");

  return `${cleanBase}${normalizedPath}`;
};

export default function Page() {
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : (rawId as string | undefined);

  const [page, setPage] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

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

  // gallery can contain existing URLs (string) or newly added Files
  const [gallery, setGallery] = useState<(File | string)[]>([]);

  // ---------- Load page (BY PAGE ID) + linked service ----------
  useEffect(() => {
    const fetchPageAndService = async () => {
      if (!id) return;

      try {
        const data = await getPageByIdApi(id);
        setPage(data);

        setTitle(data.title ?? "");
        setSlug(data.slug ?? "");
        setDescription(data.description ?? "");
        setContent(data.content ?? "");
        setMetaTitle(data.meta_title ?? "");
        setMetaDescription(data.meta_description ?? "");

        // meta.keywords -> comma separated
        const keywordsArr = Array.isArray(data.meta?.keywords)
          ? data.meta.keywords
          : [];
        setMetaKeywords(keywordsArr.join(", "));

        setTemplate(data.template ?? "default");
        setVisibility(data.visibility ?? "public");
        setStatus(data.status ?? "published");
        setActive(typeof data.active === "boolean" ? data.active : true);
        setServiceId(data.service_id ?? "");

        if (Array.isArray(data.gallery)) {
          // existing gallery URLs from backend
          setGallery(data.gallery);
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
      } finally {
        setLoading(false);
      }
    };

    fetchPageAndService();
  }, [id]);

  // ---------- Quill registration ----------
  useEffect(() => {
    if (typeof window !== "undefined") {
      const QuillCore = require("quill");
      QuillCore.register("modules/table", QuillTable);
      QuillCore.register("modules/emoji", QuillEmoji);
      QuillCore.register("modules/mention", QuillMention);
    }
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20">Loading...</div>;
  }

  if (!page) {
    return <div className="flex justify-center py-20">Page not found.</div>;
  }

  const handleEditorChange = (value: string) => {
    setContent(value);
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileArr = Array.from(files);
      setGallery((prev) => [...prev, ...fileArr]);
    }
  };

  // ---------- SAVE / UPDATE ----------
  const savePage = async () => {
    if (!id) return;

    try {
      // build keywords array from text
      const keywordsArr = metaKeywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      // split gallery into existing URLs vs new files
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
    } catch (error) {
      console.error("Error while updating page:", error);
      toast.error("Failed to update page");
    }
  };

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
        {/* Linked Service Information (if any) */}
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

        {/* Page Form */}
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

        {/* Visual Editor */}
        <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900 shadow-md">
          <h2 className="text-xl font-semibold mb-4">Visual Editor</h2>

          <ReactQuill
            value={content}
            onChange={handleEditorChange}
            theme="snow"
            modules={modules}
            formats={formats}   // 🔹 enable size + align + image formats
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
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
