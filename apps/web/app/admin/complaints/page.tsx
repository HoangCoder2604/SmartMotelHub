"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../components/auth-provider";
import { apiFetch } from "../../../lib/api";
import styles from "../../complaints/phase8.module.css";

type Status = "OPEN" | "INVESTIGATING" | "RESOLVED" | "REJECTED";
type Complaint = {
  id: string;
  type: string;
  description: string;
  evidenceUrl: string | null;
  status: Status;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
  reporter: { id: string; fullName: string; email: string | null; role: string };
  reportedUser: { id: string; fullName: string; email: string | null; role: string } | null;
  assignedAdmin: { id: string; fullName: string; email: string | null } | null;
  listing: null | { id: string; title: string; status: string; room: { title: string; property: { name: string; address: string; district: string; city: string } } };
};
type Stats = { open: number; investigating: number; resolved: number; rejected: number };

const statusText: Record<Status, string> = { OPEN: "Chờ xử lý", INVESTIGATING: "Đang kiểm tra", RESOLVED: "Đã giải quyết", REJECTED: "Bác bỏ" };

export default function AdminComplaintsPage() {
  const router = useRouter();
  const { loading, firebaseUser, profile } = useAuth();
  const [items, setItems] = useState<Complaint[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<"ALL" | Status>("OPEN");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/auth/login");
    else if (!loading && profile && profile.role !== "ADMIN") router.replace("/dashboard");
  }, [firebaseUser, loading, profile, router]);

  const getToken = useCallback(async () => {
    if (!firebaseUser) throw new Error("Chưa đăng nhập.");
    return firebaseUser.getIdToken();
  }, [firebaseUser]);

  const load = useCallback(async () => {
    if (profile?.role !== "ADMIN") return;
    const token = await getToken();
    const params = new URLSearchParams({ limit: "100" });
    if (status !== "ALL") params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    const [listData, statData] = await Promise.all([
      apiFetch<{ complaints: Complaint[] }>(`/admin/complaints?${params.toString()}`, {}, token),
      apiFetch<Stats>("/admin/complaints/stats", {}, token),
    ]);
    setItems(listData.complaints);
    setStats(statData);
  }, [getToken, profile?.role, search, status]);

  useEffect(() => {
    if (profile?.role !== "ADMIN") return;
    setPageLoading(true);
    load().catch((error) => setMessage(error instanceof Error ? error.message : "Không thể tải báo cáo."))
      .finally(() => setPageLoading(false));
  }, [load, profile?.role]);

  const action = async (item: Complaint, actionName: "investigate" | "resolve" | "reject") => {
    let body: string | undefined;
    if (actionName !== "investigate") {
      const adminNote = window.prompt(actionName === "resolve" ? "Nhập kết luận/biện pháp xử lý:" : "Nhập lý do bác bỏ:");
      if (!adminNote) return;
      if (adminNote.trim().length < 5) { setMessage("Ghi chú Admin phải có ít nhất 5 ký tự."); return; }
      body = JSON.stringify({ adminNote: adminNote.trim() });
    }

    setBusy(`${actionName}-${item.id}`);
    setMessage(null);
    try {
      const token = await getToken();
      await apiFetch(`/admin/complaints/${item.id}/${actionName}`, { method: "PATCH", ...(body ? { body } : {}) }, token);
      setMessage(actionName === "investigate" ? "Đã nhận xử lý báo cáo." : actionName === "resolve" ? "Đã giải quyết báo cáo." : "Đã bác bỏ báo cáo.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật báo cáo.");
    } finally {
      setBusy(null);
    }
  };

  if (loading || (profile?.role === "ADMIN" && pageLoading && !stats)) return <main className="center-screen"><p>Đang tải Trust & Safety…</p></main>;
  if (!profile || profile.role !== "ADMIN") return null;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className="topbar">
          <Link href="/admin" className="brand">← Admin Console</Link>
          <div className="topbar-actions"><Link className="button button-ghost button-small" href="/dashboard">Dashboard</Link><Link className="button button-ghost button-small" href="/notifications">Thông báo</Link></div>
        </nav>

        <header className={styles.header}>
          <div><p className="eyebrow">PHASE 8 · ADMIN TRUST & SAFETY</p><h1>Quản lý báo cáo</h1><p className="muted">Tiếp nhận, nhận xử lý, giải quyết hoặc bác bỏ báo cáo của người dùng.</p></div>
          <span className="role-badge role-admin">ADMIN</span>
        </header>

        {message && <div className={styles.alert}>{message}</div>}
        {stats && <section className={styles.stats}><article><span>OPEN</span><strong>{stats.open}</strong></article><article><span>INVESTIGATING</span><strong>{stats.investigating}</strong></article><article><span>RESOLVED</span><strong>{stats.resolved}</strong></article><article><span>REJECTED</span><strong>{stats.rejected}</strong></article></section>}

        <section className={styles.card}>
          <div className={styles.toolbar}>
            <input className={styles.input} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mô tả, người báo cáo, tiêu đề tin…" />
            <select className={styles.select} value={status} onChange={(event) => setStatus(event.target.value as "ALL" | Status)}>
              <option value="ALL">Tất cả trạng thái</option><option value="OPEN">OPEN</option><option value="INVESTIGATING">INVESTIGATING</option><option value="RESOLVED">RESOLVED</option><option value="REJECTED">REJECTED</option>
            </select>
            <button className={styles.secondary} onClick={() => void load()} type="button">Làm mới</button>
          </div>

          <div className={styles.list}>
            {items.length === 0 && <div className={styles.empty}>Không có báo cáo phù hợp.</div>}
            {items.map((item) => (
              <article className={styles.item} key={item.id}>
                <div className={styles.itemTop}>
                  <div><span className="eyebrow">{item.type}</span><h3>{item.listing?.title ?? "Tin đăng đã bị xóa"}</h3></div>
                  <span className={`${styles.badge} ${styles[item.status.toLowerCase()]}`}>{statusText[item.status]}</span>
                </div>
                <p className={styles.meta}>Người báo cáo: <strong>{item.reporter.fullName}</strong> ({item.reporter.email ?? "không email"}) · Người bị báo cáo: <strong>{item.reportedUser?.fullName ?? "—"}</strong></p>
                {item.listing && <p className={styles.meta}>{item.listing.room.property.name} · {item.listing.room.property.address}, {item.listing.room.property.district}, {item.listing.room.property.city} · Listing {item.listing.status}</p>}
                <p className={styles.description}>{item.description}</p>
                {item.evidenceUrl && <p><a href={item.evidenceUrl} target="_blank" rel="noreferrer">Mở bằng chứng ↗</a></p>}
                {item.assignedAdmin && <p className={styles.meta}>Admin xử lý: {item.assignedAdmin.fullName}</p>}
                {item.adminNote && <div className={styles.note}><strong>Kết luận:</strong><div>{item.adminNote}</div></div>}
                <div className={styles.buttonRow} style={{ marginTop: 14 }}>
                  {item.listing && <Link className={styles.secondary} href={`/listings/${item.listing.id}`}>Xem tin</Link>}
                  {item.status === "OPEN" && <button className={styles.secondary} disabled={busy !== null} onClick={() => void action(item, "investigate")}>Nhận xử lý</button>}
                  {(item.status === "OPEN" || item.status === "INVESTIGATING") && <button className={styles.primary} disabled={busy !== null} onClick={() => void action(item, "resolve")}>Giải quyết</button>}
                  {(item.status === "OPEN" || item.status === "INVESTIGATING") && <button className={styles.danger} disabled={busy !== null} onClick={() => void action(item, "reject")}>Bác bỏ</button>}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
