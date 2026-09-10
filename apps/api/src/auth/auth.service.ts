import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { DecodedIdToken } from "firebase-admin/auth";
import { UserRole } from "../generated/prisma/client.js";
import { PrismaService } from "../database/prisma.service.js";
import type { BootstrapUserDto } from "./dto/bootstrap-user.dto.js";
import type { UpdateProfileDto } from "./dto/update-profile.dto.js";

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async findByFirebaseUid(firebaseUid: string) {
    return this.prisma.user.findUnique({ where: { firebaseUid } });
  }

  async bootstrapUser(token: DecodedIdToken, dto: BootstrapUserDto) {
    const existingByUid = await this.prisma.user.findUnique({
      where: { firebaseUid: token.uid },
    });

    if (existingByUid) {
      return this.prisma.user.update({
        where: { id: existingByUid.id },
        data: {
          email: token.email ?? existingByUid.email,
          phone: token.phone_number ?? existingByUid.phone,
          avatarUrl: token.picture ?? existingByUid.avatarUrl,
          emailVerified: Boolean(token.email_verified),
          phoneVerified: Boolean(token.phone_number),
        },
      });
    }

    const email = token.email ?? null;
    const phone = token.phone_number ?? null;

    if (email) {
      const existingByEmail = await this.prisma.user.findUnique({ where: { email } });
      if (existingByEmail) {
        if (existingByEmail.firebaseUid && existingByEmail.firebaseUid !== token.uid) {
          throw new ConflictException("Email này đã liên kết với một tài khoản khác.");
        }

        return this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            firebaseUid: token.uid,
            phone: phone ?? existingByEmail.phone,
            avatarUrl: token.picture ?? existingByEmail.avatarUrl,
            emailVerified: Boolean(token.email_verified),
            phoneVerified: Boolean(phone),
          },
        });
      }
    }

    if (phone) {
      const existingByPhone = await this.prisma.user.findUnique({ where: { phone } });
      if (existingByPhone) {
        if (existingByPhone.firebaseUid && existingByPhone.firebaseUid !== token.uid) {
          throw new ConflictException("Số điện thoại này đã liên kết với một tài khoản khác.");
        }

        return this.prisma.user.update({
          where: { id: existingByPhone.id },
          data: {
            firebaseUid: token.uid,
            email: email ?? existingByPhone.email,
            avatarUrl: token.picture ?? existingByPhone.avatarUrl,
            emailVerified: Boolean(token.email_verified),
            phoneVerified: true,
          },
        });
      }
    }

    const fallbackName = token.name || email?.split("@")[0] || phone || "SmartMotel User";
    const selectedRole = dto.role === "LANDLORD" ? UserRole.LANDLORD : UserRole.TENANT;

    return this.prisma.user.create({
      data: {
        firebaseUid: token.uid,
        email,
        phone,
        fullName: dto.fullName?.trim() || fallbackName,
        avatarUrl: token.picture ?? null,
        role: selectedRole,
        emailVerified: Boolean(token.email_verified),
        phoneVerified: Boolean(phone),
      },
    });
  }

  async syncVerification(userId: string, token: DecodedIdToken) {
    const data: {
      email?: string;
      phone?: string;
      avatarUrl?: string;
      emailVerified?: boolean;
      phoneVerified?: boolean;
    } = {};

    if (token.email) {
      data.email = token.email;
      data.emailVerified = Boolean(token.email_verified);
    }

    if (token.phone_number) {
      data.phone = token.phone_number;
      data.phoneVerified = true;
    }

    if (token.picture) {
      data.avatarUrl = token.picture;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async getUserOrThrow(firebaseUid: string) {
    const user = await this.findByFirebaseUid(firebaseUid);
    if (!user) {
      throw new NotFoundException("Tài khoản Firebase chưa được khởi tạo trong SmartMotel Hub.");
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });
  }
}
