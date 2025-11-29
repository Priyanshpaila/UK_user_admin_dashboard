import { Suspense } from "react";
import ConsultationPageClient from "./ConsultationPageClient";

// Optional but useful to avoid static export issues:
export const dynamic = "force-dynamic";

export default function ConsultationStartPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-5xl mx-auto px-4 py-10 flex items-center justify-center text-neutral-300">
          Loading consultation…
        </div>
      }
    >
      <ConsultationPageClient />
    </Suspense>
  );
}
