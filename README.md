SmartMotel Hub

Nền tảng tìm kiếm, đăng tin, đặt phòng và quản lý nhà trọ dành cho sinh viên, người đi làm và chủ nhà.

Version: 1.0
Status: Final Release
Architecture: Next.js + NestJS + PostgreSQL/PostGIS + Prisma + Firebase + Supabase + Docker

1. Giới thiệu

SmartMotel Hub là hệ thống quản lý và tìm kiếm nhà trọ theo mô hình web application, hỗ trợ ba nhóm người dùng chính:

Tenant – người thuê phòng.

Landlord – chủ nhà/chủ trọ.

Admin – quản trị viên hệ thống.

Hệ thống được xây dựng với mục tiêu giải quyết toàn bộ vòng đời thuê trọ, từ tìm kiếm phòng, xem thông tin, đặt phòng, tạo hợp đồng, thanh toán hóa đơn, nhận thông báo cho đến khi gia hạn hoặc kết thúc hợp đồng.

SmartMotel Hub không chỉ là một website đăng tin phòng trọ mà còn cung cấp các chức năng quản lý hợp đồng, hóa đơn, thanh toán, khiếu nại, thông báo và phân quyền theo vai trò.

2. Mục tiêu dự án

SmartMotel Hub hướng đến các mục tiêu chính:

Giúp Tenant tìm phòng phù hợp nhanh hơn.

Cho phép Landlord quản lý property, phòng, listing và người thuê.

Hỗ trợ quy trình booking và hợp đồng rõ ràng.

Quản lý hóa đơn và thanh toán tập trung.

Hỗ trợ thanh toán trực tuyến.

Cung cấp thông báo thời gian thực.

Quản lý khiếu nại và phản hồi.

Phân quyền chặt chẽ giữa Tenant, Landlord và Admin.

Hỗ trợ bản đồ và dữ liệu vị trí bằng PostGIS.

Có thể triển khai thực tế trên môi trường cloud.

3. Công nghệ sử dụng

Frontend

Next.js

React

TypeScript

CSS / Tailwind CSS

Firebase Client SDK

Backend

NestJS

TypeScript

REST API

Prisma ORM

Firebase Admin SDK

Database

PostgreSQL

PostGIS

Prisma ORM

Authentication

Firebase Authentication

Email / Password

Google Sign-In

Email Verification

Forgot Password

Storage

Supabase Storage

Dùng để lưu hình ảnh property/listing và trả về public URL cho frontend.

Notification

Firebase Cloud Messaging – FCM

Dùng cho:

thông báo booking;

hợp đồng;

hóa đơn;

payment;

complaint;

cảnh báo hợp đồng sắp hết hạn.

Payment

VNPAY

Luồng thanh toán chính:

Tenant
   ↓
Invoice
   ↓
Create Payment
   ↓
VNPAY Checkout
   ↓
VNPAY Return/IPN
   ↓
Verify Signature
   ↓
Payment = SUCCEEDED
Invoice = PAID

DevOps

Docker

Docker Compose

Git

GitHub

Vercel

Supabase Cloud

4. Kiến trúc tổng thể

┌───────────────────────────┐
│         CLIENT            │
│       Next.js Web         │
└─────────────┬─────────────┘
              │ HTTPS / REST API
              ▼
┌───────────────────────────┐
│        NESTJS API         │
│                           │
│ Auth                      │
│ Users                     │
│ Properties                │
│ Listings                  │
│ Bookings                  │
│ Contracts                 │
│ Invoices                  │
│ Payments                  │
│ Notifications             │
│ Complaints                │
└──────────┬───────┬────────┘
           │       │
           │       └──────────────────┐
           ▼                          ▼
┌──────────────────────┐    ┌─────────────────────┐
│ PostgreSQL + PostGIS │    │ Firebase            │
│ Prisma ORM           │    │ Auth + FCM          │
└──────────────────────┘    └─────────────────────┘
           │
           ▼
┌──────────────────────┐
│ Supabase Storage     │
│ Property Images      │
└──────────────────────┘

           Payment
              │
              ▼
      ┌─────────────────┐
      │      VNPAY      │
      └─────────────────┘

5. Phân quyền hệ thống

Hệ thống sử dụng Role-Based Access Control – RBAC.

TENANT

Tenant có thể:

