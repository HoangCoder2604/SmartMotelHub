"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../components/auth-provider";
import { apiAssetUrl, apiFetch, apiPublicFetch } from "../../lib/api";
import styles from "./phase5.module.css";
import { SafeImage } from "../../components/safe-image";

type Amenity = { id: string; name: string; category: string | null };

type Listing = {
  id: string;
  title: string;
  description: string | null;
  viewCount: number;
  distanceKm?: number;
  images: { id: string; url: string }[];
  room: {
    title: string;
    price: string | number;
    areaM2: string | number;
    maxOccupants: number;
    hasMezzanine: boolean;
    property: { id: string; name: string; address: string; district: string; city: string };
    amenities: { amenity: { id: string; name: string } }[];
  };
};

type Pagination = { page: number; limit: number; total: number; totalPages: number };

type Filters = {
  search: string;
  city: string;
  district: string;
  minPrice: string;
  maxPrice: string;
  minArea: string;
  maxArea: string;
  minOccupants: string;
  hasMezzanine: string;
  sort: string;
  radiusKm: string;
  amenityIds: string[];
};

const initialFilters: Filters = {
  search: "",
  city: "",
  district: "",
  minPrice: "",
  maxPrice: "",
  minArea: "",
  maxArea: "",
  minOccupants: "",
  hasMezzanine: "",
  sort: "newest",
  radiusKm: "10",
  amenityIds: [],
};

