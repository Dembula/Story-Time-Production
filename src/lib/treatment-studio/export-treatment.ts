import { resolveRenderableFileSource } from "@/lib/secure-file-preview-path";
import { escapeHtmlForDocument } from "@/lib/pdf/print-html-document";
import type {
  TreatmentAsset,
  TreatmentDocument,
  TreatmentElement,
  TreatmentSlide,
} from "./types";

export type TreatmentExportOptions = {
  title: string;
  document: TreatmentDocument;
  projectId?: string;
  filenameBase?: string;
};

function safeFilename(title: string) {
  const base = title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return base || "treatment";
}

function hexColor(input: string | undefined, fallback = "0F172A") {
  if (!input?.trim()) return fallback;
  const cleaned = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) return cleaned.toUpperCase();
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return cleaned
      .split("")
      .map((c) => c + c)
      .join("")
      .toUpperCase();
  }
  return fallback;
}

function contrastText(bg: string | undefined): string {
  const h = hexColor(bg, "FFFFFF");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.55 ? "0F172A" : "F8FAFC";
}

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/") && !blob.type.startsWith("video/")) {
      // Still try for octet-stream images
      if (!blob.type.includes("octet") && blob.type !== "") return null;
    }
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function resolveAssetDataUrl(
  asset: TreatmentAsset | undefined,
  projectId?: string,
): Promise<string | null> {
  if (!asset) return null;
  if (asset.type === "link") return null;
  const ref = asset.type === "video" ? asset.thumbnailUrl || asset.url : asset.url;
  const src = resolveRenderableFileSource(ref, { projectId });
  if (!src) return null;
  if (src.startsWith("data:")) return src;
  return fetchAsDataUrl(src);
}

function assetMap(assets: TreatmentAsset[]) {
  return new Map(assets.map((a) => [a.id, a]));
}

type ResolvedImages = Map<string, string>;

async function resolveAllImages(
  document: TreatmentDocument,
  projectId?: string,
): Promise<ResolvedImages> {
  const map = new Map<string, string>();
  await Promise.all(
    document.assets.map(async (asset) => {
      const data = await resolveAssetDataUrl(asset, projectId);
      if (data) map.set(asset.id, data);
    }),
  );
  return map;
}

function layoutHtml(
  slide: TreatmentSlide,
  assets: TreatmentAsset[],
  images: ResolvedImages,
): string {
  const map = assetMap(assets);
  const textColor = contrastText(slide.backgroundColor);
  const muted = textColor === "F8FAFC" ? "CBD5E1" : "64748B";

  const title = escapeHtmlForDocument(slide.title || "");
  const subtitle = escapeHtmlForDocument(slide.subtitle || "");
  const body = escapeHtmlForDocument(slide.body || "").replace(/\n/g, "<br/>");

  const imgTag = (assetId: string, className: string) => {
    const data = images.get(assetId);
    const asset = map.get(assetId);
    if (data) {
      return `<img src="${data}" alt="${escapeHtmlForDocument(asset?.title || "Reference")}" class="${className}" />`;
    }
    if (asset?.type === "link") {
      return `<div class="link-card ${className}">${escapeHtmlForDocument(asset.title || asset.url)}</div>`;
    }
    return `<div class="img-placeholder ${className}">Reference</div>`;
  };

  switch (slide.layout) {
    case "title":
      return `<div class="layout layout-title" style="color:#${textColor}">
        <h1>${title || "Untitled"}</h1>
        ${subtitle ? `<p class="subtitle" style="color:#${muted}">${subtitle}</p>` : ""}
      </div>`;
    case "split": {
      const hero = slide.referenceIds[0];
      return `<div class="layout layout-split" style="color:#${textColor}">
        <div class="split-copy">
          <h2>${title}</h2>
          <p class="body">${body}</p>
        </div>
        <div class="split-media">${hero ? imgTag(hero, "hero") : `<div class="img-placeholder hero">Add reference</div>`}</div>
      </div>`;
    }
    case "image": {
      const hero = slide.referenceIds[0];
      return `<div class="layout layout-image">
        ${hero ? imgTag(hero, "full") : `<div class="img-placeholder full">Select a reference</div>`}
        ${title ? `<div class="image-caption"><span style="color:#fff">${title}</span></div>` : ""}
      </div>`;
    }
    case "references":
      return `<div class="layout layout-refs" style="color:#${textColor}">
        <h2>${title || "References"}</h2>
        <div class="ref-grid">
          ${slide.referenceIds
            .map((id) => `<div class="ref-cell">${imgTag(id, "ref")}</div>`)
            .join("") || `<div class="img-placeholder">Add references</div>`}
        </div>
      </div>`;
    case "blank":
      return `<div class="layout layout-blank"></div>`;
    case "content":
    default:
      return `<div class="layout layout-content" style="color:#${textColor}">
        <h2>${title}</h2>
        <p class="body">${body}</p>
      </div>`;
  }
}