đăng ký tài khoản;

xác thực email;

đăng nhập Email/Password;

đăng nhập Google;

cập nhật profile;

tìm kiếm phòng;

xem chi tiết property;

xem hình ảnh;

tạo booking;

theo dõi trạng thái booking;

quản lý hợp đồng;

xem hóa đơn;

thanh toán hóa đơn;

xem lịch sử payment;

nhận notification;

gửi complaint;

yêu cầu gia hạn hợp đồng;

thông báo không muốn gia hạn.

LANDLORD

Landlord có thể:

quản lý property;

tạo/sửa/xóa listing;

upload hình ảnh;

quản lý phòng;

xem booking;

chấp nhận/từ chối booking;

quản lý tenant;

quản lý hợp đồng;

tạo/gửi hóa đơn;

xem payment;

xử lý complaint;

nhận notification;

ngừng hoạt động property;

kích hoạt property trở lại;

xử lý yêu cầu gia hạn hợp đồng.

ADMIN

Admin có thể:

quản lý user;

xem Tenant/Landlord;

quản lý nội dung hệ thống;

kiểm soát listing/property;

theo dõi booking;

theo dõi contract;

theo dõi invoice/payment;

theo dõi complaint;

xử lý các trường hợp vi phạm hoặc dữ liệu bất thường.

6. Authentication & Authorization

SmartMotel Hub sử dụng Firebase Authentication.

Các phương thức:

Email + Password
Google Sign-In
Email Verification
Forgot Password

Sau khi Firebase xác thực thành công:

Firebase
    ↓
ID Token
    ↓
NestJS Backend
    ↓
Firebase Admin Verify Token
    ↓
Load User
    ↓
Check Role
    ↓
RBAC Authorization

Backend luôn kiểm tra quyền truy cập, không phụ thuộc hoàn toàn vào frontend.

Ví dụ:

LANDLORD endpoint

Tenant hoặc Admin gọi sai endpoint có thể nhận:

403 Forbidden

7. Property & Listing

Landlord có thể tạo property và quản lý listing.

Một property có thể chứa:

thông tin cơ bản;

địa chỉ;

tọa độ;

mô tả;

tiện nghi;

hình ảnh;

danh sách phòng;

trạng thái hoạt động.

Property Status

Các trạng thái chính:

ACTIVE
INACTIVE

ACTIVE

Property đang hoạt động.

Landlord có thể chọn:

Ngừng hoạt động

INACTIVE

Property đã tạm dừng.

Landlord có thể chọn:

Hoạt động trở lại

Chỉ Landlord sở hữu property mới được quyền thay đổi trạng thái.

8. Image Upload

Ảnh được upload lên:

Supabase Storage

Database lưu URL ảnh.

Ví dụ:

property
   ↓
property_images
   ↓
Supabase Public URL
   ↓
Next.js Image

Lợi ích:

không lưu file trực tiếp trong database;

dễ deploy;

giảm tải backend;

thuận tiện quản lý ảnh trên cloud.

9. Search & Location

SmartMotel Hub sử dụng:

PostgreSQL + PostGIS

để hỗ trợ dữ liệu vị trí.

PostGIS cho phép mở rộng PostgreSQL để lưu và truy vấn:

latitude;

longitude;

khoảng cách;

vị trí property;

tìm property gần khu vực người dùng.

10. Booking

Luồng booking cơ bản:

Tenant
   ↓
Property / Room
   ↓
Create Booking
   ↓
PENDING
   ↓
Landlord Review
   ↓
APPROVED / REJECTED

Khi booking được chấp nhận, hệ thống có thể tiếp tục sang bước tạo hợp đồng.

11. Contract Management

Contract liên kết giữa:

Tenant
Landlord
Property
Room

Các dữ liệu quan trọng:

ngày bắt đầu;

ngày kết thúc;

giá thuê;

tiền cọc;

trạng thái hợp đồng;

tenant;

landlord;

room/property.

12. Contract Expiry & Renewal

Phase 13 hoàn thiện vòng đời hợp đồng.

Hệ thống gửi nhắc hợp đồng:

30 ngày trước khi hết hạn
7 ngày trước khi hết hạn
1 ngày trước khi hết hạn
Đúng ngày hết hạn

Thông báo được gửi cho:

Tenant
Landlord

thông qua:

