"use client";

import React, { useMemo, useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Copy } from "lucide-react";

type FieldType =
  | "section"
  | "text"
  | "email"
  | "number"
  | "textarea"
  | "date"
  | "select"
  | "dropdown" // 👈 NEW
  | "radio"
  | "checkbox"
  | "file"
  | "signature"
  | "textBlock"
  | "divider"
  | "image"
  | "pageBreak";

type Option = {
  id: string;
  label: string;
  value: string;
};

type BaseField = {
  id: string;
  type: FieldType;
  label: string;
  key: string; // field name to be used in backend
  required?: boolean;
  helpText?: string;
};

type FormField = BaseField & {
  placeholder?: string;
  // For select / dropdown / radio / checkbox
  options?: Option[];
  // For static content
  content?: string;
  // For image
  imageUrl?: string;
};

const FIELD_PALETTE: { type: FieldType; label: string }[] = [
  { type: "section", label: "Section" },
  { type: "text", label: "Text Input" },
  { type: "email", label: "Email" },
  { type: "number", label: "Number" },
  { type: "textarea", label: "Textarea" },
  { type: "date", label: "Date" },
  { type: "select", label: "Select" },
  { type: "dropdown", label: "Dropdown" }, // 👈 shown as separate in palette
  { type: "radio", label: "Radio Buttons" },
  { type: "checkbox", label: "Checkbox" },
  { type: "file", label: "File Upload" },
  { type: "signature", label: "Signature" },
  { type: "textBlock", label: "Text Block" },
  { type: "divider", label: "Divider" },
  { type: "image", label: "Image" },
  { type: "pageBreak", label: "Page Break" },
];

function createId() {
  return Math.random().toString(36).slice(2, 9);
}

function defaultLabelForType(type: FieldType) {
  switch (type) {
    case "section":
      return "Section title";
    case "text":
      return "Text input";
    case "email":
      return "Email";
    case "number":
      return "Number";
    case "textarea":
      return "Textarea";
    case "date":
      return "Date";
    case "select":
      return "Select";
    case "dropdown":
      return "Dropdown";
    case "radio":
      return "Radio group";
    case "checkbox":
      return "Checkbox";
    case "file":
      return "File upload";
    case "signature":
      return "Signature";
    case "textBlock":
      return "Text block";
    case "divider":
      return "Divider";
    case "image":
      return "Image";
    case "pageBreak":
      return "Page break";
    default:
      return "Field";
  }
}

function defaultKeyForType(type: FieldType) {
  return type + "_" + createId();
}

function createDefaultField(type: FieldType): FormField {
  const id = createId();
  const base: BaseField = {
    id,
    type,
    label: defaultLabelForType(type),
    key: defaultKeyForType(type),
    required: false,
  };

  if (type === "select" || type === "dropdown" || type === "radio" || type === "checkbox") {
    const opts: Option[] = [
      { id: createId(), label: "Option 1", value: "option_1" },
      { id: createId(), label: "Option 2", value: "option_2" },
    ];
    return { ...base, options: opts };
  }

  if (type === "textBlock") {
    return {
      ...base,
      content: "This is a static text block. You can edit this content.",
    };
  }

  if (type === "image") {
    return {
      ...base,
      imageUrl: "",
      helpText: "Paste image URL or configure later.",
    };
  }

  if (type === "divider" || type === "pageBreak" || type === "section") {
    return base;
  }

  return {
    ...base,
    placeholder: "",
  };
}

