import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type SummaryStatCardProps = {
  title: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
};

export function SummaryStatCard({
  title,
  value,
  hint,
  icon: Icon,
  className,
}: SummaryStatCardProps) {
  return (
    <Card
      className={cn(
        "rounded-2xl border-border/80 bg-white shadow-sm",
        className
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {Icon ? (
          <span className="rounded-lg bg-muted/80 p-2 text-muted-foreground">
            <Icon className="size-4" />
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? (
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
