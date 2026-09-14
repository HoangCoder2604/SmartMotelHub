"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import styles from "../phase11.module.css";

function ResultContent() {
  const search = useSearchParams();
  const status = search.get("status") ?? "INVALID";
  const txnRef = search.get("txnRef") ?? "—";
  const valid = search.get("valid") === "1";
  const success = valid && status === "SUCCEEDED";
  const pending = valid && status === "PENDING";

  const title = success ? "Thanh toán thành công" : pending ? "Đang chờ xác nhận" : status === "CANCELLED" ? "Bạn đã hủy thanh toán" : status === "EXPIRED" ? "Phiên thanh toán đã hết hạn" : "Thanh toán chưa thành công";
  const icon = success ? "✓" : pending ? "…" : "!";

  return <main className={styles.page}><div className={styles.shell}>
    <nav className="topbar"><Link href="/dashboard" className="brand">SmartMotel Hub</Link></nav>
    <section className={styles.card} style={{ maxWidth: 760, margin: "70px auto 0" }}>
      <div className={styles.resultIcon}>{icon}</div>
      <p className={styles.kicker}>VNPAY PAYMENT RESULT</p>
      <h1>{title}</h1>
      <p className={styles.muted}>{success ? "Hóa đơn đã được cập nhật PAID. Thông báo cũng đã gửi cho TENANT và LANDLORD." : "Bạn có thể kiểm tra trạng thái chính thức trong lịch sử giao dịch. Không thanh toán lại nếu giao dịch ngân hàng đã trừ tiền nhưng trạng thái chưa cập nhật."}</p>
      <div className={styles.details}><div><span>Trạng thái</span><strong>{status}</strong></div><div><span>Mã giao dịch</span><strong className={styles.code}>{txnRef}</strong></div><div><span>Chữ ký callback</span><strong>{valid ? "Hợp lệ" : "Không hợp lệ"}</strong></div></div>
      <div className={styles.actions}><Link href="/payments" className="button button-primary">Xem lịch sử thanh toán</Link><Link href="/invoices" className="button button-secondary">Về hóa đơn</Link></div>
    </section>
  </div></main>;
}

export default function PaymentResultPage() {
  return <Suspense fallback={<main className={styles.page}><div className={styles.shell}><div className={styles.empty}>Đang xác minh kết quả VNPAY…</div></div></main>}><ResultContent /></Suspense>;
}
