"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { useAuth, type SmartMotelRole } from "../../../components/auth-provider";
import { apiFetch } from "../../../lib/api";
import { humanizeAuthError } from "../../../lib/auth-error";
import { getFirebaseAuth } from "../../../lib/firebase";

type SelectableRole = Extract<SmartMotelRole, "TENANT" | "LANDLORD">;

export default function PhoneAuthPage() {
  const router = useRouter();
  const { configured, refreshProfile } = useAuth();
  const [phone, setPhone] = useState("+84");
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<SelectableRole>("TENANT");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => () => verifierRef.current?.clear(), []);

  const getVerifier = () => {
    if (!verifierRef.current) {
      verifierRef.current = new RecaptchaVerifier(getFirebaseAuth(), "recaptcha-container", {
        size: "normal",
      });
    }
    return verifierRef.current;
  };

  const sendCode = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!configured) throw new Error("Dịch vụ đăng nhập chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ quản trị viên.");
      const result = await signInWithPhoneNumber(getFirebaseAuth(), phone.trim(), getVerifier());
      setConfirmation(result);
    } catch (err) {
      verifierRef.current?.clear();
      verifierRef.current = null;
      setError(humanizeAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const confirmCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!confirmation) return;
    setLoading(true);
    setError(null);
    try {
      const credential = await confirmation.confirm(code.trim());
      const token = await credential.user.getIdToken(true);
      await apiFetch("/auth/bootstrap", {
        method: "POST",
        body: JSON.stringify({ fullName: fullName.trim() || undefined, role }),
      }, token);
      await refreshProfile();
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
          <p className="eyebrow">PHONE OTP</p>
          <h1>Xác thực số điện thoại</h1>
          <p className="muted">Dùng định dạng quốc tế, ví dụ +84901234567.</p>
        </div>

        {!confirmation ? (
          <form className="form-stack" onSubmit={sendCode}>
            <label>Họ và tên (cho tài khoản mới)<input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn Hoàng" /></label>
            <div className="role-picker">
              <button type="button" className={role === "TENANT" ? "role-option active" : "role-option"} onClick={() => setRole("TENANT")}>Người tìm phòng</button>
              <button type="button" className={role === "LANDLORD" ? "role-option active" : "role-option"} onClick={() => setRole("LANDLORD")}>Chủ nhà</button>
            </div>
            <label>Số điện thoại<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required /></label>
            <div id="recaptcha-container" />
            {error && <div className="alert alert-error">{error}</div>}
            <button className="button button-primary button-full" disabled={loading}>{loading ? "Đang gửi OTP…" : "Gửi mã OTP"}</button>
          </form>
        ) : (
          <form className="form-stack" onSubmit={confirmCode}>
            <div className="alert alert-success">OTP đã được gửi tới {phone}.</div>
            <label>Mã OTP<input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} required /></label>
            {error && <div className="alert alert-error">{error}</div>}
            <button className="button button-primary button-full" disabled={loading}>{loading ? "Đang xác minh…" : "Xác nhận OTP"}</button>
            <button className="button button-ghost button-full" type="button" onClick={() => setConfirmation(null)}>Đổi số điện thoại</button>
          </form>
        )}

        <p className="auth-footer"><Link href="/auth/login">← Quay lại đăng nhập</Link></p>
      </section>
    </main>
  );
}
