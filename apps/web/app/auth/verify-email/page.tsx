"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { reload, sendEmailVerification, type ActionCodeSettings } from "firebase/auth";
import { useEffect, useState } from "react";
import { useAuth } from "../../../components/auth-provider";
import { apiFetch } from "../../../lib/api";
import { humanizeAuthError } from "../../../lib/auth-error";

function verificationSettings(): ActionCodeSettings {
  return {
    url: `${window.location.origin}/auth/verify-email`,
    handleCodeInApp: false,
  };
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const { loading, firebaseUser, profile, refreshProfile, logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/auth/login");
  }, [firebaseUser, loading, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const checkVerification = async () => {
    if (!firebaseUser) return;
    setChecking(true);
    setMessage(null);
    setError(null);

    try {
      await reload(firebaseUser);

      if (!firebaseUser.emailVerified) {
        setMessage("Email vẫn chưa được xác minh. Hãy mở thư xác minh trong hộp thư và bấm vào liên kết được gửi.");
        return;
      }

      const token = await firebaseUser.getIdToken(true);
      await apiFetch("/auth/sync-verification", { method: "POST" }, token);
      await refreshProfile();
      router.replace("/dashboard");
    } catch (err) {
      setError(humanizeAuthError(err));
    } finally {
      setChecking(false);
    }
  };

  const resend = async () => {
    if (!firebaseUser || !firebaseUser.email || cooldown > 0) return;
    setResending(true);
    setMessage(null);
    setError(null);

    try {
      await reload(firebaseUser);
      if (firebaseUser.emailVerified) {
        await checkVerification();
        return;
      }

      await sendEmailVerification(firebaseUser, verificationSettings());
      setCooldown(60);
      setMessage("Đã gửi lại email xác minh. Hãy kiểm tra Inbox và Spam/Junk.");
    } catch (err) {
      setError(humanizeAuthError(err));
    } finally {
      setResending(false);
    }
  };

  if (loading || !firebaseUser) {
    return <main className="center-screen"><p>Đang tải tài khoản…</p></main>;
  }

  const email = firebaseUser.email ?? profile?.email;

  if (!email) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-card-narrow">
          <Link className="brand" href="/">SmartMotel Hub</Link>
          <p className="eyebrow">XÁC MINH EMAIL</p>
          <h1>Tài khoản không dùng email</h1>
          <p className="muted">Tài khoản hiện tại không có địa chỉ email cần xác minh.</p>
          <Link className="button button-primary button-full" href="/dashboard">Về dashboard</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <section className="auth-card auth-card-narrow verification-card">
        <Link className="brand" href="/">SmartMotel Hub</Link>
        <div className="verification-icon" aria-hidden="true">✉</div>
        <p className="eyebrow">XÁC MINH EMAIL</p>
        <h1>Kiểm tra hộp thư của bạn</h1>
        <p className="muted">
          SmartMotel Hub đã gửi liên kết xác minh tới <strong className="verification-email">{email}</strong>.
          Bấm liên kết trong email, sau đó quay lại trang này.
        </p>

        <div className="alert alert-warning verification-note">
          Nếu không thấy email, hãy kiểm tra thư Spam/Junk. Liên kết cũ có thể hết hạn nếu bạn gửi lại nhiều lần.
        </div>

        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="verification-actions">
          <button className="button button-primary button-full" type="button" onClick={checkVerification} disabled={checking || resending}>
            {checking ? "Đang kiểm tra…" : "Tôi đã xác minh email"}
          </button>
          <button className="button button-secondary button-full" type="button" onClick={resend} disabled={checking || resending || cooldown > 0}>
            {resending ? "Đang gửi…" : cooldown > 0 ? `Gửi lại sau ${cooldown}s` : "Gửi lại email xác minh"}
          </button>
        </div>

        <button
          className="button button-ghost button-full"
          type="button"
          onClick={async () => {
            await logout();
            router.replace("/auth/login");
          }}
        >
          Đăng xuất / dùng tài khoản khác
        </button>
      </section>
    </main>
  );
}
