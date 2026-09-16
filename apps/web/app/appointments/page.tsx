"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../components/auth-provider";
import { apiFetch } from "../../lib/api";
import styles from "./phase6.module.css";

type AppointmentStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

type Appointment = {
  id: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  tenantNote: string | null;
  landlordNote: string | null;
  landlord: { fullName: string; email: string | null; phone: string | null };
  room: {
    id: string;
    title: string;
    property: { id: string; name: string; address: string; district: string; city: string };
    listings: { id: string; title: string; images: { id: string; url: string }[] }[];
  };
};

type ReviewDraft = {
  overallRating: number;
  landlordRating: number;
  securityRating: number;
  noiseRating: number;
  costRating: number;
  comment: string;
};

const statusLabels: Record<AppointmentStatus, string> = {
  PENDING: "Chờ chủ nhà xác nhận",
  CONFIRMED: "Đã xác nhận",
  REJECTED: "Bị từ chối",
  CANCELLED: "Đã hủy",
  COMPLETED: "Đã hoàn tất",
  NO_SHOW: "Không đến",
};

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN", { timeZone: "UTC" });
}

function timeLabel(value: string) {
  if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(11, 16);
}

function statusClass(status: AppointmentStatus) {
  if (status === "PENDING") return styles.statusPending;
  if (status === "CONFIRMED") return styles.statusConfirmed;
  if (status === "COMPLETED") return styles.statusCompleted;
  if (status === "REJECTED") return styles.statusRejected;
  if (status === "CANCELLED") return styles.statusCancelled;
  return styles.statusNoShow;
}

function defaultReview(): ReviewDraft {
  return {
    overallRating: 5,
    landlordRating: 5,
    securityRating: 5,
    noiseRating: 5,
    costRating: 5,
    comment: "",
  };
}

