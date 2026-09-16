"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../components/auth-provider";
import { apiFetch } from "../../lib/api";
import styles from "./phase7.module.css";

type ContractStatus = "DRAFT" | "ACTIVE" | "EXPIRED" | "TERMINATED";

type Contract = {
  id: string;
  startDate: string;
  endDate: string | null;
  monthlyRent: string | number;
  deposit: string | number | null;
  status: ContractStatus;
  tenantAcceptedAt: string | null;
  activatedAt: string | null;
  terminatedAt: string | null;
  terminationReason: string | null;
  landlord: { fullName: string; email: string | null; phone: string | null };
  room: { title: string; property: { name: string; address: string; district: string; city: string } };
  invoices: { id: string; status: string }[];
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

function statusClass(status: ContractStatus) {
  if (status === "ACTIVE") return `${styles.status} ${styles.statusActive}`;
  if (status === "DRAFT") return `${styles.status} ${styles.statusDraft}`;
  if (status === "EXPIRED") return `${styles.status} ${styles.statusExpired}`;
  return `${styles.status} ${styles.statusTerminated}`;
}

export default function TenantContractsPage() {
  const router = useRouter();
  const { loading: authLoading, firebaseUser, profile } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.replace("/auth/login");
    if (!authLoading && profile && profile.role !== "TENANT") router.replace("/forbidden");
  }, [authLoading, firebaseUser, profile, router]);

  const load = async () => {
    if (!firebaseUser || profile?.role !== "TENANT") return;
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const data = await apiFetch<{ contracts: Contract[] }>("/contracts", {}, token);
      setContracts(data.contracts);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải hợp đồng.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [firebaseUser, profile?.role]);

  const accept = async (contract: Contract) => {
    if (!firebaseUser) return;
    if (!window.confirm("Bạn xác nhận chấp nhận hợp đồng này? Phòng sẽ chuyển sang trạng thái đã thuê.")) return;
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/contracts/${contract.id}/accept`, { method: "PATCH" }, token);
      setMessage("Hợp đồng đã ACTIVE.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể chấp nhận hợp đồng.");
    }
  };

  if (authLoading || (loading && !contracts.length)) {
    return <main className={styles.page}><div className={styles.shell}><div className={styles.empty}>Đang tải hợp đồng…</div></div></main>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className="topbar">
          <Link href="/dashboard" className="brand">SmartMotel Hub</Link>
          <div className="topbar-actions">
            <Link href="/invoices" className="button button-ghost button-small">Hóa đơn</Link>
            <Link href="/notifications" className="button button-ghost button-small">Thông báo</Link>
          </div>
        </nav>

        <header className={styles.hero}>
          <div><p className={styles.kicker}>TENANT · CONTRACTS</p><h1>Hợp đồng thuê</h1><p>Xem đề nghị hợp đồng từ chủ nhà và chấp nhận khi thông tin đã chính xác.</p></div>
        </header>

        {message && <div className={styles.alert}>{message}</div>}

        {!contracts.length ? <div className={styles.empty}>Bạn chưa có hợp đồng thuê nào.</div> : (
          <section className={styles.grid}>
            {contracts.map((contract) => (
              <article className={styles.card} key={contract.id}>
                <p className={styles.kicker}>{contract.room.property.name}</p>
                <h2>{contract.room.title}</h2>
                <p className={styles.muted}>{contract.room.property.address}, {contract.room.property.district}, {contract.room.property.city}</p>
                <span className={statusClass(contract.status)}>{contract.status}</span>

                <div className={styles.details}>
                  <div><span>Ngày bắt đầu</span><strong>{dateLabel(contract.startDate)}</strong></div>
                  <div><span>Ngày kết thúc</span><strong>{dateLabel(contract.endDate)}</strong></div>
                  <div><span>Tiền thuê / tháng</span><strong>{money(contract.monthlyRent)}</strong></div>
                  <div><span>Tiền cọc</span><strong>{money(contract.deposit)}</strong></div>
                  <div><span>Chủ nhà</span><strong>{contract.landlord.fullName}</strong></div>
                  <div><span>Liên hệ</span><strong>{contract.landlord.phone || contract.landlord.email || "—"}</strong></div>
                </div>

                {contract.status === "DRAFT" && <div className={styles.alert}>Đây là hợp đồng nháp đang chờ bạn chấp nhận. Hãy kiểm tra kỹ tiền thuê, cọc và thời hạn.</div>}
                {contract.terminationReason && <div className={styles.alert}><strong>Lý do kết thúc:</strong> {contract.terminationReason}</div>}

                <div className={styles.actions}>
                  {contract.status === "DRAFT" && <button className={styles.primary} onClick={() => void accept(contract)} type="button">Chấp nhận hợp đồng</button>}
                  <Link className={styles.ghost} href="/invoices">Xem hóa đơn ({contract.invoices.length})</Link>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
