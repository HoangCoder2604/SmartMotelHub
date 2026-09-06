"use client";

import { useEffect, useState } from "react";

type Health = {
  success: boolean;
  data?: { api: string; database: string; postgisVersion: string; timestamp: string };
};

export default function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
    fetch(`${api}/health`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unknown error"));
  }, []);

  return (
    <main>
      <section className="panel">
        <p className="eyebrow">SMARTMOTEL HUB</p>
        <h1>Phase 1 foundation</h1>
        <p className="lead">Next.js + NestJS + PostgreSQL/PostGIS + Prisma + Docker đã được nối thành một skeleton chạy được.</p>

        <div className="status">
          <strong>Backend health</strong>
          {!health && !error && <span>Đang kiểm tra…</span>}
          {error && <span className="bad">Chưa kết nối API: {error}</span>}
          {health?.success && health.data && (
            <ul>
              <li>API: {health.data.api}</li>
              <li>Database: {health.data.database}</li>
              <li>PostGIS: {health.data.postgisVersion}</li>
            </ul>
          )}
        </div>

        <p className="note">Phase 1 chưa có auth, giao diện tìm phòng, map, booking hay admin.</p>
      </section>
    </main>
  );
}
