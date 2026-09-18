"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../components/auth-provider";
import { apiFetch } from "../../../lib/api";
import styles from "../../contracts/phase7.module.css";
import { statusLabel } from "../../../lib/ui-labels";

type ContractStatus = "DRAFT" | "ACTIVE" | "EXPIRED" | "TERMINATED";
type InvoiceStatus = "UNPAID" | "PAID" | "OVERDUE";

type Candidate = {
  id: string;
  tenant: { id: string; fullName: string; email: string | null; phone: string | null };
  room: {
    id: string;
    title: string;
    price: string | number;
    deposit: string | number | null;
    property: { name: string; address: string; district: string; city: string };
  };
};

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
};

type Contract = {
  id: string;
  startDate: string;
  endDate: string | null;
  monthlyRent: string | number;
  deposit: string | number | null;
  status: ContractStatus;
  terminationReason: string | null;
  renewalIntent: "NONE" | "RENEW" | "NOT_RENEW";
  renewalRequestedAt: string | null;
  renewalNote: string | null;
  previousEndDate: string | null;
  renewedAt: string | null;
  tenant: { id: string; fullName: string; email: string | null; phone: string | null };
  room: { id: string; title: string; property: { name: string; address: string; district: string; city: string } };
  invoices: Invoice[];
};

type ContractDraft = {
  appointmentId: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  deposit: string;
};

type InvoiceDraft = {
  billingMonth: string;
  dueDate: string;
  roomFee: string;
  electricityFee: string;
  waterFee: string;
  internetFee: string;
  serviceFee: string;
  otherFee: string;
};

function money(value: string | number | null) {
  if (value === null) return "—";
  return `${Number(value).toLocaleString("vi-VN")} đ`;
}

function dateLabel(value: string | null) {
  if (!value) return "Không thời hạn";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN", { timeZone: "UTC" });
}

function monthLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN", { month: "2-digit", year: "numeric", timeZone: "UTC" });
}

function contractClass(status: ContractStatus) {
  if (status === "ACTIVE") return `${styles.status} ${styles.statusActive}`;
  if (status === "DRAFT") return `${styles.status} ${styles.statusDraft}`;
  if (status === "EXPIRED") return `${styles.status} ${styles.statusExpired}`;
  return `${styles.status} ${styles.statusTerminated}`;
}

function invoiceClass(status: InvoiceStatus) {
  if (status === "PAID") return `${styles.status} ${styles.statusPaid}`;
  if (status === "OVERDUE") return `${styles.status} ${styles.statusOverdue}`;
  return `${styles.status} ${styles.statusUnpaid}`;
}

