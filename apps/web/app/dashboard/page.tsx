"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../components/auth-provider";
import { apiFetch } from "../../lib/api";
import { statusLabel, roleLabel } from "../../lib/ui-labels";

export default function DashboardPage() {
  const router = useRouter();
  const { loading, firebaseUser, profile, profileError, refreshProfile, logout } = useAuth();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/auth/login");
  }, [firebaseUser, loading, router]);

  useEffect(() => {
    setFullName(profile?.fullName ?? "");
  }, [profile]);

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
          <p className="eyebrow">TỔNG QUAN TÀI KHOẢN</p>
          <h1>Xin chào, {profile.fullName}</h1>
          <p className="muted">Mọi công việc quan trọng của bạn được sắp xếp gọn gàng tại đây.</p>
        </div>
        <span className={`role-badge role-${profile.role.toLowerCase()}`}>{roleLabel(profile.role)}</span>
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
            <div><p className="eyebrow">KHÔNG GIAN CHỦ NHÀ</p><h2>Quản lý nhà trọ</h2><p>Quản lý nhà trọ, phòng, tiện ích, hình ảnh và tin đăng.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "LANDLORD" && (
          <Link href="/landlord/appointments" className="dashboard-action-card">
            <span className="action-icon">◷</span>
            <div><p className="eyebrow">LỊCH HẸN</p><h2>Lịch xem của khách</h2><p>Xác nhận, sắp xếp và hoàn tất lịch xem phòng của khách thuê.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "LANDLORD" && (
          <Link href="/landlord/contracts" className="dashboard-action-card">
            <span className="action-icon">▤</span>
            <div><p className="eyebrow">QUẢN LÝ CHO THUÊ</p><h2>Hợp đồng & hóa đơn</h2><p>Quản lý hợp đồng, tiền thuê và hóa đơn theo từng khách thuê.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "LANDLORD" && (
          <Link href="/landlord/payments" className="dashboard-action-card">
            <span className="action-icon">₫</span>
            <div><p className="eyebrow">TÀI CHÍNH</p><h2>Ví & rút tiền</h2><p>Theo dõi số dư, tài khoản ngân hàng và các yêu cầu rút tiền.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "TENANT" && (
          <Link href="/listings" className="dashboard-action-card">
            <span className="action-icon">⌕</span>
            <div><p className="eyebrow">KHÁM PHÁ</p><h2>Khám phá phòng</h2><p>Tìm theo giá, diện tích, tiện ích và khu vực phù hợp với bạn.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "TENANT" && (
          <Link href="/favorites" className="dashboard-action-card">
            <span className="action-icon">♥</span>
            <div><p className="eyebrow">ĐÃ LƯU</p><h2>Phòng đã lưu</h2><p>Xem lại các phòng bạn quan tâm trước khi đặt lịch xem.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "TENANT" && (
          <Link href="/appointments" className="dashboard-action-card">
            <span className="action-icon">◷</span>
            <div><p className="eyebrow">LỊCH HẸN</p><h2>Lịch xem phòng</h2><p>Theo dõi lịch xem, thay đổi kế hoạch và đánh giá sau khi hoàn tất.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "TENANT" && (
          <Link href="/contracts" className="dashboard-action-card">
            <span className="action-icon">▤</span>
            <div><p className="eyebrow">HỢP ĐỒNG</p><h2>Hợp đồng thuê</h2><p>Kiểm tra thông tin hợp đồng, thời hạn thuê và yêu cầu gia hạn khi cần.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "TENANT" && (
          <Link href="/invoices" className="dashboard-action-card">
            <span className="action-icon">₫</span>
            <div><p className="eyebrow">HÓA ĐƠN</p><h2>Hóa đơn</h2><p>Theo dõi tiền phòng, điện nước, hạn thanh toán và tình trạng hóa đơn.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "TENANT" && (
          <Link href="/payments" className="dashboard-action-card">
            <span className="action-icon">◎</span>
            <div><p className="eyebrow">THANH TOÁN</p><h2>Thanh toán trực tuyến</h2><p>Thanh toán hóa đơn trực tuyến và xem lại lịch sử giao dịch của bạn.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        <Link href="/analytics" className="dashboard-action-card">
          <span className="action-icon">▥</span>
          <div><p className="eyebrow">THỐNG KÊ</p><h2>Phân tích & báo cáo</h2><p>Xem chỉ số vận hành, hóa đơn, hợp đồng và xu hướng theo vai trò của bạn.</p></div>
          <span className="action-arrow">→</span>
        </Link>
        <Link href="/notifications" className="dashboard-action-card">
          <span className="action-icon">●</span>
          <div><p className="eyebrow">NOTIFICATIONS</p><h2>Thông báo</h2><p>Nhận cập nhật về hợp đồng, hóa đơn, thanh toán và các thay đổi quan trọng.</p></div>
          <span className="action-arrow">→</span>
        </Link>
        {profile.role !== "ADMIN" && (
          <Link href="/complaints" className="dashboard-action-card">
            <span className="action-icon">⚑</span>
            <div><p className="eyebrow">HỖ TRỢ & AN TOÀN</p><h2>Báo cáo & khiếu nại</h2><p>Báo cáo tin đáng ngờ và theo dõi trạng thái xử lý từ Admin.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "ADMIN" && (
          <Link href="/admin/complaints" className="dashboard-action-card">
            <span className="action-icon">⚑</span>
            <div><p className="eyebrow">ADMIN HỖ TRỢ & AN TOÀN</p><h2>Xử lý báo cáo</h2><p>Nhận, điều tra, giải quyết hoặc bác bỏ báo cáo người dùng.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "ADMIN" && (
          <Link href="/admin/payments" className="dashboard-action-card">
            <span className="action-icon">₫</span>
            <div><p className="eyebrow">TÀI CHÍNH</p><h2>Thanh toán & rút tiền</h2><p>Theo dõi giao dịch và xử lý yêu cầu rút tiền của chủ nhà.</p></div>
            <span className="action-arrow">→</span>
          </Link>
        )}
        {profile.role === "ADMIN" && (
          <Link href="/admin" className="dashboard-action-card">
            <span className="action-icon">⚙</span>
            <div><p className="eyebrow">QUẢN TRỊ HỆ THỐNG</p><h2>Duyệt tin & quản lý tài khoản</h2><p>Kiểm duyệt tin đăng và quản lý trạng thái tài khoản người dùng.</p></div>
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
            <div><dt>Trạng thái</dt><dd>{statusLabel(profile.status)}</dd></div>
            <div><dt>Email đã xác minh</dt><dd>{profile.emailVerified ? "Có" : "Chưa"}</dd></div>
            <div><dt>Số điện thoại đã xác minh</dt><dd>{profile.phoneVerified ? "Có" : "Chưa"}</dd></div>
          </dl>
        </article>

        <article className="info-card">
          <h2>Bảo mật & trạng thái tài khoản</h2>
          <p className="muted">Tài khoản của bạn được bảo vệ và chỉ hiển thị những chức năng phù hợp với quyền sử dụng.</p>
          <div className="rbac-result"><span>Trạng thái bảo mật</span><strong className="good">Đang bảo vệ</strong></div>
          <p className="tiny muted">Các thao tác quan trọng luôn được kiểm tra quyền truy cập trước khi thực hiện.</p>
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
