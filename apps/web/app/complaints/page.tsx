"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../components/auth-provider";
import { apiFetch } from "../../lib/api";
import styles from "./phase8.module.css";
import { roleLabel } from "../../lib/ui-labels";

type ComplaintStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "REJECTED";
type Complaint = {
  id: string;
  type: string;
  description: string;
  evidenceUrl: string | null;
  status: ComplaintStatus;
  adminNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  listing: null | {
    id: string;
    title: string;
    room: { title: string; property: { name: string; address: string; district: string; city: string } };
  };
  reportedUser: { fullName: string; email: string | null } | null;
};

const labels: Record<string, string> = {
  MISLEADING: "Thông tin sai lệch",
  FRAUD: "Nghi ngờ lừa đảo",
  WRONG_PRICE: "Giá/chi phí không đúng",
  INAPPROPRIATE: "Nội dung không phù hợp",
  SAFETY: "Vấn đề an toàn",
  OTHER: "Khác",
};

const statusLabel: Record<ComplaintStatus, string> = {
  OPEN: "Chờ xử lý",
  INVESTIGATING: "Đang kiểm tra",
  RESOLVED: "Đã giải quyết",
  REJECTED: "Không chấp nhận",
};

export default function ComplaintsPage() {
  const router = useRouter();
  const { loading, firebaseUser, profile } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [listingId, setListingId] = useState("");
  const [form, setForm] = useState({ type: "MISLEADING", description: "", evidenceUrl: "" });
  const [pageLoading, setPageLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/auth/login");
  }, [firebaseUser, loading, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromQuery = new URLSearchParams(window.location.search).get("listingId");
    if (fromQuery) setListingId(fromQuery);
  }, []);

  const load = useCallback(async () => {
    if (!firebaseUser) return;
    const token = await firebaseUser.getIdToken();
    const data = await apiFetch<{ complaints: Complaint[] }>("/complaints", {}, token);
    setComplaints(data.complaints);
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) return;
    setPageLoading(true);
    load().catch((error) => setMessage(error instanceof Error ? error.message : "Không thể tải báo cáo."))
      .finally(() => setPageLoading(false));
  }, [firebaseUser, load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!firebaseUser) return;
    if (!listingId.trim()) { setMessage("Thiếu Listing ID. Hãy mở một tin phòng và bấm Báo cáo tin."); return; }
    setBusy(true);
    setMessage(null);
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/complaints/listings/${listingId.trim()}`, {
        method: "POST",
        body: JSON.stringify({
          type: form.type,
          description: form.description.trim(),
          ...(form.evidenceUrl.trim() ? { evidenceUrl: form.evidenceUrl.trim() } : {}),
        }),
      }, token);
      setForm({ type: "MISLEADING", description: "", evidenceUrl: "" });
      setMessage("Đã gửi báo cáo. Admin sẽ kiểm tra và trạng thái sẽ cập nhật tại đây.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể gửi báo cáo.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || (firebaseUser && pageLoading)) return <main className="center-screen"><p>Đang tải Trung tâm hỗ trợ…</p></main>;
  if (!profile) return null;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className="topbar">
          <Link href="/dashboard" className="brand">SmartMotel Hub</Link>
          <div className="topbar-actions">
            <Link className="button button-ghost button-small" href="/listings">Tìm phòng</Link>
            <Link className="button button-ghost button-small" href="/notifications">Thông báo</Link>
          </div>
        </nav>

        <header className={styles.header}>
          <div><p className="eyebrow">TRUNG TÂM HỖ TRỢ & AN TOÀN</p><h1>Trung tâm hỗ trợ</h1><p className="muted">Gửi phản hồi về tin đăng hoặc vấn đề trong quá trình sử dụng và theo dõi kết quả xử lý.</p></div>
          <span className={`role-badge role-${profile.role.toLowerCase()}`}>{roleLabel(profile.role)}</span>
        </header>

        {message && <div className={styles.alert}>{message}</div>}

        <div className={styles.grid}>
          <section className={styles.card}>
            <h2>Gửi báo cáo tin đăng</h2>
            <form className={styles.form} onSubmit={submit}>
              <label className={styles.field}>Listing ID
                <input className={styles.input} value={listingId} onChange={(event) => setListingId(event.target.value)} placeholder="Tự điền khi bấm Báo cáo tin ở trang chi tiết" required />
              </label>
              <label className={styles.field}>Loại báo cáo
                <select className={styles.select} value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
                  {Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </select>
              </label>
              <label className={styles.field}>Mô tả chi tiết
                <textarea className={styles.textarea} minLength={20} maxLength={5000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Mô tả điều bạn thấy bất thường, thời điểm, giá hoặc thông tin liên quan…" required />
              </label>
              <label className={styles.field}>Link bằng chứng (không bắt buộc)
                <input className={styles.input} type="url" value={form.evidenceUrl} onChange={(event) => setForm((current) => ({ ...current, evidenceUrl: event.target.value }))} placeholder="https://..." />
              </label>
              <button className={styles.primary} disabled={busy || profile.role === "ADMIN"} type="submit">{busy ? "Đang gửi…" : "Gửi báo cáo"}</button>
              {profile.role === "ADMIN" && <p className="muted">Quản trị viên xử lý phản hồi trong trung tâm quản trị và không tạo báo cáo mới tại đây.</p>}
            </form>
          </section>

          <section className={styles.card}>
            <h2>Báo cáo của tôi</h2>
            <div className={styles.list}>
              {complaints.length === 0 && <div className={styles.empty}>Bạn chưa gửi báo cáo nào.</div>}
              {complaints.map((item) => (
                <article className={styles.item} key={item.id}>
                  <div className={styles.itemTop}>
                    <div><span className="eyebrow">{labels[item.type] ?? item.type}</span><h3>{item.listing?.title ?? "Tin đăng không còn tồn tại"}</h3></div>
                    <span className={`${styles.badge} ${styles[item.status.toLowerCase()]}`}>{statusLabel[item.status]}</span>
                  </div>
                  <p className={styles.meta}>{item.listing ? `${item.listing.room.property.name} · ${item.listing.room.property.district}, ${item.listing.room.property.city}` : "—"} · {new Date(item.createdAt).toLocaleString("vi-VN")}</p>
                  <p className={styles.description}>{item.description}</p>
                  {item.evidenceUrl && <p><a href={item.evidenceUrl} target="_blank" rel="noreferrer">Mở bằng chứng ↗</a></p>}
                  {item.adminNote && <div className={styles.note}><strong>Phản hồi Admin:</strong><div>{item.adminNote}</div></div>}
                  {item.listing && <div className={styles.buttonRow} style={{ marginTop: 12 }}><Link className={styles.secondary} href={`/listings/${item.listing.id}`}>Xem tin</Link></div>}
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
