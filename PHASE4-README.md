# SmartMotel Hub — Phase 4 Admin Moderation

## Mục tiêu

Phase 4 thay thao tác sửa `PENDING -> APPROVED` thủ công trong Prisma Studio bằng Admin Console thật.

### Backend
- `GET /api/v1/admin/stats`
- `GET /api/v1/admin/listings`
- `GET /api/v1/admin/listings/:id`
- `PATCH /api/v1/admin/listings/:id/approve`
- `PATCH /api/v1/admin/listings/:id/reject`
- `GET /api/v1/admin/users`
- `PATCH /api/v1/admin/users/:id/status`
- Tất cả Admin API yêu cầu Firebase token + PostgreSQL user + `ADMIN` role + verified email.
- Approve tự động set `publishedAt`, `reviewedAt`, `reviewedByAdminId`.
- Reject lưu `rejectionReason` để LANDLORD nhìn thấy và sửa rồi gửi lại.
- Admin không thể tự SUSPEND/BAN chính tài khoản đang dùng.

### Database
Thêm vào `listings`:
- `rejection_reason`
- `reviewed_at`
- `reviewed_by_admin_id`

Migration: `202609090004_phase4_admin_moderation`.

### Frontend
- `/admin`: Admin Console
- Dashboard ADMIN có link vào Admin Console.
- LANDLORD nhìn thấy lý do bị từ chối, có thể sửa title/description và gửi lại.

## Cách áp patch

Copy toàn bộ nội dung trong folder patch vào root `smartmotel-hub/` và chọn Replace.

Sau đó chạy tại root project:

```powershell
npm run db:generate
npm run db:deploy
```

Restart API:

```powershell
npm run dev:api
```

Terminal khác:

```powershell
npm run dev:web
```

Backend phải báo `Found 0 errors` và start thành công.

## Tạo tài khoản ADMIN để test

Frontend không cho người dùng tự chọn ADMIN. Đây là chủ ý bảo mật.

1. `npm run db:studio`
2. Vào bảng `users`.
3. Chọn một tài khoản test đang là TENANT.
4. Đổi `role: TENANT -> ADMIN` rồi Save.
5. Logout/login lại tài khoản đó.
6. Dashboard phải hiện role `ADMIN` và link `Duyệt tin & quản lý user`.

Không sửa email, firebaseUid hay verification fields.

## Test end-to-end

### Test APPROVE
1. Cần một listing `PENDING`.
2. Login ADMIN -> `/admin`.
3. Tab `Duyệt tin`, filter `PENDING`.
4. Bấm `Duyệt`.
5. Listing chuyển `APPROVED` và `publishedAt` được backend tự set.
6. Mở `/listings`: TENANT thấy tin ngay.

### Test REJECT -> sửa -> gửi lại
1. Tạo/reset một listing về `PENDING`.
2. ADMIN bấm `Từ chối`, nhập lý do >= 5 ký tự.
3. Listing chuyển `REJECTED`.
4. Login LANDLORD -> quản lý phòng.
5. LANDLORD thấy lý do từ chối, sửa title/description/ảnh nếu cần.
6. `Lưu nội dung` đưa tin về `DRAFT` và xóa moderation metadata cũ.
7. `Gửi Admin duyệt` -> `PENDING`.
8. ADMIN duyệt -> `APPROVED`.

### Test User Status
1. ADMIN -> tab `Người dùng`.
2. Đổi một tài khoản test `ACTIVE -> SUSPENDED`.
3. Tài khoản đó phải bị backend chặn ở request tiếp theo.
4. Đổi lại `SUSPENDED -> ACTIVE`.

## Acceptance Criteria
- Admin API bị chặn với TENANT/LANDLORD: 403.
- ADMIN xem được queue PENDING.
- PENDING -> APPROVED qua UI Admin.
- `publishedAt` tự động, không cần Prisma Studio.
- PENDING -> REJECTED có lý do.
- LANDLORD nhìn thấy rejection reason và resubmit được.
- ADMIN quản lý ACTIVE/SUSPENDED/BANNED.
- Admin hiện tại không tự khóa chính mình.
