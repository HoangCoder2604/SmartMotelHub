"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../components/auth-provider";
import { apiFetch } from "../../lib/api";
import styles from "./phase11.module.css";
import { statusLabel } from "../../lib/ui-labels";

type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";
type Payment = {
  id: string;
  provider: "VNPAY" | "MANUAL";
  status: PaymentStatus;
  amount: string | number;
  txnRef: string;
  gatewayTransactionNo: string | null;
  bankCode: string | null;
  cardType: string | null;
  responseCode: string | null;
  paidAt: string | null;
  createdAt: string;
  invoice: {
    billingMonth: string;
    status: string;
    contract: { room: { title: string; property: { name: string; address: string } } };
  };
};
type Pagination = { page: number; limit: number; total: number; totalPages: number };

const money = (value: string | number) => `${Number(value).toLocaleString("vi-VN")} đ`;
const month = (value: string) => new Date(value).toLocaleDateString("vi-VN", { month: "2-digit", year: "numeric", timeZone: "UTC" });

function statusClass(status: PaymentStatus) {
  if (status === "SUCCEEDED") return `${styles.status} ${styles.succeeded}`;
  if (status === "PENDING") return `${styles.status} ${styles.pending}`;
  if (status === "CANCELLED") return `${styles.status} ${styles.cancelled}`;
  if (status === "EXPIRED") return `${styles.status} ${styles.expired}`;
  return `${styles.status} ${styles.failed}`;
}

export default function PaymentsPage() {
  const router = useRouter();
  const { loading: authLoading, firebaseUser, profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.replace("/auth/login");
    if (!authLoading && profile && profile.role !== "TENANT") router.replace("/forbidden");
  }, [authLoading, firebaseUser, profile, router]);

  const load = async (page = 1) => {
    if (!firebaseUser || profile?.role !== "TENANT") return;
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const data = await apiFetch<{ payments: Payment[]; pagination: Pagination }>(`/payments?page=${page}&limit=20`, {}, token);
      setPayments(data.payments);
      setPagination(data.pagination);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải lịch sử thanh toán.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [firebaseUser, profile?.role]);

  const hidePayment = async (payment: Payment) => {
    if (!firebaseUser || payment.status === "PENDING") return;
    if (!window.confirm("Xóa giao dịch này khỏi lịch sử của bạn? Dữ liệu đối soát vẫn được hệ thống lưu an toàn.")) return;
    setDeletingId(payment.id);
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/payments/${payment.id}/history`, { method: "DELETE" }, token);
      const nextPage = payments.length === 1 && pagination.page > 1 ? pagination.page - 1 : pagination.page;
      await load(nextPage);
      setMessage("Đã xóa giao dịch khỏi lịch sử của bạn.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xóa giao dịch khỏi lịch sử.");
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading || (loading && !payments.length)) return <main className={styles.page}><div className={styles.shell}><div className="skeleton skeleton-card" /></div></main>;

  return <main className={styles.page}><div className={styles.shell}>
    <nav className="topbar"><Link href="/dashboard" className="brand">SmartMotel Hub</Link><div className="topbar-actions"><Link href="/invoices" className="button button-ghost button-small">Hóa đơn</Link><Link href="/notifications" className="button button-ghost button-small">Thông báo</Link></div></nav>
    <header className={styles.hero}><div><p className={styles.kicker}>LỊCH SỬ THANH TOÁN</p><h1>Lịch sử thanh toán</h1><p className={styles.muted}>Theo dõi giao dịch và chủ động ẩn những mục bạn không còn muốn thấy.</p></div><strong>{pagination.total} giao dịch</strong></header>
    {message && <div className={styles.alert}>{message}</div>}
    {!payments.length ? <div className={styles.empty}>Chưa có giao dịch thanh toán nào.</div> : <section className={styles.grid}>{payments.map((payment) => <article className={styles.card} key={payment.id}>
      <div className={styles.cardHeader}><div><p className={styles.kicker}>{payment.invoice.contract.room.property.name}</p><h2>{payment.invoice.contract.room.title} · hóa đơn {month(payment.invoice.billingMonth)}</h2><p className={styles.muted}>{new Date(payment.createdAt).toLocaleString("vi-VN")}</p></div><span className={statusClass(payment.status)}>{statusLabel(payment.status)}</span></div>
      <div className={styles.amount}>{money(payment.amount)}</div>
      <div className={styles.details}>
        <div><span>Phương thức</span><strong className={styles.provider}>{payment.provider}</strong></div>
        <div><span>Mã SmartMotel</span><strong className={styles.code}>{payment.txnRef}</strong></div>
        <div><span>Mã VNPAY</span><strong>{payment.gatewayTransactionNo ?? "—"}</strong></div>
        <div><span>Ngân hàng / thẻ</span><strong>{[payment.bankCode, payment.cardType].filter(Boolean).join(" · ") || "—"}</strong></div>
        <div><span>Response code</span><strong>{payment.responseCode ?? "—"}</strong></div>
        <div><span>Thời gian thanh toán</span><strong>{payment.paidAt ? new Date(payment.paidAt).toLocaleString("vi-VN") : "—"}</strong></div>
      </div>
      <div className={styles.actions}>
        <button className="button button-ghost button-small" type="button" disabled={payment.status === "PENDING" || deletingId === payment.id} onClick={() => void hidePayment(payment)}>
          {deletingId === payment.id ? "Đang xóa…" : "Xóa khỏi lịch sử"}
        </button>
      </div>
    </article>)}</section>}
    {pagination.totalPages > 1 && <div className={styles.actions}>
      <button className="button button-ghost button-small" disabled={pagination.page <= 1 || loading} onClick={() => void load(pagination.page - 1)}>← Trước</button>
      <span className={styles.muted}>Trang {pagination.page} / {pagination.totalPages}</span>
      <button className="button button-ghost button-small" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => void load(pagination.page + 1)}>Sau →</button>
    </div>}
  </div></main>;
}
