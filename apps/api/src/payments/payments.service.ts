import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  InvoiceStatus,
  PaymentProvider,
  PaymentStatus,
} from "../generated/prisma/client.js";
import { PrismaService } from "../database/prisma.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";

type VnpQuery = Record<string, string | string[] | undefined>;
type FlatVnpQuery = Record<string, string>;
type CallbackSource = "return" | "ipn";

const paymentInclude = {
  invoice: {
    include: {
      contract: {
        include: {
          tenant: { select: { id: true, fullName: true, email: true } },
          landlord: { select: { id: true, fullName: true, email: true } },
          room: { include: { property: true } },
        },
      },
    },
  },
};

function flatQuery(input: VnpQuery): FlatVnpQuery {
  const output: FlatVnpQuery = {};
  for (const [key, raw] of Object.entries(input)) {
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value === "string") output[key] = value;
  }
  return output;
}

function sortParams(input: Record<string, string>) {
  return Object.entries(input)
    .filter(([, value]) => value !== "")
    .sort(([a], [b]) => a.localeCompare(b));
}

function queryString(input: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, value] of sortParams(input)) params.append(key, value);
  return params.toString();
}

function hashData(input: Record<string, string>) {
  // VNPAY signs the same canonical, URL-encoded query string that is sent
  // to the gateway. Keeping signing and URL generation identical avoids
  // checksum mismatches for values such as ReturnUrl and OrderInfo.
  return queryString(input);
}

