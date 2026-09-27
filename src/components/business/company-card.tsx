"use client";

import { Building2, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type CompanyCardProps = {
  name: string;
  taxId?: string;
  branch?: string;
  logoUrl?: string;
  onEdit?: () => void;
  onArchive?: () => void;
  className?: string;
};

export function CompanyCard({
  name,
  taxId,
  branch,
  logoUrl,
  onEdit,
  onArchive,
  className,
}: CompanyCardProps) {
  return (
    <Card
      className={cn(
        "glass-surface max-w-xl rounded-2xl border-border/80",
        className
      )}
    >
      <CardContent className="flex items-start gap-4 p-6">
        <Avatar className="size-14 rounded-2xl border border-border/60">
          {logoUrl ? <AvatarImage src={logoUrl} alt={name} /> : null}
          <AvatarFallback className="rounded-2xl bg-surface-secondary text-muted-foreground">
            <Building2 className="size-7" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-tight">{name}</p>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            {taxId ? <p>เลขประจำตัวผู้เสียภาษี: {taxId}</p> : null}
            {branch ? <p>สาขา: {branch}</p> : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="rounded-xl"
              onClick={onEdit}
            >
              <Pencil className="mr-2 size-4" />
              แก้ไข
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/5"
              onClick={onArchive}
            >
              <Trash2 className="mr-2 size-4" />
              เก็บถาวร
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
