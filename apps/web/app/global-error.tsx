"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body>
        <main className="system-state-page">
          <div className="system-state-card">
            <p className="system-state-code">500</p>
            <h1>Lỗi hệ thống</h1>
            <p>Ứng dụng gặp lỗi không mong muốn. Hãy thử tải lại hoặc quay lại sau.</p>
            <div className="system-state-actions">
              <button className="button" type="button" onClick={() => reset()}>Thử lại</button>
              <a className="button button-ghost" href="/">Trang chủ</a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
