import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AppointmentStatus,
  ListingStatus,
  PropertyStatus,
  RoomStatus,
} from "../generated/prisma/client.js";
import { PrismaService } from "../database/prisma.service.js";
import { CreateAppointmentDto } from "./dto/create-appointment.dto.js";
import { RejectAppointmentDto } from "./dto/reject-appointment.dto.js";

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

const tenantAppointmentInclude = {
  landlord: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      avatarUrl: true,
    },
  },
  room: {
    include: {
      property: true,
      listings: {
        where: { status: ListingStatus.APPROVED },
        orderBy: { publishedAt: "desc" as const },
        take: 1,
        select: {
          id: true,
          title: true,
          images: {
            orderBy: { sortOrder: "asc" as const },
            take: 1,
            select: { id: true, url: true },
          },
        },
      },
    },
  },
};

const landlordAppointmentInclude = {
  tenant: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      avatarUrl: true,
    },
  },
  room: {
    include: {
      property: true,
      listings: {
        where: { status: ListingStatus.APPROVED },
        orderBy: { publishedAt: "desc" as const },
        take: 1,
        select: {
          id: true,
          title: true,
          images: {
            orderBy: { sortOrder: "asc" as const },
            take: 1,
            select: { id: true, url: true },
          },
        },
      },
    },
  },
};

function parseDateOnly(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException("Ngày hẹn không hợp lệ.");
  }
  return date;
}

function parseTimeOnly(value: string) {
  const time = new Date(`1970-01-01T${value}:00.000Z`);
  if (Number.isNaN(time.getTime())) throw new BadRequestException("Giờ hẹn không hợp lệ.");
  return time;
}

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function appointmentStartInVietnam(date: string, time: string) {
  return new Date(`${date}T${time}:00+07:00`);
}

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createForListing(tenantId: string, listingId: string, dto: CreateAppointmentDto) {
    const listing = await this.prisma.listing.findFirst({
      where: {
        id: listingId,
        status: ListingStatus.APPROVED,
        room: {
          status: RoomStatus.AVAILABLE,
          property: { status: PropertyStatus.ACTIVE },
        },
      },
      select: {
        id: true,
        roomId: true,
        room: {
          select: {
            id: true,
            property: { select: { landlordId: true } },
          },
        },
      },
    });

    if (!listing) {
      throw new NotFoundException("Tin đăng không tồn tại hoặc phòng hiện không thể đặt lịch xem.");
    }

    const appointmentDate = parseDateOnly(dto.appointmentDate);
    const startTime = parseTimeOnly(dto.startTime);
    const endTime = parseTimeOnly(dto.endTime);

    if (minutes(dto.endTime) <= minutes(dto.startTime)) {
      throw new BadRequestException("Giờ kết thúc phải sau giờ bắt đầu.");
    }

    const startAt = appointmentStartInVietnam(dto.appointmentDate, dto.startTime);
    if (Number.isNaN(startAt.getTime()) || startAt.getTime() <= Date.now()) {
      throw new BadRequestException("Lịch xem phòng phải ở thời điểm tương lai.");
    }

    const roomConflict = await this.prisma.appointment.findFirst({
      where: {
        roomId: listing.roomId,
        appointmentDate,
        status: { in: ACTIVE_APPOINTMENT_STATUSES },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      select: { id: true },
    });

    if (roomConflict) {
      throw new ConflictException("Khung giờ này đã có lịch xem khác cho phòng. Hãy chọn giờ khác.");
    }

    const tenantConflict = await this.prisma.appointment.findFirst({
      where: {
        tenantId,
        appointmentDate,
        status: { in: ACTIVE_APPOINTMENT_STATUSES },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      select: { id: true },
    });

    if (tenantConflict) {
      throw new ConflictException("Bạn đã có một lịch xem khác trùng khung giờ này.");
    }

    return this.prisma.appointment.create({
      data: {
        tenantId,
        roomId: listing.roomId,
        landlordId: listing.room.property.landlordId,
        appointmentDate,
        startTime,
        endTime,
        tenantNote: dto.tenantNote?.trim() || null,
        status: AppointmentStatus.PENDING,
      },
      include: tenantAppointmentInclude,
    });
  }

  async listTenant(tenantId: string) {
    const [appointments, reviews] = await Promise.all([
      this.prisma.appointment.findMany({
        where: { tenantId },
        orderBy: [{ appointmentDate: "desc" }, { startTime: "desc" }],
        include: tenantAppointmentInclude,
      }),
      this.prisma.review.findMany({
        where: { tenantId },
        select: { propertyId: true },
      }),
    ]);

    return {
      appointments,
      reviewedPropertyIds: reviews.map((review) => review.propertyId),
    };
  }

  async cancel(tenantId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      select: { id: true, status: true },
    });

    if (!appointment) throw new NotFoundException("Không tìm thấy lịch xem của bạn.");

    const cancellable: AppointmentStatus[] = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];
    if (!cancellable.includes(appointment.status)) {
      throw new BadRequestException("Lịch xem này không còn có thể hủy.");
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.CANCELLED },
      include: tenantAppointmentInclude,
    });
  }

  async listLandlord(landlordId: string) {
    return this.prisma.appointment.findMany({
      where: { landlordId },
      orderBy: [{ appointmentDate: "desc" }, { startTime: "desc" }],
      include: landlordAppointmentInclude,
    });
  }

  private async getLandlordAppointmentOrThrow(landlordId: string, appointmentId: string) {
    const appointment = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, landlordId },
      include: landlordAppointmentInclude,
    });

    if (!appointment) {
      throw new NotFoundException("Không tìm thấy lịch xem hoặc lịch này không thuộc nhà trọ của bạn.");
    }

    return appointment;
  }

  async confirm(landlordId: string, appointmentId: string) {
    const appointment = await this.getLandlordAppointmentOrThrow(landlordId, appointmentId);
    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException("Chỉ lịch PENDING mới có thể xác nhận.");
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.CONFIRMED, landlordNote: null },
      include: landlordAppointmentInclude,
    });
  }

  async reject(landlordId: string, appointmentId: string, dto: RejectAppointmentDto) {
    const appointment = await this.getLandlordAppointmentOrThrow(landlordId, appointmentId);
    if (appointment.status !== AppointmentStatus.PENDING) {
      throw new BadRequestException("Chỉ lịch PENDING mới có thể từ chối.");
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: AppointmentStatus.REJECTED,
        landlordNote: dto.landlordNote?.trim() || null,
      },
      include: landlordAppointmentInclude,
    });
  }

  async complete(landlordId: string, appointmentId: string) {
    const appointment = await this.getLandlordAppointmentOrThrow(landlordId, appointmentId);
    if (appointment.status !== AppointmentStatus.CONFIRMED) {
      throw new BadRequestException("Chỉ lịch CONFIRMED mới có thể đánh dấu hoàn tất.");
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.COMPLETED },
      include: landlordAppointmentInclude,
    });
  }

  async noShow(landlordId: string, appointmentId: string) {
    const appointment = await this.getLandlordAppointmentOrThrow(landlordId, appointmentId);
    if (appointment.status !== AppointmentStatus.CONFIRMED) {
      throw new BadRequestException("Chỉ lịch CONFIRMED mới có thể đánh dấu không đến.");
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.NO_SHOW },
      include: landlordAppointmentInclude,
    });
  }
}
