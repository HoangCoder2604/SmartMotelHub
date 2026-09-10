import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ContractStatus, InvoiceStatus } from "../generated/prisma/client.js";
import { PrismaService } from "../database/prisma.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { CreateInvoiceDto } from "./dto/create-invoice.dto.js";
import { MarkInvoicePaidDto } from "./dto/mark-invoice-paid.dto.js";

const invoiceInclude = {
  contract: {
    include: {
      tenant: { select: { id: true, fullName: true, email: true, phone: true } },
      landlord: { select: { id: true, fullName: true, email: true, phone: true } },
      room: { include: { property: true } },
    },
  },
};

function parseDateOnly(value: string, fieldName: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${fieldName} không hợp lệ.`);
  }
  return date;
}

function parseBillingMonth(value: string) {
  const date = new Date(`${value}-01T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 7) !== value) {
    throw new BadRequestException("Tháng hóa đơn không hợp lệ.");
  }
  return date;
}

function firstDayOfTodayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async refreshOverdue() {
    await this.prisma.invoice.updateMany({
      where: {
        status: InvoiceStatus.UNPAID,
        dueDate: { lt: firstDayOfTodayUtc() },
      },
      data: { status: InvoiceStatus.OVERDUE },
    });
  }

  async listTenant(tenantId: string) {
    await this.refreshOverdue();
    return this.prisma.invoice.findMany({
      where: { contract: { tenantId } },
      orderBy: [{ billingMonth: "desc" }, { createdAt: "desc" }],
      include: invoiceInclude,
    });
  }

  async listLandlord(landlordId: string) {
    await this.refreshOverdue();
    return this.prisma.invoice.findMany({
      where: { contract: { landlordId } },
      orderBy: [{ billingMonth: "desc" }, { createdAt: "desc" }],
      include: invoiceInclude,
    });
  }

  async create(landlordId: string, contractId: string, dto: CreateInvoiceDto) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, landlordId },
      include: {
        tenant: { select: { id: true, fullName: true } },
        room: { include: { property: true } },
      },
    });

    if (!contract) throw new NotFoundException("Không tìm thấy hợp đồng thuộc tài khoản của bạn.");
    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException("Chỉ hợp đồng ACTIVE mới có thể tạo hóa đơn.");
    }

    const billingMonth = parseBillingMonth(dto.billingMonth);
    const dueDate = parseDateOnly(dto.dueDate, "Hạn thanh toán");
    if (dueDate.getTime() < billingMonth.getTime()) {
      throw new BadRequestException("Hạn thanh toán không thể trước tháng hóa đơn.");
    }

    const contractStartMonth = new Date(Date.UTC(contract.startDate.getUTCFullYear(), contract.startDate.getUTCMonth(), 1));
    if (billingMonth.getTime() < contractStartMonth.getTime()) {
      throw new BadRequestException("Tháng hóa đơn không thể trước tháng bắt đầu hợp đồng.");
    }

    if (contract.endDate) {
      const contractEndMonth = new Date(Date.UTC(contract.endDate.getUTCFullYear(), contract.endDate.getUTCMonth(), 1));
      if (billingMonth.getTime() > contractEndMonth.getTime()) {
        throw new BadRequestException("Tháng hóa đơn không thể sau tháng kết thúc hợp đồng.");
      }
    }

    const existing = await this.prisma.invoice.findUnique({
      where: { contractId_billingMonth: { contractId, billingMonth } },
      select: { id: true },
    });
    if (existing) throw new ConflictException("Hợp đồng này đã có hóa đơn cho tháng đã chọn.");

    const roomFee = dto.roomFee ?? Number(contract.monthlyRent);
    const electricityFee = dto.electricityFee ?? 0;
    const waterFee = dto.waterFee ?? 0;
    const internetFee = dto.internetFee ?? 0;
    const serviceFee = dto.serviceFee ?? 0;
    const otherFee = dto.otherFee ?? 0;
    const total = roomFee + electricityFee + waterFee + internetFee + serviceFee + otherFee;

    const invoice = await this.prisma.invoice.create({
      data: {
        contractId,
        billingMonth,
        dueDate,
        roomFee,
        electricityFee,
        waterFee,
        internetFee,
        serviceFee,
        otherFee,
        total,
        status: dueDate.getTime() < firstDayOfTodayUtc().getTime() ? InvoiceStatus.OVERDUE : InvoiceStatus.UNPAID,
      },
      include: invoiceInclude,
    });

    await this.notifications.notify({
      userId: contract.tenantId,
      type: "INVOICE_CREATED",
      title: `Hóa đơn ${dto.billingMonth} đã được tạo`,
      message: `${contract.room.property.name} · ${contract.room.title}: tổng thanh toán ${Math.round(total).toLocaleString("vi-VN")} đ.`,
      href: "/invoices",
    }).catch(() => undefined);

    return invoice;
  }

  async markPaid(landlordId: string, invoiceId: string, dto: MarkInvoicePaidDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, contract: { landlordId } },
      include: invoiceInclude,
    });

    if (!invoice) throw new NotFoundException("Không tìm thấy hóa đơn thuộc tài khoản của bạn.");
    const payable: InvoiceStatus[] = [InvoiceStatus.UNPAID, InvoiceStatus.OVERDUE];
    if (!payable.includes(invoice.status)) {
      throw new BadRequestException("Hóa đơn này đã được đánh dấu PAID.");
    }

    const updated = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: new Date(),
        paymentNote: dto.paymentNote?.trim() || null,
      },
      include: invoiceInclude,
    });

    await this.notifications.notify({
      userId: invoice.contract.tenantId,
      type: "INVOICE_PAID",
      title: "Thanh toán đã được xác nhận",
      message: `${invoice.contract.room.property.name} · ${invoice.contract.room.title}: hóa đơn ${invoice.billingMonth.toISOString().slice(0, 7)} đã được xác nhận PAID.`,
      href: "/invoices",
    }).catch(() => undefined);

    return updated;
  }
}
