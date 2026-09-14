CREATE TYPE "PaymentProvider" AS ENUM ('VNPAY', 'MANUAL');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED');

CREATE TABLE "payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "invoice_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount" DECIMAL(14,2) NOT NULL,
  "txn_ref" VARCHAR(100) NOT NULL,
  "checkout_url" TEXT,
  "order_info" VARCHAR(255) NOT NULL,
  "gateway_transaction_no" VARCHAR(50),
  "bank_code" VARCHAR(30),
  "card_type" VARCHAR(30),
  "response_code" VARCHAR(10),
  "transaction_status" VARCHAR(10),
  "gateway_pay_date" TIMESTAMPTZ(6),
  "expires_at" TIMESTAMPTZ(6),
  "paid_at" TIMESTAMPTZ(6),
  "failed_at" TIMESTAMPTZ(6),
  "return_received_at" TIMESTAMPTZ(6),
  "ipn_received_at" TIMESTAMPTZ(6),
  "raw_return" JSONB,
  "raw_ipn" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_txn_ref_key" ON "payments"("txn_ref");
CREATE INDEX "payments_invoice_id_status_idx" ON "payments"("invoice_id", "status");
CREATE INDEX "payments_tenant_id_created_at_idx" ON "payments"("tenant_id", "created_at");
CREATE INDEX "payments_provider_gateway_transaction_no_idx" ON "payments"("provider", "gateway_transaction_no");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