Firebase Cloud Messaging

Tenant

Tenant có thể:

Yêu cầu gia hạn
Không gia hạn

Landlord

Landlord có thể:

Gia hạn hợp đồng
Kết thúc hợp đồng

Hệ thống phải chống gửi notification trùng.

Ví dụ:

contractId + notificationType + expiryDate

được sử dụng để xác định một thông báo đã gửi hay chưa.

Khi contract kết thúc, trạng thái phòng và contract phải được cập nhật theo đúng nghiệp vụ.

13. Invoice Management

Landlord có thể quản lý hóa đơn cho Tenant.

Invoice có thể chứa:

tiền thuê;

điện;

nước;

dịch vụ;

các khoản phát sinh;

tổng tiền;

ngày tạo;

hạn thanh toán;

trạng thái.

Ví dụ trạng thái:

PENDING
PAID
OVERDUE
CANCELLED

14. Payment

SmartMotel Hub tích hợp VNPAY.

Payment Flow

Tenant chọn Invoice
       ↓
Create Payment
       ↓
Backend tạo VNPAY URL
       ↓
Redirect VNPAY
       ↓
Tenant thanh toán
       ↓
VNPAY Return / IPN
       ↓
Backend Verify HMAC SHA512
       ↓
Validate Response
       ↓
Update Database

Thanh toán được xem là thành công khi:

vnp_ResponseCode = 00
vnp_TransactionStatus = 00

Sau khi xác nhận thành công:

payment.status = SUCCEEDED
invoice.status = PAID
paidAt = current timestamp

Transaction reference sử dụng prefix:

SMH

15. Notification

Notification được sử dụng xuyên suốt hệ thống.

Các trường hợp tiêu biểu:

booking mới;

booking được duyệt;

booking bị từ chối;

contract mới;

contract sắp hết hạn;

yêu cầu gia hạn;

invoice mới;

payment thành công;

complaint mới;

complaint được xử lý.

Push notification sử dụng:

Firebase Cloud Messaging

16. Complaint

Tenant có thể gửi complaint liên quan đến quá trình thuê phòng.

Luồng ví dụ:

Tenant
   ↓
Create Complaint
   ↓
Landlord / Admin
   ↓
Review
   ↓
Resolve / Reject / Close

Complaint giúp lưu lại lịch sử xử lý vấn đề thay vì trao đổi bên ngoài hệ thống.

17. Database

ORM:

Prisma

Database:

PostgreSQL

Geospatial extension:

PostGIS

Một số nhóm entity chính:

User
Property
Room
Listing
PropertyImage
Booking
Contract
Invoice
Payment
LandlordWallet
LandlordBankAccount
LandlordWalletTransaction
WithdrawalRequest
Notification
Complaint

Quan hệ tổng quan:

User
 ├── Tenant
 └── Landlord
       │
       ▼
   Property
       │
       ├── PropertyImage
       ├── Listing
       └── Room
             │
             ▼
           Booking
             │
             ▼
           Contract
             │
             ├── Invoice
             │      │
             │      ▼
             │    Payment ──► LandlordWallet ──► WithdrawalRequest
             │                     │                    │
             │                     ▼                    ▼
             │            WalletTransaction      BankAccount
             │
             └── Notification

18. API Structure

Backend sử dụng REST API.

Prefix đề xuất:

/api/v1

Ví dụ:

/api/v1/auth
/api/v1/users
/api/v1/properties
/api/v1/listings
/api/v1/rooms
/api/v1/bookings
/api/v1/contracts
/api/v1/invoices
/api/v1/payments
/api/v1/landlord/wallet
/api/v1/admin/withdrawals
/api/v1/notifications
/api/v1/complaints

19. HTTP Status Codes

Hệ thống xử lý các HTTP status phổ biến:

200 OK
201 Created
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
429 Too Many Requests
500 Internal Server Error

20. Security

Các nguyên tắc bảo mật chính:

Firebase token verification.

Backend RBAC.

Ownership validation.

Không tin role gửi trực tiếp từ frontend.

Environment variables.

Không commit secret.

VNPAY signature verification.

Validation request DTO.

Rate limiting.

CORS configuration.

Upload validation.

Error handling.

Production secret management.

21. Environment Variables

Không commit file:

.env
.env.local
.env.production

Nên cung cấp:

.env.example

