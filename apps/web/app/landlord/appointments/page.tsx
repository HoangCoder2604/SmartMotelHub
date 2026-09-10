"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../components/auth-provider";
import { apiFetch } from "../../../lib/api";
import styles from "../../appointments/phase6.module.css";

type AppointmentStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

type Appointment = {
  id: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  tenantNote: string | null;
  landlordNote: string | null;
  tenant: { fullName: string; email: string | null; phone: string | null };
  room: {
    title: string;
    property: { name: string; address: string; district: string; city: string };
    listings: { id: string; title: string }[];
  };
};

const labels: Record<AppointmentStatus, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  REJECTED: "Đã từ chối",
  CANCELLED: "Khách đã hủy",
  COMPLETED: "Đã hoàn tất",
  NO_SHOW: "Khách không đến",
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

export default function LandlordAppointmentsPage() {
  const router = useRouter();
  const { loading: authLoading, firebaseUser, profile } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | AppointmentStatus>("ALL");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.replace("/auth/login");
    if (!authLoading && profile && profile.role !== "LANDLORD") router.replace("/dashboard");
  }, [authLoading, firebaseUser, profile, router]);

  const load = async () => {
    if (!firebaseUser || profile?.role !== "LANDLORD") return;
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const data = await apiFetch<{ appointments: Appointment[] }>("/landlord/appointments", {}, token);
      setAppointments(data.appointments);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải lịch hẹn.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [firebaseUser, profile?.role]);

  const visible = useMemo(
    () => appointments.filter((appointment) => filter === "ALL" || appointment.status === filter),
    [appointments, filter],
  );

  const action = async (appointment: Appointment, kind: "confirm" | "reject" | "complete" | "no-show") => {
    if (!firebaseUser) return;
    let body: string | undefined;
    if (kind === "reject") {
      const note = window.prompt("Lý do từ chối (không bắt buộc):", "Khung giờ này chưa phù hợp, vui lòng chọn lịch khác.");
      if (note === null) return;
      body = JSON.stringify({ landlordNote: note });
    }

    if ((kind === "complete" || kind === "no-show") && !window.confirm(kind === "complete" ? "Xác nhận lịch xem đã hoàn tất?" : "Xác nhận khách không đến?")) return;

    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/landlord/appointments/${appointment.id}/${kind}`, { method: "PATCH", ...(body ? { body } : {}) }, token);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật lịch hẹn.");
    }
  };

  if (authLoading || (loading && !appointments.length)) {
    return <main className={styles.page}><div className={styles.shell}><div className={styles.empty}>Đang tải lịch xem của khách…</div></div></main>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className="topbar">
          <Link href="/dashboard" className="brand">SmartMotel Hub</Link>
          <div className="topbar-actions"><Link href="/landlord/properties" className="button button-ghost button-small">Nhà trọ & phòng</Link></div>
        </nav>

        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>LANDLORD · APPOINTMENTS</p>
            <h1>Lịch xem phòng</h1>
            <p>Xác nhận yêu cầu của TENANT, đánh dấu hoàn tất hoặc không đến sau buổi xem.</p>
          </div>
        </header>

        {message && <div className={styles.alert}>{message}</div>}

        <div className={styles.toolbar}>
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            <option value="ALL">Tất cả trạng thái</option>
            {Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
          <button className={styles.ghost} onClick={() => void load()} type="button">Làm mới</button>
        </div>

        {!visible.length ? <div className={styles.empty}>Chưa có lịch xem phòng phù hợp.</div> : (
          <section className={styles.grid}>
            {visible.map((appointment) => (
              <article className={styles.card} key={appointment.id}>
                <div className={styles.cardTop}>
                  <div>
                    <p className={styles.kicker}>{appointment.room.property.name}</p>
                    <h2>{appointment.room.title}</h2>
                    <p className={styles.muted}>{appointment.room.property.address}, {appointment.room.property.district}, {appointment.room.property.city}</p>
                  </div>
                  <span className={`${styles.status} ${statusClass(appointment.status)}`}>{labels[appointment.status]}</span>
                </div>

                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}><span>Ngày</span><strong>{dateLabel(appointment.appointmentDate)}</strong></div>
                  <div className={styles.detailItem}><span>Khung giờ</span><strong>{timeLabel(appointment.startTime)} – {timeLabel(appointment.endTime)}</strong></div>
                  <div className={styles.detailItem}><span>Khách xem</span><strong>{appointment.tenant.fullName}</strong></div>
                  <div className={styles.detailItem}><span>Liên hệ</span><strong>{appointment.tenant.phone || appointment.tenant.email || "—"}</strong></div>
                </div>

                {appointment.tenantNote && <div className={styles.note}><strong>Lời nhắn TENANT:</strong> {appointment.tenantNote}</div>}
                {appointment.landlordNote && <div className={styles.note}><strong>Phản hồi của bạn:</strong> {appointment.landlordNote}</div>}

                <div className={styles.actions}>
                  {appointment.status === "PENDING" && <button className={styles.secondary} onClick={() => void action(appointment, "confirm")} type="button">Xác nhận</button>}
                  {appointment.status === "PENDING" && <button className={styles.danger} onClick={() => void action(appointment, "reject")} type="button">Từ chối</button>}
                  {appointment.status === "CONFIRMED" && <button className={styles.secondary} onClick={() => void action(appointment, "complete")} type="button">Đánh dấu hoàn tất</button>}
                  {appointment.status === "CONFIRMED" && <button className={styles.danger} onClick={() => void action(appointment, "no-show")} type="button">Khách không đến</button>}
                  {appointment.room.listings[0] && <Link className={styles.ghost} href={`/listings/${appointment.room.listings[0].id}`}>Xem tin phòng</Link>}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