export default function PublicListingsPage() {
  const router = useRouter();
  const { firebaseUser, profile } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 12, total: 0, totalPages: 0 });
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const buildParams = (page: number, source: Filters, currentPosition: { lat: number; lng: number } | null) => {
    const params = new URLSearchParams();
    const simpleKeys: (keyof Pick<Filters, "search" | "city" | "district" | "minPrice" | "maxPrice" | "minArea" | "maxArea" | "minOccupants" | "hasMezzanine" | "sort">)[] = [
      "search", "city", "district", "minPrice", "maxPrice", "minArea", "maxArea", "minOccupants", "hasMezzanine", "sort",
    ];
    simpleKeys.forEach((key) => { if (source[key]) params.set(key, source[key]); });
    if (source.amenityIds.length) params.set("amenityIds", source.amenityIds.join(","));
    if (currentPosition) {
      params.set("lat", String(currentPosition.lat));
      params.set("lng", String(currentPosition.lng));
      params.set("radiusKm", source.radiusKm || "10");
    }
    params.set("page", String(page));
    params.set("limit", "12");
    return params;
  };

  const load = async (page = 1, source = filters, currentPosition = position) => {
    setLoading(true);
    setMessage(null);
    try {
      const params = buildParams(page, source, currentPosition);
      const data = await apiPublicFetch<{ listings: Listing[]; pagination: Pagination }>(`/listings?${params.toString()}`);
      setListings(data.listings);
      setPagination(data.pagination);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải danh sách phòng.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const query = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("search") ?? "" : "";
    const seededFilters = query ? { ...initialFilters, search: query } : initialFilters;
    setFilters(seededFilters);
    void Promise.all([
      load(1, seededFilters, null),
      apiPublicFetch<{ amenities: Amenity[] }>("/amenities").then((data) => setAmenities(data.amenities)).catch(() => undefined),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!firebaseUser || profile?.role !== "TENANT") {
      setFavorites(new Set());
      return;
    }
    void firebaseUser.getIdToken().then((token) =>
      apiFetch<{ favorites: { listing: { id: string } }[] }>("/favorites", {}, token)
        .then((data) => setFavorites(new Set(data.favorites.map((item) => item.listing.id))))
        .catch(() => undefined),
    );
  }, [firebaseUser, profile?.role]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void load(1);
  };

  const reset = () => {
    setFilters(initialFilters);
    setPosition(null);
    void load(1, initialFilters, null);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setMessage("Trình duyệt này không hỗ trợ định vị.");
      return;
    }
    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        const next = { lat: result.coords.latitude, lng: result.coords.longitude };
        setPosition(next);
        const nextFilters = { ...filters, sort: "distance" };
        setFilters(nextFilters);
        setLocating(false);
        void load(1, nextFilters, next);
      },
      () => {
        setLocating(false);
        setMessage("Không lấy được vị trí. Hãy cho phép Location trong trình duyệt rồi thử lại.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const toggleAmenity = (id: string) => {
    setFilters((current) => ({
      ...current,
      amenityIds: current.amenityIds.includes(id)
        ? current.amenityIds.filter((item) => item !== id)
        : [...current.amenityIds, id],
    }));
  };

  const toggleFavorite = async (listingId: string) => {
    if (!firebaseUser || !profile) {
      router.push("/auth/login");
      return;
    }
    if (profile.role !== "TENANT") {
      setMessage("Chức năng lưu phòng dành cho khách thuê.");
      return;
    }
    try {
      const token = await firebaseUser.getIdToken();
      const currentlyFavorite = favorites.has(listingId);
      await apiFetch(`/favorites/${listingId}`, { method: currentlyFavorite ? "DELETE" : "POST" }, token);
      setFavorites((current) => {
        const next = new Set(current);
        if (currentlyFavorite) next.delete(listingId); else next.add(listingId);
        return next;
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật yêu thích.");
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className="topbar">
          <Link href="/" className="brand">SmartMotel Hub</Link>
          <div className="topbar-actions">
            {profile?.role === "TENANT" && <Link className="button button-ghost button-small" href="/favorites">Phòng đã lưu</Link>}
            <Link className="button button-ghost button-small" href="/dashboard">Dashboard</Link>
          </div>
        </nav>

        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>KHÁM PHÁ KHÔNG GIAN SỐNG</p>
            <h1>Tìm phòng phù hợp nhanh hơn</h1>
            <p>Lọc theo giá, diện tích, tiện ích và khoảng cách thực tế để tìm lựa chọn phù hợp.</p>
          </div>
        </header>

        <form className={styles.filterPanel} onSubmit={submit}>
          <div className={styles.filterGrid}>
            <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Tên phòng, nhà trọ, địa chỉ…" />
            <input value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} placeholder="Tỉnh / Thành phố" />
            <input value={filters.district} onChange={(e) => setFilters({ ...filters, district: e.target.value })} placeholder="Quận / Huyện" />
            <input type="number" min="0" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} placeholder="Giá từ" />
            <input type="number" min="0" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} placeholder="Giá đến" />
          </div>

          <div className={styles.advancedGrid}>
            <input type="number" min="0" value={filters.minArea} onChange={(e) => setFilters({ ...filters, minArea: e.target.value })} placeholder="Diện tích từ (m²)" />
            <input type="number" min="0" value={filters.maxArea} onChange={(e) => setFilters({ ...filters, maxArea: e.target.value })} placeholder="Diện tích đến (m²)" />
            <input type="number" min="1" value={filters.minOccupants} onChange={(e) => setFilters({ ...filters, minOccupants: e.target.value })} placeholder="Ít nhất N người" />
            <select value={filters.hasMezzanine} onChange={(e) => setFilters({ ...filters, hasMezzanine: e.target.value })}>
              <option value="">Gác lửng: tất cả</option>
              <option value="true">Có gác</option>
              <option value="false">Không gác</option>
            </select>
            <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}>
              <option value="newest">Mới nhất</option>
              <option value="price_asc">Giá thấp → cao</option>
              <option value="price_desc">Giá cao → thấp</option>
              <option value="area_desc">Diện tích lớn</option>
              <option value="popular">Xem nhiều</option>
              <option value="distance" disabled={!position}>Gần tôi nhất</option>
            </select>
          </div>

          <div className={styles.amenityBlock}>
            <div className={styles.amenityTitle}>
              <strong>Tiện ích bắt buộc</strong>
              <span>{filters.amenityIds.length} đã chọn</span>
            </div>
            <div className={styles.amenityList}>
              {amenities.map((amenity) => (
                <label className={styles.amenityCheck} key={amenity.id}>
                  <input type="checkbox" checked={filters.amenityIds.includes(amenity.id)} onChange={() => toggleAmenity(amenity.id)} />
                  {amenity.name}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.actions}>
            <button className={styles.primary} type="submit">Tìm phòng</button>
            <button className={styles.secondary} type="button" onClick={locate} disabled={locating}>{locating ? "Đang lấy vị trí…" : "⌖ Tìm gần tôi"}</button>
            {position && (
              <select value={filters.radiusKm} onChange={(e) => setFilters({ ...filters, radiusKm: e.target.value })} aria-label="Bán kính tìm kiếm">
                <option value="2">Trong 2 km</option>
                <option value="5">Trong 5 km</option>
                <option value="10">Trong 10 km</option>
                <option value="20">Trong 20 km</option>
                <option value="50">Trong 50 km</option>
              </select>
            )}
            <button className={styles.ghost} type="button" onClick={reset}>Đặt lại</button>
          </div>
        </form>

        {message && <div className={styles.alert}>{message}</div>}

        <div className={styles.resultsHeader}>
          <strong>{loading ? "Đang tìm…" : `${pagination.total} phòng phù hợp`}</strong>
          {position && <span>Đang lọc quanh vị trí của bạn · {filters.radiusKm} km</span>}
        </div>

        {loading ? (
          <div className={styles.empty}>Đang tải danh sách phòng…</div>
        ) : listings.length === 0 ? (
          <div className={styles.empty}>Không có phòng phù hợp. Hãy thử nới lỏng bộ lọc hoặc tăng bán kính.</div>
        ) : (
          <section className={styles.grid}>
            {listings.map((listing) => (
              <article className={styles.card} key={listing.id}>
                <div className={styles.cover}>
                  {listing.images[0]
                    ? <SafeImage src={apiAssetUrl(listing.images[0].url)} alt={listing.title} />
                    : <div className={styles.noImage}>Chưa có ảnh</div>}
                  <button
                    className={`${styles.favoriteButton} ${favorites.has(listing.id) ? styles.favoriteActive : ""}`}
                    type="button"
                    aria-label={favorites.has(listing.id) ? "Bỏ lưu phòng" : "Lưu phòng"}
                    onClick={() => void toggleFavorite(listing.id)}
                  >
                    {favorites.has(listing.id) ? "♥" : "♡"}
                  </button>
                </div>
                <div className={styles.cardBody}>
                  <p className={styles.location}>{listing.room.property.district} · {listing.room.property.city}{listing.distanceKm !== undefined ? ` · ${listing.distanceKm} km` : ""}</p>
                  <h2><Link href={`/listings/${listing.id}`}>{listing.title}</Link></h2>
                  <p className={styles.price}>{Number(listing.room.price).toLocaleString("vi-VN")} ₫ <span>/ tháng</span></p>
                  <div className={styles.meta}>
                    <span>{String(listing.room.areaM2)} m²</span>
                    <span>{listing.room.maxOccupants} người</span>
                    {listing.room.hasMezzanine && <span>Có gác</span>}
                    <span>{listing.viewCount} lượt xem</span>
                  </div>
                  <div className={styles.tags}>{listing.room.amenities.slice(0, 5).map(({ amenity }) => <span key={amenity.id}>{amenity.name}</span>)}</div>
                </div>
              </article>
            ))}
          </section>
        )}

        {pagination.totalPages > 1 && (
          <nav className={styles.pagination} aria-label="Phân trang">
            <button className={styles.ghost} disabled={pagination.page <= 1 || loading} onClick={() => void load(pagination.page - 1)}>← Trước</button>
            <span>Trang {pagination.page} / {pagination.totalPages}</span>
            <button className={styles.ghost} disabled={pagination.page >= pagination.totalPages || loading} onClick={() => void load(pagination.page + 1)}>Sau →</button>
          </nav>
        )}
      </div>
    </main>
  );
}
