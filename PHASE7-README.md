# SmartMotel Hub — Phase 7: Contracts + Invoices + In-App Notifications

Phase 7 nối tiếp Phase 6 và biến flow sau lịch xem thành flow thuê phòng thật:

`COMPLETED appointment → DRAFT contract → TENANT accept → ACTIVE contract → invoices → landlord confirms payment`

## Phạm vi Phase 7

### LANDLORD — hợp đồng
- `/landlord/contracts`
- Chỉ các appointment `COMPLETED` chưa có contract và room chưa có `DRAFT/ACTIVE` contract mới xuất hiện trong danh sách ứng viên.
- Tạo hợp đồng `DRAFT` từ appointment đã hoàn tất.
- Tiền thuê/cọc được prefill từ Room nhưng LANDLORD có thể điều chỉnh khi tạo DRAFT.
- Có thể thu hồi contract `DRAFT`.
- Khi TENANT chấp nhận:
  - contract `DRAFT → ACTIVE`
  - set `tenantAcceptedAt`, `activatedAt`
  - Room `→ RENTED`
  - listing `APPROVED → HIDDEN`
  - các lịch PENDING/CONFIRMED còn lại của room bị `CANCELLED`
- LANDLORD có thể kết thúc contract `ACTIVE → TERMINATED`.
- Khi terminate:
  - Room `→ AVAILABLE`
  - listing `HIDDEN → DRAFT` để chủ nhà cập nhật rồi gửi Admin duyệt lại.

### TENANT — hợp đồng
- `/contracts`
- Xem contract được LANDLORD tạo cho mình.
- Chỉ TENANT sở hữu contract mới có thể accept.
- Accept yêu cầu email verified.

### Hóa đơn
LANDLORD:
- Chỉ contract `ACTIVE` mới tạo invoice được.
- Một contract chỉ có một invoice cho mỗi `billingMonth`.
- Server tự tính `total`, client không gửi total.
- Thành phần: tiền phòng, điện, nước, Internet, dịch vụ, khác.
- LANDLORD xác nhận `UNPAID/OVERDUE → PAID` và hệ thống set `paidAt`.

TENANT:
- `/invoices`
- Chỉ xem invoice thuộc contract của chính mình.
- `UNPAID` tự chuyển `OVERDUE` khi quá `dueDate` lúc API danh sách invoice được gọi.

> Phase 7 **chưa tích hợp cổng thanh toán thật** (VNPay/MoMo/Stripe). Nút `PAID` là xác nhận thanh toán thủ công từ LANDLORD để giữ MVP rõ ràng và không giả lập payment gateway.

### In-app notifications
- Bảng `notifications` mới.
- `/notifications` cho mọi user đã đăng nhập.
- Thông báo khi:
  - LANDLORD tạo/thu hồi contract
  - TENANT accept contract
  - contract bị terminate
  - invoice được tạo
  - LANDLORD xác nhận invoice PAID
  - lịch xem bị hủy do room đã có người thuê
- Có đánh dấu một thông báo đã đọc / đọc tất cả.

## Database migration

Phase 7 **có migration**.

Thêm vào `contracts`:
- `appointment_id`
- `tenant_accepted_at`
- `activated_at`
- `terminated_at`
- `termination_reason`

Thêm vào `invoices`:
- `payment_note`

Thêm bảng:
- `notifications`

## API

TENANT:
- `GET /api/v1/contracts`
- `PATCH /api/v1/contracts/:id/accept`
- `GET /api/v1/invoices`

LANDLORD:
- `GET /api/v1/landlord/contracts`
- `POST /api/v1/landlord/contracts`
- `DELETE /api/v1/landlord/contracts/:id`
- `PATCH /api/v1/landlord/contracts/:id/terminate`
- `GET /api/v1/landlord/invoices`
- `POST /api/v1/landlord/contracts/:contractId/invoices`
- `PATCH /api/v1/landlord/invoices/:id/paid`

AUTHENTICATED USER:
- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/:id/read`
- `PATCH /api/v1/notifications/read-all`

## Cài patch

Copy toàn bộ nội dung folder patch vào root `smartmotel-hub/` và chọn Replace.

Sau đó bắt buộc chạy:

```powershell
npm run db:generate
npm run db:deploy
```

Backend:

```powershell
npm run dev:api
```

Frontend terminal khác:

```powershell
npm run dev:web
```

## Flow test đề xuất

1. Đảm bảo Phase 6 có appointment `COMPLETED` giữa TENANT A và room của LANDLORD A.
2. Login LANDLORD A → `/landlord/contracts`.
3. Chọn appointment COMPLETED → tạo contract DRAFT.
4. Login TENANT A → `/notifications`: phải có `CONTRACT_CREATED`.
5. TENANT A → `/contracts` → kiểm tra tiền thuê/cọc/ngày → `Chấp nhận hợp đồng`.
6. Prisma Studio kiểm tra:
   - contract `ACTIVE`
   - `tenantAcceptedAt != null`
   - `activatedAt != null`
   - room `RENTED`
   - listing cũ `HIDDEN`
7. Login LANDLORD → `/landlord/contracts` → tạo invoice tháng hiện tại.
8. Login TENANT → `/invoices` → invoice phải hiện đúng tổng server tính.
9. LANDLORD → xác nhận đã thanh toán → invoice `PAID`, `paidAt != null`.
10. TENANT → `/notifications` → phải có `INVOICE_PAID`.
11. Test invoice trùng cùng `billingMonth` → phải `409 Conflict`.
12. Test LANDLORD khác truy cập/terminate contract của A → phải bị chặn `404`.
13. LANDLORD A terminate ACTIVE contract → contract `TERMINATED`, room `AVAILABLE`, listing `DRAFT`.

## Acceptance criteria

- Contract chỉ tạo từ appointment COMPLETED thuộc đúng LANDLORD.
- Không tạo DRAFT/ACTIVE contract thứ hai cho room đang có hợp đồng đang xử lý.
- TENANT chỉ xem/accept contract của chính mình.
- Accept contract cập nhật room/listing đúng transaction.
- Invoice chỉ tạo cho ACTIVE contract.
- Total invoice tính server-side.
- Duplicate invoice theo contract + month bị chặn.
- TENANT chỉ xem invoice của mình.
- LANDLORD chỉ thao tác invoice/contract thuộc mình.
- Payment confirmation chỉ do LANDLORD thực hiện.
- Notifications có ownership theo `userId`.
