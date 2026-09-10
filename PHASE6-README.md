# SmartMotel Hub — Phase 6: Appointment Booking + Reviews

Phase 6 nối tiếp Phase 5 và sử dụng hai bảng `appointments` + `reviews` đã có từ Phase 1, vì vậy **không cần migration database mới**.

## Tính năng

### TENANT — đặt lịch xem phòng
- Từ `/listings/{id}` chọn ngày, giờ bắt đầu, giờ kết thúc và lời nhắn.
- Chỉ listing `APPROVED`, room `AVAILABLE`, property `ACTIVE` mới đặt được.
- Lịch phải ở tương lai.
- Chặn trùng lịch cùng phòng.
- Chặn TENANT tự đặt hai lịch chồng giờ.
- Lịch mới có trạng thái `PENDING`.
- `/appointments` hiển thị toàn bộ lịch của TENANT.
- TENANT có thể hủy `PENDING` hoặc `CONFIRMED` → `CANCELLED`.

### LANDLORD — xử lý lịch
Trang `/landlord/appointments`:
- `PENDING → CONFIRMED`
- `PENDING → REJECTED` + ghi chú tùy chọn
- `CONFIRMED → COMPLETED`
- `CONFIRMED → NO_SHOW`
- Ownership được kiểm tra bằng `landlordId`, landlord khác không thể thao tác lịch không thuộc mình.

### Reviews
- Chỉ TENANT có ít nhất một appointment `COMPLETED` tại property mới được đánh giá.
- Mỗi TENANT chỉ đánh giá một lần cho mỗi property (`@@unique([tenantId, propertyId])`).
- Rating 1–5: tổng thể, chủ nhà, an ninh, yên tĩnh, chi phí.
- Review đủ điều kiện được `VISIBLE` ngay trong Phase 6.
- Trang listing detail hiển thị điểm trung bình + tối đa 20 review gần nhất.

## API mới

TENANT:
- `GET /api/v1/appointments`
- `POST /api/v1/appointments/listings/:listingId`
- `PATCH /api/v1/appointments/:id/cancel`

LANDLORD:
- `GET /api/v1/landlord/appointments`
- `PATCH /api/v1/landlord/appointments/:id/confirm`
- `PATCH /api/v1/landlord/appointments/:id/reject`
- `PATCH /api/v1/landlord/appointments/:id/complete`
- `PATCH /api/v1/landlord/appointments/:id/no-show`

Reviews:
- `GET /api/v1/reviews/properties/:propertyId`
- `GET /api/v1/reviews/properties/:propertyId/eligibility` — TENANT
- `POST /api/v1/reviews/properties/:propertyId` — TENANT đã hoàn tất lịch

## File thêm / thay

Backend:
- `apps/api/src/appointments/**`
- `apps/api/src/reviews/**`
- `apps/api/src/app.module.ts`

Frontend:
- `apps/web/app/appointments/page.tsx`
- `apps/web/app/appointments/phase6.module.css`
- `apps/web/app/landlord/appointments/page.tsx`
- `apps/web/app/listings/[id]/page.tsx`
- `apps/web/app/dashboard/page.tsx`

## Cài patch

Copy toàn bộ nội dung folder patch vào root `smartmotel-hub/` và chọn Replace.

Không cần `db:deploy`. Chạy:

```powershell
npm run db:generate
npm run dev:api
```

Terminal khác:

```powershell
npm run dev:web
```

## Flow test đề xuất

1. Login TENANT → mở một listing APPROVED → `Đặt lịch xem phòng`.
2. Chọn ngày mai + 09:00–10:00 → gửi → phải tạo `PENDING`.
3. Mở `/appointments` → lịch phải xuất hiện.
4. Login LANDLORD sở hữu phòng → `/landlord/appointments` → lịch PENDING phải xuất hiện.
5. Bấm `Xác nhận` → `CONFIRMED`.
6. Login TENANT → `/appointments` → thấy `CONFIRMED`.
7. Login LANDLORD → `Đánh dấu hoàn tất` → `COMPLETED`.
8. Login TENANT → `/appointments` → nút `Đánh giá nhà trọ` xuất hiện.
9. Gửi review → reload listing detail → review và điểm trung bình phải xuất hiện.
10. Test thêm: đặt lịch trùng giờ cùng room phải `409`, LANDLORD khác thao tác appointment phải `404`, LANDLORD/ADMIN gọi TENANT appointments/reviews phải `403`.

## Acceptance criteria

- Booking chỉ hoạt động với listing public hợp lệ.
- Không đặt lịch quá khứ.
- Không overlap cùng room hoặc cùng TENANT.
- TENANT chỉ thấy/hủy appointment của mình.
- LANDLORD chỉ xử lý appointment thuộc property của mình.
- State transitions đúng: PENDING → CONFIRMED/REJECTED; CONFIRMED → COMPLETED/NO_SHOW; TENANT → CANCELLED.
- Review chỉ sau appointment COMPLETED.
- Một review / tenant / property.
- Public listing detail hiển thị review VISIBLE và aggregate rating.
