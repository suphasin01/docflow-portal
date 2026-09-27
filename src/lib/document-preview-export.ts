"use client";

function oklch2rgb(L: number, C: number, H: number, A = 1): string {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;
  const rL = 4.076741662 * l3 - 3.307711591 * m3 + 0.230969929 * s3;
  const gL = -1.268438005 * l3 + 2.609757401 * m3 - 0.341319396 * s3;
  const bL = -0.004196086 * l3 - 0.703418615 * m3 + 1.695608672 * s3;
  const gc = (c: number) =>
    c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  const r = Math.round(Math.max(0, Math.min(1, gc(rL))) * 255);
  const g = Math.round(Math.max(0, Math.min(1, gc(gL))) * 255);
  const bv = Math.round(Math.max(0, Math.min(1, gc(bL))) * 255);
  return A < 1 ? `rgba(${r},${g},${bv},${A})` : `rgb(${r},${g},${bv})`;
}

function convertOklch(val: string): string {
  return val.replace(
    /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.%]+))?\s*\)/g,
    (_, L, C, H, Astr) => {
      const alpha = Astr
        ? Astr.includes("%")
          ? parseFloat(Astr) / 100
          : parseFloat(Astr)
        : 1;
      return oklch2rgb(parseFloat(L), parseFloat(C), parseFloat(H), alpha);
    },
  );
}

/**
 * html2canvas ไม่เรนเดอร์ CSS filter (grayscale) ให้ตรงพรีวิว — วาดลง canvas จากรูปต้นฉบับที่โหลดแล้ว
 */
/** ใช้ใน onclone ของ html2canvas — ให้ PDF/พิมพ์ได้ grayscale แบบเดียวกับพรีวิว */
export function bakeStampGrayscaleIntoCanvas(
  clonedDoc: Document,
  clonedRoot: HTMLElement,
  liveRoot: HTMLElement,
) {
  const clonedImgs = [
    ...clonedRoot.querySelectorAll<HTMLImageElement>(
      "img[data-document-stamp]",
    ),
  ];
  const liveImgs = [
    ...liveRoot.querySelectorAll<HTMLImageElement>("img[data-document-stamp]"),
  ];
  const n = Math.min(clonedImgs.length, liveImgs.length);
  for (let i = 0; i < n; i++) {
    const cloneImg = clonedImgs[i];
    const liveImg = liveImgs[i];
    if (!liveImg.complete || liveImg.naturalWidth === 0) continue;

    const w = liveImg.naturalWidth;
    const h = liveImg.naturalHeight;
    const canvas = clonedDoc.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    ctx.filter = "grayscale(100%)";
    ctx.globalAlpha = 0.5;
    try {
      ctx.drawImage(liveImg, 0, 0);
    } catch {
      continue;
    }
    ctx.filter = "none";
    ctx.globalAlpha = 1;

    canvas.setAttribute("data-document-stamp", "");
    canvas.className = cloneImg.className.replace(/\bgrayscale\b/g, "").trim();
    canvas.style.cssText = cloneImg.style.cssText;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.objectFit = "contain";
    canvas.style.pointerEvents = "none";
    cloneImg.parentNode?.replaceChild(canvas, cloneImg);
  }
}

function fixPreviewExportClone(
  clonedDoc: Document,
  clonedRoot: HTMLElement,
  liveRoot: HTMLElement,
) {
  // หน้า detail เก็บตัวพิมพ์ไว้นอกจอและซ่อนด้วย opacity เพื่อไม่ให้ผู้ใช้เห็น
  // html2canvas สืบทอด opacity/ตำแหน่งจาก parent จึงต้องเปิดให้เห็นเฉพาะ clone
  // ก่อน render ไม่เช่นนั้นจะได้ PDF/ภาพพิมพ์เป็นหน้าว่าง
  let current: HTMLElement | null = clonedRoot;
  while (current && current !== clonedDoc.body) {
    current.style.opacity = "1";
    current.style.visibility = "visible";
    current.style.left = "0";
    current.style.top = "0";
    current.style.transform = "none";
    current = current.parentElement;
  }

  const rootStyle = window.getComputedStyle(document.documentElement);
  const overrides = ([...rootStyle] as string[])
    .filter((p) => p.startsWith("--"))
    .map((name) => {
      const val = rootStyle.getPropertyValue(name).trim();
      if (!val.includes("oklch")) return null;
      return `${name}: ${convertOklch(val)};`;
    })
    .filter(Boolean)
    .join("\n");

  if (overrides) {
    const style = clonedDoc.createElement("style");
    style.textContent = `:root { ${overrides} }`;
    clonedDoc.head.appendChild(style);
  }

  const exportStyle = clonedDoc.createElement("style");
  exportStyle.textContent = `
    [data-pdf-text-box] {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
    }

    [data-pdf-text-box="row"] {
      justify-content: space-between !important;
    }

    [data-pdf-text-box] > span {
      position: relative !important;
      top: -7px !important;
      line-height: 1 !important;
      display: block !important;
    }

    [data-pdf-text-box="table-cell"] {
      display: table-cell !important;
      vertical-align: middle !important;
    }

    [data-pdf-text-box="left"] {
      display: block !important;
    }
  `;
  clonedDoc.head.appendChild(exportStyle);

  bakeStampGrayscaleIntoCanvas(clonedDoc, clonedRoot, liveRoot);

  clonedDoc.querySelectorAll<HTMLElement>("[style]").forEach((el) => {
    const s = el.getAttribute("style") ?? "";
    if (s.includes("oklch")) el.setAttribute("style", convertOklch(s));
  });
}

