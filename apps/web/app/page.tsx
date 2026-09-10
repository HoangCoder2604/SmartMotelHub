"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../components/auth-provider";
import { API_URL } from "../lib/api";

type Health = {
  success: boolean;
  data?: { api: string; database: string; postgisVersion: string; timestamp: string };
};

export default function Home() {
  const { loading, profile, configured } = useAuth();
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/health`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unknown error"));
  }, []);

  return (
    <main className="site-shell">
      <nav className="topbar">
        <Link href="/" className="brand">SmartMotel Hub</Link>
        <div className="nav-actions">
          {!loading && profile ? (
            <Link className="button button-primary button-small" href="/dashboard">Dashboard</Link>
          ) : (
            <>
              <Link className="button button-ghost button-small" href="/auth/login">Đăng nhập</Link>
              <Link className="button button-primary button-small" href="/auth/register">Đăng ký</Link>
            </>
          )}
        </div>
      </nav>

      <section className="hero-grid">
        <div>
          <p className="eyebrow">PHASE 2 · AUTHENTICATION</p>
          <h1>Tài khoản thật, quyền truy cập thật.</h1>
          <p className="lead">
            Firebase xử lý danh tính. NestJS xác minh token và PostgreSQL lưu hồ sơ, role và trạng thái tài khoản.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href={profile ? "/dashboard" : "/auth/register"}>
              {profile ? "Mở dashboard" : "Tạo tài khoản"}
            </Link>
            <Link className="button button-secondary" href="/auth/login">Đăng nhập</Link>
          </div>
          {!configured && (
            <div className="alert alert-warning">
              Firebase Web chưa được cấu hình. Trang health vẫn chạy, nhưng auth cần điền các biến NEXT_PUBLIC_FIREBASE_* trong .env.
            </div>
          )}
        </div>

        <div className="system-card">
          <div className="system-card-header">
            <strong>System status</strong>
            <span className="badge">localhost</span>
          </div>
          {!health && !error && <p className="muted">Đang kiểm tra backend…</p>}
          {error && <p className="bad">Chưa kết nối API: {error}</p>}
          {health?.success && health.data && (
            <div className="status-list">
              <div><span>API</span><strong className="good">{health.data.api}</strong></div>
              <div><span>Database</span><strong className="good">{health.data.database}</strong></div>
              <div><span>PostGIS</span><strong>{health.data.postgisVersion.split(" ")[0]}</strong></div>
              <div><span>Auth</span><strong>{configured ? "configured" : "waiting config"}</strong></div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
