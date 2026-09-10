# SmartMotel Hub — Phase 2 Dashboard Loading Hotfix

Copy `apps/` vào root project hiện tại và chọn **Replace**.

Hotfix:
- Email login chỉ dùng 1 token refresh + 1 API sync/profile request thay vì nhiều request tuần tự.
- Profile trả về từ backend được hydrate trực tiếp vào AuthProvider.
- Dashboard render ngay khi profile đã có, không chờ auth observer request nền.
- Nếu profile load lỗi, Dashboard hiển thị lỗi + nút Thử lại thay vì spinner vô hạn.

Không cần npm install, Prisma migration hay thay `.env`.
