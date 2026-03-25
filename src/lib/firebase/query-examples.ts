/**
 * ตัวอย่างคิวรี Firestore สำหรับแอป (อ้างอิงในโค้ดจริงที่ hooks/services)
 *
 * 1) เอกสารของบริษัท เรียงตามวันที่ออก ล่าสุดก่อน
 *    query(
 *      collection(db, "documents"),
 *      where("companyId", "==", companyId),
 *      orderBy("issueDate", "desc"),
 *      limit(50)
 *    )
 *
 * 2) ใบแจ้งหนี้ที่ค้างชำระ
 *    query(
 *      collection(db, "documents"),
 *      where("companyId", "==", companyId),
 *      where("type", "==", "invoice"),
 *      where("paymentStatus", "in", ["unpaid", "partial", "overdue"])
 *    )
 *    // แนะนำสร้าง composite index: companyId + type + paymentStatus
 *
 * 3) รายการสินค้าที่ใช้งาน
 *    query(
 *      collection(db, "products"),
 *      where("companyId", "==", companyId),
 *      where("active", "==", true),
 *      orderBy("name")
 *    )
 *
 * 4) รายการบรรทัดเอกสาร
 *    query(
 *      collection(db, "documentItems"),
 *      where("companyId", "==", companyId),
 *      where("documentId", "==", documentId),
 *      orderBy("lineNo")
 *    )
 *
 * 5) การชำระเงินตามเอกสาร
 *    query(
 *      collection(db, "payments"),
 *      where("companyId", "==", companyId),
 *      where("documentId", "==", documentId)
 *    )
 */

export const FIRESTORE_QUERY_NOTES = "see JSDoc above";
