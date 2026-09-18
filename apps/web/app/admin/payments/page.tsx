"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../../components/auth-provider";
import { apiFetch } from "../../../lib/api";
import styles from "../../payments/phase11.module.css";
import { statusLabel } from "../../../lib/ui-labels";

type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED";
type Payment = {
  id: string;
  provider: "VNPAY" | "MANUAL";
  status: PaymentStatus;
  amount: string | number;
  txnRef: string;
  gatewayTransactionNo: string | null;
  bankCode: string | null;
  responseCode: string | null;
  createdAt: string;
  paidAt: string | null;
  invoice: { contract: { tenant: { fullName: string }; landlord: { fullName: string }; room: { title: string; property: { name: string } } } };
};
type Pagination = { page: number; limit: number; total: number; totalPages: number };
type Summary = { succeeded: number; pending: number; failed: number; revenue: number };
type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED";
type Withdrawal = {
  id: string;
  amount: string | number;
  status: WithdrawalStatus;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  branch: string | null;
  transferReference: string | null;
  adminNote: string | null;
  rejectionReason: string | null;
  requestedAt: string;
  reviewedAt: string | null;
  landlord: { id: string; fullName: string; email: string | null; phone: string | null };
  reviewedByAdmin: { fullName: string } | null;
};
type WithdrawalData = { withdrawals: Withdrawal[]; summary: { pendingCount: number; pendingAmount: number } };

const money = (value: string | number) => `${Number(value).toLocaleString("vi-VN")} đ`;

function withdrawalStatusClass(status: WithdrawalStatus) {
  if (status === "APPROVED") return `${styles.status} ${styles.succeeded}`;
  if (status === "PENDING") return `${styles.status} ${styles.pending}`;
  return `${styles.status} ${styles.failed}`;
}

