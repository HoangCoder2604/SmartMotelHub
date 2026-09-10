"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { useAuth } from "../../../components/auth-provider";
import { humanizeAuthError } from "../../../lib/auth-error";
import { getFirebaseAuth } from "../../../lib/firebase";

export default function ForgotPasswordPage() {
  const { configured } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!configured) throw new Error("Firebase Web chưa được cấu hình trong .env.");
      await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
      setMessage("Nếu email tồn tại, Firebase đã gửi hướng dẫn đặt lại mật khẩu.");
    } catch (err) {
      setError(humanizeAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card auth-card-narrow">
        <Link className="brand" href="/">SmartMotel Hub</Link>
        <p className="eyebrow">KHÔI PHỤC TÀI KHOẢN</p>
        <h1>Quên mật khẩu?</h1>
        <p className="muted">Nhập email dùng để đăng ký SmartMotel Hub.</p>
        <form className="form-stack" onSubmit={submit}>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          {message && <div className="alert alert-success">{message}</div>}
          {error && <div className="alert alert-error">{error}</div>}
          <button className="button button-primary button-full" disabled={loading}>{loading ? "Đang gửi…" : "Gửi email đặt lại mật khẩu"}</button>
        </form>
        <p className="auth-footer"><Link href="/auth/login">← Quay lại đăng nhập</Link></p>
      </section>
    </main>
  );
}