Ví dụ các biến môi trường:

# Database
DATABASE_URL=

# Firebase Client
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# VNPAY
VNP_TMN_CODE=
VNP_HASH_SECRET=
VNP_URL=
VNP_RETURN_URL=

# Backend
PORT=
FRONTEND_URL=

Không đưa secret thật vào GitHub.

22. Cấu trúc project

Cấu trúc tổng quan:

smartmotel-hub/
│
├── apps/
│   │
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── public/
│   │   ├── services/
│   │   └── package.json
│   │
│   └── api/
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── migrations/
│       │   └── seed.ts
│       │
│       ├── src/
│       │   ├── auth/
│       │   ├── users/
│       │   ├── properties/
│       │   ├── listings/
│       │   ├── bookings/
│       │   ├── contracts/
│       │   ├── invoices/
│       │   ├── payments/
│       │   ├── notifications/
│       │   └── complaints/
│       │
│       └── package.json
│
├── docker-compose.yml
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
└── README.md

23. Chạy project local

Yêu cầu

Cài đặt:

Node.js
npm
Docker Desktop
Git

Clone project

git clone https://github.com/HoangCoder2604/SmartMotelHub.git
cd SmartMotelHub

Cài dependency

Từ thư mục root:

npm install

Nếu frontend/backend quản lý dependency riêng:

cd apps/web
npm install

cd ../api
npm install

24. Database local bằng Docker

Khởi động database:

docker compose up -d db

Kiểm tra:

docker ps

Sau đó cấu hình:

DATABASE_URL=postgresql://...

25. Prisma

Generate Prisma Client:

npx prisma generate

Chạy migration:

npx prisma migrate dev

Mở Prisma Studio:

npx prisma studio

Seed database nếu dự án sử dụng seed:

npx prisma db seed

26. Chạy Backend

Ví dụ:

cd apps/api
npm run start:dev

Backend local có thể chạy tại:

http://localhost:4000

Tùy cấu hình PORT.

27. Chạy Frontend

cd apps/web
npm run dev

Frontend mặc định:

http://localhost:3000

Nếu port 3000 đang được sử dụng, có thể cấu hình port khác theo script của project.

28. Deployment

Frontend

Frontend được triển khai trên:

Vercel

Quy trình:

GitHub
   ↓
Vercel Project
   ↓
Environment Variables
   ↓
Build
   ↓
Deploy

Database

Production database:

Supabase PostgreSQL

Database local Docker đã được migrate sang Supabase cloud.

Storage

Production image storage:

Supabase Storage

Firebase

Firebase được sử dụng cho:

Authentication
Email Verification
Password Reset
Google Login
FCM Push Notification

29. Favicon

SmartMotel Hub sử dụng logo hiện tại của dự án làm favicon/tab icon.

Không thiết kế logo mới ở Phase 13.

Ví dụ Next.js:

apps/web/app/favicon.ico

hoặc metadata/icon tương ứng với cấu trúc Next.js hiện tại.

30. Development Roadmap – 13 Phases

Phase 1 – Project Foundation

Thiết lập nền tảng dự án:

Next.js;

NestJS;

PostgreSQL;

Prisma;

PostGIS;

Docker;

Docker Compose;

Git/GitHub;

monorepo structure;

.env;

.gitignore.

Kết quả:

Frontend + Backend + Database chạy được local.

Phase 2 – Authentication & Role System

Xây dựng:

Firebase Authentication;

Email/Password login;

Google Sign-In;

email verification;

token verification;

Tenant/Landlord/Admin;

RBAC;

protected endpoint;

role-based redirect.

Kết quả:

User đăng nhập và truy cập đúng dashboard theo role.

Phase 3 – Listing Foundation

Xây dựng module listing/property:

create;

update;

read;

status;

authorization;

landlord ownership.

Kết quả:

Landlord bắt đầu quản lý dữ liệu property/listing.

Phase 4 – Property & Room Management

Hoàn thiện:

property;

room;

thông tin nhà trọ;

giá;

trạng thái;

tiện nghi;

địa chỉ;

quản lý phòng.

Phase 5 – Search, Location & Images

Hoàn thiện trải nghiệm tìm kiếm:

property discovery;

search;

filter;

location;

PostGIS;

upload ảnh;

hiển thị ảnh;

Supabase Storage.

