-- SmartMotel Hub Phase 1 initial database
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TYPE "UserRole" AS ENUM ('TENANT', 'LANDLORD', 'ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'BANNED');
CREATE TYPE "PropertyStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'RENTED', 'MAINTENANCE');
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'VISIBLE', 'HIDDEN');
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED');
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PAID', 'OVERDUE');
CREATE TYPE "ComplaintStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED', 'REJECTED');

CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(255),
  "phone" VARCHAR(30),
  "firebase_uid" VARCHAR(128),
  "password_hash" VARCHAR(255),
  "full_name" VARCHAR(150) NOT NULL,
  "avatar_url" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'TENANT',
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "email_verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "phone_verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_contact_required" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL)
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
CREATE UNIQUE INDEX "users_firebase_uid_key" ON "users"("firebase_uid");
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE INDEX "users_status_idx" ON "users"("status");

CREATE TABLE "properties" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "landlord_id" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "address" VARCHAR(500) NOT NULL,
  "ward" VARCHAR(150),
  "district" VARCHAR(150) NOT NULL,
  "city" VARCHAR(150) NOT NULL,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "location" geography(Point,4326),
  "status" "PropertyStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "properties_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "properties_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90),
  CONSTRAINT "properties_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180),
  CONSTRAINT "properties_landlord_fkey" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "properties_landlord_id_idx" ON "properties"("landlord_id");
CREATE INDEX "properties_city_district_idx" ON "properties"("city", "district");
CREATE INDEX "properties_status_idx" ON "properties"("status");
CREATE INDEX "properties_location_gist_idx" ON "properties" USING GIST ("location");

CREATE OR REPLACE FUNCTION sync_property_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location := ST_SetSRID(
    ST_MakePoint(NEW.longitude::double precision, NEW.latitude::double precision),
    4326
  )::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER properties_sync_location_trigger
BEFORE INSERT OR UPDATE OF latitude, longitude ON properties
FOR EACH ROW EXECUTE FUNCTION sync_property_location();

CREATE TABLE "rooms" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "property_id" UUID NOT NULL,
  "room_number" VARCHAR(50),
  "title" VARCHAR(220) NOT NULL,
  "description" TEXT,
  "price" DECIMAL(14,2) NOT NULL,
  "deposit" DECIMAL(14,2),
  "area_m2" DECIMAL(7,2) NOT NULL,
  "electricity_price" DECIMAL(12,2),
  "water_price" DECIMAL(12,2),
  "internet_price" DECIMAL(12,2),
  "service_fee" DECIMAL(12,2),
  "max_occupants" INTEGER NOT NULL DEFAULT 1,
  "has_mezzanine" BOOLEAN NOT NULL DEFAULT FALSE,
  "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "rooms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rooms_property_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "rooms_price_check" CHECK ("price" >= 0),
  CONSTRAINT "rooms_deposit_check" CHECK ("deposit" IS NULL OR "deposit" >= 0),
  CONSTRAINT "rooms_area_check" CHECK ("area_m2" > 0),
  CONSTRAINT "rooms_max_occupants_check" CHECK ("max_occupants" > 0),
  CONSTRAINT "rooms_fees_check" CHECK (
    ("electricity_price" IS NULL OR "electricity_price" >= 0) AND
    ("water_price" IS NULL OR "water_price" >= 0) AND
    ("internet_price" IS NULL OR "internet_price" >= 0) AND
    ("service_fee" IS NULL OR "service_fee" >= 0)
  )
);

CREATE INDEX "rooms_property_id_idx" ON "rooms"("property_id");
CREATE INDEX "rooms_status_idx" ON "rooms"("status");
CREATE INDEX "rooms_price_idx" ON "rooms"("price");
CREATE INDEX "rooms_area_m2_idx" ON "rooms"("area_m2");

CREATE TABLE "amenities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "icon" VARCHAR(120),
  "category" VARCHAR(80),
  CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "amenities_code_key" ON "amenities"("code");

CREATE TABLE "room_amenities" (
  "room_id" UUID NOT NULL,
  "amenity_id" UUID NOT NULL,
  CONSTRAINT "room_amenities_pkey" PRIMARY KEY ("room_id", "amenity_id"),
  CONSTRAINT "room_amenities_room_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "room_amenities_amenity_fkey" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "room_amenities_amenity_id_idx" ON "room_amenities"("amenity_id");

CREATE TABLE "listings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "room_id" UUID NOT NULL,
  "title" VARCHAR(220) NOT NULL,
  "description" TEXT,
  "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
  "is_vip" BOOLEAN NOT NULL DEFAULT FALSE,
  "vip_expired_at" TIMESTAMPTZ(6),
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "published_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "listings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "listings_room_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "listings_view_count_check" CHECK ("view_count" >= 0)
);
CREATE INDEX "listings_room_id_idx" ON "listings"("room_id");
CREATE INDEX "listings_status_published_at_idx" ON "listings"("status", "published_at");
CREATE INDEX "listings_is_vip_vip_expired_at_idx" ON "listings"("is_vip", "vip_expired_at");

