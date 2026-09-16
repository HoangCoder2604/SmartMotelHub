# SmartMotel Hub — Phase 12

## Production Optimization & UX Hardening

Phase 12 gom toàn bộ tối ưu production vào một lượt, đồng thời bổ sung hai yêu cầu mới: **xóa/ẩn lịch sử thanh toán của TENANT** và **sửa ảnh listing khi deploy**.

### 1. Performance

- Next.js có route-level skeleton thay vì màn hình trắng khi chuyển trang.
- Frontend preconnect tới API production và bỏ request RBAC debug dư thừa ở Dashboard.
- Public listing + amenities dùng cache header phù hợp; dữ liệu auth/payment vẫn `no-store`.
- API client có timeout rõ ràng để không treo loading vô thời hạn.
- Prisma/Supabase không eager `$connect()` lúc Nest bootstrap; pool vẫn giới hạn nhỏ cho serverless.
- Payment và Notification chuyển sang pagination.
- Bổ sung index cho payment feed, public listings, room price/status, appointments, invoices và đảm bảo GIST location.

### 2. Payment history cleanup

TENANT có nút **Xóa khỏi lịch sử**.

Đây là soft-hide, không hard-delete dữ liệu tài chính:

- `payments.tenant_hidden_at` được ghi thời gian ẩn.
- TENANT không còn thấy item đó.
- LANDLORD và ADMIN vẫn đối soát được.
- Giao dịch `PENDING` không được ẩn.

API:

```text
DELETE /api/v1/payments/:id/history
```

### 3. Listing images / Supabase Storage

Ảnh upload mới dùng Supabase Storage khi backend có:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=listing-images
```

Frontend có fallback nếu ảnh lỗi và ảnh card được lazy-load.

Dữ liệu PostgreSQL cũ chỉ migrate URL/metadata, không tự chuyển file local. Nếu máy cũ vẫn còn `apps/api/uploads/listings`, chạy:

```powershell
npm run images:migrate-storage --workspace=apps/api
```

Script upload file local lên bucket và cập nhật `listing_images.url/public_id` sang Supabase public URL. File gốc đã mất thì script báo `MISSING` và frontend sẽ hiển thị placeholder.

### 4. Security / production hardening

- Rate limit toàn API với ngưỡng chặt hơn cho auth, payment, upload.
- CORS chỉ nhận origin trong `WEB_ORIGIN`; request server-to-server không có Origin vẫn được phép cho VNPAY IPN.
- Security headers cho API và Next.js.
- Production env validation khi NestJS khởi động.
- Upload ảnh kiểm tra MIME + magic bytes + size + số lượng.
- Request/error logging không log token/secret; request > 1.5s được đánh dấu `SLOW`.
- Frontend có trang 403 / 404 / 500.

> Rate limiter hiện là in-memory theo từng Vercel instance. Với quy mô đồ án và demo production là đủ. Nếu triển khai tải lớn đa-instance, chuyển state rate-limit sang Redis/Upstash.

## Cập nhật database

Phase 12 **không seed và không xóa dữ liệu**.

Sau khi copy patch:

```powershell
npm install
npm run db:generate
npm run db:deploy
```

Migration mới thêm `tenant_hidden_at` và các index production.

## Build test

```powershell
npm run build --workspace=apps/api
npm run build --workspace=apps/web
```

## Vercel checklist

Backend production:

```text
DATABASE_URL              Transaction pooler :6543
DIRECT_URL                Session/Direct :5432
DATABASE_POOL_MAX          1 hoặc 2
WEB_ORIGIN                 https://smartmotel-hub.vercel.app
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_STORAGE_BUCKET
VNPAY_TMN_CODE
VNPAY_HASH_SECRET
VNPAY_PAYMENT_URL
VNPAY_RETURN_URL
VNPAY_WEB_RESULT_URL
VNPAY_ORDER_TYPE
VNPAY_EXPIRE_MINUTES
VNPAY_IPN_URL
```

Frontend production chỉ có biến public:

```text
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
NEXT_PUBLIC_FIREBASE_VAPID_KEY
```

Không đặt `DATABASE_URL`, `DIRECT_URL`, `FIREBASE_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` hoặc `VNPAY_HASH_SECRET` ở frontend.

Trong Vercel backend, bật **Fluid Compute** và chọn Function Region gần Supabase (project hiện dùng `ap-southeast-1`, nên ưu tiên Singapore nếu plan cho phép).

## Test chung Phase 12

1. `GET /api/v1/health` trả 200.
2. Login TENANT / LANDLORD / ADMIN vẫn hoạt động.
3. Public listings load, filter, pagination, near-me hoạt động.
4. Ảnh mới upload hiện từ Supabase Storage; URL ảnh hỏng hiển thị placeholder.
5. TENANT payment history phân trang, xóa khỏi lịch sử được; payment vẫn còn ở LANDLORD/ADMIN.
6. VNPAY checkout/Return/IPN vẫn hoạt động; invoice chuyển `PAID` khi success.
7. Notifications phân trang, mark-read/delete/push vẫn hoạt động.
8. Truy cập sai role chuyển sang `/forbidden`.
9. URL không tồn tại hiển thị 404; runtime UI error có trang 500.
10. F12 Console không có CORS error và Network không gọi `localhost` trên production.
