# Beyond Doc — Data schema (Firestore)

เอกสารอ้างอิงโครงสร้างข้อมูลหลักของแอป ตาม `src/types/index.ts`, การเขียน Firestore ใน `src/lib/firebase/`, และ `firestore.rules`

---

## หลักการทั่วไป

| หลักการ | รายละเอียด |
|--------|-------------|
| **Multi-tenant** | เกือบทุกเรคอร์ดธุรกิจมี `companyId` อ้างอิง `companies/{companyId}` |
| **ผู้สร้าง** | `createdBy` = Firebase Auth `uid` |
| **เวลา** | `createdAt`, `updatedAt` เป็น `Timestamp` (Firestore) |
| **Document ID** | ส่วนใหญ่ใช้ auto-id; `companies` / `settings` ใช้ `companyId` เป็น document id สำหรับ settings |

---

## Collection index (มีใน `firestore.rules`)

| Collection | Document ID | หมายเหตุ |
|------------|-------------|-----------|
| `users` | `{userId}` (= Auth uid) | โปรไฟล์ผู้ใช้หลัง login |
| `companies` | auto-id | บริษัทหลายแห่งต่อ owner |
| `settings` | `{companyId}` | ตั้งค่าเอกสาร / VAT / เลขที่ — **doc id = company id** |
| `documents` | auto-id | เอกสารธุรกิจหลัก |
| `products` | auto-id | ในโค้ดปัจจุบัน = **catalog** (`CatalogItem`) |
| `customers` | auto-id | legacy ลูกค้า |
| `vendors` | auto-id | legacy ผู้ขาย |
| `contacts` | auto-id | ลูกค้า/ผู้ขายแบบรวม (โมเดลหลัก) |
| `payments` | auto-id | รายการรับชำระต่อเอกสาร |

---

## Collection ที่โค้ดอ้างถึงแต่ **ยังไม่มีใน rules**

| Collection | การใช้งาน |
|------------|-----------|
| `documentItems` | เขียนใน `save-document.ts` (บรรทัดรายการแยกเอกสาร) — ถ้ายังใช้อยู่ควรเพิ่ม `match` ใน `firestore.rules` |

---

## 1. `users/{userId}`

โครงสร้างจาก `bootstrap-profile.ts` (merge)

| Field | Type | คำอธิบาย |
|-------|------|-----------|
| `email` | `string \| null` | จาก Firebase Auth |
| `displayName` | `string \| null` | |
| `photoURL` | `string \| null` | |
| `updatedAt` | `Timestamp` | |

หมายเหตุ: ชนิด `UserProfile` ใน TypeScript มี `companyId` แต่ bootstrap ปัจจุบันไม่ได้บังคับฟิลด์นี้ใน `users`

---

## 2. `companies/{companyId}`

สอดคล้อง `Company` + ฟิลด์ที่เขียนจริงจาก mutation/bootstrap

| Field | Type | คำอธิบาย |
|-------|------|-----------|
| `ownerId` | `string` | Auth uid เจ้าของ |
| `name` | `string` | ชื่อบริษัท (TH) |
| `nameEn` | `string?` | |
| `officeType` | `"none" \| "hq" \| "branch"` | |
| `taxId` | `string?` | |
| `branch` | `string?` | |
| `branchName` | `string?` | |
| `branchCode` | `string?` | |
| `address` | `string?` | |
| `phone` | `string?` | |
| `email` | `string?` | |
| `logoUrl` | `string?` | |
| `signerName` | `string?` | |
| `signerPosition` | `string?` | |
| `isDefault` | `boolean?` | บริษัทเริ่มต้น |
| `archived` | `boolean?` | soft archive |
| `createdBy` | `string` | (rules: create) |
| `createdAt` | `Timestamp` | |
| `updatedAt` | `Timestamp` | |

---

## 3. `settings/{companyId}`

เอกสารตั้งค่าต่อบริษัท — รวม legacy (`CompanySettings`) กับฟิลด์ wizard (`DocumentSettings`)

