"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CertificateView from "./CertificateView";
import { type Design, designFields, sampleFor } from "@/lib/design";

/** A design scaled to fit its container's width, filled with sample values. */
export default function Thumb({ design, values }: { design: Design; values?: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const samples = useMemo(
    () => values ?? Object.fromEntries(designFields(design).map((f) => [f, sampleFor(design, f)])),
    [design, values],
  );
  const scale = w / design.width;
  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ aspectRatio: `${design.width} / ${design.height}` }}>
      {w > 0 && (
        <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0", width: design.width, height: design.height }}>
          <CertificateView design={design} values={samples} />
        </div>
      )}
    </div>
  );
}
