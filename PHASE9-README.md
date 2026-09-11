# SmartMotel Hub — Phase 9: Firebase Cloud Messaging (Web Push)

Phase 9 nối tiếp Phase 8 và nâng cấp hệ thống `notifications` từ chỉ thông báo trong app thành **Firebase Cloud Messaging (FCM) Web Push**.

## Flow

`Business event → notifications table → tìm push_devices của user → Firebase Admin FCM → Browser/Web Push`

Ví dụ các event đã có từ Phase 7–8 như `CONTRACT_CREATED`, `INVOICE_CREATED`, `INVOICE_PAID`, `COMPLAINT_RESOLVED` sẽ tự động được đẩy ra trình duyệt nếu user đã bật push.

## Chức năng

- User chủ động bấm **Bật thông báo trình duyệt** tại `/notifications`.
- Browser xin quyền Notification bằng user gesture.
- Firebase Web SDK tạo FCM registration token.
- Backend lưu token vào bảng `push_devices` theo `userId`.
- Có thể đăng ký nhiều trình duyệt/thiết bị cho cùng user.
- Push gửi best-effort: nếu FCM lỗi thì nghiệp vụ chính vẫn thành công và notification trong PostgreSQL vẫn còn.
- Token FCM hết hạn/invalid được backend tự xóa khi gửi.
- Khi logout, frontend cố gỡ token của thiết bị khỏi account trước khi sign out để giảm rủi ro trên máy dùng chung.
- Có nút **Gửi thông báo thử** để test FCM không cần account thứ hai.
- Foreground push được hiển thị bằng Browser Notification.
- Background push được xử lý bởi `/firebase-messaging-sw.js`.
- Click notification mở đúng `href` nội bộ.

## Database migration

Có migration:

`202609110001_phase9_fcm_push`

Thêm bảng:

- `push_devices.id`
- `push_devices.user_id`
- `push_devices.token` (unique)
- `push_devices.platform`
- `push_devices.user_agent`
- `push_devices.last_seen_at`
- `push_devices.created_at`
- `push_devices.updated_at`

## API mới

Authenticated user:

- `GET /api/v1/notifications/push/status`
- `POST /api/v1/notifications/push/device`
- `DELETE /api/v1/notifications/push/device`
- `POST /api/v1/notifications/push/test`

API notification cũ vẫn giữ nguyên:

- `GET /api/v1/notifications`
- `PATCH /api/v1/notifications/:id/read`
- `PATCH /api/v1/notifications/read-all`

## Cấu hình Firebase Web Push

Firebase Console → Project settings → **Cloud Messaging** → phần **Web Push certificates**.

Nếu chưa có key pair, chọn **Generate key pair**. Copy **public key** (VAPID public key).

Thêm vào file thật:

`apps/web/.env.local`

```env
NEXT_PUBLIC_FIREBASE_VAPID_KEY=YOUR_PUBLIC_VAPID_KEY
```

Không đặt private key ở frontend. `NEXT_PUBLIC_FIREBASE_VAPID_KEY` là public key và có thể dùng ở browser.

Sau khi đổi `.env.local`, phải restart Next.js.

## Cài patch

Copy toàn bộ nội dung patch vào root `smartmotel-hub/` và chọn Replace.

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

Phase 9 không thêm npm dependency mới vì project đã có `firebase` và `firebase-admin`.

## Test nhanh

1. Điền `NEXT_PUBLIC_FIREBASE_VAPID_KEY` trong `apps/web/.env.local`.
2. Restart web.
3. Login bất kỳ user hợp lệ.
4. Mở `http://localhost:3001/notifications`.
5. Bấm **Bật thông báo trình duyệt** → Chrome/Edge chọn **Allow**.
6. Chạy Prisma Studio và kiểm tra bảng `push_devices` có 1 row với đúng `user_id`.
7. Quay lại `/notifications` → bấm **Gửi thông báo thử**.
8. Phải thấy Browser Notification: `SmartMotel Hub — Thông báo đẩy FCM trên thiết bị này đang hoạt động.`
9. Chuyển tab sang nền/minimize browser rồi gửi thử lại để test Service Worker background push.
10. Click notification phải mở `/notifications`.
11. Bấm **Tắt trên thiết bị này** → row token của thiết bị phải bị xóa khỏi `push_devices`.
12. Bật lại push và thử một event thật, ví dụ LANDLORD tạo invoice cho TENANT; TENANT phải nhận cả in-app notification và browser push.

## Security acceptance

- Mọi endpoint push đều yêu cầu FirebaseAuthGuard + RegisteredUserGuard.
- User chỉ đăng ký/gỡ push token cho chính `userId` backend lấy từ token đăng nhập; client không được gửi `userId` tùy ý.
- `DELETE push/device` có điều kiện `userId + token`, nên user A không thể gỡ device của user B chỉ bằng token.
- Một FCM token đã liên kết user A không được tự động chuyển sang user B; backend trả `409 Conflict` nếu chưa logout/gỡ đúng cách.
- Logout cố unregister token trước khi Firebase sign out.
- Không lưu Firebase service-account private key ở frontend.
- Service worker chỉ cho phép `href` bắt đầu bằng `/` để tránh click push redirect sang site ngoài.
- Push fail không rollback các nghiệp vụ chính như invoice/contract/complaint.

## Lưu ý trình duyệt

- `localhost` có thể dùng Web Push khi phát triển.
- Khi deploy production, site phải dùng HTTPS.
- Nếu browser đã chọn **Block**, cần vào Site settings của trình duyệt và đổi Notifications thành Allow trước khi bấm lại.
- Nếu FCM test tạo notification trong database nhưng không có browser popup, kiểm tra VAPID key, browser permission và row trong `push_devices` trước.
