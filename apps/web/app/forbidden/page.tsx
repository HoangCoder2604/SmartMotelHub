import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="system-state-page">
      <div className="system-state-card">
        <p className="system-state-code">403</p>
        <h1>Bạn không có quyền truy cập</h1>
        <p>Tài khoản hiện tại không được phép mở khu vực này.</p>
        <div className="system-state-actions">
          <Link className="button" href="/dashboard">Về Dashboard</Link>
          <Link className="button button-ghost" href="/">Trang chủ</Link>
        </div>
      </div>
    </main>
  );
}