function elementHtml(el: TreatmentElement, assets: TreatmentAsset[], images: ResolvedImages): string {
  const style = [
    `left:${el.x}%`,
    `top:${el.y}%`,
    `width:${el.width}%`,
    `height:${el.height}%`,
    `z-index:${el.zIndex}`,
    el.rotation ? `transform:rotate(${el.rotation}deg)` : "",
  ]
    .filter(Boolean)
    .join(";");

  if (el.type === "text") {
    const color = el.color || "#0f172a";
    return `<div class="el el-text" style="${style};font-size:${el.fontSize ?? 28}px;font-weight:${el.fontWeight ?? 600};color:${color};text-align:${el.align ?? "left"}">${escapeHtmlForDocument(el.text || "").replace(/\n/g, "<br/>")}</div>`;
  }
  if (el.type === "shape") {
    const radius = el.shape === "ellipse" ? "50%" : "4px";
    return `<div class="el el-shape" style="${style};background:${el.fill || "#fb923c"};border-radius:${radius}"></div>`;
  }
  if (el.type === "image" && el.referenceId) {
    const data = images.get(el.referenceId);
    const asset = assets.find((a) => a.id === el.referenceId);
    if (data) {
      return `<div class="el el-image" style="${style}"><img src="${data}" alt="${escapeHtmlForDocument(asset?.title || "")}" /></div>`;
    }
    if (asset?.type === "link") {
      return `<div class="el el-image link-card" style="${style}">${escapeHtmlForDocument(asset.title || asset.url)}</div>`;
    }
  }
  return "";
}

function slideToHtml(
  slide: TreatmentSlide,
  assets: TreatmentAsset[],
  images: ResolvedImages,
  index: number,
): string {
  const bg = slide.backgroundColor || "#ffffff";
  const elements = [...slide.elements]
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((el) => elementHtml(el, assets, images))
    .join("");

  return `<section class="doc-page treatment-page" data-slide="${index + 1}" style="background:${bg}">
    ${layoutHtml(slide, assets, images)}
    ${elements}
  </section>`;
}

