# SmartMotel Hub — Phase 3 patch

Phase 3 adds the first real motel-management domain flow on top of the completed Firebase/NestJS/PostgreSQL authentication stack.

## Included

### Backend
- `GET /api/v1/amenities`
- LANDLORD-only property management:
  - `GET /api/v1/properties/mine`
  - `GET /api/v1/properties/:id`
  - `POST /api/v1/properties`
  - `PATCH /api/v1/properties/:id`
  - `DELETE /api/v1/properties/:id` (soft archive -> `INACTIVE`)
- LANDLORD-only room management:
  - `POST /api/v1/properties/:propertyId/rooms`
  - `PATCH /api/v1/rooms/:id`
- LANDLORD-only listing management:
  - `GET /api/v1/landlord/listings/mine`
  - `POST /api/v1/landlord/listings/room/:roomId`
  - `PATCH /api/v1/landlord/listings/:id`
  - `POST /api/v1/landlord/listings/:id/images`
  - `DELETE /api/v1/landlord/listings/:id/images/:imageId`
  - `POST /api/v1/landlord/listings/:id/submit`
- Public approved listings:
  - `GET /api/v1/listings`
  - `GET /api/v1/listings/:id`
- Local development image serving:
  - `GET /api/v1/listing-images/:filename`

### Security
- Property/room/listing writes require `LANDLORD` role.
- Writes also require verified email.
- Ownership is checked again in the service layer.
- Listing image upload is limited to 5 MB and 8 images/listing.
- File contents are signature-checked for JPEG/PNG/WebP instead of trusting the browser MIME header.
- Generated filenames are used instead of user filenames.
- Uploaded development files are ignored by Git.

### Frontend
- Dashboard now has role-specific Phase 3 actions.
- `/landlord/properties`: create/list/archive properties.
- `/landlord/properties/[id]`: add rooms, choose amenities, change room status, create listing draft, upload/remove images, submit listing for review.
- `/listings`: public search/filter page for `APPROVED` listings.

## Install

Copy this patch into the existing `smartmotel-hub` root and choose **Replace files in destination**.

No new npm package is required and the Prisma schema is unchanged, so there is no new migration in this patch.

Make sure amenities exist:

```powershell
npm run db:seed
```

Then run API and frontend in separate terminals:

```powershell
npm run dev:api
```

```powershell
npm run dev:web
```

## Test flow

1. Log in with the verified `LANDLORD` account.
2. Dashboard -> **Quản lý nhà trọ**.
3. Create one property.
4. Open **Quản lý phòng**.
5. Add one room and select amenities.
6. Create a listing draft for that room.
7. Upload at least one JPG/PNG/WebP image (max 5 MB/image, max 8 images).
8. Click **Gửi Admin duyệt**. Listing status should become `PENDING`.

Admin moderation is intentionally not bypassed. The public `/listings` endpoint only returns `APPROVED` records.

For a temporary Phase 3 UI test only, open Prisma Studio and manually change the test listing from `PENDING` to `APPROVED`; then refresh `http://localhost:3001/listings`. In the later Admin phase, this manual test step will be replaced with real moderation endpoints/UI.

## Local image storage

Images are stored during development under:

```text
apps/api/uploads/listings/
```

This folder is ignored by Git. For production, move this storage adapter to Cloudinary / S3 / Cloudflare R2 instead of using the local filesystem.
