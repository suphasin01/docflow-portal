/**
 * ย่อรูปภาพให้พอดี 200×200 (cover crop) แล้วคืนเป็น base64 JPEG
 * ทำงานฝั่ง client เท่านั้น (ใช้ Canvas API)
 */
export function resizeImageToBase64(
  file: File,
  size = 200,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context ไม่พร้อม"));

      // cover crop: ตัดกลางรูป
      const { naturalWidth: sw, naturalHeight: sh } = img;
      const scale = Math.max(size / sw, size / sh);
      const scaledW = sw * scale;
      const scaledH = sh * scale;
      const offsetX = (size - scaledW) / 2;
      const offsetY = (size - scaledH) / 2;

      ctx.drawImage(img, offsetX, offsetY, scaledW, scaledH);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("โหลดรูปไม่สำเร็จ"));
    };

    img.src = objectUrl;
  });
}
