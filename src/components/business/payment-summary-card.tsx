import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type PaymentSummaryCardProps = {
  subtotal: number;
  vat: number;
  total: number;
  className?: string;
};

function fmt(n: number) {
  return n.toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PaymentSummaryCard({
  subtotal,
  vat,
  total,
  className,
}: PaymentSummaryCardProps) {
  return (
    <Card
      className={cn(
        "rounded-2xl border-border/80 bg-white shadow-sm",
        className
      )}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">สรุปยอดเงิน</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>ยอดก่อนภาษี</span>
          <span className="font-medium text-foreground">{fmt(subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>ภาษีมูลค่าเพิ่ม</span>
          <span className="font-medium text-foreground">{fmt(vat)}</span>
        </div>
        <Separator />
        <div className="flex justify-between text-base font-semibold">
          <span>ยอดรวมสุทธิ</span>
          <span>{fmt(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
