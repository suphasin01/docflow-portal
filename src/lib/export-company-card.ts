"use client";

export async function exportCompanyCard(element: HTMLElement) {
  await document.fonts.ready;
  await Promise.all(Array.from(element.querySelectorAll("img")).map((img) => img.decode()));
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(element, {
    pixelRatio: 3,
    filter: (node) => !(node instanceof Element && node.hasAttribute("data-export-ignore")),
    style: { transform: "none", boxShadow: "none", transition: "none" },
  });
  if (!blob) throw new Error("Image export failed");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "beyond-dev-company-card.png";
  link.click();
  // Let Safari finish reading the blob before releasing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
