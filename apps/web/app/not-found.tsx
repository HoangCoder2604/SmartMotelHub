import Link from "next/link";

export default function NotFound() {
  return (
    <main className="system-state-page">
      <div className="system-state-card">
        <p className="system-state-code">404</p>
        <h1>Không tìm thấy trang</h1>
        <p>Đường dẫn này không tồn tại hoặc nội dung đã được di chuyển.</p>
        <div className="system-state-actions">
          <Link className="button" href="/">Về trang chủ</Link>
          <Link className="button button-ghost" href="/dashboard">Dashboard</Link>
        </div>
      </div>
    </main>
  );
}
