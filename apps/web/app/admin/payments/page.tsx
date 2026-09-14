"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../components/auth-provider";
import { apiFetch } from "../../../lib/api";
import styles from "../../payments/phase11.module.css";

type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";
type Payment = {
  id: string; provider: "VNPAY" | "MANUAL"; status: PaymentStatus; amount: string | number; txnRef: string; gatewayTransactionNo: string | null; bankCode: string | null; responseCode: string | null; createdAt: string; paidAt: string | null;
  invoice: { contract: { tenant: { fullName: string }; landlord: { fullName: string }; room: { title: string; property: { name: string } } } };
};
const money = (value: string | number) => `${Number(value).toLocaleString("vi-VN")} đ`;

export default function AdminPaymentsPage() {
  const router = useRouter();
  const { loading: authLoading, firebaseUser, profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.replace("/auth/login");
    if (!authLoading && profile && profile.role !== "ADMIN") router.replace("/dashboard");
  }, [authLoading, firebaseUser, profile, router]);

  useEffect(() => {
    if (!firebaseUser || profile?.role !== "ADMIN") return;
    void (async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const data = await apiFetch<{ payments: Payment[] }>("/admin/payments", {}, token);
        setPayments(data.payments);
      } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể tải payment audit."); }
      finally { setLoading(false); }
    })();
  }, [firebaseUser, profile?.role]);

  const totals = useMemo(() => ({
    success: payments.filter((p) => p.status === "SUCCEEDED").length,
    revenue: payments.filter((p) => p.status === "SUCCEEDED").reduce((sum, p) => sum + Number(p.amount), 0),
    pending: payments.filter((p) => p.status === "PENDING").length,
    failed: payments.filter((p) => ["FAILED", "CANCELLED", "EXPIRED"].includes(p.status)).length,
  }), [payments]);

  if (authLoading || loading) return <main className={styles.page}><div className={styles.shell}><div className={styles.empty}>Đang tải payment audit…</div></div></main>;
  return <main className={styles.page}><div className={styles.shell}>
    <nav className="topbar"><Link href="/dashboard" className="brand">SmartMotel Hub</Link><div className="topbar-actions"><Link href="/admin" className="button button-ghost button-small">Admin Console</Link></div></nav>
    <header className={styles.hero}><div><p className={styles.kicker}>ADMIN · PAYMENT AUDIT</p><h1>Đối soát thanh toán</h1><p className={styles.muted}>Audit gateway transaction theo TENANT, LANDLORD, mã giao dịch và trạng thái.</p></div></header>
    <div className={styles.details}><div><span>Thành công</span><strong>{totals.success}</strong></div><div><span>Doanh số ghi nhận</span><strong>{money(totals.revenue)}</strong></div><div><span>Đang chờ</span><strong>{totals.pending}</strong></div><div><span>Không thành công</span><strong>{totals.failed}</strong></div></div>
    {message && <div className={`${styles.alert} ${styles.danger}`}>{message}</div>}
    <section className={styles.grid} style={{ marginTop: 22 }}>{payments.map((payment) => <article className={styles.card} key={payment.id}>
      <div className={styles.cardHeader}><div><p className={styles.kicker}>{payment.provider} · {payment.status}</p><h2>{payment.invoice.contract.room.property.name} · {payment.invoice.contract.room.title}</h2><p className={styles.muted}>TENANT: {payment.invoice.contract.tenant.fullName} · LANDLORD: {payment.invoice.contract.landlord.fullName}</p></div><strong>{money(payment.amount)}</strong></div>
      <div className={styles.details}><div><span>TxnRef</span><strong className={styles.code}>{payment.txnRef}</strong></div><div><span>VNPAY Txn</span><strong>{payment.gatewayTransactionNo ?? "—"}</strong></div><div><span>Bank</span><strong>{payment.bankCode ?? "—"}</strong></div><div><span>Response</span><strong>{payment.responseCode ?? "—"}</strong></div><div><span>Tạo lúc</span><strong>{new Date(payment.createdAt).toLocaleString("vi-VN")}</strong></div><div><span>Paid at</span><strong>{payment.paidAt ? new Date(payment.paidAt).toLocaleString("vi-VN") : "—"}</strong></div></div>
    </article>)}</section>
  </div></main>;
}
