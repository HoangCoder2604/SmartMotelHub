# Phase 12 backend environment checklist

Production startup sẽ fail-fast nếu thiếu biến cốt lõi để tránh deployment chạy nửa vời.

Không commit value thật của secret. Đối chiếu tên key trong `apps/api/.env.example` và Vercel Environment Variables.

`WEB_ORIGIN` có thể chứa nhiều origin phân tách bằng dấu phẩy, nhưng production nên chỉ giữ domain frontend chính và các Preview domain thật sự cần thiết.
