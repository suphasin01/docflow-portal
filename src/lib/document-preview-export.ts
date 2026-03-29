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

function fixPreviewExportClone(clonedDoc: Document) {
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

export async function exportPreviewContainerToPdf(
  el: HTMLElement,
  filename: string,
) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  await waitForFontsReady(document);

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    onclone: (clonedDoc) => fixPreviewExportClone(clonedDoc),
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

  pdf.save(`${filename}.pdf`);
}

export async function printPreviewContainer(el: HTMLElement) {
  const { default: html2canvas } = await import("html2canvas");
  await waitForFontsReady(document);

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    onclone: (clonedDoc) => fixPreviewExportClone(clonedDoc),
  });

  const imgData = canvas.toDataURL("image/png");
  const win = window.open("", "_blank");
  if (!win) return;

  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          @page { margin: 0; size: A4 portrait; }
          body { margin: 0; padding: 0; background: white; }
          img { width: 210mm; display: block; }
        </style>
      </head>
      <body>
        <img src="${imgData}" />
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); };
          };
        <\/script>
      </body>
    </html>
  `);
  win.document.close();
}
