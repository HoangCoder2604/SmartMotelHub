import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AppointmentStatus,
  ContractRenewalIntent,
  ContractStatus,
  ListingStatus,
  RoomStatus,
} from "../generated/prisma/client.js";
import { PrismaService } from "../database/prisma.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { CreateContractDto } from "./dto/create-contract.dto.js";
import { RenewContractDto } from "./dto/renew-contract.dto.js";
import { RequestContractRenewalDto } from "./dto/request-contract-renewal.dto.js";
import { TerminateContractDto } from "./dto/terminate-contract.dto.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_DAYS = new Set([30, 7, 1, 0]);

const contractInclude = {
  tenant: {
    select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true },
  },
  landlord: {
    select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true },
  },
  room: {
    include: {
      property: true,
      listings: {
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: {
          id: true,
          title: true,
          status: true,
          images: {
            orderBy: { sortOrder: "asc" as const },
            take: 1,
            select: { id: true, url: true },
          },
        },
      },
    },
  },
  appointment: {
    select: { id: true, appointmentDate: true, startTime: true, endTime: true, status: true },
  },
  invoices: {
    orderBy: { billingMonth: "desc" as const },
  },
};

function parseDateOnly(value: string, fieldName: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${fieldName} không hợp lệ.`);
  }
  return date;
}

function vietnamTodayUtc(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${value.year}-${value.month}-${value.day}T00:00:00.000Z`);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysUntil(endDate: Date, today: Date) {
  return Math.round((endDate.getTime() - today.getTime()) / DAY_MS);
}

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listLandlord(landlordId: string) {
    // Đây cũng là fallback cho môi trường serverless: mở trang hợp đồng sẽ
    // kích hoạt workflow nếu background worker không chạy liên tục.
    await this.processExpiryWorkflow().catch(() => undefined);

    const [contracts, candidates] = await Promise.all([
      this.prisma.contract.findMany({
        where: { landlordId },
        orderBy: { createdAt: "desc" },
        include: contractInclude,
      }),
      this.prisma.appointment.findMany({
        where: {
          landlordId,
          status: AppointmentStatus.COMPLETED,
          contract: null,
          room: {
            status: RoomStatus.AVAILABLE,
            contracts: {
              none: { status: { in: [ContractStatus.DRAFT, ContractStatus.ACTIVE] } },
            },
          },
        },
        orderBy: [{ appointmentDate: "desc" }, { startTime: "desc" }],
        include: {
          tenant: { select: { id: true, fullName: true, email: true, phone: true } },
          room: { include: { property: true } },
        },
      }),
    ]);

    return { contracts, candidates };
  }

  async listTenant(tenantId: string) {
    await this.processExpiryWorkflow().catch(() => undefined);

    return this.prisma.contract.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: contractInclude,
    });
  }

  async createDraft(landlordId: string, dto: CreateContractDto) {
    const appointment = await this.prisma.appointment.findFirst({
      where: {
        id: dto.appointmentId,
        landlordId,
        status: AppointmentStatus.COMPLETED,
        room: { status: RoomStatus.AVAILABLE },
      },
      include: {
        tenant: { select: { id: true, fullName: true } },
        room: { include: { property: true } },
        contract: { select: { id: true } },
      },
    });

    if (!appointment) {
      throw new NotFoundException("Không tìm thấy lịch xem COMPLETED thuộc nhà trọ của bạn.");
    }

    if (appointment.contract) {
      throw new ConflictException("Lịch xem này đã được dùng để tạo hợp đồng.");
    }

    const blockingContract = await this.prisma.contract.findFirst({
      where: {
        roomId: appointment.roomId,
        status: { in: [ContractStatus.DRAFT, ContractStatus.ACTIVE] },
      },
      select: { id: true, status: true },
    });

    if (blockingContract) {
      throw new ConflictException("Phòng này đang có hợp đồng DRAFT hoặc ACTIVE.");
    }

    const startDate = parseDateOnly(dto.startDate, "Ngày bắt đầu");
    const endDate = dto.endDate ? parseDateOnly(dto.endDate, "Ngày kết thúc") : null;
    if (endDate && endDate.getTime() <= startDate.getTime()) {
      throw new BadRequestException("Ngày kết thúc phải sau ngày bắt đầu.");
    }

    const monthlyRent = dto.monthlyRent ?? Number(appointment.room.price);
    const deposit = dto.deposit ?? (appointment.room.deposit === null ? null : Number(appointment.room.deposit));

    const contract = await this.prisma.contract.create({
      data: {
        appointmentId: appointment.id,
        roomId: appointment.roomId,
        tenantId: appointment.tenantId,
        landlordId,
        startDate,
        endDate,
        monthlyRent,
        deposit,
        status: ContractStatus.DRAFT,
      },
      include: contractInclude,
    });

    await this.notifications.notify({
      userId: appointment.tenantId,
      type: "CONTRACT_CREATED",
      title: "Bạn có hợp đồng thuê mới",
      message: `${appointment.room.property.name} · ${appointment.room.title} đang chờ bạn xem và chấp nhận.`,
      href: "/contracts",
    }).catch(() => undefined);

    return contract;
  }

  async deleteDraft(landlordId: string, contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, landlordId },
      include: { room: { include: { property: true } } },
    });

    if (!contract) throw new NotFoundException("Không tìm thấy hợp đồng thuộc tài khoản của bạn.");
    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException("Chỉ có thể thu hồi hợp đồng DRAFT.");
    }

    await this.prisma.contract.delete({ where: { id: contractId } });

    await this.notifications.notify({
      userId: contract.tenantId,
      type: "CONTRACT_WITHDRAWN",
      title: "Hợp đồng nháp đã được thu hồi",
      message: `${contract.room.property.name} · ${contract.room.title}: chủ nhà đã thu hồi đề nghị hợp đồng.`,
      href: "/contracts",
    }).catch(() => undefined);

    return { id: contractId };
  }

  async accept(tenantId: string, contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: contractInclude,
    });

    if (!contract) throw new NotFoundException("Không tìm thấy hợp đồng của bạn.");
    if (contract.status !== ContractStatus.DRAFT) {
      throw new BadRequestException("Chỉ hợp đồng DRAFT mới có thể chấp nhận.");
    }
    if (contract.room.status !== RoomStatus.AVAILABLE) {
      throw new ConflictException("Phòng hiện không còn ở trạng thái AVAILABLE.");
    }

    const active = await this.prisma.contract.findFirst({
      where: {
        roomId: contract.roomId,
        status: ContractStatus.ACTIVE,
        id: { not: contract.id },
      },
      select: { id: true },
    });

    if (active) throw new ConflictException("Phòng này đã có hợp đồng ACTIVE khác.");

    const affectedAppointments = await this.prisma.appointment.findMany({
      where: {
        roomId: contract.roomId,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
      },
      select: { id: true, tenantId: true },
    });

    const now = new Date();
    const activated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.contract.update({
        where: { id: contract.id },
        data: {
          status: ContractStatus.ACTIVE,
          tenantAcceptedAt: now,
          activatedAt: now,
          terminatedAt: null,
          terminationReason: null,
          renewalIntent: ContractRenewalIntent.NONE,
          renewalRequestedAt: null,
          renewalNote: null,
        },
        include: contractInclude,
      });

      await tx.room.update({
        where: { id: contract.roomId },
        data: { status: RoomStatus.RENTED },
      });

      await tx.listing.updateMany({
        where: { roomId: contract.roomId, status: ListingStatus.APPROVED },
        data: { status: ListingStatus.HIDDEN },
      });

      if (affectedAppointments.length) {
        await tx.appointment.updateMany({
          where: {
            id: { in: affectedAppointments.map((item) => item.id) },
            status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] },
          },
          data: {
            status: AppointmentStatus.CANCELLED,
            landlordNote: "Phòng đã có hợp đồng thuê mới.",
          },
        });
      }

      return updated;
    });

    await this.notifications.notify({
      userId: contract.landlordId,
      type: "CONTRACT_ACTIVATED",
      title: "TENANT đã chấp nhận hợp đồng",
      message: `${contract.tenant.fullName} đã chấp nhận hợp đồng ${contract.room.property.name} · ${contract.room.title}.`,
      href: "/landlord/contracts",
    }).catch(() => undefined);

    const cancelledTenantIds = [...new Set(affectedAppointments.map((item) => item.tenantId).filter((id) => id !== tenantId))];
    await Promise.all(
      cancelledTenantIds.map((userId) =>
        this.notifications.notify({
          userId,
          type: "APPOINTMENT_CANCELLED_ROOM_RENTED",
          title: "Lịch xem phòng đã được hủy",
          message: `${contract.room.property.name} · ${contract.room.title} đã có người thuê.`,
          href: "/appointments",
        }).catch(() => undefined),
      ),
    );

    return activated;
  }

  async requestRenewalIntent(tenantId: string, contractId: string, dto: RequestContractRenewalDto) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, tenantId },
      include: contractInclude,
    });

    if (!contract) throw new NotFoundException("Không tìm thấy hợp đồng của bạn.");
    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException("Chỉ hợp đồng ACTIVE mới có thể gửi lựa chọn gia hạn.");
    }
    if (!contract.endDate) {
      throw new BadRequestException("Hợp đồng không có ngày kết thúc nên không cần workflow gia hạn.");
    }

    const intent = dto.intent === "RENEW" ? ContractRenewalIntent.RENEW : ContractRenewalIntent.NOT_RENEW;
    if (contract.renewalIntent === intent) {
      throw new ConflictException(
        intent === ContractRenewalIntent.RENEW
          ? "Bạn đã gửi yêu cầu gia hạn cho hợp đồng này."
          : "Bạn đã thông báo không gia hạn cho hợp đồng này.",
      );
    }

    const requestedAt = new Date();
    const updated = await this.prisma.contract.update({
      where: { id: contract.id },
      data: {
        renewalIntent: intent,
        renewalRequestedAt: requestedAt,
        renewalNote: dto.note?.trim() || null,
      },
      include: contractInclude,
    });

    const wantsRenewal = intent === ContractRenewalIntent.RENEW;
    await this.notifications.notify({
      userId: contract.landlordId,
      type: wantsRenewal ? "CONTRACT_RENEWAL_REQUESTED" : "CONTRACT_NOT_RENEWING",
      title: wantsRenewal ? "TENANT yêu cầu gia hạn hợp đồng" : "TENANT sẽ không gia hạn hợp đồng",
      message: `${contract.tenant.fullName} ${wantsRenewal ? "muốn gia hạn" : "không muốn gia hạn"} ${contract.room.property.name} · ${contract.room.title}.${dto.note?.trim() ? ` Ghi chú: ${dto.note.trim()}` : ""}`,
      href: "/landlord/contracts",
    }).catch(() => undefined);

    return updated;
  }

  async renew(landlordId: string, contractId: string, dto: RenewContractDto) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, landlordId },
      include: contractInclude,
    });

    if (!contract) throw new NotFoundException("Không tìm thấy hợp đồng thuộc tài khoản của bạn.");
    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException("Chỉ hợp đồng ACTIVE mới có thể gia hạn.");
    }
    if (!contract.endDate) {
      throw new BadRequestException("Hợp đồng hiện không có ngày kết thúc.");
    }
    if (contract.renewalIntent !== ContractRenewalIntent.RENEW) {
      throw new BadRequestException("TENANT chưa gửi yêu cầu gia hạn hợp đồng này.");
    }

    const newEndDate = parseDateOnly(dto.newEndDate, "Ngày kết thúc mới");
    if (newEndDate.getTime() <= contract.endDate.getTime()) {
      throw new BadRequestException("Ngày kết thúc mới phải sau ngày kết thúc hiện tại.");
    }

    const renewedAt = new Date();
    const updated = await this.prisma.contract.update({
      where: { id: contract.id },
      data: {
        previousEndDate: contract.endDate,
        endDate: newEndDate,
        renewedAt,
        renewalIntent: ContractRenewalIntent.NONE,
        renewalRequestedAt: null,
        renewalNote: null,
      },
      include: contractInclude,
    });

    await this.notifications.notify({
      userId: contract.tenantId,
      type: "CONTRACT_RENEWED",
      title: "Hợp đồng đã được gia hạn",
      message: `${contract.room.property.name} · ${contract.room.title} đã được gia hạn đến ${dateKey(newEndDate)}.${dto.note?.trim() ? ` Chủ nhà: ${dto.note.trim()}` : ""}`,
      href: "/contracts",
    }).catch(() => undefined);

    return updated;
  }

  async terminate(landlordId: string, contractId: string, dto: TerminateContractDto) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, landlordId },
      include: contractInclude,
    });

    if (!contract) throw new NotFoundException("Không tìm thấy hợp đồng thuộc tài khoản của bạn.");
    if (contract.status !== ContractStatus.ACTIVE) {
      throw new BadRequestException("Chỉ hợp đồng ACTIVE mới có thể kết thúc.");
    }

    const now = new Date();
    const terminated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.contract.update({
        where: { id: contract.id },
        data: {
          status: ContractStatus.TERMINATED,
          terminatedAt: now,
          terminationReason: dto.reason?.trim() || null,
          renewalIntent: ContractRenewalIntent.NONE,
          renewalRequestedAt: null,
        },
        include: contractInclude,
      });

      await tx.room.update({
        where: { id: contract.roomId },
        data: { status: RoomStatus.AVAILABLE },
      });

      await tx.listing.updateMany({
        where: { roomId: contract.roomId, status: ListingStatus.HIDDEN },
        data: {
          status: ListingStatus.DRAFT,
          publishedAt: null,
          rejectionReason: null,
          reviewedAt: null,
          reviewedByAdminId: null,
        },
      });

      return updated;
    });

    await this.notifications.notify({
      userId: contract.tenantId,
      type: "CONTRACT_TERMINATED",
      title: "Hợp đồng thuê đã kết thúc",
      message: `${contract.room.property.name} · ${contract.room.title}: hợp đồng đã được kết thúc.`,
      href: "/contracts",
    }).catch(() => undefined);

    return terminated;
  }

  async processExpiryWorkflow() {
    const today = vietnamTodayUtc();
    const horizon = new Date(today.getTime() + 30 * DAY_MS);
    const contracts = await this.prisma.contract.findMany({
      where: {
        status: ContractStatus.ACTIVE,
        endDate: { not: null, lte: horizon },
      },
      select: {
        id: true,
        tenantId: true,
        landlordId: true,
        roomId: true,
        endDate: true,
        tenant: { select: { fullName: true } },
        landlord: { select: { fullName: true } },
        room: { select: { title: true, property: { select: { name: true } } } },
      },
    });

    let reminders = 0;
    let expired = 0;

    for (const contract of contracts) {
      if (!contract.endDate) continue;
      const remaining = daysUntil(contract.endDate, today);

      if (REMINDER_DAYS.has(remaining)) {
        await this.sendExpiryReminder(contract, remaining);
        reminders += 2;
      }

      if (remaining <= 0) {
        const changed = await this.expireContract(contract.id, contract.roomId, today);
        if (changed) {
          expired += 1;
          if (remaining < 0) {
            await this.sendExpiredAfterDowntime(contract);
          }
        }
      }
    }

    return { checked: contracts.length, reminders, expired, date: dateKey(today) };
  }

  private async sendExpiryReminder(
    contract: {
      id: string;
      tenantId: string;
      landlordId: string;
      endDate: Date | null;
      tenant: { fullName: string };
      landlord: { fullName: string };
      room: { title: string; property: { name: string } };
    },
    remaining: number,
  ) {
    if (!contract.endDate) return;
    const end = dateKey(contract.endDate);
    const type = remaining === 0 ? "CONTRACT_EXPIRES_TODAY" : `CONTRACT_EXPIRY_${remaining}D`;
    const tenantTitle = remaining === 0 ? "Hợp đồng hết hạn hôm nay" : `Hợp đồng còn ${remaining} ngày`;
    const landlordTitle = remaining === 0 ? "Hợp đồng của TENANT hết hạn hôm nay" : `Hợp đồng TENANT còn ${remaining} ngày`;
    const suffix = remaining === 0 ? "hết hạn hôm nay" : `sẽ hết hạn sau ${remaining} ngày`;

    await Promise.all([
      this.notifications.notifyOnce({
        userId: contract.tenantId,
        type,
        title: tenantTitle,
        message: `${contract.room.property.name} · ${contract.room.title} ${suffix} (${end}). Hãy chọn gia hạn hoặc không gia hạn.`,
        href: "/contracts",
        dedupeKey: `contract-expiry:${contract.id}:${end}:${remaining}:tenant`,
      }).catch(() => undefined),
      this.notifications.notifyOnce({
        userId: contract.landlordId,
        type,
        title: landlordTitle,
        message: `${contract.tenant.fullName} · ${contract.room.property.name} · ${contract.room.title} ${suffix} (${end}).`,
        href: "/landlord/contracts",
        dedupeKey: `contract-expiry:${contract.id}:${end}:${remaining}:landlord`,
      }).catch(() => undefined),
    ]);
  }

  private async expireContract(contractId: string, roomId: string, today: Date) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.contract.updateMany({
        where: {
          id: contractId,
          status: ContractStatus.ACTIVE,
          endDate: { not: null, lte: today },
        },
        data: {
          status: ContractStatus.EXPIRED,
          renewalIntent: ContractRenewalIntent.NONE,
          renewalRequestedAt: null,
        },
      });

      if (result.count === 0) return false;

      await tx.room.update({
        where: { id: roomId },
        data: { status: RoomStatus.AVAILABLE },
      });

      await tx.listing.updateMany({
        where: { roomId, status: ListingStatus.HIDDEN },
        data: {
          status: ListingStatus.DRAFT,
          publishedAt: null,
          rejectionReason: null,
          reviewedAt: null,
          reviewedByAdminId: null,
        },
      });

      return true;
    });
  }

  private async sendExpiredAfterDowntime(contract: {
    id: string;
    tenantId: string;
    landlordId: string;
    endDate: Date | null;
    tenant: { fullName: string };
    room: { title: string; property: { name: string } };
  }) {
    if (!contract.endDate) return;
    const end = dateKey(contract.endDate);
    await Promise.all([
      this.notifications.notifyOnce({
        userId: contract.tenantId,
        type: "CONTRACT_EXPIRED",
        title: "Hợp đồng đã hết hạn",
        message: `${contract.room.property.name} · ${contract.room.title} đã hết hạn ngày ${end}.`,
        href: "/contracts",
        dedupeKey: `contract-expired:${contract.id}:${end}:tenant`,
      }).catch(() => undefined),
      this.notifications.notifyOnce({
        userId: contract.landlordId,
        type: "CONTRACT_EXPIRED",
        title: "Hợp đồng TENANT đã hết hạn",
        message: `${contract.tenant.fullName} · ${contract.room.property.name} · ${contract.room.title} đã hết hạn ngày ${end}.`,
        href: "/landlord/contracts",
        dedupeKey: `contract-expired:${contract.id}:${end}:landlord`,
      }).catch(() => undefined),
    ]);
  }
}
