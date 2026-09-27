"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { isBootstrapAdminEmail } from "@/config/allowed-auth";
import {
  requestAccess as submitAccessRequest,
  resolveInitialAccess,
  subscribeOwnAccess,
  type AccessRole,
  type AccessStatus,
} from "@/lib/firebase/access-management";
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { bootstrapUserCompanies } from "@/lib/firebase/bootstrap-profile";
import { useCompanyStore } from "@/stores/company-store";
import type { UserProfile } from "@/types";

export type SessionPhase =
  | "unconfigured"
  | "initializing"
  | "signed_out"
  | "checking"
  | "pending"
  | "rejected"
  | "approved";

type AuthState = {
  user: User | null;
  loading: boolean;
  profileLoading: boolean;
  profile: UserProfile | null;
  firebaseReady: boolean;
  sessionPhase: SessionPhase;
  accessStatus: AccessStatus;
  accessRole: AccessRole | null;
  accessError: string | null;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAccess: () => Promise<void>;
  requestAccess: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accessStatus, setAccessStatus] =
    useState<AccessStatus>("checking");
  const [accessRole, setAccessRole] = useState<AccessRole | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const firebaseReady = isFirebaseConfigured();
  const activeUidRef = useRef<string | null>(null);
  const accessEpochRef = useRef(0);

  const resetCompanyStore = useCompanyStore((state) => state.resetCompanyStore);

  const loadProfile = useCallback(
    async (currentUser: User) => {
      const db = getFirebaseDb();
      if (!db) return;
      const epoch = accessEpochRef.current;
      const isStillActive = () => activeUidRef.current === currentUser.uid && accessEpochRef.current === epoch;

      setProfileLoading(true);
      try {
        await bootstrapUserCompanies(currentUser);
        if (!isStillActive()) return;

        const ref = doc(db, "users", currentUser.uid);
        const snapshot = await getDoc(ref);
        if (!isStillActive()) return;
        setProfile(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
      } finally {
        if (isStillActive()) {
          setProfileLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (!firebaseReady) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      queueMicrotask(() => setLoading(false));
      return;
    }

    let disposed = false;
    let revision = 0;
    let stopAccessListener: (() => void) | undefined;
    let profileLoadedForUid: string | null = null;

    const isCurrent = (value: number) => !disposed && revision === value;

    const applyApprovedAccess = (
      currentUser: User,
      role: AccessRole,
      currentRevision: number,
    ) => {
      if (!isCurrent(currentRevision)) return;

      setAccessStatus("approved");
      setAccessRole(role);
      setAccessError(null);
      // ปลดหน้าแอปทันทีเมื่อสิทธิ์ผ่าน ไม่ผูก session กับการโหลดข้อมูลบริษัท
      setLoading(false);

      if (profileLoadedForUid === currentUser.uid) return;
      profileLoadedForUid = currentUser.uid;
      void loadProfile(currentUser).catch((error) => {
        if (!isCurrent(currentRevision)) return;
        console.error("load profile error:", error);
        setAccessError(
          error instanceof Error ? error.message : "โหลดข้อมูลผู้ใช้ไม่สำเร็จ",
        );
      });
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      const currentRevision = ++revision;
      stopAccessListener?.();
      stopAccessListener = undefined;
      profileLoadedForUid = null;

      if (!isCurrent(currentRevision)) return;
      activeUidRef.current = currentUser?.uid ?? null;
      accessEpochRef.current += 1;
      setUser(currentUser);
      setProfile(null);
      setProfileLoading(false);
      setAccessError(null);
      setAccessRole(null);
      setAccessStatus("checking");
      setLoading(true);
      resetCompanyStore();

      if (!currentUser) {
        setLoading(false);
        return;
      }

      if (
        isBootstrapAdminEmail(
          currentUser.email,
          currentUser.emailVerified,
        )
      ) {
        applyApprovedAccess(currentUser, "admin", currentRevision);
        return;
      }

      try {
        const initial = await resolveInitialAccess(currentUser);
        if (!isCurrent(currentRevision)) return;

        if (initial.status === "approved" && initial.role) {
          applyApprovedAccess(currentUser, initial.role, currentRevision);
        } else {
          setAccessStatus(initial.status);
          setAccessRole(null);
          setLoading(false);
        }

        stopAccessListener = subscribeOwnAccess(
          currentUser.uid,
          (next) => {
            if (!isCurrent(currentRevision)) return;
            if (next.status === "approved" && next.role) {
              applyApprovedAccess(currentUser, next.role, currentRevision);
              return;
            }

            profileLoadedForUid = null;
            accessEpochRef.current += 1;
            setProfileLoading(false);
            setProfile(null);
            resetCompanyStore();
            setAccessStatus(next.status);
            setAccessRole(null);
            setLoading(false);
          },
          (error) => {
            if (!isCurrent(currentRevision)) return;
            console.error("access listener error:", error);
            accessEpochRef.current += 1;
            profileLoadedForUid = null;
            setProfile(null);
            setProfileLoading(false);
            resetCompanyStore();
            setAccessStatus("pending");
            setAccessRole(null);
            setAccessError(error.message);
            setLoading(false);
          },
        );
      } catch (error) {
        if (!isCurrent(currentRevision)) return;
        console.error("resolve access error:", error);
        setAccessStatus("pending");
        setAccessError(
          error instanceof Error
            ? error.message
            : "ไม่สามารถตรวจสอบสิทธิ์เข้าใช้งานได้",
        );
        setLoading(false);
      }
    });

    return () => {
      disposed = true;
      revision += 1;
      activeUidRef.current = null;
      stopAccessListener?.();
      unsubscribeAuth();
    };
  }, [firebaseReady, loadProfile, resetCompanyStore]);

  const signInGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase Auth ยังไม่พร้อม");
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase Auth ยังไม่พร้อม");
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signOut = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    setLoading(true);
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, []);

  const refreshAccess = useCallback(async () => {
    if (!user) return;

    setAccessError(null);
    setAccessStatus("checking");
    setLoading(true);
    try {
      const next = await resolveInitialAccess(user);
      setAccessStatus(next.status);
      setAccessRole(next.role);
      if (next.status === "approved" && next.role) {
        setLoading(false);
        void loadProfile(user).catch((error) => {
          console.error("refresh profile error:", error);
          setAccessError(
            error instanceof Error
              ? error.message
              : "โหลดข้อมูลผู้ใช้ไม่สำเร็จ",
          );
        });
      }
    } catch (error) {
      setAccessError(
        error instanceof Error ? error.message : "ตรวจสอบสิทธิ์ไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, [loadProfile, user]);

  const requestAccess = useCallback(async () => {
    if (!user) return;
    setAccessError(null);
    await submitAccessRequest(user);
    setAccessStatus("pending");
    setAccessRole(null);
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (user && accessStatus === "approved") await loadProfile(user);
  }, [accessStatus, loadProfile, user]);

  const sessionPhase = useMemo<SessionPhase>(() => {
    if (!firebaseReady) return "unconfigured";
    if (loading && !user) return "initializing";
    if (!user) return "signed_out";
    if (loading || accessStatus === "checking") return "checking";
    return accessStatus;
  }, [accessStatus, firebaseReady, loading, user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      profileLoading,
      profile,
      firebaseReady,
      sessionPhase,
      accessStatus,
      accessRole,
      accessError,
      signInGoogle,
      signInEmail,
      signOut,
      refreshAccess,
      requestAccess,
      refreshProfile,
    }),
    [
      user,
      loading,
      profileLoading,
      profile,
      firebaseReady,
      sessionPhase,
      accessStatus,
      accessRole,
      accessError,
      signInGoogle,
      signInEmail,
      signOut,
      refreshAccess,
      requestAccess,
      refreshProfile,
    ],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth ต้องอยู่ภายใน AuthProvider");
  return context;
}