| Field | Type | คำอธิบาย |
|-------|------|-----------|
| `companyId` | `string` | ซ้ำกับ doc id |
| `currency` | `string` | เช่น `THB` |
| `vatRateDefault` | `number` | legacy |
| `docNumberPrefixes` | `object` | prefix ต่อ `DocumentType` |
| `defaultVatRate` | `number` | |
| `defaultWithholdingTaxRate` | `number` | |
| `documentNumberDateFormat` | enum | ดู `DocumentNumberDateFormat` ใน types |
| `documentRunningDigits` | `number` | |
| `documentNumberSeparator` | `string` | |
| `deletedNumberBehavior` | enum | `fill_gap` \| `continue_max` |
| `documentDisplayDateFormat` | enum | รูปแบบวันที่บนเอกสาร |
| `step3Presets` | `object` | preset ลายเซ็น/ตราประทับ/เงื่อนไขชำระ/หมายเหตุ/ข้อตกลง ของ wizard ขั้นที่ 3 — โครงสร้างตาม `Step3PresetStore` ใน `document-step3.ts` (รูปเป็น data URL ได้; ระวังขนาดเอกสาร Firestore ~1 MiB) |
| `createdBy` | `string` | |
| `createdAt` | `Timestamp` | |
| `updatedAt` | `Timestamp` | |

---

## 4. `documents/{docId}` — `BusinessDocument`

ธุรกิจหลัก + ฟิลด์ snapshot สำหรับพรีวิว

### Identity & ประเภท

| Field | Type | คำอธิบาย |
|-------|------|-----------|
| `companyId` | `string` | |
| `docNumber` | `string` | เลขที่แสดง |
| `type` | `DocumentType` | รายการค่าดูด้านล่าง |
| `status` | `DocumentStatus` | `draft` \| `issued` \| `paid` \| `partial` \| `overdue` \| `cancelled` |
| `workflowStatus` | `"draft" \| "billed"?` | เช่น ออกบิลต่อแล้ว |

### คู่ค้า & วันที่

| Field | Type | คำอธิบาย |
|-------|------|-----------|
| `customerId` | `string?` | |
| `customerName` | `string?` | denormalized |
| `vendorId` | `string?` | |
| `vendorName` | `string?` | denormalized |
| `issueDate` | `string` | รูปแบบ `YYYY-MM-DD` |
| `dueDate` | `string?` | |

### ยอดเงิน (รวมระดับเอกสาร)

| Field | Type |
|-------|------|
| `subtotal` | `number` |
| `discountTotal` | `number` |
| `vatAmount` | `number` |
| `total` | `number` |
| `notes` | `string?` |

### การชำระเงิน (ประเภทที่ระบบรองรับ)

| Field | Type |
|-------|------|
| `paymentStatus` | `PaymentStatus?` |
| `paymentMethod` | `string \| null?` |
| `paymentStatusHistory` | `PaymentStatusHistoryEntry[]?` |

### โซ่เอกสาร (flow)

| Field | Type | คำอธิบาย |
|-------|------|-----------|
| `refDocumentId` | `string \| null?` | |
| `sourceDocumentId` | `string \| null?` | เอกสารต้นทาง |
| `chainId` | `string \| null?` | กลุ่มโซ่ |
| `createdFromFlowAction` | `string \| null?` | |
| `nextDocumentsCreated` | `string[]?` | ประเภทเอกสารที่สร้างต่อจากเอกสารนี้แล้ว |

### Snapshot & draft preview

| Field | Type | คำอธิบาย |
|-------|------|-----------|
| `companySnapshot` | `object?` | ข้อมูลบริษัท ณ เวลาออกเอกสาร |
| `partnerSnapshot` | `object?` | ลูกค้า/ผู้ขาย ณ เวลาออกเอกสาร |
| `previewData` | `object?` | `step1Data`, `step2Data`, `step3Data` (แบบฟอร์ม wizard) |

### Meta

| Field | Type |
|-------|------|
| `createdBy` | `string` |
| `createdAt` | `Timestamp` |
| `updatedAt` | `Timestamp` |

### `DocumentType`

`quotation`, `sales_order`, `invoice`, `billing_note`, `tax_invoice`, `receipt`, `delivery_order`, `credit_note`, `purchase_order`, `purchase_request`, `goods_receipt`, `payment_voucher`

---

## 5. `products/{docId}` — Catalog (ปัจจุบัน)

ตรงกับ `CatalogItem` ในโค้ด catalog / mutations

