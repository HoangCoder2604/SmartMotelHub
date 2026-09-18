"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithPopup,
  updateProfile,
  type ActionCodeSettings,
  type User,
} from "firebase/auth";
import { useAuth, type SmartMotelRole } from "../../../components/auth-provider";
import { apiFetch } from "../../../lib/api";
import { humanizeAuthError } from "../../../lib/auth-error";
import { getFirebaseAuth } from "../../../lib/firebase";

type SelectableRole = Extract<SmartMotelRole, "TENANT" | "LANDLORD">;

async function bootstrap(user: User, fullName: string, role: SelectableRole) {
  const token = await user.getIdToken(true);
  return apiFetch("/auth/bootstrap", {
    method: "POST",
    body: JSON.stringify({ fullName, role }),
  }, token);
}

function verificationSettings(): ActionCodeSettings {
  return {
    url: `${window.location.origin}/auth/verify-email`,
    handleCodeInApp: false,
  };
}

export default function RegisterPage() {
  const router = useRouter();
  const { configured, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SelectableRole>("TENANT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finishGoogle = async (user: User, name: string) => {
    await bootstrap(user, name, role);
    await refreshProfile();
    router.replace("/dashboard");
  };

  const submitEmail = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    let createdUser: User | null = null;

    try {
      if (!configured) throw new Error("Dịch vụ đăng nhập chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ quản trị viên.");
      if (fullName.trim().length < 2) throw new Error("Họ tên phải có ít nhất 2 ký tự.");

      const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      createdUser = credential.user;
      await updateProfile(createdUser, { displayName: fullName.trim() });

      // Gửi mail trước khi bootstrap. Nếu một bước setup thất bại, tài khoản Firebase
      // mới tạo sẽ được rollback để tránh để lại account mồ côi trong quá trình đăng ký.
      await sendEmailVerification(createdUser, verificationSettings());
      await bootstrap(createdUser, fullName.trim(), role);
      await refreshProfile();
      router.replace("/auth/verify-email");
    } catch (err) {
      if (createdUser) await deleteUser(createdUser).catch(() => undefined);
      setError(humanizeAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const registerGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!configured) throw new Error("Dịch vụ đăng nhập chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ quản trị viên.");
      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(getFirebaseAuth(), provider);
      await finishGoogle(credential.user, credential.user.displayName || "SmartMotel User");
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
          <p className="eyebrow">TẠO TÀI KHOẢN</p>
          <h1>Bắt đầu với SmartMotel</h1>
          <p className="muted">Chọn đúng vai trò. Quyền ADMIN không thể đăng ký từ giao diện.</p>
        </div>

        <div className="role-picker" aria-label="Vai trò tài khoản">
          <button type="button" className={role === "TENANT" ? "role-option active" : "role-option"} onClick={() => setRole("TENANT")}>Người tìm phòng</button>
          <button type="button" className={role === "LANDLORD" ? "role-option active" : "role-option"} onClick={() => setRole("LANDLORD")}>Chủ nhà</button>
        </div>

        <button className="button button-google" type="button" onClick={registerGoogle} disabled={loading}>
          Tiếp tục bằng Google
        </button>

        <div className="divider"><span>hoặc dùng email</span></div>

        <form className="form-stack" onSubmit={submitEmail}>
          <label>Họ và tên<input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn Hoàng" autoComplete="name" required /></label>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@example.com" autoComplete="email" required /></label>
          <label>Mật khẩu<input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tối thiểu 6 ký tự" autoComplete="new-password" required /></label>
          <p className="tiny muted form-hint">Đăng ký bằng email sẽ gửi một liên kết xác minh tới hộp thư của bạn.</p>
          {error && <div className="alert alert-error">{error}</div>}
          <button className="button button-primary button-full" disabled={loading}>{loading ? "Đang tạo tài khoản…" : "Đăng ký"}</button>
        </form>

        <Link className="button button-secondary button-full" href="/auth/phone">Đăng ký bằng số điện thoại</Link>
        <p className="auth-footer">Đã có tài khoản? <Link href="/auth/login">Đăng nhập</Link></p>
      </section>
    </main>
  );
}
