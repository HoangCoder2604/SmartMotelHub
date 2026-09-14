"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../../components/auth-provider";
import { apiFetch } from "../../../lib/api";
import styles from "../../payments/phase11.module.css";

type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";
type Payment = {
  id: string; provider: "VNPAY" | "MANUAL"; status: PaymentStatus; amount: string | number; txnRef: string;
  gatewayTransactionNo: string | null; bankCode: string | null; cardType: string | null; paidAt: string | null; createdAt: string;
  invoice: { billingMonth: string; contract: { tenant: { fullName: string; email: string | null }; room: { title: string; property: { name: string } } } };
};

const money = (value: string | number) => `${Number(value).toLocaleString("vi-VN")} đ`;
function statusClass(status: PaymentStatus) {
  if (status === "SUCCEEDED") return `${styles.status} ${styles.succeeded}`;
  if (status === "PENDING") return `${styles.status} ${styles.pending}`;
  return `${styles.status} ${styles.failed}`;
}

export default function LandlordPaymentsPage() {
  const router = useRouter();
  const { loading: authLoading, firebaseUser, profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.replace("/auth/login");
    if (!authLoading && profile && profile.role !== "LANDLORD") router.replace("/dashboard");
  }, [authLoading, firebaseUser, profile, router]);

  useEffect(() => {
    if (!firebaseUser || profile?.role !== "LANDLORD") return;
    void (async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const data = await apiFetch<{ payments: Payment[] }>("/landlord/payments", {}, token);
        setPayments(data.payments);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Không thể tải lịch sử thanh toán.");
      } finally { setLoading(false); }
    })();
  }, [firebaseUser, profile?.role]);

  if (authLoading || loading) return <main className={styles.page}><div className={styles.shell}><div className={styles.empty}>Đang tải thanh toán…</div></div></main>;
  return <main className={styles.page}><div className={styles.shell}>
    <nav className="topbar"><Link href="/dashboard" className="brand">SmartMotel Hub</Link><div className="topbar-actions"><Link href="/landlord/contracts" className="button button-ghost button-small">Hợp đồng & hóa đơn</Link></div></nav>
    <header className={styles.hero}><div><p className={styles.kicker}>LANDLORD · PAYMENT RECONCILIATION</p><h1>Thanh toán đã nhận</h1><p className={styles.muted}>Theo dõi VNPAY và các khoản xác nhận thủ công thuộc đúng nhà trọ của bạn.</p></div></header>
    {message && <div className={`${styles.alert} ${styles.danger}`}>{message}</div>}
    {!payments.length ? <div className={styles.empty}>Chưa có giao dịch nào.</div> : <section className={styles.grid}>{payments.map((payment) => <article className={styles.card} key={payment.id}>
      <div className={styles.cardHeader}><div><p className={styles.kicker}>{payment.invoice.contract.room.property.name}</p><h2>{payment.invoice.contract.room.title}</h2><p className={styles.muted}>TENANT: {payment.invoice.contract.tenant.fullName} · {payment.invoice.contract.tenant.email ?? "—"}</p></div><span className={statusClass(payment.status)}>{payment.status}</span></div>
      <div className={styles.amount}>{money(payment.amount)}</div>
      <div className={styles.details}><div><span>Phương thức</span><strong>{payment.provider}</strong></div><div><span>Mã SmartMotel</span><strong className={styles.code}>{payment.txnRef}</strong></div><div><span>Mã VNPAY</span><strong>{payment.gatewayTransactionNo ?? "—"}</strong></div><div><span>Ngân hàng</span><strong>{payment.bankCode ?? "—"}</strong></div><div><span>Tạo lúc</span><strong>{new Date(payment.createdAt).toLocaleString("vi-VN")}</strong></div><div><span>Thanh toán lúc</span><strong>{payment.paidAt ? new Date(payment.paidAt).toLocaleString("vi-VN") : "—"}</strong></div></div>
    </article>)}</section>}
  </div></main>;
}
