"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../components/auth-provider";
import { apiFetch } from "../../lib/api";
import styles from "./phase10.module.css";

type MonthPoint = {
  month: string;
  revenue: number;
  spend: number;
  invoiceCount: number;
  newUsers: number;
};

type Rental = {
  id: string;
  startDate: string;
  endDate: string | null;
  monthlyRent: string | number;
  room: {
    id: string;
    title: string;
    roomNumber: string | null;
    property: { id: string; name: string; address: string; district: string; city: string };
  };
};

type AnalyticsData = {
  role: "ADMIN" | "LANDLORD" | "TENANT";
  months: number;
  generatedAt: string;
  summary: Record<string, number>;
  users?: Record<string, number>;
  properties?: Record<string, number>;
  rooms?: Record<string, number>;
  listings?: Record<string, number>;
  contracts?: Record<string, number>;
  appointments?: Record<string, number>;
  invoices?: Record<string, number>;
  complaints?: Record<string, number>;
  reviews?: number;
  currentRentals?: Rental[];
  monthly: MonthPoint[];
};

const moneyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function money(value: number | undefined) {
  return moneyFormatter.format(value ?? 0);
}

function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return `${month}/${year.slice(2)}`;
}

function MetricCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <article className={styles.metricCard}>
      <p>{label}</p>
      <strong>{value}</strong>
      {hint && <span>{hint}</span>}
    </article>
  );
}

