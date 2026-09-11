import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { FirebaseAdminService } from "../auth/firebase-admin.service.js";
import { PrismaService } from "../database/prisma.service.js";

export type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  href?: string | null;
};

const INVALID_FCM_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseAdmin: FirebaseAdminService,
  ) {}

  async notify(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        href: input.href ?? null,
      },
    });

    // Push là best-effort: nếu FCM lỗi thì nghiệp vụ chính vẫn thành công và
    // thông báo in-app vẫn được lưu trong PostgreSQL.
    void this.sendPushForNotification(notification).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Không thể gửi FCM push: ${message}`);
    });

    return notification;
  }

  private async sendPushForNotification(notification: {
    id: string;
    userId: string;
    type: string;
    title: string;
    message: string;
    href: string | null;
  }) {
    const devices = await this.prisma.pushDevice.findMany({
      where: { userId: notification.userId },
      orderBy: { lastSeenAt: "desc" },
      take: 20,
      select: { token: true },
    });

    if (!devices.length) return;

    const tokens = devices.map((device) => device.token);
    const batches = await this.firebaseAdmin.sendPushToTokens(tokens, {
      title: notification.title,
      body: notification.message,
      href: notification.href,
      type: notification.type,
      notificationId: notification.id,
    });

    const invalidTokens: string[] = [];
    let tokenOffset = 0;
    for (const batch of batches) {
      batch.responses.forEach((response, index) => {
        if (!response.success && response.error?.code && INVALID_FCM_CODES.has(response.error.code)) {
          invalidTokens.push(tokens[tokenOffset + index]);
        }
      });
      tokenOffset += batch.responses.length;
    }

    if (invalidTokens.length) {
      await this.prisma.pushDevice.deleteMany({ where: { token: { in: invalidTokens } } });
    }
  }

  async registerPushDevice(userId: string, token: string, userAgent?: string | null) {
    const existing = await this.prisma.pushDevice.findUnique({
      where: { token },
      select: { userId: true },
    });

    if (existing && existing.userId !== userId) {
      throw new ConflictException(
        "Thiết bị này đang được liên kết với tài khoản khác. Hãy đăng xuất đúng cách ở tài khoản cũ rồi thử lại.",
      );
    }

    const device = await this.prisma.pushDevice.upsert({
      where: { token },
      create: {
        userId,
        token,
        platform: "WEB",
        userAgent: userAgent?.slice(0, 500) || null,
        lastSeenAt: new Date(),
      },
      update: {
        userAgent: userAgent?.slice(0, 500) || null,
        lastSeenAt: new Date(),
      },
      select: { id: true, platform: true, lastSeenAt: true },
    });

    return device;
  }

  async unregisterPushDevice(userId: string, token: string) {
    await this.prisma.pushDevice.deleteMany({ where: { userId, token } });
    return { success: true };
  }

  async pushDeviceStatus(userId: string) {
    const count = await this.prisma.pushDevice.count({ where: { userId } });
    return { registeredDevices: count };
  }

  async list(userId: string) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return { items, unreadCount };
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
      select: { id: true, readAt: true },
    });

    if (!notification) throw new NotFoundException("Không tìm thấy thông báo.");
    if (notification.readAt) return notification;

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    return { success: true };
  }

  async deleteOne(userId: string, id: string) {
    const result = await this.prisma.notification.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      throw new NotFoundException("Không tìm thấy thông báo.");
    }

    return { deletedCount: result.count };
  }

  async deleteRead(userId: string) {
    const result = await this.prisma.notification.deleteMany({
      where: { userId, readAt: { not: null } },
    });

    return { deletedCount: result.count };
  }

  async deleteAll(userId: string) {
    const result = await this.prisma.notification.deleteMany({
      where: { userId },
    });

    return { deletedCount: result.count };
  }
}
