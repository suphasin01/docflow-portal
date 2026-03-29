"use client";

import { useMemo, useState } from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Trash2,
  Plus,
  PackageSearch,
  PencilLine,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Columns3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCompanyStore } from "@/stores/company-store";
import { useCatalogItems } from "@/hooks/use-workspace-data";
import type { CatalogItem } from "@/types";
import type { Step1FormValues } from "@/lib/schemas/document-draft";
import {
  buildDefaultStep2Values,
  createEmptyItemRow,
  computeTotals,
  DEFAULT_SUMMARY_BLOCK_ORDER,
  SUMMARY_BLOCK_LABELS,
  type Step2FormValues,
  type ItemRow,
  type SummaryBlockKey,
  type VisibleColumns,
} from "@/lib/schemas/document-step2";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getCatalogVatRate(item: CatalogItem & { id: string }): number {
  if (item.vatType === "vat3") return 3;
  if (item.vatType === "vat7") return 7;
  return item.customVatRate ?? 0;
}

function getVatLabel(rate: number): string {
  if (rate === 7) return "7%";
  if (rate === 3) return "3%";
  if (rate === -1) return "ยกเว้น";
  return "ไม่ระบุ";
}

// ─── Column Selector ──────────────────────────────────────────────────────────

const COLUMN_OPTIONS: {
  key: keyof VisibleColumns;
  label: string;
  locked?: boolean;
}[] = [
  { key: "index", label: "#" },
  { key: "code", label: "รหัส" },
  { key: "itemName", label: "สินค้า/บริการ", locked: true },
  { key: "description", label: "รายละเอียด" },
  { key: "quantity", label: "จำนวน" },
  { key: "unit", label: "หน่วย" },
  { key: "unitPrice", label: "ราคา/หน่วย" },
  { key: "discount", label: "ส่วนลด" },
  { key: "vat", label: "ภาษี" },
];

