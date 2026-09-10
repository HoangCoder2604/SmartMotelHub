"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../components/auth-provider";
import { apiAssetUrl, apiFetch } from "../../lib/api";
import styles from "./admin.module.css";

type ListingStatus = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";
type UserRole = "TENANT" | "LANDLORD" | "ADMIN";
type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED";

type Stats = {
  listings: { pending: number; approved: number; rejected: number };
  users: { active: number; suspended: number; banned: number; landlords: number; tenants: number };
};

type AdminListing = {
  id: string;
  title: string;
  description: string | null;
  status: ListingStatus;
  rejectionReason: string | null;
  publishedAt: string | null;
  reviewedAt: string | null;
  createdAt: string;
  images: { id: string; url: string }[];
  room: {
    title: string;
    price: string | number;
    areaM2: string | number;
    maxOccupants: number;
    amenities: { amenity: { id: string; name: string } }[];
    property: {
      id: string;
      name: string;
      address: string;
      district: string;
      city: string;
      landlord: {
        id: string;
        fullName: string;
        email: string | null;
        phone: string | null;
        status: UserStatus;
      };
    };
  };
};

type AdminUser = {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  _count: { ownedProperties: number; reviews: number };
};

const formatMoney = (value: string | number) => `${Number(value).toLocaleString("vi-VN")} ₫`;
const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleString("vi-VN") : "—";