| Field | Type | คำอธิบาย |
|-------|------|-----------|
| `companyId` | `string` | |
| `code` | `string` | เช่น P0001 |
| `codeNumber` | `number` | ลำดับสำหรับ running |
| `itemType` | `"product" \| "service"` | |
| `name` | `string` | |
| `description` | `string?` | |
| `unit` | `string?` | |
| `salePrice` | `number` | |
| `costPrice` | `number?` | |
| `vatType` | `CatalogVatType` | `vat3` \| `vat7` \| `custom` |
| `customVatRate` | `number?` | |
| `isArchived` | `boolean` | |
| `createdBy` | `string` | |
| `createdAt` | `Timestamp` | |
| `updatedAt` | `Timestamp` | |

---

## 6. `contacts/{docId}` — `Contact`

| Field | Type |
|-------|------|
| `companyId` | `string` |
| `partnerType` | `"customer" \| "vendor"` |
| `code` | `string` |
| `codeNumber` | `number` |
| `nameTh` | `string` |
| `nameEn` | `string?` |
| `taxId` | `string?` |
| `phone` | `string?` |
| `email` | `string?` |
| `address` | `string?` |
| `officeType` | `ContactOfficeType` |
| `branchName` | `string?` |
| `branchCode` | `string?` |
| `logoBase64` | `string?` |
| `isArchived` | `boolean` |
| `createdBy` | `string` |
| `createdAt` | `Timestamp` |
| `updatedAt` | `Timestamp` |

---

## 7. `customers/{docId}` — `Customer` (legacy)

| Field | Type |
|-------|------|
| `companyId` | `string` |
| `name`, `taxId?`, `contactName?`, `phone?`, `email?`, `address?`, `notes?` | |
| `active` | `boolean` |
| + `FirestoreTimestamps` | |

---

## 8. `vendors/{docId}` — `Vendor` (legacy)

เหมือนลำดับฟิลด์กับ Customer แต่เป็นผู้ขาย

---

## 9. `payments/{docId}` — `Payment`

| Field | Type |
|-------|------|
| `companyId` | `string` |
| `documentId` | `string` |
| `docNumber` | `string` |
| `amount` | `number` |
| `paidAt` | `string` | มักเป็น `YYYY-MM-DD` |
| `method` | `string?` |
| `note` | `string?` |
| `createdBy` | `string` |
| `createdAt` | `Timestamp` |
| `updatedAt` | `Timestamp` |

---

## 10. `documentItems/{docId}` — `DocumentItem` (ถ้ามีการใช้งาน)

จาก TypeScript: รายการบรรทัดต่อเอกสาร (แยก collection)

| Field | Type |
|-------|------|
| `companyId` | `string` |
| `documentId` | `string` |
| `lineNo` | `number` |
| `description` | `string` |
| `quantity` | `number` |
| `unitPrice` | `number` |
| `discountAmount` | `number` |
| `vatRate` | `number` |
| `lineTotal` | `number` |
| + timestamps | |

**หมายเหตุ:** ใน flow ปัจจุบันหลายจุดเก็บรายการใน `documents.previewData.step2Data` แทน — ตรวจสอบว่า collection นี้ยังถูกเขียนหรือไม่ก่อนเพิ่มกฎความปลอดภัย

---

## อ้างอิง logic ที่เกี่ยวข้อง

- **ประเภทเอกสาร / โฟลว์รายรับ-รายจ่าย:** `src/lib/doc-types.ts` (`DOC_TYPE_CONFIG`)
- **ลำดับเอกสารถัดไป:** `src/lib/document-flow.ts` (`DOCUMENT_FLOW_CONFIG`)
- **ฟอร์ม wizard (step1–3):** `src/lib/schemas/document-draft.ts`, `document-step2.ts`, `document-step3.ts`

---

## สรุปความสัมพันธ์แบบย่อ

```text
users/{uid}
companies/{companyId}
settings/{companyId}     ← doc id = companyId
contacts/*               → companyId
documents/*              → companyId, optional chainId / sourceDocumentId
products/*               → companyId (catalog)
customers/*, vendors/*   → companyId (legacy)
payments/*               → companyId, documentId
documentItems/*          → companyId, documentId (ถ้าใช้งาน — ยังไม่มีใน rules)
```

ไฟล์นี้สะท้อนสภาพโค้ด ณ เวลาเขียน หากเพิ่ม collection ใหม่ให้อัปเดตเทียบกับ `firestore.rules` และ `src/types/index.ts` พร้อมกัน
