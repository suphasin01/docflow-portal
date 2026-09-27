"use client";

import type { User } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseDb } from "./client";

export type AccessStatus = "checking" | "approved" | "pending" | "rejected";
export type AccessRole = "admin" | "user";

export type AccessControlRecord = {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  status: Exclude<AccessStatus, "checking" | "pending">;
  role: AccessRole;
  approvedAt?: unknown;
  approvedBy?: string;
  updatedAt?: unknown;
};

export type AccessRequestRecord = {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  status: Exclude<AccessStatus, "checking">;
  requestedAt?: unknown;
  updatedAt?: unknown;
  approvedAt?: unknown;
  approvedBy?: string;
  rejectedAt?: unknown;
  rejectedBy?: string;
};

function userIdentity(user: User) {
  return {
    uid: user.uid,
    email: user.email?.trim().toLowerCase() ?? "",
    displayName: user.displayName?.trim() ?? "",
    photoURL: user.photoURL ?? "",
  };
}

function asAccessStatus(value: unknown): AccessStatus {
  if (value === "approved" || value === "rejected" || value === "pending") {
    return value;
  }
  return "pending";
}

export async function resolveInitialAccess(user: User): Promise<{
  status: AccessStatus;
  role: AccessRole | null;
}> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const controlRef = doc(db, "accessControl", user.uid);
  const requestRef = doc(db, "accessRequests", user.uid);
  const [controlSnap, requestSnap] = await Promise.all([
    getDoc(controlRef),
    getDoc(requestRef),
  ]);

  if (controlSnap.exists() && controlSnap.data().status === "approved") {
    const data = controlSnap.data();
    return {
      status: "approved",
      role: data.role === "admin" ? "admin" : "user",
    };
  }

  if (requestSnap.exists() && requestSnap.data().status === "pending") {
    return { status: "pending", role: null };
  }

  if (
    (requestSnap.exists() && requestSnap.data().status === "rejected") ||
    (controlSnap.exists() && controlSnap.data().status === "rejected")
  ) {
    return { status: "rejected", role: null };
  }

  await requestAccess(user, false);

  return { status: "pending", role: null };
}

export async function requestAccess(user: User, restart = true) {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const requestRef = doc(db, "accessRequests", user.uid);
  const requestSnap = await getDoc(requestRef);
  await setDoc(
    requestRef,
    {
      ...userIdentity(user),
      status: "pending",
      requestedAt:
        restart || !requestSnap.exists()
          ? serverTimestamp()
          : (requestSnap.data().requestedAt ?? serverTimestamp()),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribeOwnAccess(
  uid: string,
  callback: (value: { status: AccessStatus; role: AccessRole | null }) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  let controlLoaded = false;
  let requestLoaded = false;
  let control: DocumentData | null = null;
  let request: DocumentData | null = null;
  let reportedError = false;

  const reportError = (error: Error) => {
    if (reportedError) return;
    reportedError = true;
    onError(error);
  };

  const emit = () => {
    if (!controlLoaded || !requestLoaded) return;

    if (control?.status === "approved") {
      callback({
        status: "approved",
        role: control.role === "admin" ? "admin" : "user",
      });
      return;
    }

    if (request?.status === "pending") {
      callback({ status: "pending", role: null });
      return;
    }

    if (request?.status === "rejected" || control?.status === "rejected") {
      callback({ status: "rejected", role: null });
      return;
    }

    callback({ status: "pending", role: null });
  };

  const stopControl = onSnapshot(
    doc(db, "accessControl", uid),
    (snapshot) => {
      controlLoaded = true;
      control = snapshot.exists() ? snapshot.data() : null;
      emit();
    },
    reportError,
  );
  const stopRequest = onSnapshot(
    doc(db, "accessRequests", uid),
    (snapshot) => {
      requestLoaded = true;
      request = snapshot.exists() ? snapshot.data() : null;
      emit();
    },
    reportError,
  );

  return () => {
    stopControl();
    stopRequest();
  };
}

function mapRequest(id: string, data: DocumentData): AccessRequestRecord {
  return {
    id,
    uid: typeof data.uid === "string" ? data.uid : id,
    email: typeof data.email === "string" ? data.email : "",
    displayName: typeof data.displayName === "string" ? data.displayName : "",
    photoURL: typeof data.photoURL === "string" ? data.photoURL : "",
    status: asAccessStatus(data.status) as AccessRequestRecord["status"],
    requestedAt: data.requestedAt,
    updatedAt: data.updatedAt,
    approvedAt: data.approvedAt,
    approvedBy: data.approvedBy,
    rejectedAt: data.rejectedAt,
    rejectedBy: data.rejectedBy,
  };
}

function mapMember(id: string, data: DocumentData): AccessControlRecord {
  return {
    id,
    uid: typeof data.uid === "string" ? data.uid : id,
    email: typeof data.email === "string" ? data.email : "",
    displayName: typeof data.displayName === "string" ? data.displayName : "",
    photoURL: typeof data.photoURL === "string" ? data.photoURL : "",
    status: data.status === "approved" ? "approved" : "rejected",
    role: data.role === "admin" ? "admin" : "user",
    approvedAt: data.approvedAt,
    approvedBy: data.approvedBy,
    updatedAt: data.updatedAt,
  };
}

export function subscribeAccessRequests(
  callback: (rows: AccessRequestRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  return onSnapshot(
    query(collection(db, "accessRequests"), orderBy("requestedAt", "desc")),
    (snapshot) =>
      callback(snapshot.docs.map((row) => mapRequest(row.id, row.data()))),
    (error) => onError(error),
  );
}

export function subscribeAccessMembers(
  callback: (rows: AccessControlRecord[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  return onSnapshot(
    collection(db, "accessControl"),
    (snapshot) =>
      callback(snapshot.docs.map((row) => mapMember(row.id, row.data()))),
    (error) => onError(error),
  );
}

export async function approveAccessRequest(
  request: AccessRequestRecord,
  admin: User,
) {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const batch = writeBatch(db);
  batch.set(
    doc(db, "accessControl", request.uid),
    {
      uid: request.uid,
      email: request.email,
      displayName: request.displayName,
      photoURL: request.photoURL,
      status: "approved",
      role: "user",
      approvedAt: serverTimestamp(),
      approvedBy: admin.uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(
    doc(db, "accessRequests", request.uid),
    {
      status: "approved",
      approvedAt: serverTimestamp(),
      approvedBy: admin.uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();
}

export async function rejectAccessRequest(
  request: Pick<AccessRequestRecord, "uid" | "email" | "displayName" | "photoURL">,
  admin: User,
) {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore ยังไม่พร้อม");

  const batch = writeBatch(db);
  batch.set(
    doc(db, "accessControl", request.uid),
    {
      uid: request.uid,
      email: request.email,
      displayName: request.displayName,
      photoURL: request.photoURL,
      status: "rejected",
      role: "user",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  batch.set(
    doc(db, "accessRequests", request.uid),
    {
      status: "rejected",
      rejectedAt: serverTimestamp(),
      rejectedBy: admin.uid,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  await batch.commit();
}

export async function revokeMember(member: AccessControlRecord, admin: User) {
  await rejectAccessRequest(member, admin);
}
