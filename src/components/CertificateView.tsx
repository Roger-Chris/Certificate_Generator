"use client";

import { type CSSProperties, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { type Design, type DesignElement, fillHtml, sanitizeHtml, type TextElement } from "@/lib/design";

/**
 * Renders a design at its native pixel size. The editor scales it with a CSS transform; exports
 * capture it 1:1. `values` fills {Field} tokens — pass null to show the raw tokens.
 */
export interface CertificateViewProps {
  design: Design;
  values: Record<string, string> | null;
  editingId?: string | null;
  onCommitText?: (id: string, html: string) => void;
}

export default function CertificateView({ design, values, editingId, onCommitText }: CertificateViewProps) {
  return (
    <div
      data-certificate
      style={{
        position: "relative",
        width: design.width,
        height: design.height,
        background: design.background,
        overflow: "hidden",
      }}
    >
      {design.backgroundImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={design.backgroundImage}
          alt=""
          draggable={false}
          style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
        />
      )}
      {design.elements.map((el) =>
        el.hidden ? null : (
          <ElementView
            key={el.id}
            el={el}
            design={design}
            values={values}
            editing={el.id === editingId}
            onCommitText={onCommitText}
          />
        ),
      )}
    </div>
  );
}

function ElementView({
  el,
  design,
  values,
  editing,
  onCommitText,
}: {
  el: DesignElement;
  design: Design;
  values: Record<string, string> | null;
  editing: boolean;
  onCommitText?: (id: string, html: string) => void;
}) {
  const box: CSSProperties = {
    position: "absolute",
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
    opacity: el.opacity ?? 1,
  };
  if (el.type === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img data-el={el.id} src={el.src} alt="" draggable={false} style={{ ...box, objectFit: el.fit, pointerEvents: "none" }} />
    );
  }
  if (el.type === "shape") {
    return (
      <div
        data-el={el.id}
        style={{
          ...box,
          background: el.fill,
          border: el.stroke && el.strokeWidth ? `${el.strokeWidth}px solid ${el.stroke}` : undefined,
          borderRadius: el.shape === "ellipse" ? "50%" : el.radius ?? 0,
          boxSizing: "border-box",
        }}
      />
    );
  }
  return <TextView el={el} design={design} values={values} editing={editing} onCommitText={onCommitText} box={box} />;
}

/** Bumps when web fonts finish loading so auto-fit text re-measures with the real font. */
function useFontsVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const bump = () => setV((x) => x + 1);
    document.fonts.addEventListener("loadingdone", bump);
    return () => document.fonts.removeEventListener("loadingdone", bump);
  }, []);
  return v;
}

function TextView({
  el,
  design,
  values,
  editing,
  onCommitText,
  box,
}: {
  el: TextElement;
  design: Design;
  values: Record<string, string> | null;
  editing: boolean;
  onCommitText?: (id: string, html: string) => void;
  box: CSSProperties;
}) {
  const clean = useMemo(() => sanitizeHtml(el.html), [el.html]);
  const html = useMemo(() => (values ? fillHtml(clean, design, values) : clean), [clean, design, values]);
  const inner = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const fontsVersion = useFontsVersion();

  // Auto-fit: shrink the font until the content fits the box (long names / titles).
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || editing || !el.autoFit) {
      if (fit !== 1) setFit(1);
      return;
    }
    let s = 1;
    const apply = () => {
      node.style.fontSize = `${el.fontSize * s}px`;
      node.style.letterSpacing = el.letterSpacing ? `${el.letterSpacing * s}px` : "";
    };
    apply();
    while ((node.scrollHeight > el.h + 1 || node.scrollWidth > el.w + 1) && s > 0.3) {
      s -= 0.02;
      apply();
    }
    if (Math.abs(s - fit) > 0.001) setFit(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, el.w, el.h, el.fontSize, el.fontFamily, el.fontWeight, el.lineHeight, el.letterSpacing, el.autoFit, editing, fontsVersion]);

  // Editing: load the raw (token) HTML once, commit on blur.
  useEffect(() => {
    const node = inner.current;
    if (!editing || !node) return;
    node.innerHTML = clean;
    node.focus();
    const range = document.createRange();
    range.selectNodeContents(node);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const s = editing ? 1 : fit;
  const textStyle: CSSProperties = {
    fontFamily: `"${el.fontFamily}"`,
    fontSize: el.fontSize * s,
    fontWeight: el.fontWeight,
    fontStyle: el.italic ? "italic" : "normal",
    color: el.gradient ? "transparent" : el.color,
    lineHeight: el.lineHeight,
    letterSpacing: el.letterSpacing ? el.letterSpacing * s : undefined,
    textAlign: el.align,
    textTransform: el.uppercase ? "uppercase" : undefined,
    whiteSpace: "normal",
    overflowWrap: "break-word",
    width: "100%",
    outline: "none",
    ...(el.gradient
      ? { backgroundImage: `linear-gradient(180deg, ${el.gradient[0]}, ${el.gradient[1]})`, WebkitBackgroundClip: "text", backgroundClip: "text" }
      : {}),
  };

  return (
    <div
      data-el={el.id}
      style={{
        ...box,
        display: "flex",
        flexDirection: "column",
        justifyContent: el.valign === "middle" ? "center" : el.valign === "bottom" ? "flex-end" : "flex-start",
        overflow: el.autoFit && !editing ? "hidden" : "visible",
      }}
    >
      {editing ? (
        <div
          ref={inner}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          style={{ ...textStyle, cursor: "text", caretColor: el.gradient ? el.gradient[0] : el.color, minHeight: el.fontSize * el.lineHeight }}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") (e.target as HTMLElement).blur();
            e.stopPropagation();
          }}
          onBlur={(e) => onCommitText?.(el.id, sanitizeHtml(e.currentTarget.innerHTML))}
        />
      ) : (
        <div ref={inner} style={textStyle} dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  );
}