function formatVnpDate(date: Date) {
  const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${vn.getUTCFullYear()}${pad(vn.getUTCMonth() + 1)}${pad(vn.getUTCDate())}${pad(vn.getUTCHours())}${pad(vn.getUTCMinutes())}${pad(vn.getUTCSeconds())}`;
}

function parseVnpDate(value?: string) {
  if (!value || !/^\d{14}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(8, 10));
  const minute = Number(value.slice(10, 12));
  const second = Number(value.slice(12, 14));
  const date = new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizedIp(value: string) {
  if (!value || value === "::1" || value === "::ffff:127.0.0.1") return "127.0.0.1";
  return value.replace(/^::ffff:/, "").slice(0, 45);
}

function makeTxnRef() {
  const now = new Date();
  const stamp = formatVnpDate(now);
  const suffix = randomBytes(5).toString("hex").toUpperCase();
  return `SMH${stamp}${suffix}`;
}

function responseStatus(responseCode: string | undefined, transactionStatus: string | undefined) {
  if (responseCode === "00" && transactionStatus === "00") return PaymentStatus.SUCCEEDED;
  if (responseCode === "24") return PaymentStatus.CANCELLED;
  if (responseCode === "11") return PaymentStatus.EXPIRED;
  return PaymentStatus.FAILED;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private config() {
    const tmnCode = process.env.VNPAY_TMN_CODE?.trim();
    const hashSecret = process.env.VNPAY_HASH_SECRET?.trim();
    if (!tmnCode || !hashSecret) {
      throw new ServiceUnavailableException(
        "VNPAY chưa được cấu hình. Hãy thêm VNPAY_TMN_CODE và VNPAY_HASH_SECRET vào apps/api/.env.",
      );
    }

    const expireMinutesRaw = Number(process.env.VNPAY_EXPIRE_MINUTES ?? 15);
    const expireMinutes = Number.isFinite(expireMinutesRaw) && expireMinutesRaw >= 5 && expireMinutesRaw <= 60
      ? Math.floor(expireMinutesRaw)
      : 15;

    return {
      tmnCode,
      hashSecret,
      paymentUrl: process.env.VNPAY_PAYMENT_URL?.trim() || "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
      returnUrl: process.env.VNPAY_RETURN_URL?.trim() || "http://localhost:4000/api/v1/payments/vnpay/return",
      webResultUrl: process.env.VNPAY_WEB_RESULT_URL?.trim() || "http://localhost:3001/payments/result",
      orderType: process.env.VNPAY_ORDER_TYPE?.trim() || "other",
      expireMinutes,
    };
  }

  private sign(params: Record<string, string>, secret: string) {
    return createHmac("sha512", secret).update(hashData(params), "utf8").digest("hex");
  }

  private verifySignature(query: FlatVnpQuery, secret: string) {
    const received = query.vnp_SecureHash?.toLowerCase();
    if (!received) return false;

    const unsigned = { ...query };
    delete unsigned.vnp_SecureHash;
    delete unsigned.vnp_SecureHashType;
    const expected = this.sign(unsigned, secret).toLowerCase();
    if (received.length !== expected.length) return false;

    try {
      return timingSafeEqual(Buffer.from(received, "utf8"), Buffer.from(expected, "utf8"));
    } catch {
      return false;
    }
  }

  private amountForGateway(amount: unknown) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) throw new BadRequestException("Số tiền hóa đơn không hợp lệ.");
    return Math.round(value * 100).toString();
  }

  async createVnpayCheckout(tenantId: string, invoiceId: string, ipAddress: string, bankCode?: string) {
    const config = this.config();
    const now = new Date();

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, contract: { tenantId } },
      include: {
        contract: { include: { room: { include: { property: true } } } },
      },
    });

    if (!invoice) throw new NotFoundException("Không tìm thấy hóa đơn của bạn.");
    if (invoice.status === InvoiceStatus.PAID) throw new ConflictException("Hóa đơn này đã được thanh toán.");

    await this.prisma.payment.updateMany({
      where: {
        invoiceId,
        tenantId,
        provider: PaymentProvider.VNPAY,
        status: PaymentStatus.PENDING,
        expiresAt: { lte: now },
      },
      data: { status: PaymentStatus.EXPIRED, failedAt: now },
    });

    const active = await this.prisma.payment.findFirst({
      where: {
        invoiceId,
        tenantId,
        provider: PaymentProvider.VNPAY,
        status: PaymentStatus.PENDING,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    if (active?.checkoutUrl) {
      return {
        paymentId: active.id,
        txnRef: active.txnRef,
        checkoutUrl: active.checkoutUrl,
        expiresAt: active.expiresAt,
        reused: true,
      };
    }

    const expiresAt = new Date(now.getTime() + config.expireMinutes * 60 * 1000);
    const txnRef = makeTxnRef();
    const billingMonth = invoice.billingMonth.toISOString().slice(0, 7).replace("-", "");
    const orderInfo = `Thanh toan hoa don ${billingMonth} SmartMotel Hub`;

    const params: Record<string, string> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: config.tmnCode,
      vnp_Amount: this.amountForGateway(invoice.total),
      vnp_CurrCode: "VND",
      vnp_TxnRef: txnRef,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: config.orderType,
      vnp_Locale: "vn",
      vnp_ReturnUrl: config.returnUrl,
      vnp_IpAddr: normalizedIp(ipAddress),
      vnp_CreateDate: formatVnpDate(now),
      vnp_ExpireDate: formatVnpDate(expiresAt),
    };
    if (bankCode) params.vnp_BankCode = bankCode;

    const secureHash = this.sign(params, config.hashSecret);
    const checkoutUrl = `${config.paymentUrl}?${queryString(params)}&vnp_SecureHash=${secureHash}`;

    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        tenantId,
        provider: PaymentProvider.VNPAY,
        status: PaymentStatus.PENDING,
        amount: invoice.total,
        txnRef,
        checkoutUrl,
        orderInfo,
        expiresAt,
      },
    });

    return {
      paymentId: payment.id,
      txnRef,
      checkoutUrl,
      expiresAt,
      reused: false,
    };
  }

  async listTenant(tenantId: string, page = 1, limit = 20) {
    const where = { tenantId, tenantHiddenAt: null };
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: paymentInclude,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { payments, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async hideTenantHistory(tenantId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, tenantId, tenantHiddenAt: null },
      select: { id: true, status: true },
    });
    if (!payment) throw new NotFoundException("Không tìm thấy giao dịch thanh toán.");
    if (payment.status === PaymentStatus.PENDING) {
      throw new ConflictException("Không thể xóa giao dịch đang chờ xử lý khỏi lịch sử.");
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { tenantHiddenAt: new Date() },
    });
    return { id: payment.id, hidden: true };
  }

  async listLandlord(landlordId: string, page = 1, limit = 20) {
    const where = { invoice: { contract: { landlordId } } };
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: paymentInclude,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { payments, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listAdmin(page = 1, limit = 20) {
    const [payments, total, succeeded, pending, failed, revenue] = await Promise.all([
      this.prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: paymentInclude,
      }),
      this.prisma.payment.count(),
      this.prisma.payment.count({ where: { status: PaymentStatus.SUCCEEDED } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
      this.prisma.payment.count({ where: { status: { in: [PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED] } } }),
      this.prisma.payment.aggregate({ where: { status: PaymentStatus.SUCCEEDED }, _sum: { amount: true } }),
    ]);

    return {
      payments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: { succeeded, pending, failed, revenue: Number(revenue._sum.amount ?? 0) },
    };
  }

  async getTenantByTxnRef(tenantId: string, txnRef: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { tenantId, txnRef },
      include: paymentInclude,
    });
    if (!payment) throw new NotFoundException("Không tìm thấy giao dịch thanh toán.");
    return payment;
  }

  private callbackData(query: FlatVnpQuery) {
    const config = this.config();
    const validSignature = this.verifySignature(query, config.hashSecret);
    const validMerchant = query.vnp_TmnCode === config.tmnCode;
    return { config, validSignature, validMerchant };
  }

  private async applyCallback(source: CallbackSource, raw: VnpQuery) {
    const query = flatQuery(raw);
    const txnRef = query.vnp_TxnRef ?? "";
    const { validSignature, validMerchant } = this.callbackData(query);

    if (!validSignature || !validMerchant) {
      return { ok: false, reason: "INVALID_SIGNATURE", txnRef, payment: null } as const;
    }

    const payment = await this.prisma.payment.findUnique({
      where: { txnRef },
      include: paymentInclude,
    });
    if (!payment) return { ok: false, reason: "NOT_FOUND", txnRef, payment: null } as const;

    const expectedAmount = this.amountForGateway(payment.amount);
    if (query.vnp_Amount !== expectedAmount) {
      return { ok: false, reason: "INVALID_AMOUNT", txnRef, payment } as const;
    }

    const status = responseStatus(query.vnp_ResponseCode, query.vnp_TransactionStatus);
    const alreadyProcessed = source === "ipn" && payment.status === PaymentStatus.SUCCEEDED && Boolean(payment.ipnReceivedAt);
    const now = new Date();
    const gatewayPayDate = parseVnpDate(query.vnp_PayDate);
    const rawData = query;

    if (status === PaymentStatus.SUCCEEDED) {
      const transitioned = await this.prisma.$transaction(async (tx) => {
        const changed = await tx.payment.updateMany({
          where: { id: payment.id, status: { not: PaymentStatus.SUCCEEDED } },
          data: {
            status: PaymentStatus.SUCCEEDED,
            gatewayTransactionNo: query.vnp_TransactionNo || null,
            bankCode: query.vnp_BankCode || null,
            cardType: query.vnp_CardType || null,
            responseCode: query.vnp_ResponseCode || null,
            transactionStatus: query.vnp_TransactionStatus || null,
            gatewayPayDate,
            paidAt: gatewayPayDate ?? now,
            failedAt: null,
            ...(source === "return"
              ? { returnReceivedAt: now, rawReturn: rawData }
              : { ipnReceivedAt: now, rawIpn: rawData }),
          },
        });

        if (changed.count === 0) {
          if (source === "return") {
            await tx.payment.update({ where: { id: payment.id }, data: { returnReceivedAt: now, rawReturn: rawData } });
          } else {
            await tx.payment.update({ where: { id: payment.id }, data: { ipnReceivedAt: now, rawIpn: rawData } });
          }
          return false;
        }

        await tx.invoice.updateMany({
          where: { id: payment.invoiceId, status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.OVERDUE] } },
          data: {
            status: InvoiceStatus.PAID,
            paidAt: gatewayPayDate ?? now,
            paymentNote: `VNPAY ${query.vnp_TransactionNo || payment.txnRef}`,
          },
        });
        return true;
      });

      if (transitioned) {
        const month = payment.invoice.billingMonth.toISOString().slice(0, 7);
        await Promise.all([
          this.notifications.notify({
            userId: payment.tenantId,
            type: "PAYMENT_VNPAY_SUCCESS",
            title: "Thanh toán VNPAY thành công",
            message: `${payment.invoice.contract.room.property.name} · hóa đơn ${month} đã được thanh toán ${Math.round(Number(payment.amount)).toLocaleString("vi-VN")} đ.`,
            href: "/payments",
          }).catch(() => undefined),
          this.notifications.notify({
            userId: payment.invoice.contract.landlordId,
            type: "PAYMENT_RECEIVED",
            title: "Đã nhận thanh toán hóa đơn",
            message: `${payment.invoice.contract.tenant.fullName} đã thanh toán hóa đơn ${month} qua VNPAY.`,
            href: "/landlord/payments",
          }).catch(() => undefined),
        ]);
      }
    } else if (payment.status !== PaymentStatus.SUCCEEDED) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status,
          gatewayTransactionNo: query.vnp_TransactionNo || null,
          bankCode: query.vnp_BankCode || null,
          cardType: query.vnp_CardType || null,
          responseCode: query.vnp_ResponseCode || null,
          transactionStatus: query.vnp_TransactionStatus || null,
          gatewayPayDate,
          failedAt: now,
          ...(source === "return"
            ? { returnReceivedAt: now, rawReturn: rawData }
            : { ipnReceivedAt: now, rawIpn: rawData }),
        },
      });
    }

    const latest = await this.prisma.payment.findUnique({ where: { id: payment.id }, include: paymentInclude });
    return { ok: true, reason: "PROCESSED", txnRef, payment: latest, alreadyProcessed } as const;
  }

  async handleVnpayReturn(query: VnpQuery) {
    const config = this.config();
    const result = await this.applyCallback("return", query);
    const status = result.payment?.status ?? "INVALID";
    const params = new URLSearchParams({
      txnRef: result.txnRef || "unknown",
      status,
      valid: result.ok ? "1" : "0",
      reason: result.reason,
    });
    return { redirectUrl: `${config.webResultUrl}?${params.toString()}` };
  }

  async handleVnpayIpn(query: VnpQuery) {
    const result = await this.applyCallback("ipn", query);

    if (result.reason === "INVALID_SIGNATURE") return { RspCode: "97", Message: "Invalid Checksum" };
    if (result.reason === "NOT_FOUND") return { RspCode: "01", Message: "Order not found" };
    if (result.reason === "INVALID_AMOUNT") return { RspCode: "04", Message: "Invalid Amount" };
    if ("alreadyProcessed" in result && result.alreadyProcessed) {
      return { RspCode: "02", Message: "Order already confirmed" };
    }
    return { RspCode: "00", Message: "Confirm Success" };
  }
}
