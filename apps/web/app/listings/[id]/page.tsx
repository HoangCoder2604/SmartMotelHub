"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../../components/auth-provider";
import { apiAssetUrl, apiFetch } from "../../../lib/api";
import appointmentStyles from "../../appointments/phase6.module.css";
import styles from "../phase5.module.css";

type Listing = {
  id: string;
  title: string;
  description: string | null;
  viewCount: number;
  publishedAt: string | null;
  images: { id: string; url: string }[];
  room: {
    title: string;
    description: string | null;
    roomNumber: string | null;
    price: string | number;
    deposit: string | number | null;
    areaM2: string | number;
    electricityPrice: string | number | null;
    waterPrice: string | number | null;
    internetPrice: string | number | null;
    serviceFee: string | number | null;
    maxOccupants: number;
    hasMezzanine: boolean;
    property: {
      id: string;
      name: string;
      address: string;
      ward: string | null;
      district: string;
      city: string;
      latitude: string | number;
      longitude: string | number;
    };
    amenities: { amenity: { id: string; name: string } }[];
  };
  similarListings: Listing[];
};

type PublicReview = {
  id: string;
  overallRating: number;
  landlordRating: number | null;
  securityRating: number | null;
  noiseRating: number | null;
  costRating: number | null;
  comment: string | null;
  createdAt: string;
  tenant: { fullName: string; avatarUrl: string | null };
};

type ReviewsResponse = {
  reviews: PublicReview[];
  summary: {
    count: number;
    overall: number | null;
    landlord: number | null;
    security: number | null;
    noise: number | null;
    cost: number | null;
  };
};

function money(value: string | number | null) {
  if (value === null || value === undefined || value === "") return "—";
  return `${Number(value).toLocaleString("vi-VN")} ₫`;
}

function localDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function stars(value: number) {
  const rounded = Math.max(1, Math.min(5, Math.round(value)));
  return `${"★".repeat(rounded)}${"☆".repeat(5 - rounded)}`;
}

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { firebaseUser, profile } = useAuth();
  const [listing, setListing] = useState<Listing | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [booking, setBooking] = useState({ appointmentDate: localDate(1), startTime: "09:00", endTime: "10:00", tenantNote: "" });
  const [bookingBusy, setBookingBusy] = useState(false);
  const [reviews, setReviews] = useState<ReviewsResponse | null>(null);

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    apiFetch<{ listing: Listing }>(`/listings/${params.id}`)
      .then((data) => setListing(data.listing))
      .catch((error) => setMessage(error instanceof Error ? error.message : "Không thể tải tin đăng."))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!params.id || !firebaseUser || profile?.role !== "TENANT") return;
    void firebaseUser.getIdToken().then((token) =>
      apiFetch<{ listingId: string; favorited: boolean }>(`/favorites/${params.id}/status`, {}, token)
        .then((data) => setFavorited(data.favorited))
        .catch(() => undefined),
    );
  }, [firebaseUser, params.id, profile?.role]);

  useEffect(() => {
    const propertyId = listing?.room.property.id;
    if (!propertyId) return;
    apiFetch<ReviewsResponse>(`/reviews/properties/${propertyId}`)
      .then(setReviews)
      .catch(() => setReviews(null));
  }, [listing?.room.property.id]);

  const toggleFavorite = async () => {
    if (!firebaseUser || !profile) {
      router.push("/auth/login");
      return;
    }
    if (profile.role !== "TENANT") {
      setMessage("Chức năng lưu phòng dành cho TENANT.");
      return;
    }
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/favorites/${params.id}`, { method: favorited ? "DELETE" : "POST" }, token);
      setFavorited(!favorited);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật yêu thích.");
    }
  };

  const submitBooking = async (event: FormEvent) => {
    event.preventDefault();
    if (!firebaseUser || !profile) {
      router.push("/auth/login");
      return;
    }
    if (profile.role !== "TENANT") {
      setMessage("Chỉ TENANT mới có thể đặt lịch xem phòng.");
      return;
    }

    setBookingBusy(true);
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/appointments/listings/${params.id}`, { method: "POST", body: JSON.stringify(booking) }, token);
      setMessage("Đã gửi yêu cầu xem phòng. Chủ nhà sẽ xác nhận lịch của bạn.");
      setBookingOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể đặt lịch xem phòng.");
    } finally {
      setBookingBusy(false);
    }
  };

  if (loading) {
    return <main className={styles.page}><div className={styles.shell}><div className={styles.empty}>Đang tải chi tiết phòng…</div></div></main>;
  }

  if (!listing) {
    return <main className={styles.page}><div className={styles.shell}><div className={styles.alert}>{message ?? "Không tìm thấy tin đăng."}</div></div></main>;
  }

  const property = listing.room.property;
  const lat = Number(property.latitude);
  const lng = Number(property.longitude);
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=16&output=embed`;
  const currentImage = listing.images[selectedImage] ?? listing.images[0];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <nav className="topbar">
          <Link href="/listings" className="brand">← SmartMotel Hub</Link>
          <div className="topbar-actions">
            {profile?.role === "TENANT" && <Link className="button button-ghost button-small" href="/appointments">Lịch xem của tôi</Link>}
            {profile?.role === "TENANT" && <Link className="button button-ghost button-small" href="/favorites">Phòng đã lưu</Link>}
            <Link className="button button-ghost button-small" href="/dashboard">Dashboard</Link>
          </div>
        </nav>

        {message && <div className={styles.alert}>{message}</div>}

        <div className={styles.detailLayout}>
          <article className={styles.detailMain}>
            <div className={styles.galleryMain}>
              {currentImage ? <img src={apiAssetUrl(currentImage.url)} alt={listing.title} /> : <div className={styles.noImage}>Chưa có ảnh</div>}
            </div>
            {listing.images.length > 1 && (
              <div className={styles.thumbs}>
                {listing.images.map((image, index) => (
                  <button className={`${styles.thumb} ${selectedImage === index ? styles.thumbActive : ""}`} key={image.id} onClick={() => setSelectedImage(index)} type="button">
                    <img src={apiAssetUrl(image.url)} alt={`Ảnh ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}

            <h1 className={styles.detailTitle}>{listing.title}</h1>
            <p className={styles.location}>{property.address}{property.ward ? `, ${property.ward}` : ""}, {property.district}, {property.city}</p>
            <div className={styles.meta}>
              <span>{String(listing.room.areaM2)} m²</span>
              <span>Tối đa {listing.room.maxOccupants} người</span>
              <span>{listing.room.hasMezzanine ? "Có gác" : "Không gác"}</span>
              <span>{listing.viewCount} lượt xem</span>
            </div>

            <section className={styles.section}>
              <h2>Mô tả</h2>
              <p>{listing.description || listing.room.description || "Chủ nhà chưa thêm mô tả chi tiết."}</p>
            </section>

            <section className={styles.section}>
              <h2>Tiện ích</h2>
              <div className={styles.tags}>{listing.room.amenities.map(({ amenity }) => <span key={amenity.id}>{amenity.name}</span>)}</div>
            </section>

            <section className={styles.section}>
              <h2>Chi phí</h2>
              <div className={styles.feeGrid}>
                <div className={styles.feeItem}><span>Tiền cọc</span><strong>{money(listing.room.deposit)}</strong></div>
                <div className={styles.feeItem}><span>Điện</span><strong>{money(listing.room.electricityPrice)}</strong></div>
                <div className={styles.feeItem}><span>Nước</span><strong>{money(listing.room.waterPrice)}</strong></div>
                <div className={styles.feeItem}><span>Internet</span><strong>{money(listing.room.internetPrice)}</strong></div>
                <div className={styles.feeItem}><span>Phí dịch vụ</span><strong>{money(listing.room.serviceFee)}</strong></div>
              </div>
            </section>

            <section className={styles.section}>
              <h2>Vị trí</h2>
              <iframe className={styles.mapFrame} src={mapUrl} loading="lazy" title={`Bản đồ ${property.name}`} referrerPolicy="no-referrer-when-downgrade" />
              <p className={styles.location}>Tọa độ: {lat}, {lng}</p>
            </section>

            <section className={styles.section} id="reviews">
              <h2>Đánh giá nhà trọ</h2>
              {!reviews || reviews.summary.count === 0 ? (
                <p className={styles.location}>Chưa có đánh giá từ TENANT đã hoàn tất lịch xem.</p>
              ) : (
                <>
                  <div className={appointmentStyles.reviewSummary}>
                    <div><div className={appointmentStyles.score}>{reviews.summary.overall?.toFixed(1) ?? "—"}<span>/5</span></div><div className={appointmentStyles.stars}>{stars(reviews.summary.overall ?? 5)}</div><p className={styles.location}>{reviews.summary.count} đánh giá</p></div>
                    <div className={appointmentStyles.ratingBars}>
                      <span>Chủ nhà: <strong>{reviews.summary.landlord?.toFixed(1) ?? "—"}</strong></span>
                      <span>An ninh: <strong>{reviews.summary.security?.toFixed(1) ?? "—"}</strong></span>
                      <span>Yên tĩnh: <strong>{reviews.summary.noise?.toFixed(1) ?? "—"}</strong></span>
                      <span>Chi phí: <strong>{reviews.summary.cost?.toFixed(1) ?? "—"}</strong></span>
                    </div>
                  </div>
                  <div className={appointmentStyles.reviewList}>
                    {reviews.reviews.map((review) => (
                      <article className={appointmentStyles.reviewItem} key={review.id}>
                        <div className={appointmentStyles.reviewItemTop}><strong>{review.tenant.fullName}</strong><span className={appointmentStyles.stars}>{stars(review.overallRating)}</span></div>
                        {review.comment && <p>{review.comment}</p>}
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>

            {listing.similarListings?.length > 0 && (
              <section className={styles.section}>
                <h2>Phòng tương tự quanh {property.district}</h2>
                <div className={styles.similarGrid}>
                  {listing.similarListings.map((item) => (
                    <Link className={styles.similarCard} href={`/listings/${item.id}`} key={item.id}>
                      {item.images[0] ? <img src={apiAssetUrl(item.images[0].url)} alt={item.title} /> : <div className={styles.noImage}>Chưa có ảnh</div>}
                      <div><strong>{item.title}</strong><span>{money(item.room.price)} / tháng</span></div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </article>

          <aside className={styles.sidebar}>
            <section className={styles.sidebarCard}>
              <p className={styles.kicker}>GIÁ THUÊ</p>
              <p className={styles.sidebarPrice}>{money(listing.room.price)} <span style={{ fontSize: 14, color: "#6f7988" }}>/ tháng</span></p>
              <button className={styles.primary} style={{ width: "100%" }} onClick={() => {
                if (!firebaseUser) { router.push("/auth/login"); return; }
                if (profile?.role !== "TENANT") { setMessage("Chỉ TENANT mới có thể đặt lịch xem phòng."); return; }
                setBookingOpen((value) => !value);
              }} type="button">Đặt lịch xem phòng</button>
              <button className={favorited ? styles.secondary : styles.ghost} style={{ width: "100%", marginTop: 8 }} onClick={() => void toggleFavorite()} type="button">
                {favorited ? "♥ Đã lưu phòng" : "♡ Lưu phòng"}
              </button>
              {firebaseUser && profile?.role !== "ADMIN" && (
                <Link className={styles.ghost} style={{ width: "100%", marginTop: 8, textAlign: "center" }} href={`/complaints?listingId=${listing.id}`}>⚑ Báo cáo tin</Link>
              )}

              {bookingOpen && profile?.role === "TENANT" && (
                <form className={appointmentStyles.bookingForm} onSubmit={submitBooking}>
                  <div className={appointmentStyles.bookingRow}>
                    <label className={appointmentStyles.bookingField}>Ngày xem
                      <input className={appointmentStyles.input} type="date" min={localDate(0)} value={booking.appointmentDate} onChange={(event) => setBooking((current) => ({ ...current, appointmentDate: event.target.value }))} required />
                    </label>
                    <label className={appointmentStyles.bookingField}>Bắt đầu
                      <input className={appointmentStyles.input} type="time" value={booking.startTime} onChange={(event) => setBooking((current) => ({ ...current, startTime: event.target.value }))} required />
                    </label>
                    <label className={appointmentStyles.bookingField}>Kết thúc
                      <input className={appointmentStyles.input} type="time" value={booking.endTime} onChange={(event) => setBooking((current) => ({ ...current, endTime: event.target.value }))} required />
                    </label>
                  </div>
                  <textarea className={appointmentStyles.textarea} maxLength={1000} placeholder="Lời nhắn cho chủ nhà (không bắt buộc)" value={booking.tenantNote} onChange={(event) => setBooking((current) => ({ ...current, tenantNote: event.target.value }))} />
                  <button className={appointmentStyles.primary} disabled={bookingBusy} type="submit">{bookingBusy ? "Đang gửi…" : "Gửi yêu cầu"}</button>
                </form>
              )}
            </section>

            <section className={styles.sidebarCard}>
              <p className={styles.kicker}>NHÀ TRỌ</p>
              <h2 style={{ margin: "6px 0" }}>{property.name}</h2>
              <p className={styles.location}>{property.address}, {property.district}, {property.city}</p>
              {profile?.role === "TENANT" && <Link className={styles.secondary} style={{ width: "100%", marginTop: 12 }} href="/appointments">Xem lịch của tôi</Link>}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
