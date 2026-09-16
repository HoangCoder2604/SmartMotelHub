"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../../components/auth-provider";
import { apiFetch } from "../../../lib/api";
import styles from "../../payments/phase11.module.css";

type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";
type Payment = {
  id: string; provider: "VNPAY" | "MANUAL"; status: PaymentStatus; amount: string | number; txnRef: string; gatewayTransactionNo: string | null; bankCode: string | null; responseCode: string | null; createdAt: string; paidAt: string | null;
  invoice: { contract: { tenant: { fullName: string }; landlord: { fullName: string }; room: { title: string; property: { name: string } } } };
};
type Pagination = { page: number; limit: number; total: number; totalPages: number };
type Summary = { succeeded: number; pending: number; failed: number; revenue: number };
const money = (value: string | number) => `${Number(value).toLocaleString("vi-VN")} đ`;

export default function AdminPaymentsPage() {
  const router = useRouter();
  const { loading: authLoading, firebaseUser, profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [summary, setSummary] = useState<Summary>({ succeeded: 0, pending: 0, failed: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.replace("/auth/login");
    if (!authLoading && profile && profile.role !== "ADMIN") router.replace("/forbidden");
  }, [authLoading, firebaseUser, profile, router]);

  const load = async (page = 1) => {
    if (!firebaseUser || profile?.role !== "ADMIN") return;
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const data = await apiFetch<{ payments: Payment[]; pagination: Pagination; summary: Summary }>(`/admin/payments?page=${page}&limit=20`, {}, token);
      setPayments(data.payments); setPagination(data.pagination); setSummary(data.summary); setMessage(null);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể tải payment audit."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [firebaseUser, profile?.role]);

  if (authLoading || (loading && !payments.length)) return <main className={styles.page}><div className={styles.shell}><div className="skeleton skeleton-card" /></div></main>;
  return <main className={styles.page}><div className={styles.shell}>
    <nav className="topbar"><Link href="/dashboard" className="brand">SmartMotel Hub</Link><div className="topbar-actions"><Link href="/admin" className="button button-ghost button-small">Admin Console</Link></div></nav>
    <header className={styles.hero}><div><p className={styles.kicker}>ADMIN · PAYMENT AUDIT</p><h1>Đối soát thanh toán</h1><p className={styles.muted}>Audit gateway transaction theo TENANT, LANDLORD, mã giao dịch và trạng thái.</p></div><strong>{pagination.total} giao dịch</strong></header>
    <div className={styles.details}><div><span>Thành công</span><strong>{summary.succeeded}</strong></div><div><span>Doanh số ghi nhận</span><strong>{money(summary.revenue)}</strong></div><div><span>Đang chờ</span><strong>{summary.pending}</strong></div><div><span>Không thành công</span><strong>{summary.failed}</strong></div></div>
    {message && <div className={`${styles.alert} ${styles.danger}`}>{message}</div>}
    {!payments.length ? <div className={styles.empty}>Chưa có giao dịch nào.</div> : <section className={styles.grid} style={{ marginTop: 22 }}>{payments.map((payment) => <article className={styles.card} key={payment.id}>
      <div className={styles.cardHeader}><div><p className={styles.kicker}>{payment.provider} · {payment.status}</p><h2>{payment.invoice.contract.room.property.name} · {payment.invoice.contract.room.title}</h2><p className={styles.muted}>TENANT: {payment.invoice.contract.tenant.fullName} · LANDLORD: {payment.invoice.contract.landlord.fullName}</p></div><strong>{money(payment.amount)}</strong></div>
      <div className={styles.details}><div><span>TxnRef</span><strong className={styles.code}>{payment.txnRef}</strong></div><div><span>VNPAY Txn</span><strong>{payment.gatewayTransactionNo ?? "—"}</strong></div><div><span>Bank</span><strong>{payment.bankCode ?? "—"}</strong></div><div><span>Response</span><strong>{payment.responseCode ?? "—"}</strong></div><div><span>Tạo lúc</span><strong>{new Date(payment.createdAt).toLocaleString("vi-VN")}</strong></div><div><span>Paid at</span><strong>{payment.paidAt ? new Date(payment.paidAt).toLocaleString("vi-VN") : "—"}</strong></div></div>
    </article>)}</section>}
    {pagination.totalPages > 1 && <div className={styles.actions}><button className="button button-ghost button-small" disabled={pagination.page <= 1 || loading} onClick={() => void load(pagination.page - 1)}>← Trước</button><span className={styles.muted}>Trang {pagination.page} / {pagination.totalPages}</span><button className="button button-ghost button-small" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => void load(pagination.page + 1)}>Sau →</button></div>}
  </div></main>;
}
