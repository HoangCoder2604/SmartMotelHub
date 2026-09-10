import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { UserStatus } from "../../generated/prisma/client.js";
import { AuthService } from "../auth.service.js";
import type { AuthRequest } from "../types/auth-request.js";

@Injectable()
export class RegisteredUserGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const firebaseUser = request.firebaseUser;

    if (!firebaseUser) {
      throw new UnauthorizedException("Firebase authentication chưa được xác minh.");
    }

    const user = await this.authService.getUserOrThrow(firebaseUser.uid);
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException("Tài khoản đang bị tạm khóa.");
    }
    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException("Tài khoản đã bị khóa.");
    }

    request.currentUser = user;
    return true;
  }
}
