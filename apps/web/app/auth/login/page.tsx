"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup, type User } from "firebase/auth";
import { useAuth, type SmartMotelRole, type SmartMotelUser } from "../../../components/auth-provider";
import { ApiError, apiFetch } from "../../../lib/api";
import { humanizeAuthError } from "../../../lib/auth-error";
import { getFirebaseAuth } from "../../../lib/firebase";

type SelectableRole = Extract<SmartMotelRole, "TENANT" | "LANDLORD">;

export default function LoginPage() {
  const router = useRouter();
  const { configured, setProfileFromServer } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SelectableRole>("TENANT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Một token refresh + một backend request là đủ để đồng bộ verification
  // và đồng thời lấy profile mới nhất.
  const syncAndHydrateProfile = async (user: User) => {
    const token = await user.getIdToken(true);
    const data = await apiFetch<{ user: SmartMotelUser }>(
      "/auth/sync-verification",
      { method: "POST" },
      token,
    );
    setProfileFromServer(data.user);
    return data.user;
  };

  const submitEmail = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!configured) throw new Error("Firebase Web chưa được cấu hình trong .env.");
      const credential = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      const profile = await syncAndHydrateProfile(credential.user);

      if (profile.email && !profile.emailVerified) {
        router.replace("/auth/verify-email");
        return;
      }

      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("Tài khoản Firebase tồn tại nhưng chưa có hồ sơ SmartMotel. Hãy đăng ký trước.");
      } else {
        setError(humanizeAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const loginGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!configured) throw new Error("Firebase Web chưa được cấu hình trong .env.");
      const credential = await signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider());
      const token = await credential.user.getIdToken(true);
      await apiFetch("/auth/bootstrap", {
        method: "POST",
        body: JSON.stringify({ fullName: credential.user.displayName || undefined, role }),
      }, token);

      const profile = await syncAndHydrateProfile(credential.user);
      if (profile.email && !profile.emailVerified) {
        router.replace("/auth/verify-email");
        return;
      }

      router.replace("/dashboard");
    } catch (err) {
      setError(humanizeAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-heading">
          <Link className="brand" href="/">SmartMotel Hub</Link>
          <p className="eyebrow">ĐĂNG NHẬP</p>
          <h1>Chào mừng quay lại</h1>
          <p className="muted">Role bên dưới chỉ dùng khi Google tạo tài khoản lần đầu; tài khoản cũ giữ nguyên role trong database.</p>
        </div>

        <div className="role-picker">
          <button type="button" className={role === "TENANT" ? "role-option active" : "role-option"} onClick={() => setRole("TENANT")}>Người tìm phòng</button>
          <button type="button" className={role === "LANDLORD" ? "role-option active" : "role-option"} onClick={() => setRole("LANDLORD")}>Chủ nhà</button>
        </div>

        <button className="button button-google" type="button" onClick={loginGoogle} disabled={loading}>Đăng nhập bằng Google</button>
        <div className="divider"><span>hoặc</span></div>

        <form className="form-stack" onSubmit={submitEmail}>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
          <label>Mật khẩu<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
          <div className="form-row-end"><Link href="/auth/forgot-password">Quên mật khẩu?</Link></div>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="button button-primary button-full" disabled={loading}>{loading ? "Đang đăng nhập…" : "Đăng nhập"}</button>
        </form>

        <Link className="button button-secondary button-full" href="/auth/phone">Đăng nhập bằng số điện thoại</Link>
        <p className="auth-footer">Chưa có tài khoản? <Link href="/auth/register">Đăng ký</Link></p>
      </section>
    </main>
  );
}