async function waitForFontsReady(doc: Document) {
  if ("fonts" in doc) {
    await (doc as Document & { fonts: FontFaceSet }).fonts.ready;
  }
}

async function waitForImagesReady(root: HTMLElement) {
  const images = [...root.querySelectorAll<HTMLImageElement>("img")];
  await Promise.all(
    images.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        });
      }
      if (typeof image.decode === "function" && image.naturalWidth > 0) {
        await image.decode().catch(() => undefined);
      }
    }),
  );
}

function safePdfFilename(filename: string) {
  const cleaned = filename
    .replace(/\.pdf$/i, "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .trim();
  return `${cleaned || "document"}.pdf`;
}

function downloadPdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safePdfFilename(filename);
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function exportPreviewContainerToPdf(
  el: HTMLElement,
  filename: string,
) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  await waitForFontsReady(document);
  await waitForImagesReady(el);

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    onclone: (clonedDoc, clonedRoot) =>
      fixPreviewExportClone(clonedDoc, clonedRoot, el),
  });

  const A4_W = 210;
  const A4_H = 297;
  const pixelRatio = canvas.width / A4_W;
  const pageHeightPx = A4_H * pixelRatio;

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  let remainingHeight = canvas.height;
  let yOffset = 0;

  while (remainingHeight > 0) {
    const sliceH = Math.min(pageHeightPx, remainingHeight);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceH;
    const ctx = pageCanvas.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(canvas, 0, -yOffset);

    const sliceData = pageCanvas.toDataURL("image/jpeg", 0.95);
    const sliceHeightMm = sliceH / pixelRatio;
    if (yOffset > 0) pdf.addPage();
    pdf.addImage(sliceData, "JPEG", 0, 0, A4_W, sliceHeightMm);

    yOffset += pageHeightPx;
    remainingHeight -= pageHeightPx;
  }

  downloadPdfBlob(pdf.output("blob"), filename);
}

export async function printPreviewContainer(
  el: HTMLElement,
  preparedWindow?: Window | null,
) {
  // ต้องเปิด popup ภายใน user gesture ก่อน await ทุกชนิด ไม่เช่นนั้น browser
  // (โดยเฉพาะ in-app browser/Safari) จะบล็อกหน้าต่างพิมพ์
  const printWindow = preparedWindow ?? window.open("", "_blank");
  if (!printWindow) {
    throw new Error("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต pop-up");
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="th">
      <head><title>กำลังเตรียมเอกสาร</title></head>
      <body style="margin:0;display:grid;min-height:100vh;place-items:center;font-family:sans-serif;color:#475569">
        กำลังเตรียมเอกสารสำหรับพิมพ์…
      </body>
    </html>
  `);
  printWindow.document.close();

  try {
    const { default: html2canvas } = await import("html2canvas");
    await waitForFontsReady(document);
    await waitForImagesReady(el);

    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      onclone: (clonedDoc, clonedRoot) =>
        fixPreviewExportClone(clonedDoc, clonedRoot, el),
    });

    const imgData = canvas.toDataURL("image/png");

    printWindow.document.open();
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="th">
        <head>
          <title>พิมพ์เอกสาร</title>
          <style>
            @page { margin: 0; size: A4 portrait; }
            html, body { margin: 0; padding: 0; background: white; }
            img { width: 210mm; height: auto; display: block; }
          </style>
        </head>
        <body>
          <img id="print-image" src="${imgData}" alt="เอกสาร" />
          <script>
            const image = document.getElementById("print-image");
            const startPrint = () => {
              window.focus();
              window.print();
            };
            if (image.complete) startPrint();
            else image.onload = startPrint;
            window.onafterprint = () => window.close();
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  } catch (error) {
    printWindow.close();
    throw error;
  }
}