function ColumnSelectorPopover({
  columns,
  onChange,
}: {
  columns: VisibleColumns;
  onChange: (col: keyof VisibleColumns, val: boolean) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors">
        <Columns3 className="size-3.5" />
        เลือกคอลัมน์
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3" align="end">
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          คอลัมน์ที่แสดง
        </p>
        <div className="space-y-2">
          {COLUMN_OPTIONS.map((opt) => (
            <div key={opt.key} className="flex items-center gap-2">
              <Checkbox
                id={`col-${opt.key}`}
                checked={columns[opt.key]}
                disabled={opt.locked}
                onCheckedChange={(v) => onChange(opt.key, !!v)}
              />
              <label
                htmlFor={`col-${opt.key}`}
                className={cn(
                  "text-sm cursor-pointer select-none",
                  opt.locked && "text-muted-foreground cursor-default",
                )}
              >
                {opt.label}
              </label>
              {opt.locked && (
                <span className="ml-auto text-[10px] text-muted-foreground">
                  บังคับ
                </span>
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Item Picker Modal ────────────────────────────────────────────────────────

function ItemPickerModal({
  open,
  onClose,
  onSelect,
  companyId,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (item: CatalogItem & { id: string }) => void;
  companyId: string | null;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "product" | "service">(
    "all",
  );
  const { data: catalog, loading } = useCatalogItems(companyId);

  const filtered = useMemo(
    () =>
      catalog.filter((c) => {
        const matchType = typeFilter === "all" || c.itemType === typeFilter;
        const q = search.toLowerCase();
        const matchSearch =
          !q ||
          c.name.toLowerCase().includes(q) ||
          (c.code ?? "").toLowerCase().includes(q);
        return matchType && matchSearch;
      }),
    [catalog, search, typeFilter],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>เลือกสินค้า/บริการ</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mt-1">
          <Input
            placeholder="ค้นหาชื่อหรือรหัส..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}
          >
            <SelectTrigger className="w-32">
              <SelectValue>
                {typeFilter === "all"
                  ? "ทั้งหมด"
                  : typeFilter === "product"
                    ? "สินค้า"
                    : "บริการ"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="product">สินค้า</SelectItem>
              <SelectItem value="service">บริการ</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="mt-2 max-h-80 overflow-y-auto space-y-1">
          {loading && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              กำลังโหลด...
            </p>
          )}
          {!loading && filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              ไม่พบสินค้า/บริการ
            </p>
          )}
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="w-full rounded-lg px-3 py-2.5 text-left hover:bg-muted/60 transition-colors flex items-start gap-3"
              onClick={() => {
                onSelect(item);
                onClose();
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {item.name}
                  </span>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {item.itemType === "product" ? "สินค้า" : "บริการ"}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {item.code}
                  </span>
                  {item.unit && (
                    <span className="text-xs text-muted-foreground">
                      หน่วย: {item.unit}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-sm font-medium text-right shrink-0">
                {fmt(item.salePrice)}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sortable Item Row ─────────────────────────────────────────────────────────

function SortableItemRow({
  field,
  index,
  totalRows,
  columns,
  control,
  onRemove,
  onOpenPicker,
  getVal,
  setVal,
}: {
  field: ItemRow & { id: string };
  index: number;
  totalRows: number;
  columns: VisibleColumns;
  control: ReturnType<typeof useForm<Step2FormValues>>["control"];
  onRemove: () => void;
  onOpenPicker: () => void;
  getVal: (path: string) => unknown;
  setVal: (path: string, val: unknown) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const prefix = `items.${index}` as const;
  const sourceType = getVal(`${prefix}.itemSourceType`) as string;

  const qty = Number(getVal(`${prefix}.quantity`) ?? 0);
  const price = Number(getVal(`${prefix}.unitPrice`) ?? 0);
  const discType = getVal(`${prefix}.discountType`) as string;
  const discVal = Number(getVal(`${prefix}.discountValue`) ?? 0);
  const vatRate = Number(getVal(`${prefix}.vatRate`) ?? 0);

  const base = qty * price;
  const discAmount =
    discType === "percent" ? (base * discVal) / 100 : Math.min(discVal, base);
  const rowTotal = base - discAmount;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-border/70 bg-white shadow-sm"
    >
      {/* Row top bar */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground transition-colors"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        <span className="text-xs font-medium text-muted-foreground w-5 shrink-0">
          {index + 1}
        </span>

        {/* Source toggle */}
        <button
          type="button"
          onClick={() => {
            const next = sourceType === "manual" ? "master" : "manual";
            setVal(`${prefix}.itemSourceType`, next);
            if (next === "manual") {
              setVal(`${prefix}.selectedItemId`, "");
              setVal(`${prefix}.selectedItemCode`, "");
            }
          }}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium border transition-colors shrink-0",
            sourceType === "master"
              ? "border-blue-200 bg-blue-50 text-blue-700"
              : "border-border bg-muted/50 text-muted-foreground hover:bg-muted",
          )}
        >
          {sourceType === "master" ? (
            <>
              <PackageSearch className="size-3" />
              เลือกรายการ
            </>
          ) : (
            <>
              <PencilLine className="size-3" />
              พิมพ์เอง
            </>
          )}
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0">
          {sourceType === "master" ? (
            <button
              type="button"
              onClick={onOpenPicker}
              className="w-full text-left text-sm rounded-md border border-input bg-background px-3 py-1.5 text-muted-foreground hover:bg-muted/50 transition-colors truncate"
            >
              {(getVal(`${prefix}.title`) as string) ||
                "คลิกเพื่อเลือกสินค้า/บริการ"}
            </button>
          ) : (
            <Controller
              control={control}
              name={`items.${index}.title`}
              render={({ field: f }) => (
                <Input
                  {...f}
                  placeholder="ชื่อสินค้า/บริการ"
                  className="h-8 text-sm"
                />
              )}
            />
          )}
        </div>

        {columns.code && (
          <span className="text-xs text-muted-foreground shrink-0 w-16 text-right truncate">
            {(getVal(`${prefix}.selectedItemCode`) as string) || "—"}
          </span>
        )}

        <button
          type="button"
          onClick={onRemove}
          disabled={totalRows <= 1}
          className="text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* Description */}
      {columns.description && (
        <div className="px-10 pb-2">
          <Controller
            control={control}
            name={`items.${index}.description`}
            render={({ field: f }) => (
              <Textarea
                {...f}
                placeholder="รายละเอียด (ถ้ามี)"
                rows={1}
                className="resize-none text-xs text-muted-foreground min-h-[32px]"
              />
            )}
          />
        </div>
      )}

      {/* Numeric fields row */}
      <div className="flex flex-wrap items-end gap-3 px-10 pb-3">
        {columns.quantity && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">จำนวน</Label>
            <Controller
              control={control}
              name={`items.${index}.quantity`}
              render={({ field: f }) => (
                <Input
                  {...f}
                  type="number"
                  min={0}
                  step="any"
                  className="h-8 w-20 text-sm text-right"
                  onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                />
              )}
            />
          </div>
        )}
        {columns.unit && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">หน่วย</Label>
            <Controller
              control={control}
              name={`items.${index}.unit`}
              render={({ field: f }) => (
                <Input {...f} placeholder="ชิ้น" className="h-8 w-20 text-sm" />
              )}
            />
          </div>
        )}
        {columns.unitPrice && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">ราคา/หน่วย</Label>
            <Controller
              control={control}
              name={`items.${index}.unitPrice`}
              render={({ field: f }) => (
                <Input
                  {...f}
                  type="number"
                  min={0}
                  step="any"
                  className="h-8 w-28 text-sm text-right"
                  onChange={(e) => f.onChange(parseFloat(e.target.value) || 0)}
                />
              )}
            />
          </div>
        )}
        {columns.discount && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">ส่วนลด</Label>
            <div className="flex gap-1">
              <Controller
                control={control}
                name={`items.${index}.discountType`}
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger className="h-8 w-14 text-xs px-2">
                      <SelectValue>
                        {f.value === "percent" ? "%" : "฿"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">%</SelectItem>
                      <SelectItem value="fixed">฿</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <Controller
                control={control}
                name={`items.${index}.discountValue`}
                render={({ field: f }) => (
                  <Input
                    {...f}
                    type="number"
                    min={0}
                    step="any"
                    className="h-8 w-20 text-sm text-right"
                    onChange={(e) =>
                      f.onChange(parseFloat(e.target.value) || 0)
                    }
                  />
                )}
              />
            </div>
          </div>
        )}
        {columns.vat && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">VAT (%)</Label>
            <Controller
              control={control}
              name={`items.${index}.vatRate`}
              render={({ field: f }) => (
                <Select
                  value={String(f.value)}
                  onValueChange={(v) => f.onChange(Number(v))}
                >
                  <SelectTrigger className="h-8 w-20 text-sm">
                    <SelectValue>{getVatLabel(f.value)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">ไม่ระบุ</SelectItem>
                    <SelectItem value="3">3%</SelectItem>
                    <SelectItem value="7">7%</SelectItem>
                    <SelectItem value="-1">ยกเว้น</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}

        {/* Line total */}
        <div className="ml-auto text-right space-y-1">
          <Label className="text-xs text-muted-foreground">รวม (฿)</Label>
          <div className="h-8 flex items-center justify-end">
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {fmt(rowTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sortable Summary Block ───────────────────────────────────────────────────

function SortableSummaryBlock({
  blockKey,
  control,
  watch: watchFn,
  setValue: setValFn,
}: {
  blockKey: SummaryBlockKey;
  control: ReturnType<typeof useForm<Step2FormValues>>["control"];
  watch: ReturnType<typeof useForm<Step2FormValues>>["watch"];
  setValue: ReturnType<typeof useForm<Step2FormValues>>["setValue"];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: blockKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const label = SUMMARY_BLOCK_LABELS[blockKey];

  const renderFields = () => {
    switch (blockKey) {
      case "document_discount": {
        const enabled = watchFn("documentDiscount.enabled");
        return (
          <div className="flex items-center gap-3 flex-wrap">
            <Controller
              control={control}
              name="documentDiscount.enabled"
              render={({ field: f }) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="dd-enabled"
                    checked={f.value}
                    onCheckedChange={(v) => f.onChange(!!v)}
                  />
                  <label
                    htmlFor="dd-enabled"
                    className="text-sm font-medium cursor-pointer"
                  >
                    {label}
                  </label>
                </div>
              )}
            />
            {enabled && (
              <div className="flex items-center gap-2 ml-auto">
                <Controller
                  control={control}
                  name="documentDiscount.type"
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger className="h-8 w-16 text-xs px-2">
                        <SelectValue>
                          {f.value === "percent" ? "%" : "฿"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="fixed">฿</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <Controller
                  control={control}
                  name="documentDiscount.value"
                  render={({ field: f }) => (
                    <Input
                      {...f}
                      type="number"
                      min={0}
                      step="any"
                      className="h-8 w-28 text-sm text-right"
                      onChange={(e) =>
                        f.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  )}
                />
              </div>
            )}
          </div>
        );
      }
      case "vat": {
        const enabled = watchFn("vat.enabled");
        return (
          <div className="flex items-center gap-3 flex-wrap">
            <Controller
              control={control}
              name="vat.enabled"
              render={({ field: f }) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="vat-enabled"
                    checked={f.value}
                    onCheckedChange={(v) => f.onChange(!!v)}
                  />
                  <label
                    htmlFor="vat-enabled"
                    className="text-sm font-medium cursor-pointer"
                  >
                    {label}
                  </label>
                </div>
              )}
            />
            {enabled && (
              <div className="flex items-center gap-3 ml-auto flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap">
                    อัตรา
                  </Label>
                  <Controller
                    control={control}
                    name="vat.vatRate"
                    render={({ field: f }) => (
                      <Select
                        value={String(f.value)}
                        onValueChange={(v) => f.onChange(Number(v))}
                      >
                        <SelectTrigger className="h-8 w-20 text-sm">
                          <SelectValue>{getVatLabel(f.value)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7%</SelectItem>
                          <SelectItem value="3">3%</SelectItem>
                          <SelectItem value="-1">ยกเว้น</SelectItem>
                          <SelectItem value="0">ไม่ระบุ</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <Controller
                  control={control}
                  name="vat.includeInItems"
                  render={({ field: f }) => (
                    <div className="flex items-center gap-1.5">
                      <Checkbox
                        id="vat-include"
                        checked={f.value}
                        onCheckedChange={(v) => f.onChange(!!v)}
                      />
                      <label
                        htmlFor="vat-include"
                        className="text-xs cursor-pointer whitespace-nowrap"
                      >
                        รวมในสินค้า/บริการแล้ว
                      </label>
                    </div>
                  )}
                />
              </div>
            )}
          </div>
        );
      }
      case "wht": {
        const enabled = watchFn("wht.enabled");
        return (
          <div className="flex items-center gap-3 flex-wrap">
            <Controller
              control={control}
              name="wht.enabled"
              render={({ field: f }) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="wht-enabled"
                    checked={f.value}
                    onCheckedChange={(v) => f.onChange(!!v)}
                  />
                  <label
                    htmlFor="wht-enabled"
                    className="text-sm font-medium cursor-pointer"
                  >
                    {label}
                  </label>
                </div>
              )}
            />
            {enabled && (
              <div className="flex items-center gap-2 ml-auto">
                <Controller
                  control={control}
                  name="wht.type"
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger className="h-8 w-16 text-xs px-2">
                        <SelectValue>
                          {f.value === "percent" ? "%" : "฿"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">%</SelectItem>
                        <SelectItem value="fixed">฿</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <Controller
                  control={control}
                  name="wht.value"
                  render={({ field: f }) => (
                    <Input
                      {...f}
                      type="number"
                      min={0}
                      step="any"
                      className="h-8 w-28 text-sm text-right"
                      onChange={(e) =>
                        f.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  )}
                />
              </div>
            )}
          </div>
        );
      }
      case "additional_fee": {
        const enabled = watchFn("additionalFee.enabled");
        return (
          <div className="flex items-center gap-3 flex-wrap">
            <Controller
              control={control}
              name="additionalFee.enabled"
              render={({ field: f }) => (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="af-enabled"
                    checked={f.value}
                    onCheckedChange={(v) => f.onChange(!!v)}
                  />
                  <label
                    htmlFor="af-enabled"
                    className="text-sm font-medium cursor-pointer"
                  >
                    {label}
                  </label>
                </div>
              )}
            />
            {enabled && (
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <Controller
                  control={control}
                  name="additionalFee.label"
                  render={({ field: f }) => (
                    <Input
                      {...f}
                      placeholder="ชื่อรายการ"
                      className="h-8 w-36 text-sm"
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="additionalFee.amount"
                  render={({ field: f }) => (
                    <Input
                      {...f}
                      type="number"
                      min={0}
                      step="any"
                      placeholder="จำนวนเงิน"
                      className="h-8 w-28 text-sm text-right"
                      onChange={(e) =>
                        f.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="additionalFee.taxOption"
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger className="h-8 text-xs w-36">
                        <SelectValue>
                          {f.value === "add_vat7"
                            ? "บวก VAT เพิ่ม 7%"
                            : f.value === "include_vat"
                              ? "รวม VAT แล้ว"
                              : "ไม่คิด VAT"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="add_vat7">
                          บวก VAT เพิ่ม 7%
                        </SelectItem>
                        <SelectItem value="include_vat">
                          รวม VAT แล้ว
                        </SelectItem>
                        <SelectItem value="no_vat">ไม่คิด VAT</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
          </div>
        );
      }
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-3 rounded-lg border border-border/60 bg-white px-4 py-3"
    >
      <button
        type="button"
        className="mt-0.5 cursor-grab touch-none text-muted-foreground hover:text-foreground transition-colors"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="flex-1">{renderFields()}</div>
    </div>
  );
}

// ─── Totals Card ──────────────────────────────────────────────────────────────

function TotalsCard({
  totals,
  summaryOrder,
  vatEnabled,
  vatRate,
  vatIncluded,
  whtEnabled,
  ddEnabled,
  afEnabled,
  afLabel,
}: {
  totals: ReturnType<typeof computeTotals>;
  summaryOrder: SummaryBlockKey[];
  vatEnabled: boolean;
  vatRate: number;
  vatIncluded: boolean;
  whtEnabled: boolean;
  ddEnabled: boolean;
  afEnabled: boolean;
  afLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-white shadow-sm">
      <div className="px-5 py-4 border-b border-border/60">
        <h3 className="font-semibold text-sm">สรุปยอด</h3>
      </div>
      <div className="px-5 py-4 space-y-3">
        <TotalLine label="รวมเงิน" value={totals.itemSubtotal} />

        {totals.rowDiscountTotal > 0 && (
          <TotalLine label="ส่วนลดรายการ" value={-totals.rowDiscountTotal} />
        )}

        {summaryOrder.map((blockKey) => {
          if (
            blockKey === "document_discount" &&
            ddEnabled &&
            totals.documentDiscountTotal > 0
          ) {
            return (
              <div key={blockKey} className="space-y-2">
                <TotalLine
                  label="ส่วนลดรวม"
                  value={-totals.documentDiscountTotal}
                />
                <TotalLine
                  label="ยอดหลังหักส่วนลด"
                  value={totals.subtotalAfterAllDiscounts}
                  className="font-medium"
                />
              </div>
            );
          }

          if (blockKey === "vat" && vatEnabled) {
            return vatIncluded ? (
              <div key={blockKey} className="space-y-2">
                <TotalLine
                  label="ยอดก่อนภาษี"
                  value={Math.max(
                    0,
                    totals.taxableBaseAfterDiscount - totals.vatIncludedAmount,
                  )}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {vatRate > 0
                      ? `VAT ${vatRate}% (รวมแล้ว)`
                      : "VAT (รวมแล้ว)"}
                  </span>
                  <span className="tabular-nums">
                    {fmt(totals.vatIncludedAmount)}
                  </span>
                </div>
              </div>
            ) : (
              <TotalLine
                key={blockKey}
                label={vatRate > 0 ? `VAT ${vatRate}%` : "VAT"}
                value={totals.vatTotal}
              />
            );
          }

          if (blockKey === "wht" && whtEnabled && totals.whtTotal > 0) {
            return (
              <TotalLine
                key={blockKey}
                label="หัก ณ ที่จ่าย (WHT)"
                value={-totals.whtTotal}
              />
            );
          }

          if (
            blockKey === "additional_fee" &&
            afEnabled &&
            totals.additionalFeeTotal > 0
          ) {
            return (
              <TotalLine
                key={blockKey}
                label={afLabel || "ค่าใช้จ่ายเพิ่มเติม"}
                value={totals.additionalFeeTotal}
              />
            );
          }

          return null;
        })}

        <Separator />

        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">ยอดสุทธิ</span>
          <span className="text-lg font-bold tabular-nums text-primary">
            {fmt(totals.netTotal)}
          </span>
        </div>

        <div className="rounded-lg bg-muted/60 px-3 py-2 mt-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {totals.netTotalText}
          </p>
        </div>
      </div>
    </div>
  );
}

function TotalLine({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between text-sm", className)}>
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          value < 0 ? "text-destructive" : "text-foreground",
        )}
      >
        {value < 0 ? `-${fmt(Math.abs(value))}` : fmt(value)}
      </span>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function mergeStep2Initial(
  initial: Step2FormValues | null | undefined,
): Step2FormValues {
  const base = buildDefaultStep2Values();
  if (!initial) return base;
  return {
    ...base,
    ...initial,
    visibleColumns: { ...base.visibleColumns, ...initial.visibleColumns },
    items:
      initial.items && initial.items.length > 0 ? initial.items : base.items,
    summaryBlockOrder:
      initial.summaryBlockOrder && initial.summaryBlockOrder.length > 0
        ? initial.summaryBlockOrder
        : base.summaryBlockOrder,
  };
}

interface Step2Props {
  step1Data: Step1FormValues | null;
  onBack: () => void;
  onNext: (values: Step2FormValues) => void;
  onPreview?: (values: Step2FormValues) => void;
  initialValues?: Step2FormValues | null;
}

export function DocumentCreateStep2({
  step1Data,
  onBack,
  onNext,
  onPreview,
  initialValues,
}: Step2Props) {
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);

  const mergedDefaults = mergeStep2Initial(initialValues ?? undefined);

  const { control, watch, setValue, getValues, handleSubmit } =
    useForm<Step2FormValues>({
      defaultValues: mergedDefaults,
    });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: "items",
  });

  // Summary block DnD order (local state, synced on submit)
  const [summaryOrder, setSummaryOrder] = useState<SummaryBlockKey[]>(() =>
    mergedDefaults.summaryBlockOrder.length
      ? [...mergedDefaults.summaryBlockOrder]
      : [...DEFAULT_SUMMARY_BLOCK_ORDER],
  );

  // Item picker modal state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetIdx, setPickerTargetIdx] = useState<number>(0);

  // Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Item DnD
  function handleItemDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = fields.findIndex((f) => f.id === active.id);
    const newIdx = fields.findIndex((f) => f.id === over.id);
    if (oldIdx !== -1 && newIdx !== -1) move(oldIdx, newIdx);
  }

  // Summary block DnD
  function handleSummaryDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = summaryOrder.indexOf(active.id as SummaryBlockKey);
    const newIdx = summaryOrder.indexOf(over.id as SummaryBlockKey);
    setSummaryOrder((o) => arrayMove(o, oldIdx, newIdx));
  }

  // Column visibility toggler
  const columns = watch("visibleColumns");
  function toggleColumn(key: keyof VisibleColumns, val: boolean) {
    if (key === "itemName") return;
    setValue(`visibleColumns.${key}`, val, { shouldDirty: true });
  }

  // Catalog item selection
  function handleCatalogSelect(item: CatalogItem & { id: string }) {
    const p = `items.${pickerTargetIdx}` as const;
    setValue(`${p}.itemSourceType`, "master");
    setValue(`${p}.selectedItemId`, item.id);
    setValue(`${p}.selectedItemCode`, item.code);
    setValue(`${p}.title`, item.name);
    setValue(`${p}.description`, item.description ?? "");
    setValue(`${p}.unit`, item.unit ?? "");
    setValue(`${p}.unitPrice`, item.salePrice);
    setValue(`${p}.vatRate`, getCatalogVatRate(item));
  }

  // Calculated totals
  const allValues = watch();
  const totals = useMemo(() => computeTotals(allValues), [allValues]);

  function onSubmit(values: Step2FormValues) {
    onNext({ ...values, summaryBlockOrder: summaryOrder });
  }

  const vatEnabled = watch("vat.enabled");
  const vatRate = watch("vat.vatRate");
  const vatIncluded = watch("vat.includeInItems");
  const whtEnabled = watch("wht.enabled");
  const ddEnabled = watch("documentDiscount.enabled");
  const afEnabled = watch("additionalFee.enabled");
  const afLabel = watch("additionalFee.label");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0">
      {/* Main content */}
      <div className="flex-1 px-6 py-6">
        <div className="flex gap-6 items-start">
          {/* ── LEFT ── */}
          <div className="flex-1 min-w-0 space-y-5">
            {/* Item list card */}
            <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/50">
                <h2 className="font-semibold text-sm">รายการสินค้า/บริการ</h2>
                <div className="flex items-center gap-2">
                  <ColumnSelectorPopover
                    columns={columns}
                    onChange={toggleColumn}
                  />
                </div>
              </div>

              {/* Item rows */}
              <div className="p-4 space-y-3">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleItemDragEnd}
                >
                  <SortableContext
                    items={fields.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {fields.map((field, idx) => (
                      <SortableItemRow
                        key={field.id}
                        field={field as ItemRow & { id: string }}
                        index={idx}
                        totalRows={fields.length}
                        columns={columns}
                        control={control}
                        onRemove={() => remove(idx)}
                        onOpenPicker={() => {
                          setPickerTargetIdx(idx);
                          setPickerOpen(true);
                        }}
                        getVal={(path) => {
                          const parts = path.split(".");
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          let v: any = getValues();
                          for (const p of parts) v = v?.[p];
                          return v;
                        }}
                        setVal={(path, val) => {
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          setValue(path as any, val as any, {
                            shouldDirty: true,
                          });
                        }}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {/* Add row button */}
                <button
                  type="button"
                  onClick={() => append(createEmptyItemRow())}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 py-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                >
                  <Plus className="size-4" />
                  บันทึกรายการ
                </button>
              </div>

              {/* Item subtotal footer */}
              {fields.length > 0 && (
                <div className="flex items-center justify-end gap-4 px-5 py-3 border-t border-border/50 bg-muted/30">
                  <span className="text-xs text-muted-foreground">
                    {fields.length} รายการ
                  </span>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      รวมก่อนหักส่วนลด
                    </p>
                    <p className="text-sm font-semibold tabular-nums">
                      {fmt(totals.itemSubtotal)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Summary blocks card */}
            <div className="rounded-2xl border border-border/70 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/50">
                <h2 className="font-semibold text-sm">สรุปยอดและอื่นๆ</h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground"
                  onClick={() =>
                    setSummaryOrder([...DEFAULT_SUMMARY_BLOCK_ORDER])
                  }
                >
                  <RotateCcw className="size-3.5" />
                  ลำดับมาตรฐาน
                </Button>
              </div>

              <div className="p-4 space-y-2">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSummaryDragEnd}
                >
                  <SortableContext
                    items={summaryOrder}
                    strategy={verticalListSortingStrategy}
                  >
                    {summaryOrder.map((key) => (
                      <SortableSummaryBlock
                        key={key}
                        blockKey={key}
                        control={control}
                        watch={watch}
                        setValue={setValue}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          </div>

          {/* ── RIGHT: sticky totals ── */}
          <div className="w-72 shrink-0 sticky top-24">
            <TotalsCard
              totals={totals}
              summaryOrder={summaryOrder}
              vatEnabled={vatEnabled}
              vatRate={vatRate}
              vatIncluded={vatIncluded}
              whtEnabled={whtEnabled}
              ddEnabled={ddEnabled}
              afEnabled={afEnabled}
              afLabel={afLabel}
            />
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 border-t border-border/60 bg-white/95 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            ย้อนกลับ
          </Button>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              className="text-muted-foreground"
              onClick={() => onPreview?.(getValues())}
            >
              พรีวิว
            </Button>
            <Button type="submit" className="gap-2">
              ถัดไป
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Item picker modal */}
      <ItemPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleCatalogSelect}
        companyId={activeCompanyId}
      />
    </form>
  );
}
