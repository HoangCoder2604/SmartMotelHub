"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../components/auth-provider";
import { apiFetch } from "../../lib/api";
import {
  disablePushNotifications,
  enablePushNotifications,
  pushConfigured,
} from "../../lib/push-notifications";
import styles from "../contracts/phase7.module.css";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};
type Pagination = { page: number; limit: number; total: number; totalPages: number };
type PushStatus = { registeredDevices: number };

export default function NotificationsPage() {
  const router = useRouter();
  const { loading: authLoading, firebaseUser } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [registeredDevices, setRegisteredDevices] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pushBusy, setPushBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.replace("/auth/login");
  }, [authLoading, firebaseUser, router]);

  const browserPermission = useMemo(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
    return Notification.permission;
  }, [pushBusy]);

  const load = async (page = pagination.page || 1) => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const [notificationData, pushData] = await Promise.all([
        apiFetch<{ items: NotificationItem[]; unreadCount: number; pagination: Pagination }>(`/notifications?page=${page}&limit=20`, {}, token),
        apiFetch<PushStatus>("/notifications/push/status", {}, token),
      ]);
      setItems(notificationData.items);
      setUnreadCount(notificationData.unreadCount);
      setPagination(notificationData.pagination);
      setRegisteredDevices(pushData.registeredDevices);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải thông báo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser]);

  const markRead = async (item: NotificationItem) => {
    if (!firebaseUser || item.readAt) return;
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/notifications/${item.id}/read`, { method: "PATCH" }, token);
      setItems((current) => current.map((value) => value.id === item.id ? { ...value, readAt: new Date().toISOString() } : value));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật thông báo.");
    }
  };

  const markAll = async () => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch("/notifications/read-all", { method: "PATCH" }, token);
      const now = new Date().toISOString();
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? now })));
      setUnreadCount(0);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể đánh dấu đã đọc.");
    }
  };

  const deleteOne = async (item: NotificationItem) => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/notifications/${item.id}`, { method: "DELETE" }, token);
      const nextPage = items.length === 1 && pagination.page > 1 ? pagination.page - 1 : pagination.page;
      await load(nextPage);
      setMessage("Đã xóa thông báo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xóa thông báo.");
    }
  };

  const deleteRead = async () => {
    if (!firebaseUser) return;
    if (!window.confirm("Xóa toàn bộ thông báo đã đọc của tài khoản?")) return;
    try {
      const token = await firebaseUser.getIdToken();
      const result = await apiFetch<{ deletedCount: number }>("/notifications/read", { method: "DELETE" }, token);
      await load(1);
      setMessage(`Đã xóa ${result.deletedCount} thông báo đã đọc.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xóa thông báo đã đọc.");
    }
  };

  const deleteAll = async () => {
    if (!firebaseUser || pagination.total === 0) return;
    if (!window.confirm("Bạn có chắc muốn xóa toàn bộ thông báo của tài khoản này?")) return;
    try {
      const token = await firebaseUser.getIdToken();
      const result = await apiFetch<{ deletedCount: number }>("/notifications/all", { method: "DELETE" }, token);
      await load(1);
      setMessage(`Đã xóa ${result.deletedCount} thông báo.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xóa toàn bộ thông báo.");
    }
  };

  const enablePush = async () => {
    if (!firebaseUser) return;
    setPushBusy(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      const result = await enablePushNotifications(idToken);
      if (result.permission === "granted" && result.registered) {
        setMessage("Đã bật thông báo đẩy FCM cho trình duyệt này.");
        await load();
      } else if (result.permission === "denied") {
        setMessage("Trình duyệt đang chặn thông báo. Hãy cấp quyền Notifications cho website rồi thử lại.");
      } else setMessage("Bạn chưa cấp quyền nhận thông báo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể bật thông báo đẩy.");
    } finally { setPushBusy(false); }
  };

  const disablePush = async () => {
    if (!firebaseUser) return;
    setPushBusy(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      await disablePushNotifications(idToken);
      setMessage("Đã tắt FCM push cho thiết bị hiện tại.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tắt thông báo đẩy.");
    } finally { setPushBusy(false); }
  };

  const sendTest = async () => {
    if (!firebaseUser) return;
    setPushBusy(true);
    try {
      const idToken = await firebaseUser.getIdToken();
      await apiFetch("/notifications/push/test", { method: "POST" }, idToken);
      setMessage("Đã gửi thông báo thử.");
      window.setTimeout(() => void load(), 400);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể gửi thông báo thử.");
    } finally { setPushBusy(false); }
  };

  if (authLoading || (loading && !items.length)) return <main className={styles.page}><div className={styles.shell}><div className="skeleton skeleton-card" /></div></main>;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className="topbar">
          <Link href="/dashboard" className="brand">SmartMotel Hub</Link>
          <div className="topbar-actions">
            <button className="button button-ghost button-small" onClick={() => void markAll()} type="button">Đọc tất cả</button>
            <button className="button button-ghost button-small" onClick={() => void deleteRead()} type="button">Xóa đã đọc</button>
            <button className="button button-ghost button-small" onClick={() => void deleteAll()} type="button">Xóa tất cả</button>
          </div>
        </nav>

        <header className={styles.hero}><div><p className={styles.kicker}>CẬP NHẬT DÀNH CHO BẠN</p><h1>Thông báo</h1><p>{unreadCount} chưa đọc · {pagination.total} thông báo.</p></div></header>
        {message && <div className={styles.alert}>{message}</div>}

        <section className={styles.form}>
          <p className={styles.kicker}>PUSH NOTIFICATION</p><h2>Thông báo trình duyệt</h2>
          <div className={styles.details}>
            <div><span>FCM Web Push</span><strong>{pushConfigured ? "Đã cấu hình VAPID" : "Chưa cấu hình VAPID"}</strong></div>
            <div><span>Quyền trình duyệt</span><strong>{browserPermission}</strong></div>
            <div><span>Thiết bị đã đăng ký</span><strong>{registeredDevices}</strong></div>
          </div>
          <div className={styles.actions}>
            <button className={styles.primary} disabled={pushBusy || !pushConfigured} onClick={() => void enablePush()} type="button">{pushBusy ? "Đang xử lý…" : "Bật thông báo trình duyệt"}</button>
            <button className={styles.secondary} disabled={pushBusy || !pushConfigured} onClick={() => void sendTest()} type="button">Gửi thông báo thử</button>
            <button className={styles.ghost} disabled={pushBusy || !pushConfigured} onClick={() => void disablePush()} type="button">Tắt trên thiết bị này</button>
          </div>
        </section>

        {!items.length ? <div className={styles.empty}>Chưa có thông báo nào.</div> : <section className={styles.grid}>{items.map((item) => (
          <article className={`${styles.card} ${!item.readAt ? styles.unread : ""}`} key={item.id}>
            <div className={styles.notification}><div><p className={styles.kicker}>{item.type}</p><h2>{item.title}</h2><p className={styles.muted}>{item.message}</p><p className={styles.time}>{new Date(item.createdAt).toLocaleString("vi-VN")}</p></div>
              <div className={styles.actions}>{!item.readAt && <button className={styles.ghost} onClick={() => void markRead(item)} type="button">Đã đọc</button>}<button className={styles.ghost} onClick={() => void deleteOne(item)} type="button">Xóa</button></div>
            </div>
            {item.href && <div className={styles.actions}><Link className={styles.secondary} href={item.href} onClick={() => void markRead(item)}>Mở</Link></div>}
          </article>
        ))}</section>}

        {pagination.totalPages > 1 && <div className={styles.actions}>
          <button className={styles.ghost} disabled={pagination.page <= 1 || loading} onClick={() => void load(pagination.page - 1)} type="button">← Trước</button>
          <span className={styles.muted}>Trang {pagination.page} / {pagination.totalPages}</span>
          <button className={styles.ghost} disabled={pagination.page >= pagination.totalPages || loading} onClick={() => void load(pagination.page + 1)} type="button">Sau →</button>
        </div>}
      </div>
    </main>
  );
}