export default function AdminPaymentsPage() {
  const router = useRouter();
  const { loading: authLoading, firebaseUser, profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [summary, setSummary] = useState<Summary>({ succeeded: 0, pending: 0, failed: 0, revenue: 0 });
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [withdrawSummary, setWithdrawSummary] = useState({ pendingCount: 0, pendingAmount: 0 });
  const [transferRefs, setTransferRefs] = useState<Record<string, string>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.replace("/auth/login");
    if (!authLoading && profile && profile.role !== "ADMIN") router.replace("/forbidden");
  }, [authLoading, firebaseUser, profile, router]);

  const load = async (page = 1) => {
    if (!firebaseUser || profile?.role !== "ADMIN") return;
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const [paymentData, withdrawalData] = await Promise.all([
        apiFetch<{ payments: Payment[]; pagination: Pagination; summary: Summary }>(`/admin/payments?page=${page}&limit=20`, {}, token),
        apiFetch<WithdrawalData>("/admin/withdrawals", {}, token),
      ]);
      setPayments(paymentData.payments);
      setPagination(paymentData.pagination);
      setSummary(paymentData.summary);
      setWithdrawals(withdrawalData.withdrawals);
      setWithdrawSummary(withdrawalData.summary);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải dữ liệu đối soát.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, profile?.role]);

  const approve = async (item: Withdrawal) => {
    if (!firebaseUser) return;
    const transferReference = transferRefs[item.id]?.trim();
    if (!transferReference) {
      setMessage("Hãy nhập mã giao dịch/chuyển khoản ngân hàng trước khi duyệt.");
      return;
    }
    setBusyId(item.id);
    setMessage(null);
    setSuccess(null);
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/admin/withdrawals/${item.id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ transferReference }),
      }, token);
      setSuccess(`Đã duyệt lệnh rút ${money(item.amount)} của ${item.landlord.fullName}.`);
      await load(pagination.page || 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể duyệt yêu cầu rút tiền.");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (item: Withdrawal) => {
    if (!firebaseUser) return;
    const reason = rejectReasons[item.id]?.trim();
    if (!reason) {
      setMessage("Hãy nhập lý do từ chối trước khi xử lý.");
      return;
    }
    setBusyId(item.id);
    setMessage(null);
    setSuccess(null);
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/admin/withdrawals/${item.id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      }, token);
      setSuccess(`Đã từ chối lệnh rút ${money(item.amount)} của ${item.landlord.fullName}.`);
      await load(pagination.page || 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể từ chối yêu cầu rút tiền.");
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading || (loading && !payments.length && !withdrawals.length)) {
    return <main className={styles.page}><div className={styles.shell}><div className="skeleton skeleton-card" /></div></main>;
  }

  const pendingWithdrawals = withdrawals.filter((item) => item.status === "PENDING");

  return <main className={styles.page}><div className={styles.shell}>
    <nav className="topbar"><Link href="/dashboard" className="brand">SmartMotel Hub</Link><div className="topbar-actions"><Link href="/admin" className="button button-ghost button-small">Admin Console</Link></div></nav>
    <header className={styles.hero}><div><p className={styles.kicker}>THANH TOÁN & YÊU CẦU RÚT TIỀN</p><h1>Đối soát tài chính</h1><p className={styles.muted}>Theo dõi giao dịch và xử lý yêu cầu rút tiền của chủ nhà. Chỉ xác nhận sau khi khoản chuyển thực tế đã hoàn tất.</p></div><strong>{pagination.total} giao dịch</strong></header>

    <section className={styles.walletGrid}>
      <article className={styles.metricCard}><span>VNPAY thành công</span><strong>{summary.succeeded}</strong><small>{money(summary.revenue)} doanh số</small></article>
      <article className={styles.metricCard}><span>Lệnh rút đang chờ</span><strong>{withdrawSummary.pendingCount}</strong><small>Cần Admin xử lý</small></article>
      <article className={styles.metricCard}><span>Tiền đang chờ rút</span><strong>{money(withdrawSummary.pendingAmount)}</strong><small>Đã được giữ chỗ trong ví Landlord</small></article>
      <article className={styles.metricCard}><span>Payment đang chờ</span><strong>{summary.pending}</strong><small>{summary.failed} giao dịch không thành công</small></article>
    </section>

    {message && <div className={`${styles.alert} ${styles.danger}`}>{message}</div>}
    {success && <div className={`${styles.alert} ${styles.success}`}>{success}</div>}

    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeading}><div><p className={styles.kicker}>WITHDRAWAL QUEUE</p><h2>Yêu cầu rút tiền chờ xử lý</h2></div></div>
      {!pendingWithdrawals.length ? <div className={styles.empty}>Không có yêu cầu rút tiền nào đang chờ.</div> : <div className={styles.grid}>
        {pendingWithdrawals.map((item) => <article className={styles.card} key={item.id}>
          <div className={styles.cardHeader}>
            <div><p className={styles.kicker}>Chủ nhà · {item.landlord.fullName}</p><h2>{money(item.amount)}</h2><p className={styles.muted}>{item.landlord.email ?? item.landlord.phone ?? "—"}</p></div>
            <span className={withdrawalStatusClass(item.status)}>{statusLabel(item.status)}</span>
          </div>
          <div className={styles.bankBox}>
            <strong>{item.bankName} ({item.bankCode})</strong>
            <span>STK: {item.accountNumber}</span>
            <span>Chủ TK: {item.accountHolderName}</span>
            <span>Chi nhánh: {item.branch ?? "—"}</span>
          </div>
          <p className={styles.muted}>Yêu cầu lúc {new Date(item.requestedAt).toLocaleString("vi-VN")}. Hãy chuyển đúng số tiền tới tài khoản trên trước khi bấm duyệt.</p>
          <div className={styles.adminActionGrid}>
            <label><span>Mã giao dịch ngân hàng</span><input className={styles.input} value={transferRefs[item.id] ?? ""} onChange={(e) => setTransferRefs({ ...transferRefs, [item.id]: e.target.value })} placeholder="Bắt buộc khi duyệt" /></label>
            <button className="button button-primary" disabled={busyId === item.id} onClick={() => void approve(item)}>Đã chuyển tiền & duyệt</button>
            <label><span>Lý do từ chối</span><input className={styles.input} value={rejectReasons[item.id] ?? ""} onChange={(e) => setRejectReasons({ ...rejectReasons, [item.id]: e.target.value })} placeholder="Bắt buộc khi từ chối" /></label>
            <button className="button button-ghost" disabled={busyId === item.id} onClick={() => void reject(item)}>Từ chối giao dịch</button>
          </div>
        </article>)}
      </div>}
    </section>

    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeading}><div><p className={styles.kicker}>WITHDRAWAL HISTORY</p><h2>Lịch sử xử lý rút tiền</h2></div></div>
      <div className={styles.grid}>{withdrawals.filter((item) => item.status !== "PENDING").slice(0, 20).map((item) => <article className={styles.card} key={item.id}>
        <div className={styles.cardHeader}><div><h2>{item.landlord.fullName} · {money(item.amount)}</h2><p className={styles.muted}>{item.bankName} · {item.accountNumber}</p></div><span className={withdrawalStatusClass(item.status)}>{statusLabel(item.status)}</span></div>
        <div className={styles.details}><div><span>Mã chuyển khoản</span><strong>{item.transferReference ?? "—"}</strong></div><div><span>Lý do từ chối</span><strong>{item.rejectionReason ?? "—"}</strong></div><div><span>Admin xử lý</span><strong>{item.reviewedByAdmin?.fullName ?? "—"}</strong></div><div><span>Thời điểm</span><strong>{item.reviewedAt ? new Date(item.reviewedAt).toLocaleString("vi-VN") : "—"}</strong></div></div>
      </article>)}</div>
    </section>

    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeading}><div><p className={styles.kicker}>PAYMENT AUDIT</p><h2>Giao dịch thanh toán</h2></div></div>
      {!payments.length ? <div className={styles.empty}>Chưa có giao dịch nào.</div> : <section className={styles.grid}>{payments.map((payment) => <article className={styles.card} key={payment.id}>
        <div className={styles.cardHeader}><div><p className={styles.kicker}>{payment.provider} · {payment.status}</p><h2>{payment.invoice.contract.room.property.name} · {payment.invoice.contract.room.title}</h2><p className={styles.muted}>TENANT: {payment.invoice.contract.tenant.fullName} · LANDLORD: {payment.invoice.contract.landlord.fullName}</p></div><strong>{money(payment.amount)}</strong></div>
        <div className={styles.details}><div><span>TxnRef</span><strong className={styles.code}>{payment.txnRef}</strong></div><div><span>VNPAY Txn</span><strong>{payment.gatewayTransactionNo ?? "—"}</strong></div><div><span>Bank</span><strong>{payment.bankCode ?? "—"}</strong></div><div><span>Response</span><strong>{payment.responseCode ?? "—"}</strong></div><div><span>Tạo lúc</span><strong>{new Date(payment.createdAt).toLocaleString("vi-VN")}</strong></div><div><span>Paid at</span><strong>{payment.paidAt ? new Date(payment.paidAt).toLocaleString("vi-VN") : "—"}</strong></div></div>
      </article>)}</section>}
      {pagination.totalPages > 1 && <div className={styles.actions}><button className="button button-ghost button-small" disabled={pagination.page <= 1 || loading} onClick={() => void load(pagination.page - 1)}>← Trước</button><span className={styles.muted}>Trang {pagination.page} / {pagination.totalPages}</span><button className="button button-ghost button-small" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => void load(pagination.page + 1)}>Sau →</button></div>}
    </section>
  </div></main>;
}
