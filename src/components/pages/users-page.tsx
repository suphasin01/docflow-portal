"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock3,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/layout/app-header";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BOOTSTRAP_ADMIN_EMAILS } from "@/config/allowed-auth";
import {
  approveAccessRequest,
  rejectAccessRequest,
  revokeMember,
  subscribeAccessMembers,
  subscribeAccessRequests,
  type AccessControlRecord,
  type AccessRequestRecord,
} from "@/lib/firebase/access-management";

function initials(name: string, email: string) {
  return (name.trim() || email.trim() || "U").slice(0, 1).toUpperCase();
}

function dateLabel(value: unknown) {
  if (!value || typeof value !== "object") return "เมื่อสักครู่";
  const candidate = value as { toDate?: () => Date; seconds?: number };
  const date =
    typeof candidate.toDate === "function"
      ? candidate.toDate()
      : typeof candidate.seconds === "number"
        ? new Date(candidate.seconds * 1000)
        : null;
  if (!date || Number.isNaN(date.getTime())) return "เมื่อสักครู่";
  return date.toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function UserAvatar({
  name,
  email,
  photoURL,
}: {
  name: string;
  email: string;
  photoURL: string;
}) {
  return (
    <Avatar className="size-11">
      <AvatarImage src={photoURL || undefined} alt="" />
      <AvatarFallback className="bg-surface-secondary font-semibold text-muted-foreground">
        {initials(name, email)}
      </AvatarFallback>
    </Avatar>
  );
}

export function UsersPage() {
  const { user, accessRole } = useAuth();
  const [requests, setRequests] = useState<AccessRequestRecord[]>([]);
  const [members, setMembers] = useState<AccessControlRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);

  useEffect(() => {
    if (accessRole !== "admin") return;

    const onError = (error: Error) => {
      console.error(error);
      toast.error("โหลดข้อมูลสิทธิ์ผู้ใช้ไม่สำเร็จ");
      setLoading(false);
    };
    const stopRequests = subscribeAccessRequests((rows) => {
      setRequests(rows);
      setLoading(false);
    }, onError);
    const stopMembers = subscribeAccessMembers(setMembers, onError);
    return () => {
      stopRequests();
      stopMembers();
    };
  }, [accessRole]);

  const pending = useMemo(
    () => requests.filter((request) => request.status === "pending"),
    [requests],
  );
  const rejected = useMemo(
    () => requests.filter((request) => request.status === "rejected"),
    [requests],
  );
  const approved = useMemo(
    () => members.filter((member) => member.status === "approved"),
    [members],
  );

  async function approve(request: AccessRequestRecord) {
    if (!user) return;
    setBusyUid(request.uid);
    try {
      await approveAccessRequest(request, user);
      toast.success(`อนุมัติ ${request.email} แล้ว`);
    } catch (error) {
      console.error(error);
      toast.error("อนุมัติผู้ใช้ไม่สำเร็จ");
    } finally {
      setBusyUid(null);
    }
  }

  async function reject(request: AccessRequestRecord) {
    if (!user) return;
    setBusyUid(request.uid);
    try {
      await rejectAccessRequest(request, user);
      toast.success(`ปฏิเสธคำขอของ ${request.email} แล้ว`);
    } catch (error) {
      console.error(error);
      toast.error("ปฏิเสธคำขอไม่สำเร็จ");
    } finally {
      setBusyUid(null);
    }
  }

  async function revoke(member: AccessControlRecord) {
    if (!user) return;
    if (!window.confirm(`ยกเลิกสิทธิ์ของ ${member.email} ใช่หรือไม่?`)) return;
    setBusyUid(member.uid);
    try {
      await revokeMember(member, user);
      toast.success(`ยกเลิกสิทธิ์ของ ${member.email} แล้ว`);
    } catch (error) {
      console.error(error);
      toast.error("ยกเลิกสิทธิ์ไม่สำเร็จ");
    } finally {
      setBusyUid(null);
    }
  }

  if (accessRole !== "admin") {
    return (
      <div className="min-h-[calc(100dvh-4rem)]">
        <AppHeader title="จัดการผู้ใช้" showTrialBanner={false} />
        <div className="p-6">
          <Card className="mx-auto max-w-xl rounded-2xl bg-surface">
            <CardContent className="flex flex-col items-center px-8 py-12 text-center">
              <ShieldCheck className="size-10 text-muted" />
              <h2 className="mt-4 text-lg font-semibold">เฉพาะผู้ดูแลระบบ</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                บัญชีนี้ไม่มีสิทธิ์จัดการสมาชิก
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-4rem)]">
      <AppHeader
        title="จัดการผู้ใช้"
        subtitle="ตรวจสอบคำขอและควบคุมสิทธิ์เข้าใช้งาน Beyond Doc"
        showTrialBanner={false}
      />

      <div className="space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-2xl border-0 bg-surface shadow-sm ring-1 ring-slate-200/80">
            <CardContent className="flex items-center gap-4 px-5 py-5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                <Clock3 className="size-5" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-foreground">{pending.length}</div>
                <div className="text-xs text-muted-foreground">คำขอรออนุมัติ</div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 bg-surface shadow-sm ring-1 ring-slate-200/80">
            <CardContent className="flex items-center gap-4 px-5 py-5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <UsersRound className="size-5" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-foreground">
                  {approved.length + BOOTSTRAP_ADMIN_EMAILS.length}
                </div>
                <div className="text-xs text-muted-foreground">ผู้ใช้ที่มีสิทธิ์</div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-0 bg-surface shadow-sm ring-1 ring-slate-200/80">
            <CardContent className="flex items-center gap-4 px-5 py-5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <div className="text-2xl font-semibold text-foreground">
                  {BOOTSTRAP_ADMIN_EMAILS.length}
                </div>
                <div className="text-xs text-muted-foreground">ผู้ดูแลระบบ</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl border-0 bg-surface py-0 shadow-sm ring-1 ring-slate-200/80">
          <div className="flex items-center justify-between border-b border-separator px-6 py-5">
            <div>
              <h2 className="font-semibold text-foreground">คำขอเข้าใช้งาน</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                ผู้ใช้จะเข้าสู่ระบบได้ทันทีหลังได้รับอนุมัติ
              </p>
            </div>
            {pending.length > 0 ? (
              <Badge className="bg-amber-100 text-amber-700">{pending.length} รายการใหม่</Badge>
            ) : null}
          </div>
          <CardContent className="px-0">
            {loading ? (
              <div className="space-y-3 p-6">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            ) : pending.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <UserRoundCheck className="size-10 text-emerald-500" />
                <div className="mt-3 font-medium text-foreground">ไม่มีคำขอค้างอยู่</div>
                <div className="mt-1 text-xs text-muted-foreground">คำขอใหม่จะแสดงที่นี่อัตโนมัติ</div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pending.map((request) => (
                  <div key={request.uid} className="flex flex-wrap items-center gap-4 px-6 py-4">
                    <UserAvatar
                      name={request.displayName}
                      email={request.email}
                      photoURL={request.photoURL}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">
                        {request.displayName || "Google user"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{request.email}</div>
                      <div className="mt-1 text-[11px] text-muted">
                        ขอสิทธิ์เมื่อ {dateLabel(request.requestedAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg text-muted-foreground"
                        disabled={busyUid === request.uid}
                        onClick={() => void reject(request)}
                      >
                        <X className="size-4" /> ปฏิเสธ
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-lg bg-emerald-600 hover:bg-emerald-700"
                        disabled={busyUid === request.uid}
                        onClick={() => void approve(request)}
                      >
                        <Check className="size-4" /> อนุมัติ
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-0 bg-surface py-0 shadow-sm ring-1 ring-slate-200/80">
          <div className="border-b border-separator px-6 py-5">
            <h2 className="font-semibold text-foreground">ผู้ใช้ที่มีสิทธิ์</h2>
            <p className="mt-1 text-xs text-muted-foreground">บัญชีที่สามารถเข้าถึง workspace ได้</p>
          </div>
          <CardContent className="px-0">
            <div className="divide-y divide-slate-100">
              {BOOTSTRAP_ADMIN_EMAILS.map((email) => (
                <div key={email} className="flex items-center gap-4 px-6 py-4">
                  <UserAvatar name="Admin" email={email} photoURL="" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{email}</div>
                    <div className="text-xs text-muted-foreground">Bootstrap administrator</div>
                  </div>
                  <Badge className="bg-blue-50 text-blue-700">ผู้ดูแล</Badge>
                </div>
              ))}
              {approved.map((member) => (
                <div key={member.uid} className="flex flex-wrap items-center gap-4 px-6 py-4">
                  <UserAvatar
                    name={member.displayName}
                    email={member.email}
                    photoURL={member.photoURL}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">
                      {member.displayName || "Google user"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{member.email}</div>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-700">ใช้งานอยู่</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={busyUid === member.uid}
                    onClick={() => void revoke(member)}
                  >
                    <UserRoundX className="size-4" /> ยกเลิกสิทธิ์
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {rejected.length > 0 ? (
          <Card className="rounded-2xl border-0 bg-surface py-0 shadow-sm ring-1 ring-slate-200/80">
            <div className="border-b border-separator px-6 py-5">
              <h2 className="font-semibold text-foreground">คำขอที่ปฏิเสธ</h2>
            </div>
            <CardContent className="divide-y divide-slate-100 px-0">
              {rejected.map((request) => (
                <div key={request.uid} className="flex flex-wrap items-center gap-4 px-6 py-4">
                  <UserAvatar
                    name={request.displayName}
                    email={request.email}
                    photoURL={request.photoURL}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{request.email}</div>
                    <div className="text-xs text-muted-foreground">ปฏิเสธเมื่อ {dateLabel(request.rejectedAt)}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={busyUid === request.uid}
                    onClick={() => void approve(request)}
                  >
                    อนุมัติภายหลัง
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
