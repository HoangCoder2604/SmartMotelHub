"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  cardType: string | null;
  paidAt: string | null;
  createdAt: string;
  invoice: {
    billingMonth: string;
    contract: {
      tenant: { fullName: string; email: string | null };
      room: { title: string; property: { name: string } };
    };
  };
};
type Pagination = { page: number; limit: number; total: number; totalPages: number };
type BankAccount = {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  branch: string | null;
};
type WithdrawalStatus = "PENDING" | "APPROVED" | "REJECTED";
type Withdrawal = {
  id: string;
  amount: string | number;
  status: WithdrawalStatus;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountHolderName: string;
  transferReference: string | null;
  rejectionReason: string | null;
  requestedAt: string;
  reviewedAt: string | null;
};
type WalletOverview = {
  wallet: {
    balance: string | number;
    pendingWithdrawal: string | number;
    totalReceived: string | number;
    totalWithdrawn: string | number;
    availableBalance: number;
  };
  bankAccount: BankAccount | null;
  withdrawals: Withdrawal[];
};

type BankForm = {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  branch: string;
};

const emptyBankForm: BankForm = {
  bankCode: "",
  bankName: "",
  accountNumber: "",
  accountHolderName: "",
  branch: "",
};

const money = (value: string | number) => `${Number(value).toLocaleString("vi-VN")} đ`;

function paymentStatusClass(status: PaymentStatus) {
  if (status === "SUCCEEDED") return `${styles.status} ${styles.succeeded}`;
  if (status === "PENDING") return `${styles.status} ${styles.pending}`;
  return `${styles.status} ${styles.failed}`;
}

function withdrawalStatusClass(status: WithdrawalStatus) {
  if (status === "APPROVED") return `${styles.status} ${styles.succeeded}`;
  if (status === "PENDING") return `${styles.status} ${styles.pending}`;
  return `${styles.status} ${styles.failed}`;
}

