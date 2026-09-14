# SmartMotel Hub — Phase 11: VNPAY Sandbox + Payment History

Phase 11 replaces the old "manual-only" payment flow with a real redirect-based VNPAY Sandbox integration while keeping manual confirmation as a fallback/audited payment method.

## What is included

- TENANT can start VNPAY payment directly from `/invoices`.
- Backend calculates the amount from the invoice in PostgreSQL. The browser never sends the payable amount.
- Signed VNPAY v2.1.0 request using HMAC-SHA512.
- 15-minute payment session with reuse of the active checkout URL.
- Signed Return URL handler.
- Signed IPN handler for server-to-server confirmation.
- Idempotent callback processing: Return + IPN cannot mark the same payment twice.
- Verifies `vnp_TmnCode`, HMAC signature, `vnp_TxnRef`, and `vnp_Amount` before updating an invoice.
- Success automatically changes Invoice to `PAID` and sets `paidAt`.
- FCM/in-app notifications for TENANT and LANDLORD after successful VNPAY payment.
- Payment history for TENANT: `/payments`.
- Payment reconciliation for LANDLORD: `/landlord/payments`.
- Payment audit for ADMIN: `/admin/payments`.
- Manual LANDLORD confirmation now also creates an audited `MANUAL / SUCCEEDED` Payment row.
- Manual confirmation is blocked while a VNPAY session is still active, reducing double-payment races.
- No card number, OTP, CVV, or banking credentials are stored by SmartMotel Hub.

## Database

New enums:

- `PaymentProvider`: `VNPAY`, `MANUAL`
- `PaymentStatus`: `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `EXPIRED`

New table:

- `payments`

Migration:

`apps/api/prisma/migrations/202609110002_phase11_vnpay_payments/migration.sql`

Run:

```powershell
npm run db:generate
npm run db:deploy
```

## VNPAY Sandbox configuration

Register/use a VNPAY Sandbox merchant and copy the sandbox `vnp_TmnCode` and `vnp_HashSecret` into the real backend file `apps/api/.env`.

```env
VNPAY_TMN_CODE=YOUR_TMN_CODE
VNPAY_HASH_SECRET=YOUR_HASH_SECRET
VNPAY_PAYMENT_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:4000/api/v1/payments/vnpay/return
VNPAY_WEB_RESULT_URL=http://localhost:3001/payments/result
VNPAY_ORDER_TYPE=other
VNPAY_EXPIRE_MINUTES=15
VNPAY_IPN_URL=http://localhost:4000/api/v1/payments/vnpay/ipn
```

`VNPAY_HASH_SECRET` is backend-only. Never put it in `NEXT_PUBLIC_*` or commit it to GitHub.

### Local Return URL vs IPN

The VNPAY browser Return URL works with localhost because the customer's browser returns to your local API.

VNPAY IPN is server-to-server. VNPAY cannot call `localhost` on your computer. For a full IPN test, expose the API through a public HTTPS tunnel/domain and configure the public IPN URL in the VNPAY Sandbox merchant portal, for example:

```text
https://your-public-api.example/api/v1/payments/vnpay/ipn
```

The code is already ready for both Return and IPN.

## API added

TENANT:

```text
POST /api/v1/payments/invoices/:invoiceId/vnpay
GET  /api/v1/payments
GET  /api/v1/payments/txn/:txnRef
```

LANDLORD:

```text
GET /api/v1/landlord/payments
```

ADMIN:

```text
GET /api/v1/admin/payments
```

Public VNPAY callbacks protected by signature validation:

```text
GET /api/v1/payments/vnpay/return
GET /api/v1/payments/vnpay/ipn
```

## Recommended test flow

1. Run API and Web.
2. Login TENANT with an `UNPAID` or `OVERDUE` invoice.
3. Open `/invoices`.
4. Click `Thanh toán qua VNPAY`.
5. Complete payment on the VNPAY Sandbox page.
6. VNPAY returns to `/payments/result`.
7. Verify:
   - `payments.status = SUCCEEDED`
   - `invoices.status = PAID`
   - `invoices.paidAt != null`
   - `gatewayTransactionNo` has a value
   - TENANT receives payment notification
   - LANDLORD receives payment notification
   - Phase 10 analytics updates automatically because the invoice is now `PAID`

## VNPAY official NCB sandbox card

For the official successful sandbox test case:

```text
Bank: NCB
Card number: 9704198526191432198
Cardholder: NGUYEN VAN A
Issue date: 07/15
OTP: 123456
```

Use only in the VNPAY Sandbox environment.

## Security acceptance checks

- TENANT B starts payment for TENANT A invoice -> `404`.
- Client cannot choose/change the amount; backend reads `invoice.total`.
- Tampered callback signature -> VNPAY IPN response `97` and no invoice change.
- Callback amount different from invoice/payment amount -> response `04` and no invoice change.
- Same successful Return/IPN repeated -> remains one logical successful payment; invoice is not paid twice.
- LANDLORD A cannot see LANDLORD B payments.
- TENANT cannot access `/admin/payments` or `/landlord/payments` -> `403`.
- LANDLORD cannot manually mark an invoice PAID while a VNPAY checkout session is still active -> `409`.
- Payment success never stores card number/CVV/OTP.

## Notes

The old LANDLORD manual `Xác nhận đã thanh toán` path is intentionally retained for cash/bank-transfer cases. From Phase 11 onward, those confirmations are written to `payments` as provider `MANUAL`, so payment history is no longer limited to VNPAY transactions.