export default function AdminPage() {
  const router = useRouter();
  const { loading, firebaseUser, profile, logout } = useAuth();
  const [tab, setTab] = useState<"listings" | "users">("listings");
  const [stats, setStats] = useState<Stats | null>(null);
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [listingStatus, setListingStatus] = useState<"ALL" | ListingStatus>("PENDING");
  const [listingSearch, setListingSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [pageLoading, setPageLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/auth/login");
    else if (!loading && profile && profile.role !== "ADMIN") router.replace("/dashboard");
  }, [firebaseUser, loading, profile, router]);

  const token = useCallback(async () => {
    if (!firebaseUser) throw new Error("Chưa đăng nhập.");
    return firebaseUser.getIdToken();
  }, [firebaseUser]);

  const loadStats = useCallback(async () => {
    if (profile?.role !== "ADMIN") return;
    const idToken = await token();
    const data = await apiFetch<Stats>("/admin/stats", {}, idToken);
    setStats(data);
  }, [profile?.role, token]);

  const loadListings = useCallback(async () => {
    if (profile?.role !== "ADMIN") return;
    const idToken = await token();
    const params = new URLSearchParams({ limit: "100" });
    if (listingStatus !== "ALL") params.set("status", listingStatus);
    if (listingSearch.trim()) params.set("search", listingSearch.trim());
    const data = await apiFetch<{ listings: AdminListing[] }>(`/admin/listings?${params.toString()}`, {}, idToken);
    setListings(data.listings);
  }, [listingSearch, listingStatus, profile?.role, token]);

  const loadUsers = useCallback(async () => {
    if (profile?.role !== "ADMIN") return;
    const idToken = await token();
    const params = new URLSearchParams({ limit: "100" });
    if (userSearch.trim()) params.set("search", userSearch.trim());
    const data = await apiFetch<{ users: AdminUser[] }>(`/admin/users?${params.toString()}`, {}, idToken);
    setUsers(data.users);
  }, [profile?.role, token, userSearch]);

  useEffect(() => {
    if (profile?.role !== "ADMIN") return;
    const run = async () => {
      setPageLoading(true);
      setMessage(null);
      try {
        await Promise.all([loadStats(), loadListings(), loadUsers()]);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Không thể tải dữ liệu Admin.");
      } finally {
        setPageLoading(false);
      }
    };
    void run();
  }, [loadListings, loadStats, loadUsers, profile?.role]);

  const searchListings = async (event: FormEvent) => {
    event.preventDefault();
    setPageLoading(true);
    try { await loadListings(); } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể tải tin đăng."); }
    finally { setPageLoading(false); }
  };

  const searchUsers = async (event: FormEvent) => {
    event.preventDefault();
    setPageLoading(true);
    try { await loadUsers(); } catch (error) { setMessage(error instanceof Error ? error.message : "Không thể tải người dùng."); }
    finally { setPageLoading(false); }
  };

  const approve = async (listing: AdminListing) => {
    if (!window.confirm(`Duyệt tin “${listing.title}”? Tin sẽ xuất hiện ngay ở trang public.`)) return;
    setBusyKey(`approve-${listing.id}`);
    setMessage(null);
    try {
      const idToken = await token();
      await apiFetch(`/admin/listings/${listing.id}/approve`, { method: "PATCH" }, idToken);
      setMessage("Đã duyệt tin. publishedAt được backend đặt tự động theo thời gian hiện tại.");
      await Promise.all([loadListings(), loadStats()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể duyệt tin.");
    } finally {
      setBusyKey(null);
    }
  };

  const reject = async (listing: AdminListing) => {
    if (rejectReason.trim().length < 5) {
      setMessage("Lý do từ chối phải có ít nhất 5 ký tự.");
      return;
    }
    setBusyKey(`reject-${listing.id}`);
    setMessage(null);
    try {
      const idToken = await token();
      await apiFetch(`/admin/listings/${listing.id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reason: rejectReason.trim() }),
      }, idToken);
      setMessage("Đã từ chối tin và lưu lý do để chủ nhà chỉnh sửa rồi gửi lại.");
      setRejectingId(null);
      setRejectReason("");
      await Promise.all([loadListings(), loadStats()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể từ chối tin.");
    } finally {
      setBusyKey(null);
    }
  };

  const changeUserStatus = async (user: AdminUser, status: UserStatus) => {
    if (user.status === status) return;
    const warning = status === "ACTIVE"
      ? `Mở khóa tài khoản ${user.fullName}?`
      : `${status === "BANNED" ? "Khóa" : "Tạm khóa"} tài khoản ${user.fullName}?`;
    if (!window.confirm(warning)) return;

    setBusyKey(`user-${user.id}`);
    setMessage(null);
    try {
      const idToken = await token();
      await apiFetch(`/admin/users/${user.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }, idToken);
      setMessage("Đã cập nhật trạng thái người dùng.");
      await Promise.all([loadUsers(), loadStats()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật người dùng.");
    } finally {
      setBusyKey(null);
    }
  };

  if (loading || (profile?.role === "ADMIN" && pageLoading && !stats)) {
    return <main className="center-screen"><p>Đang tải Admin Console…</p></main>;
  }

  if (!profile || profile.role !== "ADMIN") return null;

  return (
    <main className={`site-shell ${styles.shell}`}>
      <nav className="topbar">
        <Link href="/" className="brand">SmartMotel Hub</Link>
        <div className="topbar-actions">
          <Link href="/listings" className="button button-ghost button-small">Tin public</Link>
          <Link href="/dashboard" className="button button-ghost button-small">Dashboard</Link>
          <button className="button button-ghost button-small" onClick={async () => { await logout(); router.replace("/"); }}>Đăng xuất</button>
        </div>
      </nav>

      <header className={styles.header}>
        <div>
          <p className="eyebrow">PHASE 4 · ADMIN MODERATION</p>
          <h1>Admin Console</h1>
          <p className="muted">Duyệt tin thật, ghi lại người duyệt/lý do từ chối và quản lý trạng thái tài khoản.</p>
        </div>
        <span className="role-badge role-admin">ADMIN</span>
      </header>

      {message && <div className="alert alert-warning">{message}</div>}

      {stats && (
        <section className={styles.statsGrid}>
          <article><span>Chờ duyệt</span><strong>{stats.listings.pending}</strong></article>
          <article><span>Đã duyệt</span><strong>{stats.listings.approved}</strong></article>
          <article><span>Bị từ chối</span><strong>{stats.listings.rejected}</strong></article>
          <article><span>User ACTIVE</span><strong>{stats.users.active}</strong></article>
          <article><span>Landlord</span><strong>{stats.users.landlords}</strong></article>
          <article><span>Tenant</span><strong>{stats.users.tenants}</strong></article>
        </section>
      )}

      <div className={styles.tabs}>
        <button className={tab === "listings" ? styles.activeTab : ""} onClick={() => setTab("listings")}>Duyệt tin</button>
        <button className={tab === "users" ? styles.activeTab : ""} onClick={() => setTab("users")}>Người dùng</button>
      </div>

      {tab === "listings" ? (
        <section>
          <form className={styles.toolbar} onSubmit={searchListings}>
            <select value={listingStatus} onChange={(e) => setListingStatus(e.target.value as "ALL" | ListingStatus)}>
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="REJECTED">REJECTED</option>
              <option value="DRAFT">DRAFT</option>
              <option value="HIDDEN">HIDDEN</option>
            </select>
            <input value={listingSearch} onChange={(e) => setListingSearch(e.target.value)} placeholder="Tiêu đề, nhà trọ, chủ nhà…" />
            <button className="button button-primary button-small">Lọc</button>
          </form>

          {pageLoading ? <div className="empty-state"><p>Đang tải…</p></div> : listings.length === 0 ? (
            <div className="empty-state"><h2>Không có tin phù hợp</h2><p>Hãy đổi bộ lọc hoặc tạo một tin PENDING từ tài khoản LANDLORD.</p></div>
          ) : (
            <div className={styles.listingList}>
              {listings.map((listing) => (
                <article className={styles.listingCard} key={listing.id}>
                  <div className={styles.cover}>
                    {listing.images[0]
                      ? <img src={apiAssetUrl(listing.images[0].url)} alt={listing.title} />
                      : <div className={styles.noImage}>Chưa có ảnh</div>}
                  </div>
                  <div className={styles.listingMain}>
                    <div className={styles.titleRow}>
                      <div>
                        <p className="eyebrow">{listing.room.property.district} · {listing.room.property.city}</p>
                        <h2>{listing.title}</h2>
                      </div>
                      <span className={`${styles.status} ${styles[listing.status.toLowerCase()]}`}>{listing.status}</span>
                    </div>
                    <p className={styles.price}>{formatMoney(listing.room.price)} <span>/ tháng</span></p>
                    <p className="muted">{listing.description || "Không có mô tả."}</p>
                    <div className={styles.meta}>
                      <span>{String(listing.room.areaM2)} m²</span>
                      <span>Tối đa {listing.room.maxOccupants} người</span>
                      <span>Tạo {formatDate(listing.createdAt)}</span>
                    </div>
                    <div className={styles.adminInfo}>
                      <strong>{listing.room.property.name}</strong>
                      <span>{listing.room.property.address}, {listing.room.property.district}, {listing.room.property.city}</span>
                      <span>Chủ nhà: {listing.room.property.landlord.fullName} · {listing.room.property.landlord.email || listing.room.property.landlord.phone || "Chưa có liên hệ"}</span>
                    </div>
                    {listing.rejectionReason && <div className={styles.rejection}><strong>Lý do từ chối:</strong> {listing.rejectionReason}</div>}

                    {listing.status === "PENDING" && (
                      <div className={styles.actions}>
                        <button className="button button-primary button-small" disabled={busyKey !== null} onClick={() => void approve(listing)}>
                          {busyKey === `approve-${listing.id}` ? "Đang duyệt…" : "✓ Duyệt"}
                        </button>
                        <button className="button button-secondary button-small" disabled={busyKey !== null} onClick={() => { setRejectingId(listing.id); setRejectReason(""); }}>
                          Từ chối
                        </button>
                      </div>
                    )}

                    {rejectingId === listing.id && (
                      <div className={styles.rejectBox}>
                        <label>Lý do từ chối
                          <textarea rows={3} maxLength={1000} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Ví dụ: Ảnh chưa rõ, mô tả thiếu giá điện/nước…" />
                        </label>
                        <div>
                          <button className="button button-secondary button-small" onClick={() => { setRejectingId(null); setRejectReason(""); }}>Hủy</button>
                          <button className="button button-primary button-small" disabled={busyKey !== null} onClick={() => void reject(listing)}>
                            {busyKey === `reject-${listing.id}` ? "Đang xử lý…" : "Xác nhận từ chối"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section>
          <form className={styles.toolbar} onSubmit={searchUsers}>
            <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Tên, email hoặc số điện thoại…" />
            <button className="button button-primary button-small">Tìm user</button>
          </form>

          <div className={styles.userTableWrap}>
            <table className={styles.userTable}>
              <thead><tr><th>Người dùng</th><th>Role</th><th>Xác minh</th><th>Dữ liệu</th><th>Trạng thái</th></tr></thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.fullName}</strong><span>{user.email || user.phone || "—"}</span><small>Tạo {formatDate(user.createdAt)}</small></td>
                    <td><span className={styles.role}>{user.role}</span></td>
                    <td>{user.emailVerified ? "Email ✓" : "Email —"}</td>
                    <td>{user._count.ownedProperties} nhà trọ · {user._count.reviews} review</td>
                    <td>
                      <select
                        value={user.status}
                        disabled={busyKey === `user-${user.id}` || user.id === profile.id}
                        onChange={(e) => void changeUserStatus(user, e.target.value as UserStatus)}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="SUSPENDED">SUSPENDED</option>
                        <option value="BANNED">BANNED</option>
                      </select>
                      {user.id === profile.id && <small className={styles.selfNote}>Tài khoản hiện tại</small>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
