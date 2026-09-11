# SmartMotel Hub — Phase 10: Analytics & Reporting

Phase 10 bổ sung dashboard phân tích theo vai trò. Backend luôn lấy user hiện tại từ Firebase token + PostgreSQL profile; client không truyền tenantId/landlordId để chọn phạm vi dữ liệu.

## Cài patch

Copy thư mục `apps/` vào root project SmartMotel Hub và chọn Replace khi được hỏi.

Phase 10 **không thay đổi Prisma schema và không có migration**.

Chỉ cần restart:

```powershell
npm run dev:api
npm run dev:web
```

Nếu muốn kiểm tra generated client trước khi chạy API vẫn có thể dùng `npm run db:generate`, nhưng không bắt buộc cho Phase 10.

## API

```text
GET /api/v1/analytics/overview?months=3
GET /api/v1/analytics/overview?months=6
GET /api/v1/analytics/overview?months=12
```

Khoảng thời gian được backend giới hạn 3–12 tháng.

### ADMIN

- tổng user + phân bố role/status
- property / room / tỷ lệ lấp đầy
- listing theo trạng thái
- contract ACTIVE
- invoice PAID / UNPAID / OVERDUE
- tổng tiền invoice PAID đã được xác nhận
- tổng tiền còn phải thu
- complaint theo trạng thái
- xu hướng PAID invoice và user mới theo tháng

### LANDLORD

Chỉ lấy dữ liệu thuộc `landlordId` đang đăng nhập:

- property / room / occupancy
- listing theo trạng thái
- appointment
- contract ACTIVE
- invoice và số tiền đã thu / còn phải thu
- xu hướng tiền đã xác nhận theo tháng

### TENANT

Chỉ lấy dữ liệu thuộc `tenantId` đang đăng nhập:

- favorites
- appointment
- contract ACTIVE
- invoice
- tổng đã thanh toán / chưa thanh toán
- hóa đơn quá hạn
- review count
- phòng đang thuê
- chi tiêu theo tháng

## UI

Mở:

```text
http://localhost:3001/analytics
```

Hoặc Dashboard → **Phân tích & báo cáo**.

Thử đổi 3 / 6 / 12 tháng. Với database test ít dữ liệu, các tháng không có phát sinh hiển thị 0 là đúng.

## Security acceptance test

Điểm quan trọng của Phase 10 là **không có query `tenantId` hoặc `landlordId` từ frontend**. Backend tự scope theo user trong token.

- LANDLORD A chỉ thấy property/room/invoice/contract của A.
- LANDLORD B đăng nhập cùng URL `/analytics` vẫn chỉ thấy dữ liệu B.
- TENANT chỉ thấy chi tiêu/hợp đồng của chính mình.
- ADMIN mới nhận toàn cảnh hệ thống.

## Ý nghĩa số tiền

`Đã thu`, `Đã thanh toán`, `paidRevenue` là tổng `Invoice.status = PAID` trong PostgreSQL — tức khoản thanh toán đã được hệ thống/chủ nhà xác nhận. Đây chưa phải dữ liệu đối soát từ cổng VNPay/MoMo/ngân hàng thật.