export default function TenantAppointmentsPage() {
  const router = useRouter();
  const { loading: authLoading, firebaseUser, profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [reviewedPropertyIds, setReviewedPropertyIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | AppointmentStatus>("ALL");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewDraft, setReviewDraft] = useState<ReviewDraft>(defaultReview());

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.replace("/auth/login");
    if (!authLoading && profile && profile.role !== "TENANT") router.replace("/forbidden");
  }, [authLoading, firebaseUser, profile, router]);

  const load = async () => {
    if (!firebaseUser || profile?.role !== "TENANT") return;
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const data = await apiFetch<{ appointments: Appointment[]; reviewedPropertyIds: string[] }>("/appointments", {}, token);
      setAppointments(data.appointments);
      setReviewedPropertyIds(data.reviewedPropertyIds);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải lịch xem phòng.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [firebaseUser, profile?.role]);

  const visible = useMemo(
    () => appointments.filter((appointment) => filter === "ALL" || appointment.status === filter),
    [appointments, filter],
  );

  const cancel = async (id: string) => {
    if (!firebaseUser || !window.confirm("Bạn chắc chắn muốn hủy lịch xem này?")) return;
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/appointments/${id}/cancel`, { method: "PATCH" }, token);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể hủy lịch xem.");
    }
  };

  const submitReview = async (appointment: Appointment) => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(
        `/reviews/properties/${appointment.room.property.id}`,
        { method: "POST", body: JSON.stringify(reviewDraft) },
        token,
      );
      setReviewingId(null);
      setReviewDraft(defaultReview());
      setMessage("Đánh giá đã được đăng thành công.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể gửi đánh giá.");
    }
  };

  if (authLoading || (loading && !appointments.length)) {
    return <main className={styles.page}><div className={styles.shell}><div className={styles.empty}>Đang tải lịch xem phòng…</div></div></main>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className="topbar">
          <Link href="/dashboard" className="brand">SmartMotel Hub</Link>
          <div className="topbar-actions">
            <Link href="/listings" className="button button-ghost button-small">Tìm phòng</Link>
            <Link href="/favorites" className="button button-ghost button-small">Phòng đã lưu</Link>
          </div>
        </nav>

        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>PHASE 6 · APPOINTMENTS & REVIEWS</p>
            <h1>Lịch xem phòng của tôi</h1>
            <p>Theo dõi yêu cầu, xác nhận của chủ nhà và đánh giá sau khi lịch xem hoàn tất.</p>
          </div>
        </header>

        {message && <div className={message.includes("thành công") ? styles.success : styles.alert}>{message}</div>}

        <div className={styles.toolbar}>
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            <option value="ALL">Tất cả trạng thái</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className={styles.ghost} onClick={() => void load()} type="button">Làm mới</button>
        </div>

        {!visible.length ? (
          <div className={styles.empty}>Chưa có lịch xem phù hợp. Hãy mở một tin phòng và bấm “Đặt lịch xem phòng”.</div>
        ) : (
          <section className={styles.grid}>
            {visible.map((appointment) => {
              const property = appointment.room.property;
              const listing = appointment.room.listings[0];
              const reviewed = reviewedPropertyIds.includes(property.id);
              const canReview = appointment.status === "COMPLETED" && !reviewed;
              return (
                <article className={styles.card} key={appointment.id}>
                  <div className={styles.cardTop}>
                    <div>
                      <p className={styles.kicker}>{property.name}</p>
                      <h2>{appointment.room.title}</h2>
                      <p className={styles.muted}>{property.address}, {property.district}, {property.city}</p>
                    </div>
                    <span className={`${styles.status} ${statusClass(appointment.status)}`}>{statusLabels[appointment.status]}</span>
                  </div>

                  <div className={styles.detailGrid}>
                    <div className={styles.detailItem}><span>Ngày</span><strong>{dateLabel(appointment.appointmentDate)}</strong></div>
                    <div className={styles.detailItem}><span>Khung giờ</span><strong>{timeLabel(appointment.startTime)} – {timeLabel(appointment.endTime)}</strong></div>
                    <div className={styles.detailItem}><span>Chủ nhà</span><strong>{appointment.landlord.fullName}</strong></div>
                    <div className={styles.detailItem}><span>Liên hệ</span><strong>{appointment.landlord.phone || appointment.landlord.email || "—"}</strong></div>
                  </div>

                  {appointment.tenantNote && <div className={styles.note}><strong>Ghi chú của bạn:</strong> {appointment.tenantNote}</div>}
                  {appointment.landlordNote && <div className={styles.note}><strong>Phản hồi chủ nhà:</strong> {appointment.landlordNote}</div>}

                  <div className={styles.actions}>
                    {listing && <Link className={styles.ghost} href={`/listings/${listing.id}`}>Xem lại tin phòng</Link>}
                    {(appointment.status === "PENDING" || appointment.status === "CONFIRMED") && (
                      <button className={styles.danger} onClick={() => void cancel(appointment.id)} type="button">Hủy lịch</button>
                    )}
                    {canReview && (
                      <button className={styles.primary} onClick={() => { setReviewingId(appointment.id); setReviewDraft(defaultReview()); }} type="button">Đánh giá nhà trọ</button>
                    )}
                    {appointment.status === "COMPLETED" && reviewed && <span className={styles.muted}>Bạn đã đánh giá nhà trọ này.</span>}
                  </div>

                  {reviewingId === appointment.id && canReview && (
                    <div className={styles.reviewBox}>
                      <h3>Đánh giá trải nghiệm</h3>
                      <div className={styles.reviewGrid}>
                        {([
                          ["overallRating", "Tổng thể"],
                          ["landlordRating", "Chủ nhà"],
                          ["securityRating", "An ninh"],
                          ["noiseRating", "Yên tĩnh"],
                          ["costRating", "Chi phí"],
                        ] as const).map(([key, label]) => (
                          <label className={styles.reviewField} key={key}>{label}
                            <select className={styles.select} value={reviewDraft[key]} onChange={(event) => setReviewDraft((current) => ({ ...current, [key]: Number(event.target.value) }))}>
                              {[5, 4, 3, 2, 1].map((value) => <option value={value} key={value}>{value}/5</option>)}
                            </select>
                          </label>
                        ))}
                      </div>
                      <textarea className={styles.textarea} maxLength={1500} placeholder="Chia sẻ trải nghiệm thực tế của bạn…" value={reviewDraft.comment} onChange={(event) => setReviewDraft((current) => ({ ...current, comment: event.target.value }))} />
                      <div className={styles.actions}>
                        <button className={styles.primary} onClick={() => void submitReview(appointment)} type="button">Đăng đánh giá</button>
                        <button className={styles.ghost} onClick={() => setReviewingId(null)} type="button">Đóng</button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
