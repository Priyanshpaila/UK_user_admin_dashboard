"use client";

import React, {
  forwardRef,
  useEffect,
  useState,
} from "react";
import type ReactQuillType from "react-quill";
import "react-quill/dist/quill.snow.css";

type QuillEditorProps = {
  value: string;
  onChange: (value: string) => void;
  modules?: any;
  formats?: string[];
  className?: string;
};

const QuillEditor = forwardRef<ReactQuillType, QuillEditorProps>(
  function QuillEditor(props, ref) {
    const [QuillComponent, setQuillComponent] = useState<any>(null);

    useEffect(() => {
      let mounted = true;

      (async () => {
        const mod = await import("react-quill");
        const RQ = mod.default;
        if (!mounted) return;
        setQuillComponent(() => RQ);
      })();

      return () => {
        mounted = false;
      };
    }, []);

    if (!QuillComponent) {
      return (
        <div className="w-full rounded-md border border-neutral-700 bg-neutral-800/60 px-3 py-2 text-sm text-neutral-400">
          Loading editor…
        </div>
      );
    }

    // ✅ ref goes to the real ReactQuill instance
    return <QuillComponent ref={ref} theme="snow" {...props} />;
  }
);

export default QuillEditor;