const TREATMENT_EXPORT_CSS = `
@page { size: 13.333in 7.5in landscape; margin: 0; }
html, body {
  margin: 0;
  padding: 0;
  background: #0a0a0a;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
}
.treatment-page {
  position: relative;
  width: 13.333in;
  height: 7.5in;
  overflow: hidden;
  page-break-after: always;
  break-after: page;
  box-sizing: border-box;
}
.treatment-page:last-child {
  page-break-after: auto;
  break-after: auto;
}
.layout { position: absolute; inset: 0; box-sizing: border-box; }
.layout-title {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 8%;
}
.layout-title h1 { margin: 0; font-size: 48px; font-weight: 650; letter-spacing: -0.02em; }
.layout-title .subtitle { margin: 18px 0 0; font-size: 22px; font-weight: 400; }
.layout-content { padding: 7% 8%; }
.layout-content h2 { margin: 0; font-size: 32px; font-weight: 650; }
.layout-content .body { margin: 24px 0 0; font-size: 16px; line-height: 1.55; white-space: pre-wrap; }
.layout-split {
  display: grid; grid-template-columns: 1fr 1fr; gap: 32px; padding: 6% 7%; height: 100%;
  box-sizing: border-box;
}
.layout-split h2 { margin: 0; font-size: 28px; font-weight: 650; }
.layout-split .body { margin: 16px 0 0; font-size: 15px; line-height: 1.5; }
.split-media, .split-copy { display: flex; flex-direction: column; justify-content: center; min-height: 0; }
.split-media .hero, .split-media .img-placeholder { width: 100%; height: 4.8in; object-fit: cover; border-radius: 8px; }
.layout-image { inset: 0; }
.layout-image .full, .layout-image .img-placeholder.full {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.image-caption {
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 48px 40px 32px;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  font-size: 22px; font-weight: 600;
}
.layout-refs { padding: 5% 6%; }
.layout-refs h2 { margin: 0 0 20px; font-size: 28px; font-weight: 650; }
.ref-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.ref-cell img, .ref-cell .img-placeholder, .ref-cell .link-card {
  width: 100%; aspect-ratio: 16/9; object-fit: cover; border-radius: 6px; display: block;
}
.img-placeholder, .link-card {
  display: flex; align-items: center; justify-content: center; text-align: center;
  background: #e2e8f0; color: #64748b; font-size: 13px; padding: 12px; box-sizing: border-box;
}
.el { position: absolute; box-sizing: border-box; overflow: hidden; }
.el-text { white-space: pre-wrap; line-height: 1.25; padding: 4px; }
.el-image img { width: 100%; height: 100%; object-fit: cover; display: block; border-radius: 2px; }
.el-shape { width: 100%; height: 100%; }
`;

/** Build print/PDF-ready HTML for a treatment deck (one landscape page per slide). */
export async function buildTreatmentExportHtml(
  options: TreatmentExportOptions,
): Promise<{ title: string; bodyHtml: string; extraCss: string }> {
  const images = await resolveAllImages(options.document, options.projectId);
  const bodyHtml = options.document.slides
    .map((slide, i) => slideToHtml(slide, options.document.assets, images, i))
    .join("\n");
  return {
    title: options.title,
    bodyHtml,
    extraCss: TREATMENT_EXPORT_CSS,
  };
}

export async function downloadTreatmentPdf(options: TreatmentExportOptions): Promise<void> {
  const { title, bodyHtml, extraCss } = await buildTreatmentExportHtml(options);
  const filename = `${options.filenameBase ?? safeFilename(title)}.pdf`;

  const { buildFullHtmlDocument } = await import("@/lib/pdf/print-html-document");
  const html = buildFullHtmlDocument({ title, bodyHtml, extraCss });

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-14000px",
    top: "0",
    width: "1280px",
    height: "720px",
    border: "none",
  });
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    throw new Error("Could not prepare PDF export.");
  }

  doc.open();
  doc.write(html);
  doc.close();

  await new Promise<void>((resolve) => {
    if (iframe.contentWindow?.document.readyState === "complete") resolve();
    else iframe.addEventListener("load", () => resolve(), { once: true });
    setTimeout(resolve, 600);
  });

  // Wait for images inside the iframe
  const imgs = Array.from(doc.images);
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) resolve();
          else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            setTimeout(resolve, 4000);
          }
        }),
    ),
  );

  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const pages = Array.from(doc.querySelectorAll<HTMLElement>(".treatment-page"));
    const pdf = new jsPDF({
      unit: "in",
      format: [13.333, 7.5],
      orientation: "landscape",
    });

    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i]!;
      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: pageEl.style.backgroundColor || "#ffffff",
        logging: false,
        width: 1280,
        height: 720,
        windowWidth: 1280,
        windowHeight: 720,
      });
      const img = canvas.toDataURL("image/jpeg", 0.93);
      if (i > 0) pdf.addPage([13.333, 7.5], "landscape");
      pdf.addImage(img, "JPEG", 0, 0, 13.333, 7.5);
    }

    if (pages.length === 0) {
      throw new Error("No slides to export.");
    }

    pdf.save(filename);
  } finally {
    iframe.remove();
  }
}

