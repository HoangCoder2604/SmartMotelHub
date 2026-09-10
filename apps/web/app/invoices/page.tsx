"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../components/auth-provider";
import { apiFetch } from "../../lib/api";
import styles from "../contracts/phase7.module.css";

type InvoiceStatus = "UNPAID" | "PAID" | "OVERDUE";

type Invoice = {
  id: string;
  billingMonth: string;
  roomFee: string | number;
  electricityFee: string | number;
  waterFee: string | number;
  internetFee: string | number;
  serviceFee: string | number;
  otherFee: string | number;
  total: string | number;
  status: InvoiceStatus;
  dueDate: string;
  paidAt: string | null;
  paymentNote: string | null;
  contract: {
    id: string;
    landlord: { fullName: string; email: string | null; phone: string | null };
    room: { title: string; property: { name: string; address: string; district: string; city: string } };
  };
};

function money(value: string | number) {
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN", { timeZone: "UTC" });
}

function monthLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN", { month: "long", year: "numeric", timeZone: "UTC" });
}

function statusClass(status: InvoiceStatus) {
  if (status === "PAID") return `${styles.status} ${styles.statusPaid}`;
  if (status === "OVERDUE") return `${styles.status} ${styles.statusOverdue}`;
  return `${styles.status} ${styles.statusUnpaid}`;
}

export default function TenantInvoicesPage() {
  const router = useRouter();
  const { loading: authLoading, firebaseUser, profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.replace("/auth/login");
    if (!authLoading && profile && profile.role !== "TENANT") router.replace("/dashboard");
  }, [authLoading, firebaseUser, profile, router]);

  const load = async () => {
    if (!firebaseUser || profile?.role !== "TENANT") return;
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const data = await apiFetch<{ invoices: Invoice[] }>("/invoices", {}, token);
      setInvoices(data.invoices);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải hóa đơn.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [firebaseUser, profile?.role]);

  if (authLoading || (loading && !invoices.length)) {
    return <main className={styles.page}><div className={styles.shell}><div className={styles.empty}>Đang tải hóa đơn…</div></div></main>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className="topbar">
          <Link href="/dashboard" className="brand">SmartMotel Hub</Link>
          <div className="topbar-actions"><Link href="/contracts" className="button button-ghost button-small">Hợp đồng</Link><Link href="/notifications" className="button button-ghost button-small">Thông báo</Link></div>
        </nav>

        <header className={styles.hero}>
          <div><p className={styles.kicker}>TENANT · INVOICES</p><h1>Hóa đơn thuê phòng</h1><p>Theo dõi tiền phòng, điện, nước, Internet, phí dịch vụ và trạng thái thanh toán.</p></div>
        </header>

        {message && <div className={styles.alert}>{message}</div>}

        {!invoices.length ? <div className={styles.empty}>Bạn chưa có hóa đơn nào.</div> : (
          <section className={styles.grid}>
            {invoices.map((invoice) => (
              <article className={styles.card} key={invoice.id}>
                <p className={styles.kicker}>{invoice.contract.room.property.name}</p>
                <h2>{monthLabel(invoice.billingMonth)}</h2>
                <p className={styles.muted}>{invoice.contract.room.title} · {invoice.contract.room.property.address}</p>
                <span className={statusClass(invoice.status)}>{invoice.status}</span>

                <div className={styles.details}>
                  <div><span>Tiền phòng</span><strong>{money(invoice.roomFee)}</strong></div>
                  <div><span>Điện</span><strong>{money(invoice.electricityFee)}</strong></div>
                  <div><span>Nước</span><strong>{money(invoice.waterFee)}</strong></div>
                  <div><span>Internet</span><strong>{money(invoice.internetFee)}</strong></div>
                  <div><span>Dịch vụ</span><strong>{money(invoice.serviceFee)}</strong></div>
                  <div><span>Khác</span><strong>{money(invoice.otherFee)}</strong></div>
                </div>

                <div className={styles.invoiceTotal}>Tổng: {money(invoice.total)}</div>
                <p className={styles.muted}>Hạn thanh toán: {dateLabel(invoice.dueDate)}</p>
                {invoice.paidAt && <p className={styles.muted}>Đã xác nhận thanh toán: {new Date(invoice.paidAt).toLocaleString("vi-VN")}</p>}
                {invoice.paymentNote && <div className={styles.alert}><strong>Ghi chú:</strong> {invoice.paymentNote}</div>}
                {invoice.status === "OVERDUE" && <div className={styles.alert}>Hóa đơn đã quá hạn. Hãy liên hệ chủ nhà để xử lý thanh toán.</div>}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