Phase 6 – Booking

Xây dựng quy trình:

Tenant → Booking → Landlord Review

Bao gồm:

tạo booking;

xem booking;

duyệt;

từ chối;

kiểm tra quyền;

cập nhật trạng thái.

Phase 7 – Contract

Xây dựng quản lý hợp đồng:

tạo contract;

tenant;

landlord;

room;

start date;

end date;

contract status;

quyền truy cập.

Phase 8 – Invoice

Xây dựng hóa đơn:

tạo invoice;

quản lý khoản tiền;

due date;

invoice status;

tenant xem hóa đơn;

landlord quản lý hóa đơn.

Phase 9 – Payment

Tích hợp thanh toán:

VNPAY;

create payment;

transaction reference;

HMAC-SHA512;

VNPAY return;

IPN/response verification;

update payment;

update invoice.

Khi thành công:

Payment → SUCCEEDED
Invoice → PAID

Phase 10 – Notification

Hoàn thiện notification system:

in-app notification;

Firebase Cloud Messaging;

Tenant notification;

Landlord notification;

booking event;

contract event;

invoice/payment event.

Phase 11 – Complaint & Management

Xây dựng:

complaint;

complaint status;

landlord/admin handling;

user feedback;

authorization;

lịch sử xử lý.

Phase 12 – Production Integration & Stabilization

Hoàn thiện các phần trước release:

Supabase PostgreSQL;

migrate database local → cloud;

Supabase Storage;

production env;

Firebase production configuration;

image URL;

Vercel deployment;

Forgot Password;

payment testing;

bug fixes;

security checks;

integration testing.

Phase 13 – Final Release

Phase cuối cùng gồm 6 nhóm chính.

13.1 Property Re-activation

ACTIVE
  ↓
Ngừng hoạt động
  ↓
INACTIVE
  ↓
Hoạt động trở lại
  ↓
ACTIVE

Chỉ landlord sở hữu property mới được bật/tắt.

13.2 Contract Expiry & Renewal

Gửi nhắc:

30 ngày
7 ngày
1 ngày
Ngày hết hạn

FCM push cho:

Tenant + Landlord

Tenant:

Yêu cầu gia hạn
Không gia hạn

Landlord:

Gia hạn
Kết thúc hợp đồng

Yêu cầu:

chống notification trùng bằng `dedupe_key` theo contract + ngày hết hạn + mốc 30/7/1/0 + người nhận;

worker kiểm tra expiry khi API khởi động và theo chu kỳ (mặc định mỗi 1 giờ), đồng thời trang Contract gọi workflow như fallback;

production/serverless có endpoint cron bảo vệ bằng `CRON_SECRET`: `GET /api/v1/internal/contracts/expiry`; nên gọi endpoint này mỗi ngày để bảo đảm mốc 30/7/1/0 vẫn chạy ngay cả khi API không có traffic;

đúng ngày hết hạn: `ACTIVE → EXPIRED`;

phòng của hợp đồng hết hạn: `RENTED → AVAILABLE`;

listing đang `HIDDEN` của phòng hết hạn được trả về `DRAFT` để Landlord chủ động đăng lại;

Tenant có thể chọn `RENEW` hoặc `NOT_RENEW`;

Landlord chỉ gia hạn khi Tenant đã yêu cầu `RENEW`, ngày kết thúc mới phải lớn hơn ngày cũ;

đảm bảo ownership/authorization và FCM push cho cả Tenant + Landlord.

13.3 Landlord Wallet & Withdrawal

Khi TENANT thanh toán hóa đơn qua VNPAY thành công, hệ thống tự động ghi nhận đúng số tiền vào ví nội bộ của LANDLORD sở hữu hợp đồng/hóa đơn.

Luồng chính:

TENANT thanh toán VNPAY
  ↓
Payment = SUCCEEDED
  ↓
Invoice = PAID
  ↓
Credit Landlord Wallet
  ↓
Landlord tạo yêu cầu rút
  ↓
Giữ chỗ số tiền đang chờ rút
  ↓
Admin chuyển khoản thực tế
  ↓
Admin APPROVE / REJECT

LANDLORD có thể:

- xem số dư ví;
- xem số dư khả dụng;
- xem tiền đang chờ rút;
- thêm/cập nhật tài khoản ngân hàng;
- tạo yêu cầu rút tiền;
- xem lịch sử rút tiền và trạng thái xử lý.

