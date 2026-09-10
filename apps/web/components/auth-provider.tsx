"use client";

import { onAuthStateChanged, signOut, type User as FirebaseUser } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "../lib/api";
import { firebaseConfigured, getFirebaseAuth } from "../lib/firebase";

export type SmartMotelRole = "TENANT" | "LANDLORD" | "ADMIN";
export type SmartMotelUser = {
  id: string;
  firebaseUid: string | null;
  email: string | null;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  role: SmartMotelRole;
  status: "ACTIVE" | "SUSPENDED" | "BANNED";
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  firebaseUser: FirebaseUser | null;
  profile: SmartMotelUser | null;
  profileError: string | null;
  setProfileFromServer: (profile: SmartMotelUser) => void;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<SmartMotelUser | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  const setProfileFromServer = useCallback((nextProfile: SmartMotelUser) => {
    setProfile(nextProfile);
    setProfileError(null);
  }, []);

  const loadProfile = useCallback(async (user: FirebaseUser | null) => {
    if (!user) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    try {
      const token = await user.getIdToken();
      const data = await apiFetch<{ user: SmartMotelUser }>("/auth/me", {}, token);
      setProfile(data.user);
      setProfileError(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setProfile(null);
        setProfileError("Không tìm thấy hồ sơ SmartMotel cho tài khoản này.");
        return;
      }
      setProfile(null);
      setProfileError(error instanceof Error ? error.message : "Không thể tải hồ sơ tài khoản.");
    }
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) {
      setLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setProfileError(null);
        setLoading(false);
        return;
      }

      // Chỉ dùng loading toàn cục khi chưa có profile. Nếu login vừa hydrate
      // profile từ response backend thì dashboard có thể render ngay.
      if (!profile) setLoading(true);
      await loadProfile(user);
      setLoading(false);
    });

    return unsubscribe;
    // Không đưa profile vào dependency để tránh subscribe Firebase lại liên tục.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadProfile]);

  const refreshProfile = useCallback(async () => {
    await loadProfile(firebaseUser);
  }, [firebaseUser, loadProfile]);

  const logout = useCallback(async () => {
    if (!firebaseConfigured) return;
    await signOut(getFirebaseAuth());
    setProfile(null);
    setProfileError(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: firebaseConfigured,
      loading,
      firebaseUser,
      profile,
      profileError,
      setProfileFromServer,
      refreshProfile,
      logout,
    }),
    [firebaseUser, loading, logout, profile, profileError, refreshProfile, setProfileFromServer],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
