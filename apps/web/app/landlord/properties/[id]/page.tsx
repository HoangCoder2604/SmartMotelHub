"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../../../components/auth-provider";
import { apiAssetUrl, apiFetch, apiUpload } from "../../../../lib/api";
import { SafeImage } from "../../../../components/safe-image";

type Amenity = { id: string; code: string; name: string; category: string | null };
type ListingImage = { id: string; url: string; sortOrder: number };
type Listing = {
  id: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";
  rejectionReason: string | null;
  reviewedAt: string | null;
  images: ListingImage[];
};
type Room = {
  id: string;
  roomNumber: string | null;
  title: string;
  description: string | null;
  price: string | number;
  deposit: string | number | null;
  areaM2: string | number;
  maxOccupants: number;
  hasMezzanine: boolean;
  status: "AVAILABLE" | "RESERVED" | "RENTED" | "MAINTENANCE";
  amenities: { amenity: Amenity }[];
  listings: Listing[];
};
type PropertyDetail = {
  id: string;
  name: string;
  description: string | null;
  address: string;
  ward: string | null;
  district: string;
  city: string;
  status: "ACTIVE" | "INACTIVE";
  rooms: Room[];
};

const initialRoom = {
  roomNumber: "",
  title: "",
  description: "",
  price: "",
  deposit: "",
  areaM2: "",
  electricityPrice: "",
  waterPrice: "",
  internetPrice: "",
  serviceFee: "",
  maxOccupants: "1",
  hasMezzanine: false,
  amenityIds: [] as string[],
};

const money = (value: string | number | null) => {
  if (value === null || value === "") return "—";
  return `${Number(value).toLocaleString("vi-VN")} ₫`;
};