export default function LandlordContractsPage() {
  const router = useRouter();
  const { loading: authLoading, firebaseUser, profile } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [contractDraft, setContractDraft] = useState<ContractDraft>({ appointmentId: "", startDate: "", endDate: "", monthlyRent: "", deposit: "" });
  const [invoiceContractId, setInvoiceContractId] = useState<string | null>(null);
  const [invoiceDraft, setInvoiceDraft] = useState<InvoiceDraft>({ billingMonth: "", dueDate: "", roomFee: "", electricityFee: "0", waterFee: "0", internetFee: "0", serviceFee: "0", otherFee: "0" });
  const [renewalContractId, setRenewalContractId] = useState<string | null>(null);
  const [renewalEndDate, setRenewalEndDate] = useState("");
  const [renewalNote, setRenewalNote] = useState("");

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.replace("/auth/login");
    if (!authLoading && profile && profile.role !== "LANDLORD") router.replace("/forbidden");
  }, [authLoading, firebaseUser, profile, router]);

  const load = async () => {
    if (!firebaseUser || profile?.role !== "LANDLORD") return;
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const data = await apiFetch<{ contracts: Contract[]; candidates: Candidate[] }>("/landlord/contracts", {}, token);
      setContracts(data.contracts);
      setCandidates(data.candidates);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải hợp đồng.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [firebaseUser, profile?.role]);

  const selectedCandidate = useMemo(
    () => candidates.find((item) => item.id === contractDraft.appointmentId) ?? null,
    [candidates, contractDraft.appointmentId],
  );

  useEffect(() => {
    if (!selectedCandidate) return;
    setContractDraft((current) => ({
      ...current,
      monthlyRent: String(selectedCandidate.room.price),
      deposit: selectedCandidate.room.deposit === null ? "" : String(selectedCandidate.room.deposit),
    }));
  }, [selectedCandidate?.id]);

  const createContract = async () => {
    if (!firebaseUser || !contractDraft.appointmentId || !contractDraft.startDate) {
      setMessage("Hãy chọn lịch xem COMPLETED và ngày bắt đầu.");
      return;
    }
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch("/landlord/contracts", {
        method: "POST",
        body: JSON.stringify({
          appointmentId: contractDraft.appointmentId,
          startDate: contractDraft.startDate,
          ...(contractDraft.endDate ? { endDate: contractDraft.endDate } : {}),
          ...(contractDraft.monthlyRent ? { monthlyRent: Number(contractDraft.monthlyRent) } : {}),
          ...(contractDraft.deposit ? { deposit: Number(contractDraft.deposit) } : {}),
        }),
      }, token);
      setContractDraft({ appointmentId: "", startDate: "", endDate: "", monthlyRent: "", deposit: "" });
      setMessage("Đã tạo hợp đồng nháp và gửi thông báo cho khách thuê.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tạo hợp đồng.");
    }
  };

  const deleteDraft = async (contract: Contract) => {
    if (!firebaseUser || !window.confirm("Thu hồi hợp đồng nháp này?")) return;
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/landlord/contracts/${contract.id}`, { method: "DELETE" }, token);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể thu hồi hợp đồng.");
    }
  };

  const terminate = async (contract: Contract) => {
    if (!firebaseUser) return;
    const reason = window.prompt("Lý do kết thúc hợp đồng (không bắt buộc):", "Hai bên thống nhất kết thúc hợp đồng.");
    if (reason === null) return;
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/landlord/contracts/${contract.id}/terminate`, { method: "PATCH", body: JSON.stringify({ reason }) }, token);
      setMessage("Hợp đồng đã kết thúc. Phòng được đưa về trạng thái sẵn sàng và tin đăng được chuyển về bản nháp.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể kết thúc hợp đồng.");
    }
  };

  const openRenewalForm = (contract: Contract) => {
    if (!contract.endDate) return;
    const current = new Date(contract.endDate);
    current.setUTCMonth(current.getUTCMonth() + 6);
    setRenewalContractId(contract.id);
    setRenewalEndDate(current.toISOString().slice(0, 10));
    setRenewalNote("");
  };

  const renewContract = async (contract: Contract) => {
    if (!firebaseUser || !renewalEndDate) {
      setMessage("Hãy chọn ngày kết thúc mới.");
      return;
    }
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/landlord/contracts/${contract.id}/renew`, {
        method: "PATCH",
        body: JSON.stringify({
          newEndDate: renewalEndDate,
          ...(renewalNote.trim() ? { note: renewalNote.trim() } : {}),
        }),
      }, token);
      setMessage("Đã gia hạn hợp đồng và gửi thông báo cho khách thuê.");
      setRenewalContractId(null);
      setRenewalEndDate("");
      setRenewalNote("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể gia hạn hợp đồng.");
    }
  };

  const openInvoiceForm = (contract: Contract) => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    setInvoiceContractId(contract.id);
    setInvoiceDraft({
      billingMonth: month,
      dueDate: "",
      roomFee: String(contract.monthlyRent),
      electricityFee: "0",
      waterFee: "0",
      internetFee: "0",
      serviceFee: "0",
      otherFee: "0",
    });
  };

  const createInvoice = async (contract: Contract) => {
    if (!firebaseUser || !invoiceDraft.billingMonth || !invoiceDraft.dueDate) {
      setMessage("Hãy chọn tháng hóa đơn và hạn thanh toán.");
      return;
    }
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/landlord/contracts/${contract.id}/invoices`, {
        method: "POST",
        body: JSON.stringify({
          billingMonth: invoiceDraft.billingMonth,
          dueDate: invoiceDraft.dueDate,
          roomFee: Number(invoiceDraft.roomFee || 0),
          electricityFee: Number(invoiceDraft.electricityFee || 0),
          waterFee: Number(invoiceDraft.waterFee || 0),
          internetFee: Number(invoiceDraft.internetFee || 0),
          serviceFee: Number(invoiceDraft.serviceFee || 0),
          otherFee: Number(invoiceDraft.otherFee || 0),
        }),
      }, token);
      setInvoiceContractId(null);
      setMessage("Đã tạo hóa đơn và gửi thông báo cho khách thuê.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tạo hóa đơn.");
    }
  };

  const markPaid = async (invoice: Invoice) => {
    if (!firebaseUser) return;
    const paymentNote = window.prompt("Ghi chú thanh toán (không bắt buộc):", "Đã nhận thanh toán.");
    if (paymentNote === null) return;
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/landlord/invoices/${invoice.id}/paid`, { method: "PATCH", body: JSON.stringify({ paymentNote }) }, token);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xác nhận thanh toán.");
    }
  };

  if (authLoading || (loading && !contracts.length && !candidates.length)) {
    return <main className={styles.page}><div className={styles.shell}><div className={styles.empty}>Đang tải hợp đồng…</div></div></main>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className="topbar">
          <Link href="/dashboard" className="brand">SmartMotel Hub</Link>
          <div className="topbar-actions">
            <Link href="/landlord/appointments" className="button button-ghost button-small">Lịch xem</Link>
            <Link href="/notifications" className="button button-ghost button-small">Thông báo</Link>
          </div>
        </nav>

        <header className={styles.hero}>
          <div><p className={styles.kicker}>HỢP ĐỒNG & HÓA ĐƠN</p><h1>Hợp đồng & hóa đơn</h1><p>Tạo và theo dõi hợp đồng thuê, sau đó quản lý hóa đơn định kỳ cho từng khách thuê.</p></div>
        </header>

        {message && <div className={styles.alert}>{message}</div>}

        <section className={styles.form}>
          <h2>Tạo hợp đồng mới</h2>
          {!candidates.length ? <p className={styles.muted}>Chưa có lịch xem đã hoàn tất đủ điều kiện để tạo hợp đồng mới.</p> : (
            <>
              <div className={styles.formGrid}>
                <label>Lịch xem đã hoàn tất
                  <select className={styles.select} value={contractDraft.appointmentId} onChange={(event) => setContractDraft((current) => ({ ...current, appointmentId: event.target.value }))}>
                    <option value="">Chọn khách thuê / phòng</option>
                    {candidates.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.tenant.fullName} · {candidate.room.property.name} · {candidate.room.title}</option>)}
                  </select>
                </label>
                <label>Ngày bắt đầu<input className={styles.input} type="date" value={contractDraft.startDate} onChange={(event) => setContractDraft((current) => ({ ...current, startDate: event.target.value }))} /></label>
                <label>Ngày kết thúc<input className={styles.input} type="date" value={contractDraft.endDate} onChange={(event) => setContractDraft((current) => ({ ...current, endDate: event.target.value }))} /></label>
                <label>Tiền thuê / tháng<input className={styles.input} type="number" min="0" value={contractDraft.monthlyRent} onChange={(event) => setContractDraft((current) => ({ ...current, monthlyRent: event.target.value }))} /></label>
                <label>Tiền cọc<input className={styles.input} type="number" min="0" value={contractDraft.deposit} onChange={(event) => setContractDraft((current) => ({ ...current, deposit: event.target.value }))} /></label>
              </div>
              {selectedCandidate && <p className={styles.muted}>Khách thuê: {selectedCandidate.tenant.fullName} · {selectedCandidate.room.property.address}, {selectedCandidate.room.property.district}, {selectedCandidate.room.property.city}</p>}
              <div className={styles.actions}><button className={styles.primary} onClick={() => void createContract()} type="button">Tạo hợp đồng</button></div>
            </>
          )}
        </section>

        {!contracts.length ? <div className={styles.empty}>Chưa có hợp đồng nào.</div> : (
          <section className={styles.grid}>
            {contracts.map((contract) => (
              <article className={styles.card} key={contract.id}>
                <p className={styles.kicker}>{contract.room.property.name}</p>
                <h2>{contract.room.title}</h2>
                <p className={styles.muted}>Khách thuê: {contract.tenant.fullName} · {contract.tenant.phone || contract.tenant.email || "—"}</p>
                <span className={contractClass(contract.status)}>{statusLabel(contract.status)}</span>

                <div className={styles.details}>
                  <div><span>Bắt đầu</span><strong>{dateLabel(contract.startDate)}</strong></div>
                  <div><span>Kết thúc</span><strong>{dateLabel(contract.endDate)}</strong></div>
                  <div><span>Tiền thuê</span><strong>{money(contract.monthlyRent)}</strong></div>
                  <div><span>Tiền cọc</span><strong>{money(contract.deposit)}</strong></div>
                </div>

                {contract.status === "ACTIVE" && contract.renewalIntent === "RENEW" && (
                  <div className={styles.alert}>
                    <strong>Khách thuê yêu cầu gia hạn.</strong> {contract.renewalNote ? `Ghi chú: ${contract.renewalNote}` : "Hãy chọn ngày kết thúc mới nếu hai bên đồng ý."}
                  </div>
                )}
                {contract.status === "ACTIVE" && contract.renewalIntent === "NOT_RENEW" && (
                  <div className={styles.alert}>
                    <strong>Khách thuê chọn không gia hạn.</strong> Hợp đồng sẽ tự chuyển sang trạng thái hết hạn vào ngày {dateLabel(contract.endDate)} nếu không kết thúc sớm.
                  </div>
                )}
                {contract.renewedAt && contract.previousEndDate && (
                  <p className={styles.muted}>Gia hạn gần nhất: {dateLabel(contract.previousEndDate)} → {dateLabel(contract.endDate)}.</p>
                )}

                <div className={styles.actions}>
                  {contract.status === "DRAFT" && <button className={styles.danger} type="button" onClick={() => void deleteDraft(contract)}>Thu hồi bản nháp</button>}
                  {contract.status === "ACTIVE" && <button className={styles.secondary} type="button" onClick={() => openInvoiceForm(contract)}>+ Tạo hóa đơn</button>}
                  {contract.status === "ACTIVE" && contract.renewalIntent === "RENEW" && <button className={styles.primary} type="button" onClick={() => openRenewalForm(contract)}>Gia hạn hợp đồng</button>}
                  {contract.status === "ACTIVE" && <button className={styles.danger} type="button" onClick={() => void terminate(contract)}>Kết thúc hợp đồng</button>}
                </div>

                {renewalContractId === contract.id && contract.status === "ACTIVE" && contract.renewalIntent === "RENEW" && (
                  <div className={styles.form} style={{ marginTop: 16, marginBottom: 0 }}>
                    <h3>Gia hạn hợp đồng</h3>
                    <p className={styles.muted}>Ngày hiện tại: {dateLabel(contract.endDate)}. Ngày mới phải lớn hơn ngày hiện tại.</p>
                    <div className={styles.formGrid}>
                      <label>Ngày kết thúc mới<input className={styles.input} type="date" value={renewalEndDate} onChange={(event) => setRenewalEndDate(event.target.value)} /></label>
                      <label>Ghi chú cho khách thuê<input className={styles.input} value={renewalNote} maxLength={1500} onChange={(event) => setRenewalNote(event.target.value)} placeholder="VD: Gia hạn thêm 6 tháng" /></label>
                    </div>
                    <div className={styles.actions}>
                      <button className={styles.primary} type="button" onClick={() => void renewContract(contract)}>Xác nhận gia hạn</button>
                      <button className={styles.ghost} type="button" onClick={() => setRenewalContractId(null)}>Đóng</button>
                    </div>
                  </div>
                )}

                {invoiceContractId === contract.id && contract.status === "ACTIVE" && (
                  <div className={styles.form} style={{ marginTop: 16, marginBottom: 0 }}>
                    <h3>Hóa đơn mới</h3>
                    <div className={styles.formGrid}>
                      <label>Tháng<input className={styles.input} type="month" value={invoiceDraft.billingMonth} onChange={(event) => setInvoiceDraft((current) => ({ ...current, billingMonth: event.target.value }))} /></label>
                      <label>Hạn thanh toán<input className={styles.input} type="date" value={invoiceDraft.dueDate} onChange={(event) => setInvoiceDraft((current) => ({ ...current, dueDate: event.target.value }))} /></label>
                      <label>Tiền phòng<input className={styles.input} type="number" min="0" value={invoiceDraft.roomFee} onChange={(event) => setInvoiceDraft((current) => ({ ...current, roomFee: event.target.value }))} /></label>
                      <label>Điện<input className={styles.input} type="number" min="0" value={invoiceDraft.electricityFee} onChange={(event) => setInvoiceDraft((current) => ({ ...current, electricityFee: event.target.value }))} /></label>
                      <label>Nước<input className={styles.input} type="number" min="0" value={invoiceDraft.waterFee} onChange={(event) => setInvoiceDraft((current) => ({ ...current, waterFee: event.target.value }))} /></label>
                      <label>Internet<input className={styles.input} type="number" min="0" value={invoiceDraft.internetFee} onChange={(event) => setInvoiceDraft((current) => ({ ...current, internetFee: event.target.value }))} /></label>
                      <label>Dịch vụ<input className={styles.input} type="number" min="0" value={invoiceDraft.serviceFee} onChange={(event) => setInvoiceDraft((current) => ({ ...current, serviceFee: event.target.value }))} /></label>
                      <label>Khác<input className={styles.input} type="number" min="0" value={invoiceDraft.otherFee} onChange={(event) => setInvoiceDraft((current) => ({ ...current, otherFee: event.target.value }))} /></label>
                    </div>
                    <div className={styles.actions}><button className={styles.primary} type="button" onClick={() => void createInvoice(contract)}>Tạo hóa đơn</button><button className={styles.ghost} type="button" onClick={() => setInvoiceContractId(null)}>Đóng</button></div>
                  </div>
                )}

                {!!contract.invoices.length && (
                  <div className={styles.invoiceList}>
                    {contract.invoices.map((invoice) => (
                      <div className={styles.invoice} key={invoice.id}>
                        <div className={styles.invoiceTop}><strong>{monthLabel(invoice.billingMonth)}</strong><span className={invoiceClass(invoice.status)}>{statusLabel(invoice.status)}</span></div>
                        <div className={styles.invoiceTotal}>{money(invoice.total)}</div>
                        <p className={styles.muted}>Hạn: {dateLabel(invoice.dueDate)}</p>
                        {(invoice.status === "UNPAID" || invoice.status === "OVERDUE") && <button className={styles.secondary} type="button" onClick={() => void markPaid(invoice)}>Xác nhận đã thanh toán</button>}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