function pctToInches(pct: number, totalInches: number) {
  return (pct / 100) * totalInches;
}

/** Download an editable PowerPoint (.pptx) matching the treatment layout. */
export async function downloadTreatmentPptx(options: TreatmentExportOptions): Promise<void> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const images = await resolveAllImages(options.document, options.projectId);
  const assets = assetMap(options.document.assets);

  const pres = new PptxGenJS();
  const is43 = options.document.settings.aspectRatio === "4:3";
  // Widescreen 16:9 → 13.333 x 7.5; 4:3 → 10 x 7.5
  const slideW = is43 ? 10 : 13.333;
  const slideH = 7.5;
  pres.defineLayout({ name: "TREATMENT", width: slideW, height: slideH });
  pres.layout = "TREATMENT";
  pres.author = "Story Time";
  pres.title = options.title;

  const textColorFor = (bg?: string) => contrastText(bg);
  const mutedFor = (bg?: string) => (textColorFor(bg) === "F8FAFC" ? "CBD5E1" : "64748B");

  for (const slideDoc of options.document.slides) {
    const slide = pres.addSlide();
    const bg = hexColor(slideDoc.backgroundColor, "FFFFFF");
    slide.addShape(pres.ShapeType.rect, {
      x: 0,
      y: 0,
      w: slideW,
      h: slideH,
      fill: { color: bg },
      line: { color: bg },
    });

    const fg = textColorFor(slideDoc.backgroundColor);
    const muted = mutedFor(slideDoc.backgroundColor);
    const padX = slideW * 0.08;
    const padY = slideH * 0.1;

    const addAssetImage = (
      assetId: string,
      x: number,
      y: number,
      w: number,
      h: number,
    ) => {
      const data = images.get(assetId);
      if (data) {
        slide.addImage({ data, x, y, w, h, sizing: { type: "cover", w, h } });
        return;
      }
      const asset = assets.get(assetId);
      slide.addShape(pres.ShapeType.roundRect, {
        x,
        y,
        w,
        h,
        fill: { color: "E2E8F0" },
        line: { color: "E2E8F0" },
      });
      slide.addText(asset?.title || asset?.url || "Reference", {
        x,
        y,
        w,
        h,
        fontSize: 12,
        color: "64748B",
        align: "center",
        valign: "middle",
      });
    };

    switch (slideDoc.layout) {
      case "title":
        slide.addText(slideDoc.title || "Untitled", {
          x: padX,
          y: slideH * 0.32,
          w: slideW - padX * 2,
          h: 1.2,
          fontSize: 44,
          bold: true,
          color: fg,
          align: "center",
          valign: "middle",
        });
        if (slideDoc.subtitle?.trim()) {
          slide.addText(slideDoc.subtitle, {
            x: padX,
            y: slideH * 0.5,
            w: slideW - padX * 2,
            h: 0.6,
            fontSize: 20,
            color: muted,
            align: "center",
          });
        }
        break;
      case "split": {
        const colW = (slideW - padX * 2 - 0.4) / 2;
        slide.addText(slideDoc.title || "", {
          x: padX,
          y: padY,
          w: colW,
          h: 0.7,
          fontSize: 28,
          bold: true,
          color: fg,
        });
        slide.addText(slideDoc.body || "", {
          x: padX,
          y: padY + 0.85,
          w: colW,
          h: slideH - padY * 2 - 0.9,
          fontSize: 14,
          color: fg,
          valign: "top",
        });
        if (slideDoc.referenceIds[0]) {
          addAssetImage(
            slideDoc.referenceIds[0],
            padX + colW + 0.4,
            padY,
            colW,
            slideH - padY * 2,
          );
        }
        break;
      }
      case "image":
        if (slideDoc.referenceIds[0]) {
          addAssetImage(slideDoc.referenceIds[0], 0, 0, slideW, slideH);
        }
        if (slideDoc.title?.trim()) {
          slide.addShape(pres.ShapeType.rect, {
            x: 0,
            y: slideH - 1.4,
            w: slideW,
            h: 1.4,
            fill: { color: "000000", transparency: 45 },
            line: { color: "000000", transparency: 100 },
          });
          slide.addText(slideDoc.title, {
            x: padX,
            y: slideH - 1.15,
            w: slideW - padX * 2,
            h: 0.7,
            fontSize: 22,
            bold: true,
            color: "FFFFFF",
          });
        }
        break;
      case "references": {
        slide.addText(slideDoc.title || "References", {
          x: padX,
          y: padY * 0.7,
          w: slideW - padX * 2,
          h: 0.55,
          fontSize: 26,
          bold: true,
          color: fg,
        });
        const cols = 3;
        const gap = 0.2;
        const gridTop = padY * 0.7 + 0.7;
        const cellW = (slideW - padX * 2 - gap * (cols - 1)) / cols;
        const cellH = cellW * (9 / 16);
        slideDoc.referenceIds.slice(0, 9).forEach((id, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          addAssetImage(
            id,
            padX + col * (cellW + gap),
            gridTop + row * (cellH + gap),
            cellW,
            cellH,
          );
        });
        break;
      }
      case "blank":
        break;
      case "content":
      default:
        slide.addText(slideDoc.title || "", {
          x: padX,
          y: padY,
          w: slideW - padX * 2,
          h: 0.7,
          fontSize: 30,
          bold: true,
          color: fg,
        });
        slide.addText(slideDoc.body || "", {
          x: padX,
          y: padY + 0.9,
          w: slideW - padX * 2,
          h: slideH - padY * 2 - 1,
          fontSize: 15,
          color: fg,
          valign: "top",
        });
        break;
    }

    // Freeform elements on top
    const sorted = [...slideDoc.elements].sort((a, b) => a.zIndex - b.zIndex);
    for (const el of sorted) {
      const x = pctToInches(el.x, slideW);
      const y = pctToInches(el.y, slideH);
      const w = pctToInches(el.width, slideW);
      const h = pctToInches(el.height, slideH);

      if (el.type === "text") {
        slide.addText(el.text || "", {
          x,
          y,
          w,
          h,
          fontSize: el.fontSize ?? 24,
          bold: Number(el.fontWeight ?? 600) >= 600,
          color: hexColor(el.color, "0F172A"),
          align: el.align ?? "left",
          valign: "top",
          rotate: el.rotation ?? 0,
        });
      } else if (el.type === "shape") {
        const shape =
          el.shape === "ellipse" ? pres.ShapeType.ellipse : pres.ShapeType.roundRect;
        slide.addShape(shape, {
          x,
          y,
          w,
          h,
          fill: { color: hexColor(el.fill, "FB923C") },
          line: el.stroke && el.stroke !== "transparent"
            ? { color: hexColor(el.stroke, "FB923C") }
            : { color: hexColor(el.fill, "FB923C"), transparency: 100 },
          rotate: el.rotation ?? 0,
        });
      } else if (el.type === "image" && el.referenceId) {
        addAssetImage(el.referenceId, x, y, w, h);
      }
    }
  }

  const filename = `${options.filenameBase ?? safeFilename(options.title)}.pptx`;
  await pres.writeFile({ fileName: filename });
}
