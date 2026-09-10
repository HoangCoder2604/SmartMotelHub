"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../components/auth-provider";
import { apiFetch } from "../../lib/api";
import styles from "../contracts/phase7.module.css";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationsPage() {
  const router = useRouter();
  const { loading: authLoading, firebaseUser } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.replace("/auth/login");
  }, [authLoading, firebaseUser, router]);

  const load = async () => {
    if (!firebaseUser) return;
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const data = await apiFetch<{ items: Notification[]; unreadCount: number }>("/notifications", {}, token);
      setItems(data.items);
      setUnreadCount(data.unreadCount);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải thông báo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [firebaseUser]);

  const markRead = async (item: Notification) => {
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

  if (authLoading || (loading && !items.length)) {
    return <main className={styles.page}><div className={styles.shell}><div className={styles.empty}>Đang tải thông báo…</div></div></main>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className="topbar">
          <Link href="/dashboard" className="brand">SmartMotel Hub</Link>
          <div className="topbar-actions"><button className="button button-ghost button-small" onClick={() => void markAll()} type="button">Đọc tất cả</button></div>
        </nav>

        <header className={styles.hero}>
          <div><p className={styles.kicker}>IN-APP NOTIFICATIONS</p><h1>Thông báo</h1><p>{unreadCount} thông báo chưa đọc.</p></div>
        </header>

        {message && <div className={styles.alert}>{message}</div>}

        {!items.length ? <div className={styles.empty}>Chưa có thông báo nào.</div> : (
          <section className={styles.grid}>
            {items.map((item) => (
              <article className={`${styles.card} ${!item.readAt ? styles.unread : ""}`} key={item.id}>
                <div className={styles.notification}>
                  <div>
                    <p className={styles.kicker}>{item.type}</p>
                    <h2>{item.title}</h2>
                    <p className={styles.muted}>{item.message}</p>
                    <p className={styles.time}>{new Date(item.createdAt).toLocaleString("vi-VN")}</p>
                  </div>
                  {!item.readAt && <button className={styles.ghost} onClick={() => void markRead(item)} type="button">Đã đọc</button>}
                </div>
                {item.href && <div className={styles.actions}><Link className={styles.secondary} href={item.href} onClick={() => void markRead(item)}>Mở</Link></div>}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