ADMIN có thể:

- xem danh sách yêu cầu rút;
- xem đầy đủ thông tin tài khoản ngân hàng của LANDLORD;
- nhập mã giao dịch ngân hàng sau khi chuyển tiền;
- chọn “Đã chuyển tiền & duyệt”;
- từ chối và nhập lý do.

Quy tắc số dư:

- Payment VNPAY thành công mới được cộng ví;
- callback VNPAY lặp lại không được cộng tiền hai lần;
- yêu cầu rút sẽ giữ chỗ số tiền để tránh rút vượt số dư;
- APPROVED: trừ balance, giải phóng pending withdrawal và tăng total withdrawn;
- REJECTED: chỉ giải phóng pending withdrawal, không trừ balance;
- các payment VNPAY thành công trước Phase 13 được migration backfill vào ví.

Lưu ý: SmartMotel Hub hiện ghi nhận việc chuyển tiền bằng mã giao dịch do Admin nhập. Việc chuyển khoản ngân hàng thực tế vẫn do Admin thực hiện ngoài hệ thống, trừ khi sau này tích hợp thêm payout API của ngân hàng/payment provider.

13.4 Favicon

Dùng logo SmartMotel Hub hiện tại cho tab trình duyệt.

13.5 Final QA

Kiểm tra toàn bộ hệ thống.

Tenant

Test:

registration;

login;

Google login;

email verification;

forgot password;

profile;

listing;

booking;

contract;

invoice;

payment;

notification;

complaint;

renewal.

Landlord

Test:

login;

property;

listing;

image;

room;

booking;

contract;

invoice;

payment;

notification;

complaint;

property inactive/reactivate;

renewal.

Admin

Test:

authentication;

user management;

property/listing monitoring;

contract;

payment;

complaint;

authorization.

API

Test:

400
401
403
404
409
429
500

Security

Test:

CORS;

env;

secret;

Firebase token;

role;

ownership;

upload;

VNPAY signature;

rate limit.

Production

Test trực tiếp trên Vercel.

13.6 Final Documentation & Release

Hoàn thiện:

README;

system architecture;

database/ERD;

API overview;

local setup;

deployment guide;

QA checklist;

demo checklist;

release v1.0.

31. Final QA Checklist

Authentication

Tenant đăng ký được.

Landlord đăng ký được.

Email verification hoạt động.

Google login hoạt động.

Forgot Password gửi email.

Token hết hạn được xử lý.

Role sai nhận 403.

Property

Tạo property.

Sửa property.

Upload ảnh.

Xem ảnh từ Supabase.

ACTIVE → INACTIVE.

INACTIVE → ACTIVE.

Landlord khác không thể sửa property.

Booking

Tenant tạo booking.

Landlord xem booking.

Approve.

Reject.

Không booking sai room/property.

Contract

Tạo hợp đồng.

Tenant xem đúng contract.

Landlord xem đúng contract.

Kiểm tra end date.

Reminder 30 ngày.

Reminder 7 ngày.

Reminder 1 ngày.

Reminder đúng ngày hết hạn.

Không gửi notification trùng.

Tenant yêu cầu renew.

Tenant chọn không renew.

Landlord renew.

Landlord end contract.

Invoice

Tạo invoice.

Tenant xem invoice.

Due date đúng.

Status đúng.

Invoice PAID sau payment.

Payment

Tạo VNPAY checkout.

Return URL hoạt động.

Verify signature.

vnp_ResponseCode=00.

vnp_TransactionStatus=00.

Payment = SUCCEEDED.

Invoice = PAID.

paidAt được lưu.

Landlord Wallet & Withdrawal

VNPAY thành công cộng đúng số tiền vào ví LANDLORD của hóa đơn.

Callback VNPAY lặp lại không cộng tiền hai lần.

Payment MANUAL không tự cộng vào ví VNPAY.

Các payment VNPAY thành công cũ được backfill vào ví sau migration.

Landlord thêm/cập nhật tài khoản ngân hàng.

Không có tài khoản ngân hàng thì không thể rút tiền.

Không thể tạo yêu cầu rút vượt số dư khả dụng.

Tạo lệnh rút làm tăng pending withdrawal nhưng chưa trừ balance chính.

