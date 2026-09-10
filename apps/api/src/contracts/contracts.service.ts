import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AppointmentStatus,
  ContractStatus,
  ListingStatus,
  RoomStatus,
} from "../generated/prisma/client.js";
import { PrismaService } from "../database/prisma.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { CreateContractDto } from "./dto/create-contract.dto.js";
import { TerminateContractDto } from "./dto/terminate-contract.dto.js";

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

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listLandlord(landlordId: string) {
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
}
