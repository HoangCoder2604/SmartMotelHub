# SmartMotel Hub — Phase 5: Tenant Search & Discovery

Phase 5 mở rộng phần TENANT dựa trên dữ liệu thật đã có từ Phase 3/4.

## Tính năng

### Public search
- Search: tiêu đề, mô tả, tên nhà trọ, địa chỉ
- Lọc city / district
- Giá min / max
- Diện tích min / max
- Số người tối thiểu
- Có / không có gác
- Lọc nhiều tiện ích (phải có đủ các tiện ích đã chọn)
- Sort: mới nhất, giá tăng/giảm, diện tích, lượt xem, khoảng cách
- Pagination 12 tin/trang

### Nearby + PostGIS
- Browser Geolocation lấy lat/lng của TENANT
- Backend dùng `ST_DWithin` + `ST_Distance` trên `properties.location geography(Point,4326)`
- Bán kính 2 / 5 / 10 / 20 / 50 km
- Không cần migration mới vì PostGIS + GIST index đã có từ Phase 1

### Listing detail
- Gallery ảnh
- Giá, diện tích, sức chứa, gác
- Tiện ích
- Cọc + điện + nước + internet + service fee
- Map preview từ latitude/longitude
- Tăng viewCount
- Gợi ý phòng tương tự trong cùng district/city

### Favorites
- TENANT lưu / bỏ lưu listing
- Trang `/favorites`
- Backend chỉ cho role TENANT dùng favorites
- Bảng `favorites` đã có từ Phase 1 nên không cần migration

## File được thêm / thay

Backend:
- `apps/api/src/listings/dto/list-public-listings-query.dto.ts`
- `apps/api/src/listings/listings.service.ts`
- `apps/api/src/listings/public-listings.controller.ts`
- `apps/api/src/favorites/favorites.service.ts`
- `apps/api/src/favorites/favorites.controller.ts`
- `apps/api/src/favorites/favorites.module.ts`
- `apps/api/src/app.module.ts`

Frontend:
- `apps/web/app/listings/page.tsx`
- `apps/web/app/listings/[id]/page.tsx`
- `apps/web/app/listings/phase5.module.css`
- `apps/web/app/favorites/page.tsx`
- `apps/web/app/dashboard/page.tsx`

## Cài patch

Copy toàn bộ nội dung của folder patch vào root `smartmotel-hub/`, chọn Replace.

Phase này KHÔNG thay schema database và KHÔNG thêm npm package mới.

Chạy:

```powershell
npm run db:generate
npm run dev:api
```

Terminal khác:

```powershell
npm run dev:web
```

Backend cần hiện:

```text
Found 0 errors. Watching for file changes.
Nest application successfully started
```

## Test

1. Login TENANT.
2. Mở `http://localhost:3001/listings`.
3. Test search theo `VKU`.
4. Test giá, diện tích, tiện ích.
5. Bấm `Tìm gần tôi`, cho phép Location; thử bán kính 50 km nếu listing test ở xa vị trí hiện tại.
6. Bấm tiêu đề listing → `/listings/{id}`.
7. Test gallery, chi phí, map, viewCount.
8. Bấm `Lưu phòng` → vào `/favorites` → listing phải xuất hiện.
9. Bỏ lưu → listing biến mất khỏi `/favorites`.
10. Dùng LANDLORD hoặc ADMIN gọi `/api/v1/favorites` phải nhận 403.

## Acceptance criteria

- Search/filter trả đúng listing APPROVED + room AVAILABLE + property ACTIVE.
- Amenity filter yêu cầu đủ tất cả tiện ích được chọn.
- Nearby search dùng PostGIS và trả `distanceKm`.
- Pagination hoạt động.
- Detail chỉ mở listing public.
- viewCount tăng khi mở detail.
- TENANT add/remove favorite được.
- LANDLORD/ADMIN không được dùng favorites API.
