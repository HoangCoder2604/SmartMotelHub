"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../../components/auth-provider";
import { apiFetch } from "../../../lib/api";
import { statusLabel } from "../../../lib/ui-labels";

type PropertyRow = {
  id: string;
  name: string;
  description: string | null;
  address: string;
  ward: string | null;
  district: string;
  city: string;
  latitude: string | number;
  longitude: string | number;
  status: "ACTIVE" | "INACTIVE";
  _count: { rooms: number };
};

const initialForm = {
  name: "",
  description: "",
  address: "",
  ward: "",
  district: "",
  city: "",
  latitude: "",
  longitude: "",
};

export default function LandlordPropertiesPage() {
  const router = useRouter();
  const { loading, firebaseUser, profile } = useAuth();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !firebaseUser) router.replace("/auth/login");
    else if (!loading && profile && profile.role !== "LANDLORD") router.replace("/forbidden");
  }, [firebaseUser, loading, profile, router]);

  const loadProperties = useCallback(async () => {
    if (!firebaseUser || profile?.role !== "LANDLORD") return;
    setPageLoading(true);
    try {
      const token = await firebaseUser.getIdToken();
      const data = await apiFetch<{ properties: PropertyRow[] }>("/properties/mine", {}, token);
      setProperties(data.properties);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tải danh sách nhà trọ.");
    } finally {
      setPageLoading(false);
    }
  }, [firebaseUser, profile]);

  useEffect(() => {
    void loadProperties();
  }, [loadProperties]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!firebaseUser) return;
    setBusy(true);
    setMessage(null);
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch("/properties", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          address: form.address,
          ward: form.ward || undefined,
          district: form.district,
          city: form.city,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
        }),
      }, token);
      setForm(initialForm);
      setMessage("Đã tạo nhà trọ.");
      await loadProperties();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể tạo nhà trọ.");
    } finally {
      setBusy(false);
    }
  };

  const archive = async (id: string) => {
    if (!firebaseUser || !window.confirm("Tạm ngừng hoạt động nhà trọ này?")) return;
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/properties/${id}`, { method: "DELETE" }, token);
      await loadProperties();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật nhà trọ.");
    }
  };

  const reactivate = async (id: string) => {
    if (!firebaseUser || !window.confirm("Cho nhà trọ này hoạt động trở lại?")) return;
    try {
      const token = await firebaseUser.getIdToken();
      await apiFetch(`/properties/${id}/reactivate`, { method: "PATCH" }, token);
      setMessage("Nhà trọ đã hoạt động trở lại.");
      await loadProperties();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể kích hoạt lại nhà trọ.");
    }
  };

  if (loading || !profile) return <main className="center-screen"><p>Đang tải…</p></main>;

  return (
    <main className="site-shell phase3-shell">
      <nav className="topbar">
        <Link href="/dashboard" className="brand">SmartMotel Hub</Link>
        <Link href="/dashboard" className="button button-ghost button-small">← Dashboard</Link>
      </nav>

      <header className="phase3-header">
        <div>
          <p className="eyebrow">KHÔNG GIAN QUẢN LÝ CHỦ NHÀ</p>
          <h1>Quản lý nhà trọ</h1>
          <p className="muted">Tạo bất động sản trước, sau đó thêm phòng, tiện ích, tin đăng và ảnh.</p>
        </div>
        <span className="role-badge role-landlord">Chủ nhà</span>
      </header>

      {message && <div className="alert alert-info">{message}</div>}

      <section className="phase3-layout">
        <article className="info-card phase3-form-card">
          <h2>Thêm nhà trọ</h2>
          <form className="stack-form" onSubmit={submit}>
            <label>Tên nhà trọ<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: SmartMotel Nguyễn Văn Linh" required maxLength={200} /></label>
            <label>Mô tả<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mô tả tổng quan..." rows={3} /></label>
            <label>Địa chỉ<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Số nhà, tên đường" required /></label>
            <div className="form-grid-2">
              <label>Phường/Xã<input value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })} /></label>
              <label>Quận/Huyện<input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} required /></label>
            </div>
            <label>Thành phố/Tỉnh<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required /></label>
            <div className="form-grid-2">
              <label>Latitude<input type="number" step="0.000001" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="16.054407" required /></label>
              <label>Longitude<input type="number" step="0.000001" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="108.202167" required /></label>
            </div>
            <button className="button button-primary" disabled={busy}>{busy ? "Đang tạo…" : "Tạo nhà trọ"}</button>
          </form>
        </article>

        <section className="phase3-list-column">
          <div className="section-title-row">
            <div><p className="eyebrow">DỮ LIỆU THẬT TỪ POSTGRESQL</p><h2>Nhà trọ của bạn</h2></div>
            <button className="button button-secondary button-small" onClick={() => void loadProperties()}>Tải lại</button>
          </div>

          {pageLoading ? <div className="info-card"><p>Đang tải nhà trọ…</p></div> : properties.length === 0 ? (
            <div className="empty-state"><h3>Chưa có nhà trọ</h3><p>Tạo nhà trọ đầu tiên bằng form bên trái.</p></div>
          ) : properties.map((property) => (
            <article className="property-card" key={property.id}>
              <div className="property-card-main">
                <div className="section-title-row">
                  <div><h3>{property.name}</h3><p>{property.address}, {property.district}, {property.city}</p></div>
                  <span className={`status-chip status-${property.status.toLowerCase()}`}>{statusLabel(property.status)}</span>
                </div>
                <p className="muted">{property.description || "Chưa có mô tả."}</p>
                <div className="metadata-row"><span>{property._count.rooms} phòng</span><span>{String(property.latitude)}, {String(property.longitude)}</span></div>
              </div>
              <div className="property-card-actions">
                <Link className="button button-primary button-small" href={`/landlord/properties/${property.id}`}>Quản lý phòng</Link>
                {property.status === "ACTIVE" ? (
                  <button className="button button-ghost button-small danger-text" onClick={() => void archive(property.id)}>Ngừng hoạt động</button>
                ) : (
                  <button className="button button-secondary button-small" onClick={() => void reactivate(property.id)}>Hoạt động trở lại</button>
                )}
              </div>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
