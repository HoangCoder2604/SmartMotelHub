"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../components/auth-provider";
import { apiFetch } from "../../lib/api";
import styles from "./phase11.module.css";

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
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.replace("/auth/login");
    if (!authLoading && profile && profile.role !== "TENANT") router.replace("/dashboard");
  }, [authLoading, firebaseUser, profile, router]);

  useEffect(() => {
    if (!firebaseUser || profile?.role !== "TENANT") return;
    void (async () => {
      setLoading(true);
      try {
        const token = await firebaseUser.getIdToken();
        const data = await apiFetch<{ payments: Payment[] }>("/payments", {}, token);
        setPayments(data.payments);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Không thể tải lịch sử thanh toán.");
      } finally {
        setLoading(false);
      }
    })();
  }, [firebaseUser, profile?.role]);

  if (authLoading || loading) return <main className={styles.page}><div className={styles.shell}><div className={styles.empty}>Đang tải lịch sử thanh toán…</div></div></main>;

  return <main className={styles.page}><div className={styles.shell}>
    <nav className="topbar"><Link href="/dashboard" className="brand">SmartMotel Hub</Link><div className="topbar-actions"><Link href="/invoices" className="button button-ghost button-small">Hóa đơn</Link><Link href="/notifications" className="button button-ghost button-small">Thông báo</Link></div></nav>
    <header className={styles.hero}><div><p className={styles.kicker}>PHASE 11 · PAYMENT HISTORY</p><h1>Lịch sử thanh toán</h1><p className={styles.muted}>Theo dõi từng lần thanh toán VNPAY và các khoản được chủ nhà xác nhận thủ công.</p></div></header>
    {message && <div className={`${styles.alert} ${styles.danger}`}>{message}</div>}
    {!payments.length ? <div className={styles.empty}>Chưa có giao dịch thanh toán nào.</div> : <section className={styles.grid}>{payments.map((payment) => <article className={styles.card} key={payment.id}>
      <div className={styles.cardHeader}><div><p className={styles.kicker}>{payment.invoice.contract.room.property.name}</p><h2>{payment.invoice.contract.room.title} · hóa đơn {month(payment.invoice.billingMonth)}</h2><p className={styles.muted}>{new Date(payment.createdAt).toLocaleString("vi-VN")}</p></div><span className={statusClass(payment.status)}>{payment.status}</span></div>
      <div className={styles.amount}>{money(payment.amount)}</div>
      <div className={styles.details}>
        <div><span>Phương thức</span><strong className={styles.provider}>{payment.provider}</strong></div>
        <div><span>Mã SmartMotel</span><strong className={styles.code}>{payment.txnRef}</strong></div>
        <div><span>Mã VNPAY</span><strong>{payment.gatewayTransactionNo ?? "—"}</strong></div>
        <div><span>Ngân hàng / thẻ</span><strong>{[payment.bankCode, payment.cardType].filter(Boolean).join(" · ") || "—"}</strong></div>
        <div><span>Response code</span><strong>{payment.responseCode ?? "—"}</strong></div>
        <div><span>Thời gian thanh toán</span><strong>{payment.paidAt ? new Date(payment.paidAt).toLocaleString("vi-VN") : "—"}</strong></div>
      </div>
    </article>)}</section>}
  </div></main>;
}