CREATE TABLE "listing_images" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "listing_id" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "public_id" VARCHAR(255),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "listing_images_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "listing_images_listing_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "listing_images_listing_id_sort_order_idx" ON "listing_images"("listing_id", "sort_order");

CREATE TABLE "favorites" (
  "tenant_id" UUID NOT NULL,
  "listing_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "favorites_pkey" PRIMARY KEY ("tenant_id", "listing_id"),
  CONSTRAINT "favorites_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "favorites_listing_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "favorites_listing_id_idx" ON "favorites"("listing_id");

CREATE TABLE "appointments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "room_id" UUID NOT NULL,
  "landlord_id" UUID NOT NULL,
  "appointment_date" DATE NOT NULL,
  "start_time" TIME(0) NOT NULL,
  "end_time" TIME(0) NOT NULL,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDING',
  "tenant_note" TEXT,
  "landlord_note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "appointments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "appointments_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "appointments_room_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "appointments_landlord_fkey" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "appointments_time_check" CHECK ("end_time" > "start_time")
);
CREATE INDEX "appointments_tenant_date_idx" ON "appointments"("tenant_id", "appointment_date");
CREATE INDEX "appointments_landlord_date_idx" ON "appointments"("landlord_id", "appointment_date");
CREATE INDEX "appointments_room_date_idx" ON "appointments"("room_id", "appointment_date");
CREATE INDEX "appointments_status_idx" ON "appointments"("status");

CREATE TABLE "reviews" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "property_id" UUID NOT NULL,
  "landlord_rating" INTEGER,
  "security_rating" INTEGER,
  "noise_rating" INTEGER,
  "cost_rating" INTEGER,
  "overall_rating" INTEGER NOT NULL,
  "comment" TEXT,
  "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reviews_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reviews_property_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reviews_rating_check" CHECK (
    "overall_rating" BETWEEN 1 AND 5 AND
    ("landlord_rating" IS NULL OR "landlord_rating" BETWEEN 1 AND 5) AND
    ("security_rating" IS NULL OR "security_rating" BETWEEN 1 AND 5) AND
    ("noise_rating" IS NULL OR "noise_rating" BETWEEN 1 AND 5) AND
    ("cost_rating" IS NULL OR "cost_rating" BETWEEN 1 AND 5)
  )
);
CREATE UNIQUE INDEX "reviews_tenant_property_key" ON "reviews"("tenant_id", "property_id");
CREATE INDEX "reviews_property_status_idx" ON "reviews"("property_id", "status");

CREATE TABLE "contracts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "room_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "landlord_id" UUID NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "monthly_rent" DECIMAL(14,2) NOT NULL,
  "deposit" DECIMAL(14,2),
  "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
  "contract_file_url" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "contracts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "contracts_room_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "contracts_tenant_fkey" FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "contracts_landlord_fkey" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "contracts_dates_check" CHECK ("end_date" IS NULL OR "end_date" >= "start_date"),
  CONSTRAINT "contracts_money_check" CHECK ("monthly_rent" >= 0 AND ("deposit" IS NULL OR "deposit" >= 0))
);
CREATE INDEX "contracts_room_status_idx" ON "contracts"("room_id", "status");
CREATE INDEX "contracts_tenant_status_idx" ON "contracts"("tenant_id", "status");
CREATE INDEX "contracts_landlord_status_idx" ON "contracts"("landlord_id", "status");

CREATE TABLE "invoices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "contract_id" UUID NOT NULL,
  "billing_month" DATE NOT NULL,
  "room_fee" DECIMAL(14,2) NOT NULL,
  "electricity_fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "water_fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "internet_fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "service_fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "other_fee" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(14,2) NOT NULL,
  "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
  "due_date" DATE NOT NULL,
  "paid_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoices_contract_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "invoices_amounts_check" CHECK (
    "room_fee" >= 0 AND "electricity_fee" >= 0 AND "water_fee" >= 0 AND
    "internet_fee" >= 0 AND "service_fee" >= 0 AND "other_fee" >= 0 AND "total" >= 0
  )
);
CREATE UNIQUE INDEX "invoices_contract_billing_month_key" ON "invoices"("contract_id", "billing_month");
CREATE INDEX "invoices_status_due_date_idx" ON "invoices"("status", "due_date");

CREATE TABLE "complaints" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "reporter_id" UUID NOT NULL,
  "reported_user_id" UUID,
  "listing_id" UUID,
  "type" VARCHAR(100) NOT NULL,
  "description" TEXT NOT NULL,
  "evidence_url" TEXT,
  "status" "ComplaintStatus" NOT NULL DEFAULT 'OPEN',
  "assigned_admin_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "complaints_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "complaints_reporter_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "complaints_reported_user_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "complaints_listing_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "complaints_assigned_admin_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "complaints_target_check" CHECK ("reported_user_id" IS NOT NULL OR "listing_id" IS NOT NULL)
);
CREATE INDEX "complaints_reporter_id_idx" ON "complaints"("reporter_id");
CREATE INDEX "complaints_reported_user_id_idx" ON "complaints"("reported_user_id");
CREATE INDEX "complaints_listing_id_idx" ON "complaints"("listing_id");
CREATE INDEX "complaints_assigned_admin_status_idx" ON "complaints"("assigned_admin_id", "status");