export default function Page() {
  const [fields, setFields] = useState<FormField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  const selectedField = useMemo(
    () => fields.find((f) => f.id === selectedFieldId) || null,
    [fields, selectedFieldId]
  );

  const handleAddField = (type: FieldType) => {
    const newField = createDefaultField(type);
    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
  };

  const updateField = (id: string, patch: Partial<FormField>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const deleteField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const moveField = (id: string, direction: "up" | "down") => {
    setFields((prev) => {
      const index = prev.findIndex((f) => f.id === id);
      if (index === -1) return prev;
      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const arr = [...prev];
      const [removed] = arr.splice(index, 1);
      arr.splice(newIndex, 0, removed);
      return arr;
    });
  };

  const addOption = (fieldId: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f;
        const opts = f.options || [];
        const nextIndex = opts.length + 1;
        const newOption: Option = {
          id: createId(),
          label: `Option ${nextIndex}`,
          value: `option_${nextIndex}`,
        };
        return { ...f, options: [...opts, newOption] };
      })
    );
  };

  const updateOption = (
    fieldId: string,
    optionId: string,
    patch: Partial<Option>
  ) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f;
        const opts = f.options || [];
        return {
          ...f,
          options: opts.map((o) =>
            o.id === optionId ? { ...o, ...patch } : o
          ),
        };
      })
    );
  };

  const deleteOption = (fieldId: string, optionId: string) => {
    setFields((prev) =>
      prev.map((f) => {
        if (f.id !== fieldId) return f;
        const opts = f.options || [];
        return { ...f, options: opts.filter((o) => o.id !== optionId) };
      })
    );
  };

  const schema = useMemo(
    () => ({
      fields: fields.map((f) => ({
        id: f.id,
        type: f.type,
        label: f.label,
        key: f.key,
        required: f.required,
        placeholder: f.placeholder,
        helpText: f.helpText,
        options: f.options,
        content: f.content,
        imageUrl: f.imageUrl,
      })),
    }),
    [fields]
  );

  const copySchema = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(schema, null, 2));
      alert("Schema copied to clipboard");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 text-neutral-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold mb-1">
            Form Builder
          </h1>
          <p className="text-sm text-neutral-400">
            Add fields from the palette and we’ll generate a JSON schema you can send to your backend.
          </p>
        </div>
        <button
          type="button"
          onClick={copySchema}
          className="inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-3 py-2 text-xs sm:text-sm font-medium text-neutral-100 border border-neutral-700 hover:bg-neutral-700"
        >
          <Copy className="h-4 w-4" />
          Copy JSON Schema
        </button>
      </div>

      {/* 3-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1.6fr)_minmax(0,1.1fr)] gap-5">
        {/* Palette */}
        <aside className="rounded-2xl border border-neutral-800 bg-neutral-950/90 p-3">
          <h2 className="text-xs font-semibold text-neutral-300 uppercase tracking-[0.12em] mb-3">
            Field types
          </h2>
          <div className="space-y-1">
            {FIELD_PALETTE.map((item) => (
              <button
                key={item.type}
                type="button"
                onClick={() => handleAddField(item.type)}
                className="w-full text-left text-sm px-3 py-1.5 rounded-md bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800/80 hover:border-blue-500/60 text-neutral-100 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Canvas / Form preview */}
        <main className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-neutral-200">
              Form layout
            </h2>
            <span className="text-[11px] text-neutral-500">
              Click a field to edit its properties
            </span>
          </div>

          {fields.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-900/70 px-4 py-6 text-center text-sm text-neutral-400">
              No fields yet. Use the field types on the left to start building
              your form.
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className={`group rounded-xl border px-3 py-3 sm:px-4 sm:py-3.5 bg-neutral-900/80 flex items-start gap-3 ${
                    selectedFieldId === field.id
                      ? "border-blue-500 shadow-[0_0_0_1px_rgba(37,99,235,0.4)]"
                      : "border-neutral-800 hover:border-neutral-600"
                  }`}
                  onClick={() => setSelectedFieldId(field.id)}
                >
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveField(field.id, "up");
                      }}
                      className="p-0.5 rounded-full text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>
                    <span className="text-[10px] text-neutral-500">
                      {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveField(field.id, "down");
                      }}
                      className="p-0.5 rounded-full text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-100">
                          {field.label || "(no label)"}
                        </span>
                        <span className="text-[11px] px-1.5 py-[1px] rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                          {field.type}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteField(field.id);
                        }}
                        className="inline-flex items-center justify-center rounded-full bg-red-500/10 text-red-400 hover:bg-red-500/20 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Quick preview */}
                    <div className="pt-1">
                      {field.type === "section" && (
                        <div className="border-b border-neutral-700 pb-1">
                          <span className="text-xs font-semibold text-neutral-300 uppercase tracking-[0.12em]">
                            {field.label || "Section"}
                          </span>
                        </div>
                      )}

                      {["text", "email", "number", "date"].includes(field.type) && (
                        <input
                          disabled
                          className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-xs text-neutral-400"
                          placeholder={field.placeholder || "Input preview"}
                        />
                      )}

                      {field.type === "textarea" && (
                        <textarea
                          disabled
                          className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-xs text-neutral-400"
                          rows={2}
                          placeholder={field.placeholder || "Textarea preview"}
                        />
                      )}

                      {["select", "dropdown"].includes(field.type) && (
                        <select
                          disabled
                          className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 text-xs text-neutral-400"
                        >
                          <option>— select —</option>
                          {field.options?.map((o) => (
                            <option key={o.id}>{o.label}</option>
                          ))}
                        </select>
                      )}

                      {field.type === "radio" && (
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-neutral-300">
                          {field.options?.map((o) => (
                            <label
                              key={o.id}
                              className="inline-flex items-center gap-1"
                            >
                              <input
                                type="radio"
                                disabled
                                className="h-3 w-3"
                              />
                              {o.label}
                            </label>
                          ))}
                        </div>
                      )}

                      {field.type === "checkbox" && (
                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-neutral-300">
                          {field.options?.map((o) => (
                            <label
                              key={o.id}
                              className="inline-flex items-center gap-1"
                            >
                              <input
                                type="checkbox"
                                disabled
                                className="h-3 w-3"
                              />
                              {o.label}
                            </label>
                          ))}
                        </div>
                      )}

                      {field.type === "file" && (
                        <div className="mt-1">
                          <div className="inline-flex items-center rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-[11px] text-neutral-400">
                            File upload preview
                          </div>
                        </div>
                      )}

                      {field.type === "signature" && (
                        <div className="mt-1 border border-dashed border-neutral-700 rounded-md h-16 flex items-center justify-center text-[11px] text-neutral-500">
                          Signature box preview
                        </div>
                      )}

                      {field.type === "textBlock" && (
                        <p className="mt-1 text-xs text-neutral-300 whitespace-pre-line">
                          {field.content}
                        </p>
                      )}

                      {field.type === "divider" && (
                        <div className="mt-2 border-t border-neutral-700" />
                      )}

                      {field.type === "image" && (
                        <div className="mt-1 h-20 border border-dashed border-neutral-700 rounded-md flex items-center justify-center text-[11px] text-neutral-500">
                          Image placeholder
                        </div>
                      )}

                      {field.type === "pageBreak" && (
                        <div className="mt-2 text-[11px] text-neutral-500 italic">
                          --- Page Break ---
                        </div>
                      )}

                      {field.helpText && (
                        <div className="mt-1 text-[11px] text-neutral-500">
                          {field.helpText}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Inspector */}
        <aside className="rounded-2xl border border-neutral-800 bg-neutral-950/90 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-200">
            Field settings
          </h2>

          {!selectedField && (
            <p className="text-xs text-neutral-500">
              Select a field from the middle panel to configure its properties.
            </p>
          )}

          {selectedField && (
            <div className="space-y-4 text-sm">
              {/* Label */}
              <div>
                <label className="text-xs font-medium text-neutral-300">
                  Label
                </label>
                <input
                  value={selectedField.label}
                  onChange={(e) =>
                    updateField(selectedField.id, { label: e.target.value })
                  }
                  className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-sm text-neutral-100"
                />
              </div>

              {/* Key */}
              <div>
                <label className="text-xs font-medium text-neutral-300">
                  Field key (for backend)
                </label>
                <input
                  value={selectedField.key}
                  onChange={(e) =>
                    updateField(selectedField.id, { key: e.target.value })
                  }
                  className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200"
                />
                <p className="mt-1 text-[11px] text-neutral-500">
                  This will be used as the property name in your form JSON.
                </p>
              </div>

              {/* Required */}
              {!["section", "divider", "textBlock", "image", "pageBreak"].includes(
                selectedField.type
              ) && (
                <div className="flex items-center gap-2">
                  <input
                    id="required-toggle"
                    type="checkbox"
                    checked={!!selectedField.required}
                    onChange={(e) =>
                      updateField(selectedField.id, {
                        required: e.target.checked,
                      })
                    }
                    className="h-3.5 w-3.5 rounded border-neutral-600 bg-neutral-900"
                  />
                  <label
                    htmlFor="required-toggle"
                    className="text-xs text-neutral-300"
                  >
                    Required field
                  </label>
                </div>
              )}

              {/* Placeholder */}
              {["text", "email", "number", "textarea", "date"].includes(
                selectedField.type
              ) && (
                <div>
                  <label className="text-xs font-medium text-neutral-300">
                    Placeholder
                  </label>
                  <input
                    value={selectedField.placeholder || ""}
                    onChange={(e) =>
                      updateField(selectedField.id, {
                        placeholder: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200"
                  />
                </div>
              )}

              {/* Help text */}
              <div>
                <label className="text-xs font-medium text-neutral-300">
                  Help text
                </label>
                <textarea
                  rows={2}
                  value={selectedField.helpText || ""}
                  onChange={(e) =>
                    updateField(selectedField.id, {
                      helpText: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200"
                />
              </div>

              {/* Options for select / dropdown / radio / checkbox */}
              {["select", "dropdown", "radio", "checkbox"].includes(
                selectedField.type
              ) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-300">
                      Options
                    </span>
                    <button
                      type="button"
                      onClick={() => addOption(selectedField.id)}
                      className="inline-flex items-center gap-1 rounded-md bg-neutral-800 px-2 py-1 text-[11px] text-neutral-100 border border-neutral-700 hover:bg-neutral-700"
                    >
                      <Plus className="h-3 w-3" />
                      Add option
                    </button>
                  </div>

                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {selectedField.options?.map((opt) => (
                      <div
                        key={opt.id}
                        className="flex items-center gap-2 text-xs"
                      >
                        <input
                          value={opt.label}
                          onChange={(e) =>
                            updateOption(selectedField.id, opt.id, {
                              label: e.target.value,
                            })
                          }
                          placeholder="Label"
                          className="flex-1 rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1 text-xs text-neutral-100"
                        />
                        <input
                          value={opt.value}
                          onChange={(e) =>
                            updateOption(selectedField.id, opt.id, {
                              value: e.target.value,
                            })
                          }
                          placeholder="value_key"
                          className="flex-1 rounded-md bg-neutral-900 border border-neutral-700 px-2 py-1 text-xs text-neutral-100"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            deleteOption(selectedField.id, opt.id)
                          }
                          className="p-1 rounded-md text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {(!selectedField.options ||
                      selectedField.options.length === 0) && (
                      <p className="text-[11px] text-neutral-500">
                        No options yet. Click “Add option” to create choices.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Text block content */}
              {selectedField.type === "textBlock" && (
                <div>
                  <label className="text-xs font-medium text-neutral-300">
                    Text content
                  </label>
                  <textarea
                    rows={4}
                    value={selectedField.content || ""}
                    onChange={(e) =>
                      updateField(selectedField.id, {
                        content: e.target.value,
                      })
                    }
                    className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200"
                  />
                </div>
              )}

              {/* Image URL */}
              {selectedField.type === "image" && (
                <div>
                  <label className="text-xs font-medium text-neutral-300">
                    Image URL
                  </label>
                  <input
                    value={selectedField.imageUrl || ""}
                    onChange={(e) =>
                      updateField(selectedField.id, {
                        imageUrl: e.target.value,
                      })
                    }
                    placeholder="https://example.com/image.png"
                    className="mt-1 w-full rounded-md bg-neutral-900 border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200"
                  />
                </div>
              )}
            </div>
          )}

          {/* JSON preview */}
          <div className="pt-4 border-t border-neutral-800 mt-4">
            <p className="text-xs font-semibold text-neutral-300 mb-2">
              JSON schema preview
            </p>
            <pre className="max-h-60 overflow-auto rounded-md bg-neutral-950 border border-neutral-800 p-2 text-[10px] leading-relaxed text-neutral-300">
              {JSON.stringify(schema, null, 2)}
            </pre>
          </div>
        </aside>
      </div>
    </div>
  );
}