Admin nhìn thấy lệnh rút và đầy đủ thông tin tài khoản nhận tiền.

Admin duyệt bắt buộc nhập mã giao dịch ngân hàng.

APPROVED trừ balance, giảm pending withdrawal và tăng total withdrawn.

REJECTED giảm pending withdrawal nhưng không trừ balance.

Một lệnh rút không thể được duyệt/từ chối lần thứ hai.

Landlord nhận notification khi yêu cầu được duyệt hoặc từ chối.

Admin nhận notification khi có yêu cầu rút mới.

Notification

Tenant nhận notification.

Landlord nhận notification.

FCM token hoạt động.

Không gửi duplicate notification.

Complaint

Tenant tạo complaint.

Landlord/Admin xem complaint.

Status update đúng.

Unauthorized user không xem complaint của người khác.

API & Security

400 handled.

401 handled.

403 handled.

404 handled.

409 handled.

429 handled.

500 handled.

CORS đúng.

.env không commit.

Secrets không public.

Upload validation.

Rate limit hoạt động.

Production

Frontend Vercel chạy.

Backend production chạy.

Firebase production chạy.

Supabase database kết nối.

Supabase image load.

VNPAY callback hoạt động.

Không có console error nghiêm trọng.

Không có API 500 ngoài dự kiến.

32. Demo Flow đề xuất

Khi bảo vệ đồ án, có thể demo theo luồng:

1. Mở SmartMotel Hub
2. Tenant đăng nhập
3. Tìm property
4. Xem chi tiết phòng
5. Booking
6. Landlord đăng nhập
7. Duyệt booking
8. Tạo / xem contract
9. Tạo invoice
10. Tenant thanh toán VNPAY
11. Invoice chuyển PAID
12. Demo notification
13. Demo complaint
14. Demo contract renewal
15. Demo property inactive → active
16. Admin dashboard

Luồng này thể hiện được gần như toàn bộ hệ thống.

33. Release Checklist

Trước khi đánh dấu v1.0:

Build frontend thành công.

Build backend thành công.

Prisma migration production hoàn tất.

Không còn secret trong repository.

Database backup.

Production env chính xác.

Firebase Authorized Domains chính xác.

VNPAY URL chính xác.

Supabase Storage hoạt động.

Favicon hiển thị.

Final QA pass.

README hoàn tất.

Git repository sạch.

Tag release.

Có thể tạo release:

git add .
git commit -m "release: SmartMotel Hub v1.0"
git push origin main
git tag v1.0.0
git push origin v1.0.0

34. Git Repository

https://github.com/HoangCoder2604/SmartMotelHub

35. Project Status

SmartMotel Hub
Version: 1.0
Development Phases: 13/13
Status: COMPLETED

Sau khi Phase 13 hoàn tất và toàn bộ Final QA pass, SmartMotel Hub được xem là phiên bản:

SmartMotel Hub v1.0

Các thay đổi sau đó nên được quản lý theo:

Patch
Minor Release
Major Release

Ví dụ:

v1.0.1 - Bug fixes
v1.1.0 - New features
v2.0.0 - Major architecture/features

36. License

Dự án được phát triển cho mục đích học tập và đồ án.

Việc sử dụng hoặc triển khai ngoài phạm vi học tập cần kiểm tra lại cấu hình bảo mật, payment gateway, Firebase, Supabase và các quy định liên quan.

37. Author

SmartMotel Hub Development Team

Project repository:

HoangCoder2604/SmartMotelHub

SmartMotel Hub – Find. Rent. Manage.

Một nền tảng thống nhất cho Tenant, Landlord và Admin trong toàn bộ vòng đời thuê trọ.


### 13.6 Responsive UI polish

- Tối ưu giao diện cho desktop, tablet và mobile, bao gồm các màn hình nhỏ khoảng 360px.
- Sửa checkbox/radio toàn cục để không bị kéo `width: 100%` và che nội dung trên mobile.
- Trang tìm phòng dùng layout filter, tiện ích, action và pagination responsive; tiện ích không còn che chữ.
- Tối ưu touch target, form, card, bảng Admin, Contract, Appointment, Complaint, Analytics và Landlord Wallet/Withdrawal.
- Input/select/textarea trên mobile dùng cỡ chữ phù hợp để tránh trình duyệt tự zoom khi focus.
