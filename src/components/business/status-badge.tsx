import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const variants: Record<
  string,
  { className: string; label: string }
> = {
  draft: {
    className: "bg-slate-100 text-slate-700 border-slate-200",
    label: "ร่าง",
  },
  issued: {
    className: "bg-sky-50 text-sky-800 border-sky-200",
    label: "ออกแล้ว",
  },
  billed: {
    className: "bg-violet-50 text-violet-900 border-violet-200",
    label: "ออกบิลแล้ว",
  },
  paid: {
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    label: "ชำระแล้ว",
  },
  partial: {
    className: "bg-amber-50 text-amber-900 border-amber-200",
    label: "ชำระบางส่วน",
  },
  unpaid: {
    className: "bg-orange-50 text-orange-900 border-orange-200",
    label: "ยังไม่ชำระ",
  },
  overdue: {
    className: "bg-red-50 text-red-800 border-red-200",
    label: "เกินกำหนด",
  },
  cancelled: {
    className: "bg-zinc-100 text-zinc-600 border-zinc-200",
    label: "ยกเลิก",
  },
  active: {
    className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    label: "ใช้งาน",
  },
  inactive: {
    className: "bg-zinc-100 text-zinc-600 border-zinc-200",
    label: "ไม่ใช้งาน",
  },
};

type StatusBadgeProps = {
  status: string;
  label?: string;
  className?: string;
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const v = variants[status] ?? {
    className: "bg-muted text-foreground border-border",
    label: status,
  };
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium",
        v.className,
        className
      )}
    >
      {label ?? v.label}
    </Badge>
  );
}