export default function LandlordPaymentsPage() {
  const router = useRouter();
  const { loading: authLoading, firebaseUser, profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [wallet, setWallet] = useState<WalletOverview | null>(null);
  const [bankForm, setBankForm] = useState<BankForm>(emptyBankForm);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.replace("/auth/login");
    if (!authLoading && profile && profile.role !== "LANDLORD") router.replace("/forbidden");
  }, [authLoading, firebaseUser, profile, router]);

  const applyBankAccount = (account: BankAccount | null) => {
    if (!account) return setBankForm(emptyBankForm);
    setBankForm({
      bankCode: account.bankCode,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountHolderName: account.accountHolderName,
      branch: account.branch ?? "",
    });
  };

  const load = async (page = 1) => {
    if (!firebaseUser || profile?.role !== "LANDLORD") return;
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const [paymentData, walletData] = await Promise.all([
        apiFetch<{ payments: Payment[]; pagination: Pagination }>(`/landlord/payments?page=${page}&limit=20`, {}, token),
        apiFetch<WalletOverview>("/landlord/wallet", {}, token),
      ]);
      setPayments(paymentData.payments);
      setPagination(paymentData.pagination);
      setWallet(walletData);
      applyBankAccount(walletData.bankAccount);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải dữ liệu thanh toán.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser, profile?.role]);

  const saveBankAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!firebaseUser) return;
    setBusy(true);
    setMessage(null);
    setSuccess(null);
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch<{ bankAccount: BankAccount }>("/landlord/wallet/bank-account", {
        method: "PUT",
        body: JSON.stringify(bankForm),
      }, token);
      setSuccess("Đã lưu tài khoản ngân hàng nhận tiền.");
      await load(pagination.page || 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể lưu tài khoản ngân hàng.");
    } finally {
      setBusy(false);
    }
  };

  const requestWithdrawal = async (event: FormEvent) => {
    event.preventDefault();
    if (!firebaseUser) return;
    const amount = Number(withdrawAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      setMessage("Số tiền rút phải là số nguyên dương.");
      return;
    }

    setBusy(true);
    setMessage(null);
    setSuccess(null);
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch<{ withdrawal: Withdrawal }>("/landlord/wallet/withdrawals", {
        method: "POST",
        body: JSON.stringify({ amount }),
      }, token);
      setWithdrawAmount("");
      setSuccess("Đã gửi yêu cầu rút tiền. Số tiền đang được giữ chỗ chờ Admin xử lý.");
      await load(pagination.page || 1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tạo yêu cầu rút tiền.");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || (loading && !wallet)) {
    return <main className={styles.page}><div className={styles.shell}><div className="skeleton skeleton-card" /></div></main>;
  }

  return <main className={styles.page}><div className={styles.shell}>
    <nav className="topbar">
      <Link href="/dashboard" className="brand">SmartMotel Hub</Link>
      <div className="topbar-actions"><Link href="/landlord/contracts" className="button button-ghost button-small">Hợp đồng & hóa đơn</Link></div>
    </nav>

    <header className={styles.hero}>
      <div>
        <p className={styles.kicker}>VÍ & RÚT TIỀN</p>
        <h1>Ví chủ trọ</h1>
        <p className={styles.muted}>Tiền VNPAY từ hóa đơn của bạn được ghi nhận vào ví nội bộ sau khi gateway xác nhận thanh toán thành công.</p>
      </div>
      <strong>{pagination.total} giao dịch</strong>
    </header>

    {message && <div className={`${styles.alert} ${styles.danger}`}>{message}</div>}
    {success && <div className={`${styles.alert} ${styles.success}`}>{success}</div>}

    {wallet && <>
      <section className={styles.walletGrid}>
        <article className={styles.metricCard}><span>Số dư ví</span><strong>{money(wallet.wallet.balance)}</strong><small>Tổng tiền chưa rút</small></article>
        <article className={styles.metricCard}><span>Khả dụng để rút</span><strong>{money(wallet.wallet.availableBalance)}</strong><small>Đã trừ khoản đang chờ duyệt</small></article>
        <article className={styles.metricCard}><span>Đang chờ rút</span><strong>{money(wallet.wallet.pendingWithdrawal)}</strong><small>Admin chưa xử lý</small></article>
        <article className={styles.metricCard}><span>Đã rút</span><strong>{money(wallet.wallet.totalWithdrawn)}</strong><small>Tổng lịch sử được duyệt</small></article>
      </section>

      <section className={styles.panelGrid}>
        <article className={styles.panel}>
          <div className={styles.sectionHeading}><div><p className={styles.kicker}>BANK ACCOUNT</p><h2>Tài khoản nhận tiền</h2></div></div>
          <form className={styles.formGrid} onSubmit={saveBankAccount}>
            <label><span>Mã ngân hàng</span><input className={styles.input} required value={bankForm.bankCode} onChange={(e) => setBankForm({ ...bankForm, bankCode: e.target.value })} placeholder="VD: VCB" /></label>
            <label><span>Tên ngân hàng</span><input className={styles.input} required value={bankForm.bankName} onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })} placeholder="Vietcombank" /></label>
            <label><span>Số tài khoản</span><input className={styles.input} required value={bankForm.accountNumber} onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })} placeholder="Số tài khoản nhận tiền" /></label>
            <label><span>Chủ tài khoản</span><input className={styles.input} required value={bankForm.accountHolderName} onChange={(e) => setBankForm({ ...bankForm, accountHolderName: e.target.value })} placeholder="NGUYEN VAN A" /></label>
            <label className={styles.fullWidth}><span>Chi nhánh (không bắt buộc)</span><input className={styles.input} value={bankForm.branch} onChange={(e) => setBankForm({ ...bankForm, branch: e.target.value })} placeholder="Chi nhánh" /></label>
            <div className={styles.fullWidth}><button className="button button-primary" disabled={busy}>Lưu tài khoản ngân hàng</button></div>
          </form>
        </article>

        <article className={styles.panel}>
          <div className={styles.sectionHeading}><div><p className={styles.kicker}>WITHDRAW</p><h2>Yêu cầu rút tiền</h2></div></div>
          <p className={styles.muted}>Sau khi gửi lệnh, số tiền sẽ được giữ chỗ. Admin chuyển khoản thực tế rồi mới duyệt; lúc đó số dư ví mới bị trừ.</p>
          <form className={styles.withdrawForm} onSubmit={requestWithdrawal}>
            <label><span>Số tiền muốn rút</span><input className={styles.input} type="number" min="1" step="1" required value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="VD: 1000000" /></label>
            <button className="button button-primary" disabled={busy || !wallet.bankAccount || wallet.wallet.availableBalance <= 0}>Gửi yêu cầu rút</button>
          </form>
          {!wallet.bankAccount && <div className={`${styles.alert} ${styles.danger}`}>Bạn cần lưu tài khoản ngân hàng trước khi rút tiền.</div>}
        </article>
      </section>

      <section className={styles.sectionBlock}>
        <div className={styles.sectionHeading}><div><p className={styles.kicker}>WITHDRAWAL HISTORY</p><h2>Lịch sử yêu cầu rút</h2></div></div>
        {!wallet.withdrawals.length ? <div className={styles.empty}>Chưa có yêu cầu rút tiền.</div> : <div className={styles.grid}>
          {wallet.withdrawals.map((item) => <article className={styles.card} key={item.id}>
            <div className={styles.cardHeader}><div><h2>{money(item.amount)}</h2><p className={styles.muted}>{item.bankName} · {item.accountNumber} · {item.accountHolderName}</p></div><span className={withdrawalStatusClass(item.status)}>{statusLabel(item.status)}</span></div>
            <div className={styles.details}>
              <div><span>Yêu cầu lúc</span><strong>{new Date(item.requestedAt).toLocaleString("vi-VN")}</strong></div>
              <div><span>Mã chuyển khoản</span><strong>{item.transferReference ?? "—"}</strong></div>
              <div><span>Xử lý lúc</span><strong>{item.reviewedAt ? new Date(item.reviewedAt).toLocaleString("vi-VN") : "—"}</strong></div>
              <div><span>Lý do từ chối</span><strong>{item.rejectionReason ?? "—"}</strong></div>
            </div>
          </article>)}
        </div>}
      </section>
    </>}

    <section className={styles.sectionBlock}>
      <div className={styles.sectionHeading}><div><p className={styles.kicker}>PAYMENT RECONCILIATION</p><h2>Thanh toán đã nhận</h2></div></div>
      {!payments.length ? <div className={styles.empty}>Chưa có giao dịch nào.</div> : <section className={styles.grid}>{payments.map((payment) => <article className={styles.card} key={payment.id}>
        <div className={styles.cardHeader}><div><p className={styles.kicker}>{payment.invoice.contract.room.property.name}</p><h2>{payment.invoice.contract.room.title}</h2><p className={styles.muted}>Khách thuê: {payment.invoice.contract.tenant.fullName} · {payment.invoice.contract.tenant.email ?? "—"}</p></div><span className={paymentStatusClass(payment.status)}>{statusLabel(payment.status)}</span></div>
        <div className={styles.amount}>{money(payment.amount)}</div>
        <div className={styles.details}><div><span>Phương thức</span><strong>{payment.provider}</strong></div><div><span>Mã SmartMotel</span><strong className={styles.code}>{payment.txnRef}</strong></div><div><span>Mã VNPAY</span><strong>{payment.gatewayTransactionNo ?? "—"}</strong></div><div><span>Ngân hàng</span><strong>{payment.bankCode ?? "—"}</strong></div><div><span>Tạo lúc</span><strong>{new Date(payment.createdAt).toLocaleString("vi-VN")}</strong></div><div><span>Thanh toán lúc</span><strong>{payment.paidAt ? new Date(payment.paidAt).toLocaleString("vi-VN") : "—"}</strong></div></div>
      </article>)}</section>}
      {pagination.totalPages > 1 && <div className={styles.actions}><button className="button button-ghost button-small" disabled={pagination.page <= 1 || loading} onClick={() => void load(pagination.page - 1)}>← Trước</button><span className={styles.muted}>Trang {pagination.page} / {pagination.totalPages}</span><button className="button button-ghost button-small" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => void load(pagination.page + 1)}>Sau →</button></div>}
    </section>
  </div></main>;
}
