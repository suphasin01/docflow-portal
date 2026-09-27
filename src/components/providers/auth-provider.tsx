"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

type AuthState = {
  user: User | null;
  loading: boolean;
  profile: UserProfile | null;
  firebaseReady: boolean;
  accessStatus: AccessStatus;
  accessRole: AccessRole | null;
  accessError: string | null;
  signInGoogle: () => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accessStatus, setAccessStatus] =
    useState<AccessStatus>("checking");
  const [accessRole, setAccessRole] = useState<AccessRole | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const firebaseReady = isFirebaseConfigured();

  const { setCompanies, setCompaniesLoading, resetCompanyStore } =
    useCompanyStore();

  const loadProfile = useCallback(
    async (currentUser: User) => {
      const db = getFirebaseDb();
      if (!db) return;

      setCompaniesLoading(true);
      try {
        const companies = await bootstrapUserCompanies(currentUser);
        setCompanies(companies);
      } catch (error) {
        console.error("bootstrap companies error:", error);
        setCompaniesLoading(false);
        throw error;
      }

      const ref = doc(db, "users", currentUser.uid);
      const snapshot = await getDoc(ref);
      setProfile(snapshot.exists() ? (snapshot.data() as UserProfile) : null);
    },
    [setCompanies, setCompaniesLoading],
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
    let stopAccessListener: (() => void) | undefined;
    let profileLoadedForUid: string | null = null;

    async function applyApprovedAccess(
      currentUser: User,
      role: AccessRole,
    ) {
      if (disposed) return;
      setAccessStatus("approved");
      setAccessRole(role);
      setAccessError(null);

      if (profileLoadedForUid !== currentUser.uid) {
        profileLoadedForUid = currentUser.uid;
        try {
          await loadProfile(currentUser);
        } catch (error) {
          if (disposed) return;
          setAccessError(
            error instanceof Error ? error.message : "โหลดข้อมูลผู้ใช้ไม่สำเร็จ",
          );
        }
      }
      if (!disposed) setLoading(false);
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      stopAccessListener?.();
      stopAccessListener = undefined;
      profileLoadedForUid = null;

      if (disposed) return;
      setUser(currentUser);
      setProfile(null);
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
        await applyApprovedAccess(currentUser, "admin");
        return;
      }

      try {
        const initial = await resolveInitialAccess(currentUser);
        if (disposed) return;

        if (initial.status === "approved" && initial.role) {
          await applyApprovedAccess(currentUser, initial.role);
        } else {
          setAccessStatus(initial.status);
          setAccessRole(null);
          setLoading(false);
        }

        stopAccessListener = subscribeOwnAccess(
          currentUser.uid,
          (next) => {
            if (disposed) return;
            if (next.status === "approved" && next.role) {
              void applyApprovedAccess(currentUser, next.role);
              return;
            }

            profileLoadedForUid = null;
            setProfile(null);
            resetCompanyStore();
            setAccessStatus(next.status);
            setAccessRole(null);
            setLoading(false);
          },
          (error) => {
            if (disposed) return;
            console.error("access listener error:", error);
            setAccessError(error.message);
            setLoading(false);
          },
        );
      } catch (error) {
        if (disposed) return;
        console.error("resolve access error:", error);
        setAccessStatus("pending");
        setAccessError(
          error instanceof Error
            ? error.message
            : "ไม่สามารถส่งคำขอเข้าใช้งานได้",
        );
        setLoading(false);
      }
    });

    return () => {
      disposed = true;
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
    await firebaseSignOut(auth);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user && accessStatus === "approved") await loadProfile(user);
  }, [accessStatus, loadProfile, user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      profile,
      firebaseReady,
      accessStatus,
      accessRole,
      accessError,
      signInGoogle,
      signInEmail,
      signOut,
      refreshProfile,
    }),
    [
      user,
      loading,
      profile,
      firebaseReady,
      accessStatus,
      accessRole,
      accessError,
      signInGoogle,
      signInEmail,
      signOut,
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
