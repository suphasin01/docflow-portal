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
import { getFirebaseAuth, getFirebaseDb } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { bootstrapUserCompanies } from "@/lib/firebase/bootstrap-profile";
import { doc, getDoc } from "firebase/firestore";
import { useCompanyStore } from "@/stores/company-store";
import type { UserProfile } from "@/types";

type AuthState = {
  user: User | null;
  loading: boolean;
  profile: UserProfile | null;
  firebaseReady: boolean;
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
  const firebaseReady = isFirebaseConfigured();

  const { setCompanies, setCompaniesLoading, resetCompanyStore } =
    useCompanyStore();

  const loadProfile = useCallback(
    async (u: User) => {
      const db = getFirebaseDb();
      if (!db) return;

      // 1. bootstrap companies (สร้างบริษัทเริ่มต้นถ้ายังไม่มี)
      setCompaniesLoading(true);
      try {
        const companies = await bootstrapUserCompanies(u);
        setCompanies(companies);
      } catch (e) {
        console.error("bootstrap companies error:", e);
        setCompaniesLoading(false);
      }

      // 2. โหลด user profile
      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
      }
    },
    [setCompanies, setCompaniesLoading]
  );

  useEffect(() => {
    if (!firebaseReady) {
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          await loadProfile(u);
        } catch (e) {
          console.error(e);
          setProfile(null);
        }
      } else {
        setProfile(null);
        resetCompanyStore();
      }
      setLoading(false);
    });
    return () => unsub();
  }, [firebaseReady, loadProfile, resetCompanyStore]);

  const signInGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase Auth ยังไม่พร้อม");
    const provider = new GoogleAuthProvider();
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
    if (user) await loadProfile(user);
  }, [loadProfile, user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      profile,
      firebaseReady,
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
      signInGoogle,
      signInEmail,
      signOut,
      refreshProfile,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth ต้องอยู่ภายใน AuthProvider");
  return ctx;
}
