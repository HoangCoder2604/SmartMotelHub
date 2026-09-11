import { Injectable } from "@nestjs/common";
import {
  AppointmentStatus,
  ComplaintStatus,
  ContractStatus,
  InvoiceStatus,
  ListingStatus,
  PropertyStatus,
  RoomStatus,
  UserRole,
  UserStatus,
  type User,
} from "../generated/prisma/client.js";
import { PrismaService } from "../database/prisma.service.js";

type MonthBucket = {
  month: string;
  revenue: number;
  spend: number;
  invoiceCount: number;
  newUsers: number;
};

function firstDayOfTodayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function makeMonthBuckets(months: number) {
  const now = new Date();
  const items: MonthBucket[] = [];

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    items.push({ month: monthKey(date), revenue: 0, spend: 0, invoiceCount: 0, newUsers: 0 });
  }

  return items;
}

function periodStart(months: number) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
}

function money(value: unknown) {
  if (value === null || value === undefined) return 0;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async refreshOverdueInvoices() {
    await this.prisma.invoice.updateMany({
      where: {
        status: InvoiceStatus.UNPAID,
        dueDate: { lt: firstDayOfTodayUtc() },
      },
      data: { status: InvoiceStatus.OVERDUE },
    });
  }

  async overview(user: User, months: number) {
    await this.refreshOverdueInvoices();

    if (user.role === UserRole.ADMIN) return this.adminOverview(months);
    if (user.role === UserRole.LANDLORD) return this.landlordOverview(user.id, months);
    return this.tenantOverview(user.id, months);
  }

  private async adminOverview(months: number) {
    const start = periodStart(months);

    const [
      totalUsers,
      tenants,
      landlords,
      admins,
      activeUsers,
      suspendedUsers,
      bannedUsers,
      totalProperties,
      activeProperties,
      totalRooms,
      availableRooms,
      reservedRooms,
      rentedRooms,
      maintenanceRooms,
      draftListings,
      pendingListings,
      approvedListings,
      rejectedListings,
      hiddenListings,
      totalContracts,
      activeContracts,
      unpaidInvoices,
      paidInvoices,
      overdueInvoices,
      paidRevenue,
      outstandingRevenue,
      openComplaints,
      investigatingComplaints,
      resolvedComplaints,
      rejectedComplaints,
      recentPaidInvoices,
      recentUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: UserRole.TENANT } }),
      this.prisma.user.count({ where: { role: UserRole.LANDLORD } }),
      this.prisma.user.count({ where: { role: UserRole.ADMIN } }),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.user.count({ where: { status: UserStatus.BANNED } }),
      this.prisma.property.count(),
      this.prisma.property.count({ where: { status: PropertyStatus.ACTIVE } }),
      this.prisma.room.count(),
      this.prisma.room.count({ where: { status: RoomStatus.AVAILABLE } }),
      this.prisma.room.count({ where: { status: RoomStatus.RESERVED } }),
      this.prisma.room.count({ where: { status: RoomStatus.RENTED } }),
      this.prisma.room.count({ where: { status: RoomStatus.MAINTENANCE } }),
      this.prisma.listing.count({ where: { status: ListingStatus.DRAFT } }),
      this.prisma.listing.count({ where: { status: ListingStatus.PENDING } }),
      this.prisma.listing.count({ where: { status: ListingStatus.APPROVED } }),
      this.prisma.listing.count({ where: { status: ListingStatus.REJECTED } }),
      this.prisma.listing.count({ where: { status: ListingStatus.HIDDEN } }),
      this.prisma.contract.count(),
      this.prisma.contract.count({ where: { status: ContractStatus.ACTIVE } }),
      this.prisma.invoice.count({ where: { status: InvoiceStatus.UNPAID } }),
      this.prisma.invoice.count({ where: { status: InvoiceStatus.PAID } }),
      this.prisma.invoice.count({ where: { status: InvoiceStatus.OVERDUE } }),
      this.prisma.invoice.aggregate({ where: { status: InvoiceStatus.PAID }, _sum: { total: true } }),
      this.prisma.invoice.aggregate({
        where: { status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.OVERDUE] } },
        _sum: { total: true },
      }),
      this.prisma.complaint.count({ where: { status: ComplaintStatus.OPEN } }),
      this.prisma.complaint.count({ where: { status: ComplaintStatus.INVESTIGATING } }),
      this.prisma.complaint.count({ where: { status: ComplaintStatus.RESOLVED } }),
      this.prisma.complaint.count({ where: { status: ComplaintStatus.REJECTED } }),
      this.prisma.invoice.findMany({
        where: { status: InvoiceStatus.PAID, paidAt: { gte: start } },
        select: { total: true, paidAt: true },
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: start } },
        select: { createdAt: true },
      }),
    ]);

    const monthly = makeMonthBuckets(months);
    const bucketMap = new Map(monthly.map((item) => [item.month, item]));

    for (const invoice of recentPaidInvoices) {
      if (!invoice.paidAt) continue;
      const bucket = bucketMap.get(monthKey(invoice.paidAt));
      if (!bucket) continue;
      bucket.revenue += money(invoice.total);
      bucket.invoiceCount += 1;
    }

    for (const account of recentUsers) {
      const bucket = bucketMap.get(monthKey(account.createdAt));
      if (bucket) bucket.newUsers += 1;
    }

    const rentableRooms = availableRooms + reservedRooms + rentedRooms;

    return {
      role: UserRole.ADMIN,
      months,
      generatedAt: new Date().toISOString(),
      summary: {
        totalUsers,
        totalProperties,
        totalRooms,
        activeContracts,
        paidRevenue: money(paidRevenue._sum.total),
        outstandingRevenue: money(outstandingRevenue._sum.total),
        occupancyRate: rentableRooms > 0 ? Math.round((rentedRooms / rentableRooms) * 1000) / 10 : 0,
      },
      users: { total: totalUsers, tenants, landlords, admins, active: activeUsers, suspended: suspendedUsers, banned: bannedUsers },
      properties: { total: totalProperties, active: activeProperties },
      rooms: { total: totalRooms, available: availableRooms, reserved: reservedRooms, rented: rentedRooms, maintenance: maintenanceRooms },
      listings: { draft: draftListings, pending: pendingListings, approved: approvedListings, rejected: rejectedListings, hidden: hiddenListings },
      contracts: { total: totalContracts, active: activeContracts },
      invoices: { unpaid: unpaidInvoices, paid: paidInvoices, overdue: overdueInvoices },
      complaints: { open: openComplaints, investigating: investigatingComplaints, resolved: resolvedComplaints, rejected: rejectedComplaints },
      monthly,
    };
  }

  private async landlordOverview(landlordId: string, months: number) {
    const start = periodStart(months);
    const landlordRoomWhere = { property: { landlordId } };
    const landlordListingWhere = { room: { property: { landlordId } } };
    const landlordInvoiceWhere = { contract: { landlordId } };

    const [
      properties,
      activeProperties,
      totalRooms,
      availableRooms,
      reservedRooms,
      rentedRooms,
      maintenanceRooms,
      draftListings,
      pendingListings,
      approvedListings,
      rejectedListings,
      hiddenListings,
      activeContracts,
      totalContracts,
      pendingAppointments,
      confirmedAppointments,
      completedAppointments,
      unpaidInvoices,
      paidInvoices,
      overdueInvoices,
      collectedRevenue,
      outstandingRevenue,
      recentPaidInvoices,
    ] = await Promise.all([
      this.prisma.property.count({ where: { landlordId } }),
      this.prisma.property.count({ where: { landlordId, status: PropertyStatus.ACTIVE } }),
      this.prisma.room.count({ where: landlordRoomWhere }),
      this.prisma.room.count({ where: { ...landlordRoomWhere, status: RoomStatus.AVAILABLE } }),
      this.prisma.room.count({ where: { ...landlordRoomWhere, status: RoomStatus.RESERVED } }),
      this.prisma.room.count({ where: { ...landlordRoomWhere, status: RoomStatus.RENTED } }),
      this.prisma.room.count({ where: { ...landlordRoomWhere, status: RoomStatus.MAINTENANCE } }),
      this.prisma.listing.count({ where: { ...landlordListingWhere, status: ListingStatus.DRAFT } }),
      this.prisma.listing.count({ where: { ...landlordListingWhere, status: ListingStatus.PENDING } }),
      this.prisma.listing.count({ where: { ...landlordListingWhere, status: ListingStatus.APPROVED } }),
      this.prisma.listing.count({ where: { ...landlordListingWhere, status: ListingStatus.REJECTED } }),
      this.prisma.listing.count({ where: { ...landlordListingWhere, status: ListingStatus.HIDDEN } }),
      this.prisma.contract.count({ where: { landlordId, status: ContractStatus.ACTIVE } }),
      this.prisma.contract.count({ where: { landlordId } }),
      this.prisma.appointment.count({ where: { landlordId, status: AppointmentStatus.PENDING } }),
      this.prisma.appointment.count({ where: { landlordId, status: AppointmentStatus.CONFIRMED } }),
      this.prisma.appointment.count({ where: { landlordId, status: AppointmentStatus.COMPLETED } }),
      this.prisma.invoice.count({ where: { ...landlordInvoiceWhere, status: InvoiceStatus.UNPAID } }),
      this.prisma.invoice.count({ where: { ...landlordInvoiceWhere, status: InvoiceStatus.PAID } }),
      this.prisma.invoice.count({ where: { ...landlordInvoiceWhere, status: InvoiceStatus.OVERDUE } }),
      this.prisma.invoice.aggregate({ where: { ...landlordInvoiceWhere, status: InvoiceStatus.PAID }, _sum: { total: true } }),
      this.prisma.invoice.aggregate({
        where: { ...landlordInvoiceWhere, status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.OVERDUE] } },
        _sum: { total: true },
      }),
      this.prisma.invoice.findMany({
        where: { ...landlordInvoiceWhere, status: InvoiceStatus.PAID, paidAt: { gte: start } },
        select: { total: true, paidAt: true },
      }),
    ]);

    const monthly = makeMonthBuckets(months);
    const bucketMap = new Map(monthly.map((item) => [item.month, item]));
    for (const invoice of recentPaidInvoices) {
      if (!invoice.paidAt) continue;
      const bucket = bucketMap.get(monthKey(invoice.paidAt));
      if (!bucket) continue;
      bucket.revenue += money(invoice.total);
      bucket.invoiceCount += 1;
    }

    const rentableRooms = availableRooms + reservedRooms + rentedRooms;

    return {
      role: UserRole.LANDLORD,
      months,
      generatedAt: new Date().toISOString(),
      summary: {
        properties,
        totalRooms,
        activeContracts,
        collectedRevenue: money(collectedRevenue._sum.total),
        outstandingRevenue: money(outstandingRevenue._sum.total),
        occupancyRate: rentableRooms > 0 ? Math.round((rentedRooms / rentableRooms) * 1000) / 10 : 0,
      },
      properties: { total: properties, active: activeProperties },
      rooms: { total: totalRooms, available: availableRooms, reserved: reservedRooms, rented: rentedRooms, maintenance: maintenanceRooms },
      listings: { draft: draftListings, pending: pendingListings, approved: approvedListings, rejected: rejectedListings, hidden: hiddenListings },
      contracts: { total: totalContracts, active: activeContracts },
      appointments: { pending: pendingAppointments, confirmed: confirmedAppointments, completed: completedAppointments },
      invoices: { unpaid: unpaidInvoices, paid: paidInvoices, overdue: overdueInvoices },
      monthly,
    };
  }

  private async tenantOverview(tenantId: string, months: number) {
    const start = periodStart(months);
    const tenantInvoiceWhere = { contract: { tenantId } };

    const [
      favorites,
      pendingAppointments,
      confirmedAppointments,
      completedAppointments,
      totalContracts,
      activeContracts,
      unpaidInvoices,
      paidInvoices,
      overdueInvoices,
      totalSpent,
      outstanding,
      reviews,
      recentPaidInvoices,
      currentRentals,
    ] = await Promise.all([
      this.prisma.favorite.count({ where: { tenantId } }),
      this.prisma.appointment.count({ where: { tenantId, status: AppointmentStatus.PENDING } }),
      this.prisma.appointment.count({ where: { tenantId, status: AppointmentStatus.CONFIRMED } }),
      this.prisma.appointment.count({ where: { tenantId, status: AppointmentStatus.COMPLETED } }),
      this.prisma.contract.count({ where: { tenantId } }),
      this.prisma.contract.count({ where: { tenantId, status: ContractStatus.ACTIVE } }),
      this.prisma.invoice.count({ where: { ...tenantInvoiceWhere, status: InvoiceStatus.UNPAID } }),
      this.prisma.invoice.count({ where: { ...tenantInvoiceWhere, status: InvoiceStatus.PAID } }),
      this.prisma.invoice.count({ where: { ...tenantInvoiceWhere, status: InvoiceStatus.OVERDUE } }),
      this.prisma.invoice.aggregate({ where: { ...tenantInvoiceWhere, status: InvoiceStatus.PAID }, _sum: { total: true } }),
      this.prisma.invoice.aggregate({
        where: { ...tenantInvoiceWhere, status: { in: [InvoiceStatus.UNPAID, InvoiceStatus.OVERDUE] } },
        _sum: { total: true },
      }),
      this.prisma.review.count({ where: { tenantId } }),
      this.prisma.invoice.findMany({
        where: { ...tenantInvoiceWhere, status: InvoiceStatus.PAID, paidAt: { gte: start } },
        select: { total: true, paidAt: true },
      }),
      this.prisma.contract.findMany({
        where: { tenantId, status: ContractStatus.ACTIVE },
        orderBy: { startDate: "desc" },
        take: 5,
        select: {
          id: true,
          startDate: true,
          endDate: true,
          monthlyRent: true,
          room: {
            select: {
              id: true,
              title: true,
              roomNumber: true,
              property: { select: { id: true, name: true, address: true, district: true, city: true } },
            },
          },
        },
      }),
    ]);

    const monthly = makeMonthBuckets(months);
    const bucketMap = new Map(monthly.map((item) => [item.month, item]));
    for (const invoice of recentPaidInvoices) {
      if (!invoice.paidAt) continue;
      const bucket = bucketMap.get(monthKey(invoice.paidAt));
      if (!bucket) continue;
      bucket.spend += money(invoice.total);
      bucket.invoiceCount += 1;
    }

    return {
      role: UserRole.TENANT,
      months,
      generatedAt: new Date().toISOString(),
      summary: {
        favorites,
        activeContracts,
        totalSpent: money(totalSpent._sum.total),
        outstanding: money(outstanding._sum.total),
        overdueInvoices,
      },
      appointments: { pending: pendingAppointments, confirmed: confirmedAppointments, completed: completedAppointments },
      contracts: { total: totalContracts, active: activeContracts },
      invoices: { unpaid: unpaidInvoices, paid: paidInvoices, overdue: overdueInvoices },
      reviews,
      currentRentals,
      monthly,
    };
  }
}
