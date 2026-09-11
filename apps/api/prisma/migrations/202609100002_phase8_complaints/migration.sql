ALTER TABLE "complaints"
  ADD COLUMN IF NOT EXISTS "admin_note" TEXT,
  ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ(6);

CREATE INDEX IF NOT EXISTS "complaints_status_created_at_idx"
  ON "complaints"("status", "created_at" DESC);
