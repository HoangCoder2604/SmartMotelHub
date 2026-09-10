import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthRequest } from "../types/auth-request.js";

/**
 * Dùng SAU FirebaseAuthGuard + RegisteredUserGuard trên các endpoint quan trọng
 * cần email đã xác minh, ví dụ: đặt lịch, đăng tin, review.
 *
 * Tài khoản phone-only không có email sẽ không bị guard này chặn; khi đó module
 * nghiệp vụ có thể yêu cầu phoneVerified bằng guard riêng nếu cần.
 */
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const user = request.currentUser;

    if (!user) {
      throw new ForbiddenException("Chưa có hồ sơ SmartMotel để kiểm tra xác minh email.");
    }

    if (user.email && !user.emailVerified) {
      throw new ForbiddenException("Bạn cần xác minh email trước khi thực hiện chức năng này.");
    }

    return true;
  }
}
