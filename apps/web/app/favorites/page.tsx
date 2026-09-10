"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../../components/auth-provider";
import { apiAssetUrl, apiFetch } from "../../lib/api";
import styles from "../listings/phase5.module.css";

type FavoriteItem = {
  createdAt: string;
  listing: {
    id: string;
    title: string;
    images: { id: string; url: string }[];
    room: {
      price: string | number;
      areaM2: string | number;
      maxOccupants: number;
      property: { district: string; city: string };
      amenities: { amenity: { id: string; name: string } }[];
    };
  };
};

export default function FavoritesPage() {
  const router = useRouter();
  const { loading: authLoading, firebaseUser, profile } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    if (!firebaseUser || profile?.role !== "TENANT") return;
    setLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const data = await apiFetch<{ favorites: FavoriteItem[] }>("/favorites", {}, token);
      setFavorites(data.favorites);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải danh sách yêu thích.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!firebaseUser) {
      router.replace("/auth/login");
      return;
    }
    if (profile && profile.role !== "TENANT") {
      router.replace("/dashboard");
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, firebaseUser, profile?.role]);

  const remove = async (listingId: string) => {
    if (!firebaseUser) return;
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/favorites/${listingId}`, { method: "DELETE" }, token);
      setFavorites((current) => current.filter((item) => item.listing.id !== listingId));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể bỏ lưu phòng.");
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className="topbar">
          <Link href="/listings" className="brand">← SmartMotel Hub</Link>
          <Link className="button button-ghost button-small" href="/dashboard">Dashboard</Link>
        </nav>
        <header className={styles.hero}>
          <div><p className={styles.kicker}>TENANT · FAVORITES</p><h1>Phòng đã lưu</h1><p>Lưu các phòng quan tâm để so sánh và xem lại sau.</p></div>
        </header>

        {message && <div className={styles.alert}>{message}</div>}
        {(authLoading || loading) ? <div className={styles.empty}>Đang tải phòng đã lưu…</div> : favorites.length === 0 ? (
          <div className={styles.empty}>Bạn chưa lưu phòng nào. <Link href="/listings">Khám phá phòng ngay</Link>.</div>
        ) : (
          <section className={styles.grid}>
            {favorites.map(({ listing }) => (
              <article className={styles.card} key={listing.id}>
                <div className={styles.cover}>
                  {listing.images[0] ? <img src={apiAssetUrl(listing.images[0].url)} alt={listing.title} /> : <div className={styles.noImage}>Chưa có ảnh</div>}
                  <button className={`${styles.favoriteButton} ${styles.favoriteActive}`} type="button" aria-label="Bỏ lưu phòng" onClick={() => void remove(listing.id)}>♥</button>
                </div>
                <div className={styles.cardBody}>
                  <p className={styles.location}>{listing.room.property.district} · {listing.room.property.city}</p>
                  <h2><Link href={`/listings/${listing.id}`}>{listing.title}</Link></h2>
                  <p className={styles.price}>{Number(listing.room.price).toLocaleString("vi-VN")} ₫ <span>/ tháng</span></p>
                  <div className={styles.meta}><span>{String(listing.room.areaM2)} m²</span><span>{listing.room.maxOccupants} người</span></div>
                  <div className={styles.tags}>{listing.room.amenities.slice(0, 5).map(({ amenity }) => <span key={amenity.id}>{amenity.name}</span>)}</div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