export default function LandlordPropertyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const propertyId = params.id;
  const { loading, firebaseUser, profile } = useAuth();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [roomForm, setRoomForm] = useState(initialRoom);
  const [listingDrafts, setListingDrafts] = useState<Record<string, { title: string; description: string }>>({});
  const [listingEdits, setListingEdits] = useState<Record<string, { title: string; description: string }>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/auth/login");
    else if (!loading && profile && profile.role !== "LANDLORD") router.replace("/forbidden");
  }, [firebaseUser, loading, profile, router]);

  const load = useCallback(async () => {
    if (!firebaseUser || profile?.role !== "LANDLORD" || !propertyId) return;
    setPageLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const [propertyData, amenityData] = await Promise.all([
        apiFetch<{ property: PropertyDetail }>(`/properties/${propertyId}`, {}, token),
        apiFetch<{ amenities: Amenity[] }>("/amenities", {}, token),
      ]);
      setProperty(propertyData.property);
      setAmenities(amenityData.amenities);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải dữ liệu nhà trọ.");
    } finally {
      setPageLoading(false);
    }
  }, [firebaseUser, profile, propertyId]);

  useEffect(() => { void load(); }, [load]);

  const groupedAmenities = useMemo(() => {
    const groups = new Map<string, Amenity[]>();
    for (const amenity of amenities) {
      const key = amenity.category || "OTHER";
      groups.set(key, [...(groups.get(key) ?? []), amenity]);
    }
    return [...groups.entries()];
  }, [amenities]);

  const createRoom = async (event: FormEvent) => {
    event.preventDefault();
    if (!firebaseUser) return;
    setBusyKey("create-room");
    setMessage(null);
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/properties/${propertyId}/rooms`, {
        method: "POST",
        body: JSON.stringify({
          roomNumber: roomForm.roomNumber || undefined,
          title: roomForm.title,
          description: roomForm.description || undefined,
          price: Number(roomForm.price),
          deposit: roomForm.deposit ? Number(roomForm.deposit) : undefined,
          areaM2: Number(roomForm.areaM2),
          electricityPrice: roomForm.electricityPrice ? Number(roomForm.electricityPrice) : undefined,
          waterPrice: roomForm.waterPrice ? Number(roomForm.waterPrice) : undefined,
          internetPrice: roomForm.internetPrice ? Number(roomForm.internetPrice) : undefined,
          serviceFee: roomForm.serviceFee ? Number(roomForm.serviceFee) : undefined,
          maxOccupants: Number(roomForm.maxOccupants),
          hasMezzanine: roomForm.hasMezzanine,
          amenityIds: roomForm.amenityIds,
        }),
      }, token);
      setRoomForm(initialRoom);
      setMessage("Đã thêm phòng.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể thêm phòng.");
    } finally {
      setBusyKey(null);
    }
  };

  const createListing = async (room: Room) => {
    if (!firebaseUser) return;
    const draft = listingDrafts[room.id] ?? { title: room.title, description: room.description ?? "" };
    setBusyKey(`listing-${room.id}`);
    setMessage(null);
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/landlord/listings/room/${room.id}`, {
        method: "POST",
        body: JSON.stringify({ title: draft.title || room.title, description: draft.description || undefined }),
      }, token);
      setMessage("Đã tạo tin nháp. Bây giờ hãy tải ảnh lên.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tạo tin đăng.");
    } finally {
      setBusyKey(null);
    }
  };

  const saveListing = async (listing: Listing) => {
    if (!firebaseUser) return;
    const edit = listingEdits[listing.id] ?? { title: listing.title, description: listing.description ?? "" };
    setBusyKey(`edit-listing-${listing.id}`);
    setMessage(null);
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/landlord/listings/${listing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: edit.title, description: edit.description }),
      }, token);
      setMessage("Đã cập nhật nội dung tin đăng.");
      setListingEdits((current) => {
        const next = { ...current };
        delete next[listing.id];
        return next;
      });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật tin đăng.");
    } finally {
      setBusyKey(null);
    }
  };

  const uploadImage = async (listingId: string, file?: File) => {
    if (!firebaseUser || !file) return;
    setBusyKey(`image-${listingId}`);
    setMessage(null);
    try {
      const token = await firebaseUser.getIdToken();
      const formData = new FormData();
      formData.append("file", file);
      await apiUpload(`/landlord/listings/${listingId}/images`, formData, token);
      setMessage("Đã tải ảnh lên.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải ảnh.");
    } finally {
      setBusyKey(null);
    }
  };

  const deleteImage = async (listingId: string, imageId: string) => {
    if (!firebaseUser) return;
    setBusyKey(`delete-image-${imageId}`);
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/landlord/listings/${listingId}/images/${imageId}`, { method: "DELETE" }, token);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể xóa ảnh.");
    } finally {
      setBusyKey(null);
    }
  };

  const submitListing = async (listingId: string) => {
    if (!firebaseUser || !window.confirm("Gửi tin này sang trạng thái PENDING để chờ Admin duyệt?")) return;
    setBusyKey(`submit-${listingId}`);
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/landlord/listings/${listingId}/submit`, { method: "POST" }, token);
      setMessage("Tin đăng đã chuyển sang PENDING.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể gửi duyệt.");
    } finally {
      setBusyKey(null);
    }
  };

  const updateRoomStatus = async (roomId: string, status: Room["status"]) => {
    if (!firebaseUser) return;
    setBusyKey(`status-${roomId}`);
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/rooms/${roomId}`, { method: "PATCH", body: JSON.stringify({ status }) }, token);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật trạng thái phòng.");
    } finally {
      setBusyKey(null);
    }
  };

  if (loading || pageLoading) return <main className="center-screen"><p>Đang tải dữ liệu Phase 3…</p></main>;
  if (!property) return <main className="center-screen"><section className="info-card"><h1>Không tải được nhà trọ</h1><p>{message}</p><Link href="/landlord/properties">Quay lại</Link></section></main>;

  return (
    <main className="site-shell phase3-shell">
      <nav className="topbar">
        <Link href="/landlord/properties" className="brand">← Nhà trọ</Link>
        <Link href="/dashboard" className="button button-ghost button-small">Dashboard</Link>
      </nav>

      <header className="phase3-header">
        <div>
          <p className="eyebrow">PROPERTY · ROOM · LISTING</p>
          <h1>{property.name}</h1>
          <p className="muted">{property.address}, {property.district}, {property.city}</p>
        </div>
        <span className={`status-chip status-${property.status.toLowerCase()}`}>{property.status}</span>
      </header>

      {message && <div className="alert alert-info">{message}</div>}

      <section className="phase3-layout property-detail-layout">
        <article className="info-card phase3-form-card sticky-card">
          <h2>Thêm phòng</h2>
          <form className="stack-form" onSubmit={createRoom}>
            <div className="form-grid-2">
              <label>Số phòng<input value={roomForm.roomNumber} onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })} placeholder="P.101" /></label>
              <label>Diện tích m²<input type="number" step="0.1" min="1" value={roomForm.areaM2} onChange={(e) => setRoomForm({ ...roomForm, areaM2: e.target.value })} required /></label>
            </div>
            <label>Tiêu đề phòng<input value={roomForm.title} onChange={(e) => setRoomForm({ ...roomForm, title: e.target.value })} placeholder="Phòng studio có ban công" required /></label>
            <label>Mô tả<textarea rows={3} value={roomForm.description} onChange={(e) => setRoomForm({ ...roomForm, description: e.target.value })} /></label>
            <div className="form-grid-2">
              <label>Giá thuê/tháng<input type="number" min="0" value={roomForm.price} onChange={(e) => setRoomForm({ ...roomForm, price: e.target.value })} required /></label>
              <label>Tiền cọc<input type="number" min="0" value={roomForm.deposit} onChange={(e) => setRoomForm({ ...roomForm, deposit: e.target.value })} /></label>
            </div>
            <div className="form-grid-2">
              <label>Giá điện<input type="number" min="0" value={roomForm.electricityPrice} onChange={(e) => setRoomForm({ ...roomForm, electricityPrice: e.target.value })} /></label>
              <label>Giá nước<input type="number" min="0" value={roomForm.waterPrice} onChange={(e) => setRoomForm({ ...roomForm, waterPrice: e.target.value })} /></label>
            </div>
            <div className="form-grid-2">
              <label>Internet<input type="number" min="0" value={roomForm.internetPrice} onChange={(e) => setRoomForm({ ...roomForm, internetPrice: e.target.value })} /></label>
              <label>Phí dịch vụ<input type="number" min="0" value={roomForm.serviceFee} onChange={(e) => setRoomForm({ ...roomForm, serviceFee: e.target.value })} /></label>
            </div>
            <label>Số người tối đa<input type="number" min="1" max="20" value={roomForm.maxOccupants} onChange={(e) => setRoomForm({ ...roomForm, maxOccupants: e.target.value })} required /></label>
            <label className="check-row"><input type="checkbox" checked={roomForm.hasMezzanine} onChange={(e) => setRoomForm({ ...roomForm, hasMezzanine: e.target.checked })} /> Có gác xép</label>

            <div className="amenity-picker">
              <strong>Tiện ích</strong>
              {groupedAmenities.map(([category, items]) => (
                <div key={category} className="amenity-group">
                  <span className="tiny muted">{category}</span>
                  <div className="amenity-checks">
                    {items.map((amenity) => (
                      <label className="check-chip" key={amenity.id}>
                        <input
                          type="checkbox"
                          checked={roomForm.amenityIds.includes(amenity.id)}
                          onChange={(e) => setRoomForm({
                            ...roomForm,
                            amenityIds: e.target.checked
                              ? [...roomForm.amenityIds, amenity.id]
                              : roomForm.amenityIds.filter((id) => id !== amenity.id),
                          })}
                        />
                        {amenity.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <button className="button button-primary" disabled={busyKey === "create-room"}>{busyKey === "create-room" ? "Đang thêm…" : "Thêm phòng"}</button>
          </form>
        </article>

        <section className="phase3-list-column">
          <div className="section-title-row"><div><p className="eyebrow">{property.rooms.length} PHÒNG</p><h2>Danh sách phòng</h2></div></div>

          {property.rooms.length === 0 ? <div className="empty-state"><h3>Chưa có phòng</h3><p>Thêm phòng đầu tiên bằng form bên trái.</p></div> : property.rooms.map((room) => {
            const listing = room.listings[0];
            const draft = listingDrafts[room.id] ?? { title: room.title, description: room.description ?? "" };
            return (
              <article className="room-card" key={room.id}>
                <div className="section-title-row">
                  <div><h3>{room.roomNumber ? `${room.roomNumber} · ` : ""}{room.title}</h3><p className="room-price">{money(room.price)} <span>/ tháng</span></p></div>
                  <select className="compact-select" value={room.status} disabled={busyKey === `status-${room.id}`} onChange={(e) => void updateRoomStatus(room.id, e.target.value as Room["status"])}>
                    <option value="AVAILABLE">AVAILABLE</option><option value="RESERVED">RESERVED</option><option value="RENTED">RENTED</option><option value="MAINTENANCE">MAINTENANCE</option>
                  </select>
                </div>
                <div className="metadata-row"><span>{String(room.areaM2)} m²</span><span>Tối đa {room.maxOccupants} người</span><span>Cọc {money(room.deposit)}</span></div>
                <div className="amenity-tags">{room.amenities.map(({ amenity }) => <span key={amenity.id}>{amenity.name}</span>)}</div>

                <div className="listing-panel">
                  {!listing ? (
                    <>
                      <div><p className="eyebrow">TIN ĐĂNG</p><h4>Tạo bản nháp cho phòng này</h4></div>
                      <input value={draft.title} onChange={(e) => setListingDrafts({ ...listingDrafts, [room.id]: { ...draft, title: e.target.value } })} placeholder="Tiêu đề tin đăng" />
                      <textarea rows={2} value={draft.description} onChange={(e) => setListingDrafts({ ...listingDrafts, [room.id]: { ...draft, description: e.target.value } })} placeholder="Mô tả tin đăng" />
                      <button className="button button-secondary button-small" disabled={busyKey === `listing-${room.id}`} onClick={() => void createListing(room)}>Tạo tin nháp</button>
                    </>
                  ) : (
                    <>
                      <div className="section-title-row"><div><p className="eyebrow">TIN ĐĂNG</p><h4>{listing.title}</h4></div><span className={`status-chip status-${listing.status.toLowerCase()}`}>{listing.status}</span></div>
                      {listing.status === "REJECTED" && listing.rejectionReason && (
                        <div className="alert alert-warning">
                          <strong>Lý do Admin từ chối:</strong> {listing.rejectionReason}
                        </div>
                      )}
                      {(listing.status === "DRAFT" || listing.status === "REJECTED") ? (() => {
                        const edit = listingEdits[listing.id] ?? { title: listing.title, description: listing.description ?? "" };
                        return (
                          <div className="listing-edit-form">
                            <input
                              value={edit.title}
                              onChange={(e) => setListingEdits({ ...listingEdits, [listing.id]: { ...edit, title: e.target.value } })}
                              placeholder="Tiêu đề tin đăng"
                            />
                            <textarea
                              rows={3}
                              value={edit.description}
                              onChange={(e) => setListingEdits({ ...listingEdits, [listing.id]: { ...edit, description: e.target.value } })}
                              placeholder="Mô tả tin đăng"
                            />
                            <button
                              className="button button-secondary button-small"
                              disabled={busyKey === `edit-listing-${listing.id}`}
                              onClick={() => void saveListing(listing)}
                            >
                              {busyKey === `edit-listing-${listing.id}` ? "Đang lưu…" : "Lưu nội dung"}
                            </button>
                          </div>
                        );
                      })() : listing.description ? <p className="muted">{listing.description}</p> : null}
                      <div className="listing-image-grid">
                        {listing.images.map((image) => (
                          <div className="listing-image" key={image.id}>
                            <SafeImage src={apiAssetUrl(image.url)} alt={listing.title} />
                            {(listing.status === "DRAFT" || listing.status === "REJECTED") && <button aria-label="Xóa ảnh" disabled={busyKey === `delete-image-${image.id}`} onClick={() => void deleteImage(listing.id, image.id)}>×</button>}
                          </div>
                        ))}
                      </div>
                      {(listing.status === "DRAFT" || listing.status === "REJECTED") && (
                        <div className="listing-actions">
                          <label className="button button-secondary button-small file-button">
                            {busyKey === `image-${listing.id}` ? "Đang tải…" : "＋ Thêm ảnh"}
                            <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busyKey === `image-${listing.id}`} onChange={(e) => { const file = e.target.files?.[0]; void uploadImage(listing.id, file); e.currentTarget.value = ""; }} />
                          </label>
                          <button className="button button-primary button-small" disabled={busyKey === `submit-${listing.id}`} onClick={() => void submitListing(listing.id)}>Gửi Admin duyệt</button>
                        </div>
                      )}
                      {listing.status === "PENDING" && <p className="tiny muted">Tin đang chờ Admin duyệt.</p>}
                      {listing.status === "APPROVED" && <p className="tiny muted">Tin đã được Admin duyệt và đang hiển thị công khai nếu phòng AVAILABLE.</p>}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}
