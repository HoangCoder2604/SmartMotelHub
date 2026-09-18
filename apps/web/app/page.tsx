"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../components/auth-provider";
import { API_URL } from "../lib/api";

type Health = {
  success: boolean;
  data?: { api: string; database: string; postgisVersion: string; timestamp: string };
};

const features = [
  { icon: "✓", title: "Thông tin rõ ràng", text: "Phòng, giá thuê và tiện ích được trình bày trực quan để bạn dễ so sánh trước khi đặt lịch." },
  { icon: "⌂", title: "Hợp đồng minh bạch", text: "Theo dõi hợp đồng, thời hạn thuê và các thay đổi quan trọng ngay trong một nơi." },
  { icon: "◷", title: "Đặt lịch thuận tiện", text: "Chọn phòng phù hợp, gửi lịch xem và theo dõi xác nhận của chủ nhà nhanh chóng." },
  { icon: "₫", title: "Thanh toán an tâm", text: "Hóa đơn tập trung, trạng thái thanh toán rõ ràng và hỗ trợ thanh toán trực tuyến qua VNPAY." },
];

export default function Home() {
  const router = useRouter();
  const { loading, profile, configured } = useAuth();
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/health`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch(() => setHealthError(true));
  }, []);

  const search = (event: FormEvent) => {
    event.preventDefault();
    const keyword = query.trim();
    router.push(keyword ? `/listings?search=${encodeURIComponent(keyword)}` : "/listings");
  };

  const serviceReady = Boolean(health?.success) && !healthError;

  return (
    <main className="landing-page">
      <div className="landing-shell">
        <nav className="topbar landing-topbar">
          <Link href="/" className="brand">SmartMotel Hub</Link>
          <div className="nav-actions">
            <Link className="button button-ghost button-small" href="/listings">Khám phá phòng</Link>
            {!loading && profile ? (
              <Link className="button button-primary button-small" href="/dashboard">Không gian của tôi</Link>
            ) : (
              <>
                <Link className="button button-ghost button-small" href="/auth/login">Đăng nhập</Link>
                <Link className="button button-primary button-small" href="/auth/register">Đăng ký</Link>
              </>
            )}
          </div>
        </nav>

        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="landing-pill"><i /> Không gian thuê trọ thông minh &amp; minh bạch</span>
            <h1>Tìm phòng trọ <span>an tâm hơn,</span><br />quản lý nhẹ nhàng hơn.</h1>
            <p className="landing-lead">SmartMotel Hub kết nối người thuê và chủ nhà trong một trải nghiệm liền mạch — từ tìm phòng, đặt lịch xem đến hợp đồng, hóa đơn và thanh toán.</p>

            <form className="quick-search" onSubmit={search}>
              <span className="search-symbol" aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Tìm kiếm phòng trọ"
                placeholder="Bạn muốn tìm phòng ở khu vực nào?"
              />
              <button type="submit" className="button button-primary">Tìm phòng</button>
            </form>

            <div className="hero-shortcuts" aria-label="Gợi ý khám phá">
              <span>Gợi ý:</span>
              <Link href="/listings">Phòng mới</Link>
              <Link href="/listings">Gần bạn</Link>
              <Link href="/listings">Đầy đủ tiện ích</Link>
            </div>
          </div>

          <div className="hero-showcase" aria-hidden="true">
            <div className="showcase-glow" />
            <article className="showcase-card showcase-main-card">
              <div className="showcase-photo">
                <span className="photo-window one" />
                <span className="photo-window two" />
                <span className="photo-plant">♧</span>
                <span className="photo-bed" />
              </div>
              <div className="showcase-content">
                <div><span className="showcase-label">Phòng nổi bật</span><strong>Không gian sáng · tiện nghi</strong></div>
                <span className="showcase-price">2,8 triệu<small>/tháng</small></span>
              </div>
            </article>
            <article className="floating-card floating-rating"><span>★</span><div><strong>Trải nghiệm rõ ràng</strong><small>Thông tin tập trung, dễ theo dõi</small></div></article>
            <article className="floating-card floating-safe"><span>✓</span><div><strong>Quản lý an tâm</strong><small>Hợp đồng &amp; hóa đơn minh bạch</small></div></article>
          </div>
        </section>

        {!configured && (
          <div className="soft-notice">Một số tính năng đăng nhập đang được cấu hình. Bạn vẫn có thể khám phá danh sách phòng.</div>
        )}

        <section className="landing-section">
          <div className="section-heading-modern">
            <div><span className="section-kicker">Mọi thứ trong một nơi</span><h2>Thuê trọ không cần phức tạp</h2></div>
            <p>Từng bước được thiết kế để người dùng hiểu nhanh, thao tác ít và luôn biết mình đang ở đâu trong hành trình thuê phòng.</p>
          </div>
          <div className="feature-grid-modern">
            {features.map((feature) => (
              <article className="feature-card-modern" key={feature.title}>
                <span className="feature-icon">{feature.icon}</span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="audience-section">
          <article className="audience-card audience-tenant">
            <span className="section-kicker">Dành cho người thuê</span>
            <h2>Tìm nơi ở phù hợp với nhịp sống của bạn.</h2>
            <p>Khám phá phòng, lưu lựa chọn yêu thích, đặt lịch xem và quản lý toàn bộ hành trình thuê trong một tài khoản.</p>
            <Link href="/listings" className="text-link">Bắt đầu tìm phòng <span>→</span></Link>
          </article>
          <article className="audience-card audience-landlord">
            <span className="section-kicker">Dành cho chủ nhà</span>
            <h2>Vận hành nhà trọ gọn gàng và chuyên nghiệp.</h2>
            <p>Quản lý phòng, lịch hẹn, hợp đồng, hóa đơn, thanh toán và yêu cầu rút tiền với một quy trình thống nhất.</p>
            <Link href={profile?.role === "LANDLORD" ? "/dashboard" : "/auth/register"} className="text-link">Không gian chủ nhà <span>→</span></Link>
          </article>
        </section>

        <footer className="landing-footer">
          <div><Link href="/" className="brand">SmartMotel Hub</Link><p>Không gian thuê trọ thông minh, rõ ràng và dễ sử dụng.</p></div>
          <div className={`service-pill ${serviceReady ? "is-online" : ""}`}><i />{serviceReady ? "Hệ thống đang hoạt động ổn định" : "Đang kiểm tra trạng thái hệ thống"}</div>
        </footer>
      </div>
    </main>
  );
}
