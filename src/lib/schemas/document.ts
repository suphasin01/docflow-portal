import { z } from "zod";

export const documentTypeSchema = z.enum([
  "quotation",
  "invoice",
  "receipt",
  "purchase_order",
  "billing_note",
]);

export const documentItemRowSchema = z.object({
  id: z.string(),
  description: z.string().min(1, "ระบุรายการ"),
  quantity: z.coerce.number().min(0.01),
  unitPrice: z.coerce.number().min(0),
  discountAmount: z.coerce.number().min(0).default(0),
  vatRate: z.coerce.number().min(0).max(100).default(7),
});

export const createDocumentFormSchema = z.object({
  type: documentTypeSchema,
  counterpartyId: z.string().optional(),
  counterpartyName: z.string().min(1, "เลือกหรือระบุชื่อคู่ค้า"),
  issueDate: z.string().min(1),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(documentItemRowSchema).min(1, "เพิ่มอย่างน้อย 1 รายการ"),
});

export type CreateDocumentFormValues = z.infer<typeof createDocumentFormSchema>;
