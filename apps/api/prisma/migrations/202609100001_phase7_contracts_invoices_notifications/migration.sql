ALTER TABLE "contracts"
  ADD COLUMN "appointment_id" UUID,
  ADD COLUMN "tenant_accepted_at" TIMESTAMPTZ(6),
  ADD COLUMN "activated_at" TIMESTAMPTZ(6),
  ADD COLUMN "terminated_at" TIMESTAMPTZ(6),
  ADD COLUMN "termination_reason" TEXT;

CREATE UNIQUE INDEX "contracts_appointment_id_key"
  ON "contracts"("appointment_id");

ALTER TABLE "contracts"
  ADD CONSTRAINT "contracts_appointment_id_fkey"
  FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD COLUMN "payment_note" TEXT;

CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "type" VARCHAR(80) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "message" TEXT NOT NULL,
  "href" TEXT,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notifications_user_id_read_at_created_at_idx"
  ON "notifications"("user_id", "read_at", "created_at");

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