function StatusGrid({ title, values }: { title: string; values?: Record<string, number> }) {
  if (!values) return null;
  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}><h2>{title}</h2></div>
      <div className={styles.statusGrid}>
        {Object.entries(values).map(([key, value]) => (
          <div key={key} className={styles.statusItem}>
            <span>{key.replaceAll("_", " ")}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

function TrendChart({ data, mode }: { data: MonthPoint[]; mode: "revenue" | "spend" | "users" }) {
  const values = data.map((item) => mode === "revenue" ? item.revenue : mode === "spend" ? item.spend : item.newUsers);
  const max = Math.max(1, ...values);

  return (
    <div className={styles.chart} style={{ gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(44px, 1fr))` }} role="img" aria-label="Biểu đồ xu hướng theo tháng">
      {data.map((item, index) => {
        const value = values[index] ?? 0;
        const height = Math.max(value > 0 ? 8 : 2, Math.round((value / max) * 100));
        return (
          <div className={styles.chartColumn} key={item.month}>
            <div className={styles.chartValue}>{mode === "users" ? value : value > 0 ? `${Math.round(value / 1000).toLocaleString("vi-VN")}k` : "0"}</div>
            <div className={styles.chartTrack}>
              <div className={styles.chartBar} style={{ height: `${height}%` }} />
            </div>
            <span>{monthLabel(item.month)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const { loading: authLoading, firebaseUser, profile } = useAuth();
  const [months, setMonths] = useState(6);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.replace("/auth/login");
  }, [authLoading, firebaseUser, router]);

  useEffect(() => {
    if (!firebaseUser || !profile) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = await firebaseUser.getIdToken();
        const result = await apiFetch<AnalyticsData>(`/analytics/overview?months=${months}`, {}, token);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải số liệu phân tích.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [firebaseUser, months, profile]);

  const title = useMemo(() => {
    if (profile?.role === "ADMIN") return "Toàn cảnh hệ thống";
    if (profile?.role === "LANDLORD") return "Hiệu quả vận hành nhà trọ";
    return "Chi tiêu & hành trình thuê phòng";
  }, [profile?.role]);

  if (authLoading && !profile) return <main className="center-screen"><p>Đang tải tài khoản…</p></main>;

  return (
    <main className={styles.page}>
      <nav className={styles.nav}>
        <Link href="/dashboard" className={styles.brand}>SmartMotel Hub</Link>
        <div className={styles.navActions}>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/notifications">Thông báo</Link>
        </div>
      </nav>

      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>PHASE 10 · ANALYTICS & REPORTING</p>
          <h1>{title}</h1>
          <p>Số liệu được tổng hợp trực tiếp từ PostgreSQL theo quyền của tài khoản đang đăng nhập.</p>
        </div>
        <label className={styles.periodSelect}>
          Khoảng thời gian
          <select value={months} onChange={(event) => setMonths(Number(event.target.value))}>
            <option value={3}>3 tháng</option>
            <option value={6}>6 tháng</option>
            <option value={12}>12 tháng</option>
          </select>
        </label>
      </header>

      {error && <div className={styles.error}>{error}</div>}
      {loading && <div className={styles.loading}>Đang tổng hợp dữ liệu…</div>}

      {!loading && data?.role === "ADMIN" && (
        <>
          <section className={styles.metrics}>
            <MetricCard label="Người dùng" value={data.summary.totalUsers ?? 0} hint="Tất cả role" />
            <MetricCard label="Nhà trọ" value={data.summary.totalProperties ?? 0} hint="Property đã tạo" />
            <MetricCard label="Phòng" value={data.summary.totalRooms ?? 0} hint={`Lấp đầy ${data.summary.occupancyRate ?? 0}%`} />
            <MetricCard label="Hợp đồng ACTIVE" value={data.summary.activeContracts ?? 0} />
            <MetricCard label="Đã xác nhận thanh toán" value={money(data.summary.paidRevenue)} hint="Tổng invoice PAID" />
            <MetricCard label="Còn phải thu" value={money(data.summary.outstandingRevenue)} hint="UNPAID + OVERDUE" />
          </section>

          <section className={styles.twoColumns}>
            <article className={styles.panel}>
              <div className={styles.panelHeader}><div><p className={styles.eyebrow}>CASHFLOW</p><h2>Invoice PAID theo tháng</h2></div></div>
              <TrendChart data={data.monthly} mode="revenue" />
            </article>
            <article className={styles.panel}>
              <div className={styles.panelHeader}><div><p className={styles.eyebrow}>GROWTH</p><h2>Tài khoản mới theo tháng</h2></div></div>
              <TrendChart data={data.monthly} mode="users" />
            </article>
          </section>

          <section className={styles.threeColumns}>
            <StatusGrid title="Users" values={data.users} />
            <StatusGrid title="Listings" values={data.listings} />
            <StatusGrid title="Complaints" values={data.complaints} />
            <StatusGrid title="Rooms" values={data.rooms} />
            <StatusGrid title="Invoices" values={data.invoices} />
            <StatusGrid title="Contracts" values={data.contracts} />
          </section>
        </>
      )}

      {!loading && data?.role === "LANDLORD" && (
        <>
          <section className={styles.metrics}>
            <MetricCard label="Nhà trọ" value={data.summary.properties ?? 0} />
            <MetricCard label="Tổng phòng" value={data.summary.totalRooms ?? 0} />
            <MetricCard label="Tỷ lệ lấp đầy" value={`${data.summary.occupancyRate ?? 0}%`} hint="RENTED / phòng có thể cho thuê" />
            <MetricCard label="Hợp đồng ACTIVE" value={data.summary.activeContracts ?? 0} />
            <MetricCard label="Đã thu" value={money(data.summary.collectedRevenue)} hint="Invoice PAID" />
            <MetricCard label="Còn phải thu" value={money(data.summary.outstandingRevenue)} hint="UNPAID + OVERDUE" />
          </section>

          <article className={styles.panel}>
            <div className={styles.panelHeader}><div><p className={styles.eyebrow}>REVENUE</p><h2>Tiền thuê đã xác nhận theo tháng</h2></div></div>
            <TrendChart data={data.monthly} mode="revenue" />
          </article>

          <section className={styles.threeColumns}>
            <StatusGrid title="Rooms" values={data.rooms} />
            <StatusGrid title="Listings" values={data.listings} />
            <StatusGrid title="Appointments" values={data.appointments} />
            <StatusGrid title="Invoices" values={data.invoices} />
            <StatusGrid title="Contracts" values={data.contracts} />
            <StatusGrid title="Properties" values={data.properties} />
          </section>
        </>
      )}

      {!loading && data?.role === "TENANT" && (
        <>
          <section className={styles.metrics}>
            <MetricCard label="Phòng đã lưu" value={data.summary.favorites ?? 0} />
            <MetricCard label="Hợp đồng ACTIVE" value={data.summary.activeContracts ?? 0} />
            <MetricCard label="Đã thanh toán" value={money(data.summary.totalSpent)} hint="Tổng invoice PAID" />
            <MetricCard label="Chưa thanh toán" value={money(data.summary.outstanding)} hint="UNPAID + OVERDUE" />
            <MetricCard label="Hóa đơn quá hạn" value={data.summary.overdueInvoices ?? 0} />
            <MetricCard label="Đánh giá đã viết" value={data.reviews ?? 0} />
          </section>

          <section className={styles.twoColumns}>
            <article className={styles.panel}>
              <div className={styles.panelHeader}><div><p className={styles.eyebrow}>SPENDING</p><h2>Chi tiêu đã thanh toán theo tháng</h2></div></div>
              <TrendChart data={data.monthly} mode="spend" />
            </article>
            <div className={styles.stack}>
              <StatusGrid title="Lịch xem phòng" values={data.appointments} />
              <StatusGrid title="Hóa đơn" values={data.invoices} />
            </div>
          </section>

          {!!data.currentRentals?.length && (
            <article className={styles.panel}>
              <div className={styles.panelHeader}><h2>Đang thuê</h2><Link href="/contracts">Xem hợp đồng →</Link></div>
              <div className={styles.rentals}>
                {data.currentRentals.map((rental) => (
                  <div className={styles.rentalCard} key={rental.id}>
                    <div><strong>{rental.room.property.name}</strong><p>{rental.room.title}{rental.room.roomNumber ? ` · ${rental.room.roomNumber}` : ""}</p></div>
                    <div><span>{rental.room.property.district}, {rental.room.property.city}</span><strong>{money(Number(rental.monthlyRent))}/tháng</strong></div>
                  </div>
                ))}
              </div>
            </article>
          )}
        </>
      )}

      {data && <p className={styles.generated}>Cập nhật: {new Date(data.generatedAt).toLocaleString("vi-VN")}. Số tiền là tổng các hóa đơn trong dữ liệu hiện tại, chưa phải đối soát cổng thanh toán.</p>}
    </main>
  );
}
