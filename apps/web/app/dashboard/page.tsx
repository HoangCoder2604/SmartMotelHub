"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../components/auth-provider";
import { apiFetch } from "../../lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const { loading, firebaseUser, profile, profileError, refreshProfile, logout } = useAuth();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [rbac, setRbac] = useState<string>("Đang kiểm tra…");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/auth/login");
  }, [firebaseUser, loading, router]);

  useEffect(() => {
    setFullName(profile?.fullName ?? "");
  }, [profile]);

  useEffect(() => {
    if (!firebaseUser || !profile) return;
    const run = async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const data = await apiFetch<{ role: string; access: string }>(`/auth/access/${profile.role.toLowerCase()}`, {}, token);
        setRbac(data.access);
      } catch (error) {
        setRbac(error instanceof Error ? error.message : "RBAC failed");
      }
    };
    void run();
  }, [firebaseUser, profile]);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    setMessage(null);
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify({ fullName }) }, token);
      await refreshProfile();
      setMessage("Đã cập nhật hồ sơ.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật hồ sơ.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !profile) return <main className="center-screen"><p>Đang tải tài khoản…</p></main>;

  if (!profile) {
    return (
      <main className="center-screen">
        <section className="info-card" style={{ maxWidth: 560 }}>
          <h1>Không thể tải tài khoản</h1>
          <p className="muted">{profileError ?? "Không tìm thấy hồ sơ SmartMotel."}</p>
          <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            <button className="button button-primary" onClick={() => void refreshProfile()}>Thử lại</button>
            <Link className="button button-secondary" href="/auth/login">Về đăng nhập</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="site-shell dashboard-shell">
      <nav className="topbar">
        <Link href="/" className="brand">SmartMotel Hub</Link>
        <div className="topbar-actions">
          <Link href="/listings" className="button button-ghost button-small">Tìm phòng</Link>
          <button className="button button-ghost button-small" onClick={async () => { await logout(); router.replace("/"); }}>Đăng xuất</button>
        </div>
      </nav>

      <header className="dashboard-header">
        <div>
          <p className="eyebrow">PHASE 8 · TRUST & SAFETY</p>
          <h1>Xin chào, {profile.fullName}</h1>
          <p className="muted">Tiếp tục quản lý thuê phòng và bổ sung Trung tâm báo cáo / xử lý khiếu nại an toàn.</p>
        </div>
        <span className={`role-badge role-${profile.role.toLowerCase()}`}>{profile.role}</span>
      </header>

      {profile.email && !profile.emailVerified && (
        <div className="alert alert-warning dashboard-verification-alert">
          <div><strong>Email chưa được xác minh.</strong> Xác minh email trước khi đặt lịch, đăng tin hoặc đánh giá.</div>
          <Link className="button button-secondary button-small" href="/auth/verify-email">Xác minh ngay</Link>
        </div>
      )}

      <section className="dashboard-action-grid">
        {profile.role === "LANDLORD" && (
          <Link href="/landlord/properties" className="dashboard-action-card">
            <span className="action-icon">⌂</span>
            <div><p className="eyebrow">LANDLORD WORKSPACE</p><h2>Quản lý nhà trọ</h2><p>Tạo property, phòng, tiện ích, tin đăng và tải ảnh.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "LANDLORD" && (
          <Link href="/landlord/appointments" className="dashboard-action-card">
            <span className="action-icon">◷</span>
            <div><p className="eyebrow">LANDLORD APPOINTMENTS</p><h2>Lịch xem của khách</h2><p>Xác nhận, từ chối và hoàn tất lịch xem phòng của TENANT.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "LANDLORD" && (
          <Link href="/landlord/contracts" className="dashboard-action-card">
            <span className="action-icon">▤</span>
            <div><p className="eyebrow">LANDLORD RENTAL</p><h2>Hợp đồng & hóa đơn</h2><p>Tạo hợp đồng từ lịch COMPLETED, quản lý tiền thuê và xác nhận thanh toán.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "TENANT" && (
          <Link href="/listings" className="dashboard-action-card">
            <span className="action-icon">⌕</span>
            <div><p className="eyebrow">TENANT DISCOVERY</p><h2>Khám phá phòng</h2><p>Tìm theo giá, diện tích, tiện ích, khoảng cách và xem chi tiết phòng.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "TENANT" && (
          <Link href="/favorites" className="dashboard-action-card">
            <span className="action-icon">♥</span>
            <div><p className="eyebrow">TENANT FAVORITES</p><h2>Phòng đã lưu</h2><p>Xem lại các phòng bạn quan tâm trước khi đặt lịch xem.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "TENANT" && (
          <Link href="/appointments" className="dashboard-action-card">
            <span className="action-icon">◷</span>
            <div><p className="eyebrow">TENANT APPOINTMENTS</p><h2>Lịch xem phòng</h2><p>Theo dõi xác nhận của chủ nhà, hủy lịch và đánh giá sau khi hoàn tất.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "TENANT" && (
          <Link href="/contracts" className="dashboard-action-card">
            <span className="action-icon">▤</span>
            <div><p className="eyebrow">TENANT CONTRACTS</p><h2>Hợp đồng thuê</h2><p>Xem hợp đồng DRAFT từ chủ nhà và chấp nhận để kích hoạt thuê phòng.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "TENANT" && (
          <Link href="/invoices" className="dashboard-action-card">
            <span className="action-icon">₫</span>
            <div><p className="eyebrow">TENANT INVOICES</p><h2>Hóa đơn</h2><p>Theo dõi tiền phòng, điện nước, hạn thanh toán và trạng thái PAID.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        <Link href="/notifications" className="dashboard-action-card">
          <span className="action-icon">●</span>
          <div><p className="eyebrow">NOTIFICATIONS</p><h2>Thông báo</h2><p>Nhận cập nhật về hợp đồng, hóa đơn, thanh toán và các thay đổi quan trọng.</p></div>
          <span className="action-arrow">→</span>
        </Link>
        {profile.role !== "ADMIN" && (
          <Link href="/complaints" className="dashboard-action-card">
            <span className="action-icon">⚑</span>
            <div><p className="eyebrow">TRUST & SAFETY</p><h2>Báo cáo & khiếu nại</h2><p>Báo cáo tin đáng ngờ và theo dõi trạng thái xử lý từ Admin.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "ADMIN" && (
          <Link href="/admin/complaints" className="dashboard-action-card">
            <span className="action-icon">⚑</span>
            <div><p className="eyebrow">ADMIN TRUST & SAFETY</p><h2>Xử lý báo cáo</h2><p>Nhận, điều tra, giải quyết hoặc bác bỏ báo cáo người dùng.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "ADMIN" && (
          <Link href="/admin" className="dashboard-action-card">
            <span className="action-icon">⚙</span>
            <div><p className="eyebrow">ADMIN CONSOLE</p><h2>Duyệt tin & quản lý user</h2><p>Xử lý PENDING → APPROVED / REJECTED và khóa/mở tài khoản.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
      </section>

      <section className="dashboard-grid">
        <article className="info-card">
          <h2>Tài khoản</h2>
          <dl className="details-list">
            <div><dt>Email</dt><dd>{profile.email ?? "—"}</dd></div>
            <div><dt>Điện thoại</dt><dd>{profile.phone ?? "—"}</dd></div>
            <div><dt>Trạng thái</dt><dd>{profile.status}</dd></div>
            <div><dt>Email verified</dt><dd>{profile.emailVerified ? "Có" : "Chưa"}</dd></div>
            <div><dt>Phone verified</dt><dd>{profile.phoneVerified ? "Có" : "Chưa"}</dd></div>
          </dl>
        </article>

        <article className="info-card">
          <h2>Backend RBAC</h2>
          <p className="muted">Backend kiểm tra Firebase token + PostgreSQL user + role trước khi cho truy cập.</p>
          <div className="rbac-result"><span>Role endpoint</span><strong>{rbac}</strong></div>
          <p className="tiny muted">Contracts, Invoices, Notifications và Complaints tiếp tục enforce ownership + RBAC ở backend.</p>
        </article>

        <article className="info-card info-card-wide">
          <h2>Hồ sơ</h2>
          <form className="inline-profile-form" onSubmit={saveProfile}>
            <label>Họ và tên<input value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={150} required /></label>
            <button className="button button-primary" disabled={saving}>{saving ? "Đang lưu…" : "Lưu thay đổi"}</button>
          </form>
          {message && <p className="form-message">{message}</p>}
        </article>
      </section>
    </main>
  );
}
