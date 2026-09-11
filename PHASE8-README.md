# SmartMotel Hub — Phase 8: Trust & Safety / Complaints

Phase 8 nối tiếp Phase 7 và bổ sung luồng báo cáo tin đăng + xử lý khiếu nại bởi Admin.

## Flow

`TENANT/LANDLORD → báo cáo listing APPROVED → OPEN → ADMIN nhận xử lý → INVESTIGATING → RESOLVED hoặc REJECTED → notification cho reporter`

## Chức năng

### User
- Trang `/complaints` xem các báo cáo của chính mình.
- Từ trang chi tiết listing có nút `⚑ Báo cáo tin` tự truyền `listingId`.
- Loại báo cáo: `MISLEADING`, `FRAUD`, `WRONG_PRICE`, `INAPPROPRIATE`, `SAFETY`, `OTHER`.
- Mô tả tối thiểu 20 ký tự.
- Có thể đính kèm URL bằng chứng.
- Không thể báo cáo listing của chính mình.
- Không tạo trùng báo cáo cùng reporter + listing + type khi báo cáo cũ còn `OPEN/INVESTIGATING`.
- User chỉ xem complaint do chính mình tạo.

### Admin
- Trang `/admin/complaints`.
- Thống kê OPEN / INVESTIGATING / RESOLVED / REJECTED.
- Tìm kiếm và filter trạng thái.
- `OPEN → INVESTIGATING` bằng nút Nhận xử lý.
- `OPEN/INVESTIGATING → RESOLVED` với ghi chú kết luận.
- `OPEN/INVESTIGATING → REJECTED` với lý do.
- Nếu complaint đã được Admin A nhận, Admin B không thể giành xử lý: `409 Conflict`.
- Reporter nhận notification khi Admin nhận xử lý / giải quyết / bác bỏ.

## Database migration

Có migration `202609100002_phase8_complaints` thêm:
- `complaints.admin_note`
- `complaints.resolved_at`
- index `complaints(status, created_at)`

## API

Authenticated user:
- `GET /api/v1/complaints`
- `POST /api/v1/complaints/listings/:listingId` (TENANT/LANDLORD + verified email)

ADMIN:
- `GET /api/v1/admin/complaints/stats`
- `GET /api/v1/admin/complaints?status=OPEN&search=...`
- `PATCH /api/v1/admin/complaints/:id/investigate`
- `PATCH /api/v1/admin/complaints/:id/resolve`
- `PATCH /api/v1/admin/complaints/:id/reject`

## Cài patch

Copy `apps/` vào root project và Replace.

Chạy:

```powershell
npm run db:generate
npm run db:deploy
npm run dev:api
```

Terminal khác:

```powershell
npm run dev:web
```

## Test nhanh

1. Login TENANT → `/listings` → mở một listing APPROVED → `⚑ Báo cáo tin`.
2. Chọn `MISLEADING`, nhập mô tả >= 20 ký tự → gửi.
3. `/complaints` phải thấy `OPEN`.
4. Gửi lại cùng loại cho cùng tin khi complaint còn OPEN → `409 Conflict`.
5. Login ADMIN → `/admin/complaints` → thấy complaint.
6. `Nhận xử lý` → `INVESTIGATING`.
7. `Giải quyết` + ghi chú → `RESOLVED`, `resolvedAt != null`, `adminNote != null`.
8. Login TENANT → `/notifications` thấy `COMPLAINT_RESOLVED`; `/complaints` thấy phản hồi Admin.

## Security acceptance

- LANDLORD không thể report chính listing của mình → 400.
- User A không thể xem complaint của User B qua API danh sách (server filter reporterId).
- Non-ADMIN gọi `/admin/complaints` → 403.
- Admin B không thể xử lý complaint đã assigned cho Admin A → 409.
- Complaint terminal RESOLVED/REJECTED không được xử lý lần hai → 400.
