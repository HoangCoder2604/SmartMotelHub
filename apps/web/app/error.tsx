"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="system-state-page">
      <div className="system-state-card">
        <p className="system-state-code">500</p>
        <h1>Đã xảy ra lỗi</h1>
        <p>SmartMotel Hub không thể tải nội dung này. Bạn có thể thử lại mà không cần tải lại toàn bộ website.</p>
        <div className="system-state-actions">
          <button className="button" type="button" onClick={() => reset()}>Thử lại</button>
          <a className="button button-ghost" href="/dashboard">Dashboard</a>
        </div>
      </div>
    </main>
  );
}
