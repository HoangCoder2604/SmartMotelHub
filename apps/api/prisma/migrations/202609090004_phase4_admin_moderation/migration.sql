ALTER TABLE "listings"
  ADD COLUMN "rejection_reason" TEXT,
  ADD COLUMN "reviewed_at" TIMESTAMPTZ(6),
  ADD COLUMN "reviewed_by_admin_id" UUID;

CREATE INDEX "listings_reviewed_by_admin_id_reviewed_at_idx"
  ON "listings"("reviewed_by_admin_id", "reviewed_at");

ALTER TABLE "listings"
  ADD CONSTRAINT "listings_reviewed_by_admin_id_fkey"
  FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
