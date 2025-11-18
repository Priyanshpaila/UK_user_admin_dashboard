"use client";
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation"; // To get the service ID from the URL
import { getServiceApi, getBackendBase } from "../../../../api"; // Import the API function to fetch service details
import dynamic from "next/dynamic"; // Dynamically import Quill (so it doesn't cause issues during SSR)
import "react-quill/dist/quill.snow.css";
import ReactTooltip from "react-tooltip"; // Tooltip library for React

// Dynamically import ReactQuill (so it doesn't cause issues during SSR)
const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

// Dynamically import Quill plugins (client-side only)
const QuillEmoji = dynamic(() => import("quill-emoji"), { ssr: false });
const QuillMention = dynamic(() => import("quill-mention"), { ssr: false });
const QuillTable = dynamic(() => import("quill-table"), { ssr: false });

import Quill from "quill"; // Import Quill directly

// Quill modules for toolbar options
const modules = {
  toolbar: [
    [{ header: "1" }, { header: "2" }, { font: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["bold", "italic", "underline", "strike"],
    ["link", "image", "video"], // For video embedding
    [{ color: [] }, { background: [] }],
    ["blockquote", "code-block"],
    [{ direction: "rtl" }],
    ["undo", "redo"],
    [{ table: [] }, { insertRow: [] }, { deleteRow: [] }], // Table features
    ["emoji", "mention"], // Assuming you have a plugin for emojis or mentions
  ],
};

export default function Page() {
  const { id } = useParams(); // Get the service ID from the URL
  const [service, setService] = useState<any | null>(null); // State to hold the service data
  const [loading, setLoading] = useState(true); // State for loading indicator
  const [content, setContent] = useState(""); // State for the HTML content from the visual editor

  // Additional fields for the page form
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
  const [gallery, setGallery] = useState<string[]>([]);
  const [serviceId, setServiceId] = useState("");

  // Fetch service data when the page loads
  useEffect(() => {
    const fetchService = async () => {
      try {
        const data = await getServiceApi(id);
        setService(data); // Set the fetched data to state
        setServiceId(data._id);
        setTitle(data.name);
        setSlug(data.slug);
        setDescription(data.description);
        setContent(data.content);
        setMetaTitle(data.meta_title);
        setMetaDescription(data.meta_description);
        setMetaKeywords(data.meta.keywords.join(", "));
        setTemplate(data.template);
        setVisibility(data.visibility);
        setStatus(data.status);
        setActive(data.active);
        setGallery(data.gallery || []);
      } catch (error) {
        console.error("Error fetching service:", error);
      } finally {
        setLoading(false); // Set loading to false once data is fetched
      }
    };

    if (id) {
      fetchService();
    }
  }, [id]);

  // Register Quill modules when ReactQuill is initialized
  useEffect(() => {
    if (typeof window !== "undefined") {
      const Quill = require("quill");
      Quill.register("modules/table", QuillTable);
      Quill.register("modules/emoji", QuillEmoji);
      Quill.register("modules/mention", QuillMention);
    }
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20">Loading...</div>; // Show loading message while fetching
  }

  if (!service) {
    return <div className="flex justify-center py-20">Service not found.</div>; // Show error if no service found
  }

  // Handle the image URL
  const getFullImageUrl = (imagePath: string) => {
    const baseUrl = getBackendBase(); // Get the backend base URL
    const cleanBaseUrl = baseUrl.replace(/\/api$/, ""); // Remove the '/api' from the base URL if it exists
    return `${cleanBaseUrl}${imagePath}`; // Concatenate the cleaned base URL and image path
  };

  // Handle content change in the visual editor
  const handleEditorChange = (value: string) => {
    setContent(value); // Set the HTML content when the user types
  };

  // Handle gallery image uploads
  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const imageUrls = Array.from(files).map((file) =>
        URL.createObjectURL(file)
      );
      setGallery((prev) => [...prev, ...imageUrls]);
    }
  };

  const dataURLtoFile = (dataUrl: string, filename: string) => {
    if (!dataUrl) return null;

    const arr = dataUrl.split(",");
    const matchResult = arr[0].match(/:(.*?);/); // Match MIME type

    if (!matchResult) {
      console.error("Invalid data URL: MIME type not found.");
      return null; // Return null if match fails
    }

    const mime = matchResult[1]; // Get MIME type from the match
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, { type: mime });
  };

  // Save the service
  // Save the service
  const saveService = async () => {
    const formData = new FormData();

    // Ensure required fields are defined
    formData.append("title", title || ""); // If title is null/undefined, use empty string
    formData.append("slug", slug || "");
    formData.append("description", description || "");
    formData.append("template", template || "default");
    formData.append("visibility", visibility || "public");
    formData.append("active", active.toString());
    formData.append("meta_title", metaTitle || "");
    formData.append("meta_description", metaDescription || "");
    formData.append("meta_keywords", metaKeywords || "");
    formData.append("status", status || "published");
    formData.append("service_id", serviceId || "");
    formData.append("published_at", new Date().toISOString());

    // Ensure gallery is defined before processing
    if (gallery && gallery.length > 0) {
      gallery.forEach((image, index) => {
        const imageFile = dataURLtoFile(image, `image-${index + 1}.jpg`); // Convert the image to a file format if needed

        // Check if imageFile is valid (not null)
        if (imageFile) {
          formData.append("gallery", imageFile); // Only append if it's not null
        }
      });
    }

    // Ensure content is defined
    formData.append("content", content || "");
    console.log(formData)

    const baseUrl = getBackendBase();

    try {
      // Send the FormData with the POST request
      const res = await fetch(`${baseUrl}/pages`, {
        method: "POST",
        body: formData, // The FormData automatically sets the correct headers (multipart/form-data)
      });

      if (!res.ok) {
        const txt = await res.text();
        console.error("Error saving page:", txt);
        return;
      }

      console.log("Service saved successfully");
      // Handle success
    } catch (error) {
      console.error("Error while saving service:", error);
      // Handle error
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-transparent text-white rounded-xl">
      <h1 className="text-3xl font-semibold mb-6">Edit Page</h1>

      {/* Display Service Information */}
      <div className="space-y-6 mb-10">
        <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900 shadow-md">
          <h2 className="text-xl font-semibold mb-4">Service Details</h2>
          <div className="flex items-center gap-6">
            {/* Display Image in small size next to the service details */}
            {service.image && (
              <div className="w-20 h-20 bg-neutral-800 rounded-lg overflow-hidden">
                <img
                  src={getFullImageUrl(service.image)} // Get the full image URL
                  alt={service.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="text-white">
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
        </div>

        {/* Page Form */}
        <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900 shadow-md">
          <h2 className="text-xl font-semibold mb-4">Page Details</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
                data-tip="Enter the title of the page"
              />
            </div>

            <div>
              <label className="text-sm">Slug</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
                data-tip="Enter a unique URL-friendly slug for the page"
              />
            </div>

            <div>
              <label className="text-sm">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
                rows={3}
                data-tip="Enter a brief description of the page"
              />
            </div>

            <div>
              <label className="text-sm">Meta Title</label>
              <input
                type="text"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
                data-tip="Enter the meta title for SEO purposes"
              />
            </div>

            <div>
              <label className="text-sm">Meta Description</label>
              <textarea
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
                rows={3}
                data-tip="Enter a short description for SEO"
              />
            </div>

            <div>
              <label className="text-sm">Meta Keywords</label>
              <input
                type="text"
                value={metaKeywords}
                onChange={(e) => setMetaKeywords(e.target.value)}
                className="w-full mt-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-md"
                placeholder="Comma separated keywords"
                data-tip="Enter SEO keywords separated by commas"
              />
            </div>
          </div>
        </div>

        {/* Visual Editor for Content */}
        <div className="p-6 rounded-xl border border-neutral-800 bg-neutral-900 shadow-md">
          <h2 className="text-xl font-semibold mb-4">Visual Editor</h2>

          <ReactQuill
            value={content}
            onChange={handleEditorChange} // Update the content state as the user types
            theme="snow"
            modules={modules} // Pass the custom toolbar options
            className="bg-neutral-800 text-white mb-3"
          />
          <h3 className="text-white text-lg">Generated HTML</h3>
          <div className="mt- p-4 bg-neutral-700 rounded-lg">
            <div className="whitespace-pre-wrap overflow-hidden text-white">
              {content}
            </div>
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
            data-tip="Upload images to the gallery"
          />
          <div className="mt-4 space-x-2">
            {gallery.map((img, idx) => (
              <img
                key={idx}
                src={img}
                alt={`Gallery image ${idx + 1}`}
                className="w-24 h-24 object-cover rounded-md"
              />
            ))}
          </div>
        </div>

        {/* Save and Send Data */}
        <div className="flex justify-end space-x-4 mt-6">
          <button
            onClick={saveService}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white"
            data-tip="Save all changes and send to the backend"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
